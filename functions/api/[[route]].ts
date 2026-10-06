import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { createAdminToken, createVipToken, verifyToken } from './jwt'

export interface Env {
  DB: D1Database
  R2?: any
  JWT_SECRET?: string
}

const app = new Hono<{ Bindings: Env }>().basePath('/api')

app.use('*', cors())

// Ensure media_assets table exists
async function ensureMediaTable(db: D1Database) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        url TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT,
        storage_type TEXT DEFAULT 'base64',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch {
    // ignore if table exists
  }
}

// Helper for D1 operations
async function getSetting(db: D1Database, key: string, defaultValue = ''): Promise<string> {
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
    return row ? row.value : defaultValue
  } catch {
    return defaultValue
  }
}

// Check admin authorization middleware
async function requireAdmin(c: any, next: any) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Admin login required' }, 401)
  }
  const token = authHeader.substring(7)
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Forbidden: Invalid admin token' }, 403)
  }
  c.set('adminUser', payload)
  await next()
}

// ----------------------------------------------------
// Public & Auth Routes
// ----------------------------------------------------

// Admin Login
app.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { password } = body

  const db = c.env.DB
  const currentPassword = await getSetting(db, 'admin_password', 'admin123')

  if (password !== currentPassword) {
    return c.json({ success: false, message: '管理密码错误，请重试' }, 401)
  }

  const token = await createAdminToken('admin')
  return c.json({ success: true, token, message: '登录成功' })
})

// Check token status
app.get('/auth/check', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ authenticated: false })
  }
  const token = authHeader.substring(7)
  const payload = await verifyToken(token)
  return c.json({ authenticated: !!(payload && payload.role === 'admin') })
})

// Public site settings
app.get('/settings', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare('SELECT key, value FROM settings WHERE key != "admin_password"').all<{ key: string; value: string }>()
  const map: Record<string, string> = {
    site_name: '智汇知识库 · 付费专属专栏',
    site_description: '深度行业认知、独家实战手册与干货知识精选',
    author_name: '专栏主理人',
    pay_notice: '本专栏内容为专属知识付费内容。如需开通访问权限，请联系主理人微信获取专属VIP密码。',
    contact_wechat: 'wx_creator_888',
    contact_qr_url: '',
  }
  for (const row of settingsRows.results || []) {
    map[row.key] = row.value
  }
  return c.json(map)
})

// Update settings (Admin)
app.post('/settings', requireAdmin, async (c) => {
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  const validKeys = [
    'site_name',
    'site_description',
    'author_name',
    'pay_notice',
    'contact_wechat',
    'contact_qr_url',
    'admin_password'
  ]

  for (const [key, val] of Object.entries(body)) {
    if (validKeys.includes(key) && typeof val === 'string') {
      await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(key, val)
        .run()
    }
  }

  return c.json({ success: true, message: '设置已成功保存' })
})

// Dashboard Stats (Admin)
app.get('/stats', requireAdmin, async (c) => {
  const db = c.env.DB
  const totalDocs = (await db.prepare('SELECT COUNT(*) as count FROM docs').first<{ count: number }>())?.count || 0
  const publishedDocs = (await db.prepare('SELECT COUNT(*) as count FROM docs WHERE is_published = 1').first<{ count: number }>())?.count || 0
  const totalCodes = (await db.prepare('SELECT COUNT(*) as count FROM access_codes').first<{ count: number }>())?.count || 0
  const activeCodes = (await db.prepare('SELECT COUNT(*) as count FROM access_codes WHERE is_active = 1').first<{ count: number }>())?.count || 0
  const totalViews = (await db.prepare('SELECT SUM(views_count) as count FROM docs').first<{ count: number }>())?.count || 0
  const totalUsage = (await db.prepare('SELECT SUM(usage_count) as count FROM access_codes').first<{ count: number }>())?.count || 0

  return c.json({
    totalDocs,
    publishedDocs,
    totalCodes,
    activeCodes,
    totalViews,
    totalUsage
  })
})

