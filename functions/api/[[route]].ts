import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { createAdminToken, createVipToken, verifyToken } from './jwt'

export interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const app = new Hono<{ Bindings: Env }>().basePath('/api')

app.use('*', cors())

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

// Image upload support (returns data URL or base64)
app.post('/upload', requireAdmin, async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return c.json({ error: '未检测到文件' }, 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    return c.json({ url: dataUrl, message: '上传成功' })
  } catch (err: any) {
    return c.json({ error: err.message || '上传失败' }, 500)
  }
})

export const onRequest = handle(app)
export default app
