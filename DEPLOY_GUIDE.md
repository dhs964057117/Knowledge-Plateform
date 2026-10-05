# 🚀 知识付费平台 Cloudflare 部署与使用完整指南

本项目是一个类似**飞书文档**的知识付费专栏系统，支持图文排版、一人一密专属鉴权、带密码直链免密阅读、文档增删改查以及全栈部署到 **Cloudflare (Pages + Functions + D1 SQLite 边缘数据库)**。

---

## 🌟 核心特性

1. **飞书/Notion级图文排版**：
   - 基于 TipTap 富文本引擎，支持多级标题、高亮提示块、代办任务清单、代码块、表格、图片上传、分割线。
   - 读者端沉浸式体验：右侧文档大纲目录（TOC 随动监听）、字号舒适、自适应移动端与打印导出。
2. **知识付费「一人一密」专属鉴权体系**：
   - **每个人密码都不一样**：管理员可为每位付费学员分配专属密码（如 `VIP-7K9M2`、学员姓名拼音或自定义口令）。
   - **密码随时可修改/停用**：学员信息、密码字符串、有效期截止日、最大使用次数均可在后台实时编辑。
   - **免输入直达链接**：支持一键复制带密码的直达链接（`https://your-domain/doc/xxx?key=专属密码`），发给学员直接点开即可免密阅读！
   - **未付费拦截页 (Paywall)**：支持展示前瞻摘要、提示文案、主理人微信号一键复制和微信二维码。
3. **全栈 Cloudflare 边缘计算原生**：
   - 前端：Vite + React + Tailwind CSS
   - 后端：Hono (运行在 Cloudflare Workers / Pages Functions 运行时)
   - 数据库：Cloudflare D1 (超轻量、零维护 Serverless SQLite 边缘数据库)

---

## 🛠️ 本地开发与体验

本地内置了轻量化模拟数据库，**无需配置 Cloudflare 即可直接开箱运行**：

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器
npm run dev
```

- 浏览器打开：`http://localhost:5173/`
- **后台管理入口**：`http://localhost:5173/admin`
  - 默认管理密码：`admin123`（可在后台「专栏设置」中随时修改）
- **默认测试 VIP 专属密码**：`VIP888`

---

## ☁️ 部署到 Cloudflare 完整步骤

### 第一步：安装并登录 Wrangler CLI

```bash
npx wrangler login
```
终端会弹出浏览器完成 Cloudflare 账号授权登录。

---

### 第二步：创建 Cloudflare D1 数据库

在项目根目录下运行命令创建 D1 数据库：

```bash
npx wrangler d1 create knowledge-db
```

执行完毕后，控制台会输出类似如下内容：
```toml
[[d1_databases]]
binding = "DB"
database_name = "knowledge-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**将输出的 `database_id` 填入项目根目录的 `wrangler.toml` 文件中**：
```toml
[[d1_databases]]
binding = "DB"
database_name = "knowledge-db"
database_id = "填入您的database_id"
```

---

### 第三步：初始化远程数据库表结构

运行以下命令，将 `schema.sql` 中的表结构和初始种子数据同步到 Cloudflare D1：

```bash
npx wrangler d1 execute knowledge-db --remote --file=./schema.sql
```

---

### 第四步：部署前端与 Functions 到 Cloudflare Pages

执行构建并一键发布：

```bash
npm run build
npx wrangler pages deploy dist --project-name=knowledge-platform
```

部署完成后，终端会返回专属访问域名（例如：`https://knowledge-platform.pages.dev`）。

---

### 🌐 进阶可选：通过 Cloudflare Dashboard 网页端连接 GitHub 自动部署

如果你希望每次 `git push` 时 Cloudflare 自动构建发布：

1. 将本项目推送到你的 **GitHub 仓库**。
2. 进入 [Cloudflare 控制台](https://dash.cloudflare.com/) -> **Compute (Workers & Pages)** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 选择你的代码仓库，配置构建参数：
   - **Framework preset**: `None`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 点击 **Save and Deploy**。
5. 部署完成后，在 Pages 项目设置中绑定 D1 数据库：
   - 进入 **Settings** -> **Functions** -> **D1 database bindings**
   - 点击 **Add binding**
   - **Variable name (变量名)**: `DB`（必须大写）
   - **D1 database**: 选择刚才创建的 `knowledge-db`
6. 重新部署一次（Retry deployment），即大功告成！

---

## 📖 平台使用日常操作指引

### 1. 发布高价值付费文档
1. 登录工作台（`/admin`），点击右上角「新建知识文档」。
2. 输入大标题、摘要、封面图。
3. 将「付费鉴权类型」设置为 **🔒 VIP专属**。
4. 使用富文本编辑器编写内容（支持加粗、代码块、引用、上传插入图片等）。
5. 点击「保存文档」，立即全站生效。

### 2. 微信成交后，为学员开通一人一密访问
1. 进入管理后台 -> 点击「一人一密卡密」选项卡。
2. 点击「生成新学员专属密码」：
   - 可以输入自定义密码（如 `VIP-张三`）或点击「随机生成」。
   - 填写学员微信或姓名备注（方便日后追踪）。
   - 适用范围：选择「全站通用VIP」或仅限定某一篇文档。
   - 可以设置过期时间或使用次数。
3. 生成后，在表格操作栏点击「**复制直达链接**」，直接在微信发给学员：
   > 格式如：`https://你的域名/doc/xxx?key=VIP-8888`
4. 学员点开链接免输入密码直接进入阅读，体验极其流畅！
5. 若学员退款或违规，可随时点击状态按钮一键「**冻结**」或直接「**修改密码**」。