// ----------------------------------------------------
// VIP Passcode & Paywall Verification
// ----------------------------------------------------

// Verify user passcode
app.post('/access/verify', async (c) => {
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))
  const rawCode = (body.code || '').trim()
  const docId = body.docId || null

  if (!rawCode) {
    return c.json({ success: false, message: '请输入专属访问密码' }, 400)
  }

  const row = await db.prepare('SELECT * FROM access_codes WHERE code = ?').bind(rawCode).first<any>()

  if (!row) {
    return c.json({ success: false, message: '密码不存在或已失效，请联系主理人获取' }, 401)
  }

  if (row.is_active !== 1) {
    return c.json({ success: false, message: '该访问密码已被停用，请联系主理人' }, 403)
  }

  if (row.expires_at) {
    const expireTime = new Date(row.expires_at).getTime()
    if (Date.now() > expireTime) {
      return c.json({ success: false, message: '您的专属访问密码已过期' }, 403)
    }
  }

  if (row.max_uses > 0 && row.usage_count >= row.max_uses) {
    return c.json({ success: false, message: '该访问密码使用次数已达上限' }, 403)
  }

  // Check doc binding: if doc_id is specified, must match requested doc
  if (row.doc_id && docId && row.doc_id !== docId) {
    const boundDoc = await db.prepare('SELECT title FROM docs WHERE id = ?').bind(row.doc_id).first<{ title: string }>()
    return c.json({ success: false, message: `该密码仅适用于单篇文档《${boundDoc?.title || '指定文档'}》，无法解锁当前内容` }, 403)
  }

  // Valid! Increment usage count
  await db.prepare('UPDATE access_codes SET usage_count = usage_count + 1 WHERE id = ?').bind(row.id).run()

  // Log access
  const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || 'unknown'
  await db.prepare('INSERT INTO access_logs (id, code_id, doc_id, ip, user_agent) VALUES (?, ?, ?, ?, ?)')
    .bind(logId, row.id, docId || row.doc_id, clientIp, userAgent)
    .run()

  let docTitle = null
  if (row.doc_id) {
    const boundDoc = await db.prepare('SELECT title FROM docs WHERE id = ?').bind(row.doc_id).first<{ title: string }>()
    docTitle = boundDoc?.title || null
  }

  const token = await createVipToken({
    codeId: row.id,
    code: row.code,
    label: row.label || '',
    docId: row.doc_id || null,
  })

  return c.json({
    success: true,
    token,
    label: row.label,
    canAccessAll: !row.doc_id,
    docId: row.doc_id || null,
    docTitle,
    message: row.doc_id ? `已解锁单篇文档: 《${docTitle || '指定文档'}》` : '已解锁全专栏所有付费文档！'
  })
})

// Passcodes CRUD (Admin)
app.get('/passcodes', requireAdmin, async (c) => {
  const db = c.env.DB
  const list = await db.prepare(`
    SELECT a.*, d.title as doc_title 
    FROM access_codes a 
    LEFT JOIN docs d ON a.doc_id = d.id 
    ORDER BY a.created_at DESC
  `).all<any>()
  return c.json(list.results || [])
})

