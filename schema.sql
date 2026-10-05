-- Cloudflare D1 / SQLite Database Schema

CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  cover_image TEXT,
  content_html TEXT NOT NULL,
  content_json TEXT,
  is_published INTEGER DEFAULT 1,
  is_vip_only INTEGER DEFAULT 1,
  views_count INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  doc_id TEXT, -- NULL for all docs, or specific doc_id
  is_active INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT -1, -- -1 for unlimited
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_logs (
  id TEXT PRIMARY KEY,
  code_id TEXT,
  doc_id TEXT,
  ip TEXT,
  user_agent TEXT,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial settings if empty
INSERT OR IGNORE INTO settings (key, value) VALUES 
('site_name', '智汇知识库 · 付费专属专栏'),
('site_description', '深度行业认知、独家实战手册与干货知识精选'),
('author_name', '专栏主理人'),
('admin_password', 'admin123'),
('pay_notice', '本专栏内容为专属知识付费内容。如需开通访问权限，请联系主理人微信获取专属VIP密码。'),
('contact_wechat', 'wx_creator_888'),
('contact_qr_url', '');

-- Seed initial sample document
INSERT OR IGNORE INTO docs (id, title, slug, excerpt, cover_image, content_html, content_json, is_published, is_vip_only, views_count, order_index) VALUES 
('welcome-guide', '🎉 欢迎使用飞书风格知识付费专栏', 'welcome-guide', '这是一份系统使用指引与专属付费内容的排版展示范例，带你了解一人一密专属鉴权与阅读体验。', 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', 
'<h1>🎉 欢迎阅读付费专属知识库</h1><p>这是一篇示例知识文档，采用<strong>飞书/Notion式现代排版</strong>构建，专为知识付费和独家干货分享量身定制。</p><h2>✨ 核心特色亮点</h2><ul><li><strong>飞书文档般的视觉体验</strong>：沉浸式阅读、双栏大纲目录（TOC）随动、清晰的层次结构。</li><li><strong>一人一密专属授权</strong>：每一个学员/购买者都可以拥有独一无二的访问密码，支持随时修改、暂停或设置过期时间。</li><li><strong>防泄露与直达分享</strong>：你可以直接给学员发送专属直达链接 <code>?key=VIP密码</code>，免去学员手动输入的繁琐，体验丝滑。</li><li><strong>全栈部署于 Cloudflare</strong>：借助 Cloudflare 边缘网络与 D1 数据库，全球秒开，免费额度极高。</li></ul><blockquote><p>💡 <strong>温馨提示</strong>：作为管理员，你可以进入右上角的「管理后台」（默认管理密码：<code>admin123</code>），随时发布新图文、管理所有学员密码、查看访问统计或修改站点公告！</p></blockquote><h2>💻 代码与实用示例</h2><pre><code>// 示例：专属卡密接入逻辑
const isAuthorized = verifyUserPasscode(userKey, documentId);
if (isAuthorized) {
  renderDocumentContent();
}</code></pre><p>祝你的知识付费事业蒸蒸日上！开始撰写你的第一篇高价值文档吧。</p>', 
'', 1, 1, 12, 0);

-- Seed initial sample passcode
INSERT OR IGNORE INTO access_codes (id, code, label, doc_id, is_active, usage_count, max_uses, expires_at) VALUES 
('code-demo-1', 'VIP888', '演示体验学员 (全库通用VIP)', NULL, 1, 5, -1, NULL);
