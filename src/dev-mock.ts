import fs from 'node:fs'
import path from 'node:path'
import { createAdminToken, createVipToken, verifyToken } from '../functions/api/jwt'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'local-db.json')

interface LocalDB {
  docs: any[]
  access_codes: any[]
  settings: Record<string, string>
  access_logs: any[]
}

const defaultDB: LocalDB = {
  settings: {
    site_name: '智汇知识库 · 付费专属专栏',
    site_description: '深度行业认知、独家实战手册与干货知识精选',
    author_name: '专栏主理人',
    admin_password: 'admin123',
    pay_notice: '本专栏内容为专属知识付费内容。如需开通访问权限，请联系主理人微信获取专属VIP密码。',
    contact_wechat: 'wx_creator_888',
    contact_qr_url: '',
  },
  access_codes: [
    {
      id: 'code-demo-1',
      code: 'VIP888',
      label: '演示体验学员 (全库通用VIP)',
      doc_id: null,
      is_active: 1,
      usage_count: 5,
      max_uses: -1,
      expires_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'code-demo-2',
      code: 'VIP666',
      label: '学员张三 (微信咨询)',
      doc_id: null,
      is_active: 1,
      usage_count: 1,
      max_uses: 10,
      expires_at: null,
      created_at: new Date().toISOString(),
    }
  ],
  docs: [
    {
      id: 'welcome-guide',
      title: '🎉 欢迎使用飞书风格知识付费专栏',
      slug: 'welcome-guide',
      excerpt: '这是一份系统使用指引与专属付费内容的排版展示范例，带你了解一人一密专属鉴权与阅读体验。',
      cover_image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80',
      content_html: `<h1>🎉 欢迎阅读付费专属知识库</h1>
<p>这是一篇示例知识文档，采用<strong>飞书/Notion式现代排版</strong>构建，专为知识付费和独家干货分享量身定制。</p>
<h2>✨ 核心特色亮点</h2>
<ul>
  <li><strong>飞书文档般的视觉体验</strong>：沉浸式阅读、双栏大纲目录（TOC）随动、清晰的层次结构与代码高亮。</li>
  <li><strong>一人一密专属授权</strong>：每一个学员/购买者都可以拥有独一无二的专属访问密码，支持随时修改、暂停或设置过期时间。</li>
  <li><strong>防泄露与直达分享</strong>：你可以直接给学员发送专属直达链接 <code>?key=VIP密码</code>，免去学员手动输入的繁琐，体验丝滑。</li>
  <li><strong>全栈部署于 Cloudflare</strong>：借助 Cloudflare 边缘网络与 D1 数据库，全球秒开，免费额度极高。</li>
</ul>
<blockquote><p>💡 <strong>温馨提示</strong>：作为管理员，你可以进入右上角的「管理后台」（默认管理密码：<code>admin123</code>），随时发布新图文、管理所有学员密码、查看访问统计或修改站点公告！</p></blockquote>
<h2>💻 代码与实用示例</h2>
<pre><code>// 示例：专属卡密接入逻辑
const isAuthorized = verifyUserPasscode(userKey, documentId);
if (isAuthorized) {
  renderDocumentContent();
}</code></pre>
<p>祝你的知识付费事业蒸蒸日上！开始撰写你的第一篇高价值文档吧。</p>`,
      content_json: '',
      is_published: 1,
      is_vip_only: 1,
      views_count: 42,
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'doc-ai-prompting',
      title: '🚀 2026 深度AI Prompt提示词实战方法论',
      slug: 'doc-ai-prompting',
      excerpt: '从零构建高可用工作流的顶尖提示词结构设计、少样本思维链与自反思技巧。',
      cover_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      content_html: `<h1>🚀 2026 深度AI Prompt提示词实战方法论</h1>
<p>在大模型时代，<strong>高质量的提示词工程</strong>是将通用AI转化为行业专家的最强武器。</p>
<h2>1. 提示词设计四要素</h2>
<ol>
  <li><strong>Role (角色定义)</strong>：明确身份与能力边界。</li>
  <li><strong>Context (背景上下文)</strong>：给出任务发生的场景与目标受众。</li>
  <li><strong>Task (核心任务)</strong>：清晰无歧义的操作步骤。</li>
  <li><strong>Constraints (输出约束)</strong>：格式、字数、语调以及负向指令。</li>
</ol>
<blockquote><p>🌟 核心秘诀：让模型“先思考，后输出”，通过思维链（Chain of Thought）可以减少 70% 的逻辑幻觉。</p></blockquote>
<h2>2. 高阶思维链模板</h2>
<pre><code>你是一位具有10年经验的首席系统架构师。
请针对分布式高并发场景，评估用户提出的技术选型方案。
在输出结论前，请在 &lt;thinking&gt; 标签中列出 3 个核心风险评估点。</code></pre>`,
      content_json: '',
      is_published: 1,
      is_vip_only: 1,
      views_count: 28,
      order_index: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  access_logs: []
}

function loadDB(): LocalDB {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), 'utf-8')
    return defaultDB
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return defaultDB
  }
}