app.post('/passcodes', requireAdmin, async (c) => {
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  let code = (body.code || '').trim()
  if (!code) {
    // Generate clean readable random code like VIP-9K7X2
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let rand = ''
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    code = 'VIP-' + rand
  }

  // Check unique
  const existing = await db.prepare('SELECT id FROM access_codes WHERE code = ?').bind(code).first()
  if (existing) {
    return c.json({ error: '该密码已存在，请换一个' }, 400)
  }

  const id = 'code_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
  const label = body.label || '学员'
  const doc_id = body.doc_id || null
  const expires_at = body.expires_at || null
  const max_uses = typeof body.max_uses === 'number' ? body.max_uses : -1
  const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1

  await db.prepare(`
    INSERT INTO access_codes (id, code, label, doc_id, is_active, usage_count, max_uses, expires_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(id, code, label, doc_id, is_active, max_uses, expires_at).run()

  return c.json({ success: true, id, code })
})

app.put('/passcodes/:id', requireAdmin, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const code = (body.code || '').trim()
  if (!code) {
    return c.json({ error: '密码不能为空' }, 400)
  }

  // Check if another record uses this code
  const existing = await db.prepare('SELECT id FROM access_codes WHERE code = ? AND id != ?').bind(code, id).first()
  if (existing) {
    return c.json({ error: '该密码已被其他学员使用，请更换' }, 400)
  }

  const label = body.label || ''
  const doc_id = body.doc_id || null
  const expires_at = body.expires_at || null
  const max_uses = typeof body.max_uses === 'number' ? body.max_uses : -1
  const is_active = body.is_active ? 1 : 0

  await db.prepare(`
    UPDATE access_codes 
    SET code = ?, label = ?, doc_id = ?, is_active = ?, max_uses = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(code, label, doc_id, is_active, max_uses, expires_at, id).run()

  return c.json({ success: true, message: '卡密已更新' })
})

app.delete('/passcodes/:id', requireAdmin, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM access_codes WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '密码已删除' })
})

// ----------------------------------------------------
// Documents CRUD
// ----------------------------------------------------

// List documents
app.get('/docs', async (c) => {
  const db = c.env.DB
  const authHeader = c.req.header('Authorization')
  let isAdmin = false
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = await verifyToken(authHeader.substring(7))
    if (payload && payload.role === 'admin') {
      isAdmin = true
    }
  }

  if (isAdmin) {
    // Admin gets all docs (including drafts)
    const list = await db.prepare(`
      SELECT id, title, slug, excerpt, cover_image, is_published, is_vip_only, views_count, order_index, created_at, updated_at
      FROM docs
      ORDER BY order_index ASC, created_at DESC
    `).all<any>()
    return c.json(list.results || [])
  } else {
    // Public only gets published docs, without full content_html for security
    const list = await db.prepare(`
      SELECT id, title, slug, excerpt, cover_image, is_vip_only, views_count, order_index, created_at, updated_at
      FROM docs
      WHERE is_published = 1
      ORDER BY order_index ASC, created_at DESC
    `).all<any>()
    return c.json(list.results || [])
  }
})

