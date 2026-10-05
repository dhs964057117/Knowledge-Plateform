# 智汇知识库 (Knowledge Platform) · 飞书风格知识付费平台

一款专为创作者打造的轻量级、高颜值知识付费专栏系统，拥有**飞书文档级**的阅读排版和创作体验，搭载**一人一密专属鉴权**机制，并完全原生适配 **Cloudflare Pages + Functions + D1 数据库**。

---

## ✨ 核心特性

- 📄 **飞书/Notion式排版**：支持多级标题、代码块、高亮块、任务清单、表格、图片上传、分割线，自带目录大纲 (TOC) 随动滚动。
- 🔐 **一人一密专属卡密鉴权**：
  - 针对付费用户生成独一无二的访问密码（支持自定义或随机生成）。
  - 支持随时修改密码、修改学员备注、设置有效期与使用次数限制、一键临时冻结。
  - 支持免密直达链接分享：`https://domain/doc/xxx?key=专属密码`。
- 🛡️ **付费内容拦截墙 (Paywall)**：未鉴权用户访问 VIP 文档时，自动弹出前瞻摘要与密码输入卡片，并展示主理人微信号与购买指引。
- ⚡ **原生支持 Cloudflare**：
  - 前端部署至 Cloudflare Pages 全球边缘 CDN。
  - 后端基于 Hono 运行于 Cloudflare Functions / Workers。
  - 数据持久化存储于 Cloudflare D1 (Serverless SQLite)。
- 💻 **本地开箱即用**：内置本地数据持久化中间件，无需连接云端即可一键 `npm run dev` 完整调试全流程。

---

## 🚀 快速上手

```bash
# 安装依赖
npm install

# 启动本地服务
npm run dev
```

- 专栏前台首页：`http://localhost:5173/`
- 主理人工作台：`http://localhost:5173/admin`（初始管理密码：`admin123`）
- 体验 VIP 密码：`VIP888`

完整 Cloudflare 部署步骤请查看：[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)。