function saveDB(db: LocalDB) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export function setupDevApiMiddleware() {
  return {
    name: 'dev-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api')) {
          return next()
        }

        const pathname = url.pathname
        const method = req.method

        // Parse JSON body helper
        const parseBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let body = ''
            req.on('data', (chunk: any) => { body += chunk })
            req.on('end', () => {
              try { resolve(JSON.parse(body)) } catch { resolve({}) }
            })
          })
        }

        const sendJson = (status: number, data: any) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }

        const db = loadDB()

        // Auth: Check admin token helper
        const isAdmin = async (): Promise<boolean> => {
          const auth = req.headers['authorization']
          if (!auth || !auth.startsWith('Bearer ')) return false
          const payload = await verifyToken(auth.substring(7))
          return !!(payload && payload.role === 'admin')
        }

        try {
          // POST /api/auth/login
          if (pathname === '/api/auth/login' && method === 'POST') {
            const body = await parseBody()
            const adminPass = db.settings.admin_password || 'admin123'
            if (body.password === adminPass) {
              const token = await createAdminToken('admin')
              return sendJson(200, { success: true, token, message: '登录成功' })
            } else {
              return sendJson(401, { success: false, message: '管理员密码错误' })
            }
          }

          // GET /api/auth/check
          if (pathname === '/api/auth/check' && method === 'GET') {
            const valid = await isAdmin()
            return sendJson(200, { authenticated: valid })
          }

          // GET /api/settings
          if (pathname === '/api/settings' && method === 'GET') {
            const clone = { ...db.settings }
            delete clone.admin_password
            return sendJson(200, clone)
          }

          // POST /api/settings
          if (pathname === '/api/settings' && method === 'POST') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const body = await parseBody()
            Object.assign(db.settings, body)
            saveDB(db)
            return sendJson(200, { success: true, message: '设置保存成功' })
          }

          // GET /api/stats
          if (pathname === '/api/stats' && method === 'GET') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const totalDocs = db.docs.length
            const publishedDocs = db.docs.filter(d => d.is_published).length
            const totalCodes = db.access_codes.length
            const activeCodes = db.access_codes.filter(c => c.is_active).length
            const totalViews = db.docs.reduce((acc, d) => acc + (d.views_count || 0), 0)
            const totalUsage = db.access_codes.reduce((acc, c) => acc + (c.usage_count || 0), 0)
            return sendJson(200, { totalDocs, publishedDocs, totalCodes, activeCodes, totalViews, totalUsage })
          }

          // POST /api/access/verify
          if (pathname === '/api/access/verify' && method === 'POST') {
            const body = await parseBody()
            const rawCode = (body.code || '').trim()
            const docId = body.docId || null

            if (!rawCode) return sendJson(400, { success: false, message: '请输入专属访问密码' })

            const match = db.access_codes.find(c => c.code.toLowerCase() === rawCode.toLowerCase())
            if (!match) return sendJson(401, { success: false, message: '密码不存在或已失效，请联系主理人获取' })
            if (!match.is_active) return sendJson(403, { success: false, message: '该密码已被停用' })

            if (match.expires_at && new Date(match.expires_at).getTime() < Date.now()) {
              return sendJson(403, { success: false, message: '您的专属密码已过期' })
            }
            if (match.max_uses > 0 && match.usage_count >= match.max_uses) {
              return sendJson(403, { success: false, message: '密码使用次数已达上限' })
            }
            if (match.doc_id && docId && match.doc_id !== docId) {
              const boundDoc = db.docs.find(d => d.id === match.doc_id)
              return sendJson(403, { success: false, message: `该密码仅适用于单篇文档《${boundDoc?.title || '指定文档'}》，无法解锁当前内容` })
            }

            match.usage_count = (match.usage_count || 0) + 1
            saveDB(db)

            const boundDoc = match.doc_id ? db.docs.find(d => d.id === match.doc_id) : null

            const token = await createVipToken({
              codeId: match.id,
              code: match.code,
              label: match.label || '',
              docId: match.doc_id || null,
            })

            return sendJson(200, {
              success: true,
              token,
              label: match.label,
              canAccessAll: !match.doc_id,
              docId: match.doc_id || null,
              docTitle: boundDoc?.title || null,
              message: match.doc_id ? `已解锁单篇文档: 《${boundDoc?.title || '指定文档'}》` : '已解锁全专栏所有付费文档！'
            })
          }

          // GET /api/passcodes
          if (pathname === '/api/passcodes' && method === 'GET') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const mapped = db.access_codes.map(c => {
              const doc = db.docs.find(d => d.id === c.doc_id)
              return { ...c, doc_title: doc ? doc.title : null }
            })
            return sendJson(200, mapped)
          }

          // POST /api/passcodes
          if (pathname === '/api/passcodes' && method === 'POST') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const body = await parseBody()
            let code = (body.code || '').trim()
            if (!code) {
              const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
              let rand = ''
              for (let i = 0; i < 5; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length))
              code = 'VIP-' + rand
            }
            if (db.access_codes.some(c => c.code.toLowerCase() === code.toLowerCase())) {
              return sendJson(400, { error: '该密码已存在，请换一个' })
            }

            const newCode = {
              id: 'code_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              code,
              label: body.label || '新学员',
              doc_id: body.doc_id || null,
              is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
              usage_count: 0,
              max_uses: typeof body.max_uses === 'number' ? body.max_uses : -1,
              expires_at: body.expires_at || null,
              created_at: new Date().toISOString()
            }
            db.access_codes.unshift(newCode)
            saveDB(db)
            return sendJson(200, { success: true, id: newCode.id, code })
          }

          // PUT /api/passcodes/:id
          if (pathname.startsWith('/api/passcodes/') && method === 'PUT') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const id = pathname.replace('/api/passcodes/', '')
            const body = await parseBody()
            const code = (body.code || '').trim()
            if (!code) return sendJson(400, { error: '密码不能为空' })

            const idx = db.access_codes.findIndex(c => c.id === id)
            if (idx === -1) return sendJson(404, { error: '卡密不存在' })

            if (db.access_codes.some(c => c.code.toLowerCase() === code.toLowerCase() && c.id !== id)) {
              return sendJson(400, { error: '该密码已被其他学员使用，请更换' })
            }

            db.access_codes[idx] = {
              ...db.access_codes[idx],
              code,
              label: body.label || '',
              doc_id: body.doc_id || null,
              is_active: body.is_active ? 1 : 0,
              max_uses: typeof body.max_uses === 'number' ? body.max_uses : -1,
              expires_at: body.expires_at || null,
              updated_at: new Date().toISOString()
            }
            saveDB(db)
            return sendJson(200, { success: true, message: '卡密已更新' })
          }

          // DELETE /api/passcodes/:id
          if (pathname.startsWith('/api/passcodes/') && method === 'DELETE') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const id = pathname.replace('/api/passcodes/', '')
            db.access_codes = db.access_codes.filter(c => c.id !== id)
            saveDB(db)
            return sendJson(200, { success: true, message: '密码已删除' })
          }

          // GET /api/docs
          if (pathname === '/api/docs' && method === 'GET') {
            const admin = await isAdmin()
            if (admin) {
              return sendJson(200, db.docs)
            } else {
              const publicList = db.docs
                .filter(d => d.is_published === 1)
                .map(d => ({
                  id: d.id,
                  title: d.title,
                  slug: d.slug,
                  excerpt: d.excerpt,
                  cover_image: d.cover_image,
                  is_vip_only: d.is_vip_only,
                  views_count: d.views_count,
                  order_index: d.order_index,
                  created_at: d.created_at,
                  updated_at: d.updated_at
                }))
              return sendJson(200, publicList)
            }
          }

          // POST /api/docs
          if (pathname === '/api/docs' && method === 'POST') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const body = await parseBody()
            const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
            const newDoc = {
              id,
              title: (body.title || '无标题文档').trim(),
              slug: body.slug || id,
              excerpt: body.excerpt || '',
              cover_image: body.cover_image || '',
              content_html: body.content_html || '<p></p>',
              content_json: body.content_json || '',
              is_published: body.is_published !== undefined ? (body.is_published ? 1 : 0) : 1,
              is_vip_only: body.is_vip_only !== undefined ? (body.is_vip_only ? 1 : 0) : 1,
              views_count: 0,
              order_index: typeof body.order_index === 'number' ? body.order_index : 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            db.docs.unshift(newDoc)
            saveDB(db)
            return sendJson(200, { success: true, id, message: '文档创建成功' })
          }

          // PUT /api/docs/:id
          if (pathname.startsWith('/api/docs/') && method === 'PUT') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const id = pathname.replace('/api/docs/', '')
            const body = await parseBody()
            const idx = db.docs.findIndex(d => d.id === id)
            if (idx === -1) return sendJson(404, { error: '文档不存在' })

            db.docs[idx] = {
              ...db.docs[idx],
              title: (body.title || '无标题文档').trim(),
              slug: body.slug || id,
              excerpt: body.excerpt || '',
              cover_image: body.cover_image || '',
              content_html: body.content_html || '<p></p>',
              content_json: body.content_json || '',
              is_published: body.is_published !== undefined ? (body.is_published ? 1 : 0) : 1,
              is_vip_only: body.is_vip_only !== undefined ? (body.is_vip_only ? 1 : 0) : 1,
              order_index: typeof body.order_index === 'number' ? body.order_index : 0,
              updated_at: new Date().toISOString()
            }
            saveDB(db)
            return sendJson(200, { success: true, message: '文档已保存' })
          }

          // DELETE /api/docs/:id
          if (pathname.startsWith('/api/docs/') && method === 'DELETE') {
            if (!(await isAdmin())) return sendJson(401, { error: 'Unauthorized' })
            const id = pathname.replace('/api/docs/', '')
            db.docs = db.docs.filter(d => d.id !== id)
            saveDB(db)
            return sendJson(200, { success: true, message: '文档已删除' })
          }

          // GET /api/docs/:id
          if (pathname.startsWith('/api/docs/') && method === 'GET') {
            const idOrSlug = pathname.replace('/api/docs/', '')
            const directKey = url.searchParams.get('key')
            const doc = db.docs.find(d => d.id === idOrSlug || d.slug === idOrSlug)

            if (!doc) return sendJson(404, { error: '文档不存在' })

            const admin = await isAdmin()
            if (admin) return sendJson(200, { ...doc, isAuthorized: true })

            if (!doc.is_published) return sendJson(403, { error: '该文档尚未公开发布' })
            if (!doc.is_vip_only) {
              doc.views_count = (doc.views_count || 0) + 1
              saveDB(db)
              return sendJson(200, { ...doc, isAuthorized: true })
            }

            // VIP checks
            let isAuthorized = false
            let userLabel = ''

            if (directKey) {
              const codeRow = db.access_codes.find(c => c.code.toLowerCase() === directKey.trim().toLowerCase())
              if (codeRow && codeRow.is_active === 1) {
                const isExpired = codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()
                const isLimitExceeded = codeRow.max_uses > 0 && codeRow.usage_count >= codeRow.max_uses
                const isDocMatched = !codeRow.doc_id || codeRow.doc_id === doc.id
                if (!isExpired && !isLimitExceeded && isDocMatched) {
                  isAuthorized = true
                  userLabel = codeRow.label || ''
                  codeRow.usage_count = (codeRow.usage_count || 0) + 1
                  saveDB(db)
                }
              }
            }

            if (!isAuthorized) {
              const vipToken = req.headers['x-access-token']
              if (vipToken) {
                const payload = await verifyToken(vipToken)
                if (payload && payload.role === 'vip') {
                  const codeRow = db.access_codes.find(c => c.id === payload.codeId)
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
              doc.views_count = (doc.views_count || 0) + 1
              saveDB(db)
              return sendJson(200, { ...doc, isAuthorized: true, userLabel })
            }

            // Unauthorized paywall
            return sendJson(401, {
              id: doc.id,
              title: doc.title,
              excerpt: doc.excerpt,
              cover_image: doc.cover_image,
              is_vip_only: 1,
              isAuthorized: false,
              message: '此内容为付费专属文档，请输入专属密码解锁'
            })
          }

          // POST /api/proxy-image
          if (pathname === '/api/proxy-image' && method === 'POST') {
            const body = await parseBody()
            const { url } = body
            if (!url) return sendJson(400, { error: '请提供图片 URL' })

            try {
              const fetchRes = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
              })
              if (!fetchRes.ok) {
                return sendJson(400, { error: `拉取失败: ${fetchRes.status}` })
              }
              const contentType = fetchRes.headers.get('content-type') || 'image/jpeg'
              const arrayBuffer = await fetchRes.arrayBuffer()
              const base64 = Buffer.from(arrayBuffer).toString('base64')
              const dataUrl = `data:${contentType};base64,${base64}`
              return sendJson(200, { success: true, dataUrl })
            } catch (e: any) {
              return sendJson(500, { error: e.message || '转存失败' })
            }
          }

          // Fallthrough
          return sendJson(404, { error: 'API route not found' })
        } catch (err: any) {
          console.error('Dev API Error:', err)
          return sendJson(500, { error: err.message || 'Internal Server Error' })
        }
      })
    }
  }
}