// Get single document (with VIP protection gate)
app.get('/docs/:id', async (c) => {
  const db = c.env.DB
  const idOrSlug = c.req.param('id')
  const directKey = c.req.query('key') // Allow ?key=VIP_CODE direct link access

  const doc = await db.prepare(`
    SELECT * FROM docs WHERE id = ? OR slug = ?
  `).bind(idOrSlug, idOrSlug).first<any>()

  if (!doc) {
    return c.json({ error: '文档不存在或已删除' }, 404)
  }

  // Check admin authorization
  const authHeader = c.req.header('Authorization')
  let isAdmin = false
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = await verifyToken(authHeader.substring(7))
    if (payload && payload.role === 'admin') {
      isAdmin = true
    }
  }

  if (isAdmin) {
    return c.json({ ...doc, isAuthorized: true })
  }

  // If document is not published and not admin
  if (doc.is_published !== 1) {
    return c.json({ error: '该文档尚未公开发布' }, 403)
  }

  // If document is free (not vip only), everyone can view
  if (doc.is_vip_only !== 1) {
    await db.prepare('UPDATE docs SET views_count = views_count + 1 WHERE id = ?').bind(doc.id).run()
    return c.json({ ...doc, isAuthorized: true })
  }

  // VIP document access check
  let isAuthorized = false
  let userLabel = ''

  // 1. Direct query param key check
  if (directKey) {
    const codeRow = await db.prepare('SELECT * FROM access_codes WHERE code = ?').bind(directKey.trim()).first<any>()
    if (codeRow && codeRow.is_active === 1) {
      const isExpired = codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()
      const isLimitExceeded = codeRow.max_uses > 0 && codeRow.usage_count >= codeRow.max_uses
      const isDocMatched = !codeRow.doc_id || codeRow.doc_id === doc.id
      if (!isExpired && !isLimitExceeded && isDocMatched) {
        isAuthorized = true
        userLabel = codeRow.label || ''
        await db.prepare('UPDATE access_codes SET usage_count = usage_count + 1 WHERE id = ?').bind(codeRow.id).run()
      }
    }
  }

  // 2. VIP Token in header
  if (!isAuthorized) {
    const vipToken = c.req.header('X-Access-Token')
    if (vipToken) {
      const payload = await verifyToken(vipToken)
      if (payload && payload.role === 'vip') {
        // Verify against DB if code is still active
        const codeRow = await db.prepare('SELECT * FROM access_codes WHERE id = ?').bind(payload.codeId).first<any>()
        if (codeRow && codeRow.is_active === 1) {
          const isExpired = codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()
          const isDocMatched = !codeRow.doc_id || codeRow.doc_id === doc.id
          if (!isExpired && isDocMatched) {
            isAuthorized = true
            userLabel = codeRow.label || ''
          }
        }
      }
    }
  }

  if (isAuthorized) {
    // Record view
    await db.prepare('UPDATE docs SET views_count = views_count + 1 WHERE id = ?').bind(doc.id).run()
    return c.json({ ...doc, isAuthorized: true, userLabel })
  }

  // Unauthorized: Return teaser info only (paywall lock)
  return c.json({
    id: doc.id,
    title: doc.title,
    excerpt: doc.excerpt,
    cover_image: doc.cover_image,
    is_vip_only: 1,
    isAuthorized: false,
    message: '此内容为付费专属文档，请输入专属密码解锁'
  }, 401)
})

// Create document (Admin)
app.post('/docs', requireAdmin, async (c) => {
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))

  const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
  const title = (body.title || '无标题文档').trim()
  const slug = body.slug || id
  const excerpt = body.excerpt || ''
  const cover_image = body.cover_image || ''
  const content_html = body.content_html || '<p></p>'
  const content_json = typeof body.content_json === 'string' ? body.content_json : JSON.stringify(body.content_json || {})
  const is_published = body.is_published !== undefined ? (body.is_published ? 1 : 0) : 1
  const is_vip_only = body.is_vip_only !== undefined ? (body.is_vip_only ? 1 : 0) : 1
  const order_index = typeof body.order_index === 'number' ? body.order_index : 0

  await db.prepare(`
    INSERT INTO docs (id, title, slug, excerpt, cover_image, content_html, content_json, is_published, is_vip_only, views_count, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).bind(id, title, slug, excerpt, cover_image, content_html, content_json, is_published, is_vip_only, order_index).run()

  return c.json({ success: true, id, message: '文档创建成功' })
})

// Update document (Admin)
app.put('/docs/:id', requireAdmin, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const title = (body.title || '无标题文档').trim()
  const slug = body.slug || id
  const excerpt = body.excerpt || ''
  const cover_image = body.cover_image || ''
  const content_html = body.content_html || '<p></p>'
  const content_json = typeof body.content_json === 'string' ? body.content_json : JSON.stringify(body.content_json || {})
  const is_published = body.is_published !== undefined ? (body.is_published ? 1 : 0) : 1
  const is_vip_only = body.is_vip_only !== undefined ? (body.is_vip_only ? 1 : 0) : 1
  const order_index = typeof body.order_index === 'number' ? body.order_index : 0

  await db.prepare(`
    UPDATE docs 
    SET title = ?, slug = ?, excerpt = ?, cover_image = ?, content_html = ?, content_json = ?, 
        is_published = ?, is_vip_only = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(title, slug, excerpt, cover_image, content_html, content_json, is_published, is_vip_only, order_index, id).run()

  return c.json({ success: true, message: '文档已保存' })
})

// Delete document (Admin)
app.delete('/docs/:id', requireAdmin, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare('DELETE FROM docs WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '文档已删除' })
})

// Image upload support (stores to R2 if configured, otherwise compressed Base64)
app.post('/upload', requireAdmin, async (c) => {
  try {
    const db = c.env.DB
    await ensureMediaTable(db)

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return c.json({ error: '未检测到文件' }, 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const mimeType = file.type || 'image/jpeg'
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('gif') ? 'gif' : 'jpg'
    const key = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`

    // 1. If Cloudflare R2 is bound
    if (c.env.R2) {
      await c.env.R2.put(key, arrayBuffer, {
        httpMetadata: { contentType: mimeType }
      })
      const url = `/api/images/${key}`
      await db.prepare(`
        INSERT INTO media_assets (id, filename, url, size, mime_type, storage_type)
        VALUES (?, ?, ?, ?, ?, 'r2')
      `).bind(key, file.name || key, url, arrayBuffer.byteLength, mimeType).run().catch(() => {})

      return c.json({ success: true, url, key, size: arrayBuffer.byteLength, storage: 'r2', message: '已上传至 R2 对象存储' })
    }

    // 2. Fallback to Base64 in D1
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const dataUrl = `data:${mimeType};base64,${base64}`

    await db.prepare(`
      INSERT INTO media_assets (id, filename, url, size, mime_type, storage_type)
      VALUES (?, ?, ?, ?, ?, 'base64')
    `).bind(key, file.name || key, dataUrl, arrayBuffer.byteLength, mimeType).run().catch(() => {})

    return c.json({ success: true, url: dataUrl, key, size: arrayBuffer.byteLength, storage: 'd1', message: '已上传并压缩存储' })
  } catch (err: any) {
    return c.json({ error: err.message || '上传失败' }, 500)
  }
})

// Proxy external image (Feishu, Notion, WeChat) into permanent R2 / Base64
app.post('/proxy-image', requireAdmin, async (c) => {
  try {
    const db = c.env.DB
    await ensureMediaTable(db)

    const body = await c.req.json().catch(() => ({}))
    const { url } = body
    if (!url || typeof url !== 'string') {
      return c.json({ error: '请提供图片 URL' }, 400)
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    })

    if (!res.ok) {
      return c.json({ error: `无法获取该图片，状态码: ${res.status}` }, 400)
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await res.arrayBuffer()
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const key = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`

    // 1. If R2 is configured
    if (c.env.R2) {
      await c.env.R2.put(key, arrayBuffer, {
        httpMetadata: { contentType }
      })
      const finalUrl = `/api/images/${key}`
      await db.prepare(`
        INSERT INTO media_assets (id, filename, url, size, mime_type, storage_type)
        VALUES (?, ?, ?, ?, ?, 'r2')
      `).bind(key, key, finalUrl, arrayBuffer.byteLength, contentType).run().catch(() => {})

      return c.json({ success: true, url: finalUrl, dataUrl: finalUrl, key, size: arrayBuffer.byteLength, storage: 'r2' })
    }

    // 2. Fallback to Base64
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const dataUrl = `data:${contentType};base64,${base64}`

    await db.prepare(`
      INSERT INTO media_assets (id, filename, url, size, mime_type, storage_type)
      VALUES (?, ?, ?, ?, ?, 'base64')
    `).bind(key, key, dataUrl, arrayBuffer.byteLength, contentType).run().catch(() => {})

    return c.json({ success: true, url: dataUrl, dataUrl, key, size: arrayBuffer.byteLength, storage: 'd1' })
  } catch (err: any) {
    return c.json({ error: err.message || '转存图片失败' }, 500)
  }
})

// Serve R2 images
app.get('/images/:key', async (c) => {
  const key = c.req.param('key')
  if (c.env.R2) {
    const object = await c.env.R2.get(key)
    if (object) {
      const headers = new Headers()
      headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg')
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(object.body, { headers })
    }
  }

  // Fallback to D1 media_assets
  try {
    const db = c.env.DB
    const row = await db.prepare('SELECT url, mime_type FROM media_assets WHERE id = ?').bind(key).first<any>()
    if (row && row.url.startsWith('data:')) {
      const parts = row.url.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
      const binary = atob(parts[1])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return new Response(bytes.buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400'
        }
      })
    }
  } catch {}

  return c.text('Image not found', 404)
})

// Get Media & Storage Stats (Admin)
app.get('/media/stats', requireAdmin, async (c) => {
  const db = c.env.DB
  await ensureMediaTable(db)

  // 1. If R2 is available
  if (c.env.R2) {
    try {
      const list = await c.env.R2.list({ limit: 1000 })
      const totalBytes = list.objects.reduce((sum: number, o: any) => sum + (o.size || 0), 0)
      const objects = list.objects.map((o: any) => ({
        key: o.key,
        url: `/api/images/${o.key}`,
        size: o.size,
        uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : new Date().toISOString(),
        contentType: o.httpMetadata?.contentType || 'image/jpeg'
      }))

      return c.json({
        engine: 'r2',
        r2Configured: true,
        bucketName: 'knowledge-images',
        totalCount: list.objects.length,
        totalBytes,
        freeQuotaBytes: 10 * 1024 * 1024 * 1024, // 10 GB
        objects
      })
    } catch {}
  }

  // 2. D1 Storage mode
  const rows = await db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC LIMIT 500').all<any>()
  const items = rows.results || []
  let totalBytes = items.reduce((sum: number, r: any) => sum + (r.size || 0), 0)

  // If media_assets is empty, estimate from docs table
  if (items.length === 0) {
    const docs = await db.prepare('SELECT content_html FROM docs').all<{ content_html: string }>()
    for (const d of docs.results || []) {
      const matches = d.content_html?.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g) || []
      for (const m of matches) {
        totalBytes += Math.round(m.length * 0.75)
      }
    }
  }

  const objects = items.map((r: any) => ({
    key: r.id,
    url: r.url,
    size: r.size,
    uploaded: r.created_at,
    contentType: r.mime_type
  }))

  return c.json({
    engine: 'd1',
    r2Configured: false,
    bucketName: undefined,
    totalCount: items.length,
    totalBytes,
    freeQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    objects
  })
})

// Delete single image (Admin) - releases R2 & D1 storage
app.delete('/media/:key', requireAdmin, async (c) => {
  const db = c.env.DB
  await ensureMediaTable(db)
  const key = c.req.param('key')

  if (c.env.R2) {
    try {
      await c.env.R2.delete(key)
    } catch {}
  }

  await db.prepare('DELETE FROM media_assets WHERE id = ? OR filename = ?').bind(key, key).run().catch(() => {})

  return c.json({ success: true, message: '图片已成功删除，存储空间已释放' })
})

// Batch delete images (Admin)
app.post('/media/delete-batch', requireAdmin, async (c) => {
  const db = c.env.DB
  await ensureMediaTable(db)
  const body = await c.req.json().catch(() => ({}))
  const keys: string[] = body.keys || []

  if (Array.isArray(keys)) {
    for (const key of keys) {
      if (c.env.R2) {
        try {
          await c.env.R2.delete(key)
        } catch {}
      }
      await db.prepare('DELETE FROM media_assets WHERE id = ? OR filename = ?').bind(key, key).run().catch(() => {})
    }
  }

  return c.json({ success: true, deletedCount: keys.length, message: `已成功删除 ${keys.length} 张图片，存储资源已释放` })
})

export const onRequest = handle(app)
export default app
