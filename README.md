# 方之投影（Cube's Projection）

开放的群创协作世界观项目，以 MediaWiki 站点为载体。

> **公理一：** 存在独立于任何描述。
> **公理二：** 任何描述都不能完整表达存在。

本仓库存放站点的页面源码：Lua 模块、模板、站点 JS/CSS、文档页与功能页面。世界观设定文档只在本地维护，不进仓库。

## 目录结构

```
.
├── code/                  wiki 页面源码（本地路径 ↔ wiki 页面名，文件无后缀）
│   ├── MediaWiki/         → MediaWiki:*   站点脚本与样式（Common.js 资源注入器等）
│   ├── Module/            → 模块:*        Lua（Scribunto）
│   ├── Template/          → 模板:*
│   ├── File/              → 文件:*        站点图标（SVG）
│   ├── docs/              → Docs:*        编写指南（索引见 code/docs/README.md）
│   ├── Tool/ Test/        → 对应页面
│   └── 首页 论坛 观测档案库
├── openspec/              OpenSpec 规格与变更
└── _local/                本地专用（gitignore）：世界观设定、设计大纲、静态原型、页面快照
```

## 页面映射示例

| 本地文件 | wiki 页面 |
| --- | --- |
| `code/MediaWiki/Common.js` | `MediaWiki:Common.js` |
| `code/Module/Navbar` | `模块:Navbar` |
| `code/Template/docs/layout` | `模板:docs/layout` |
| `code/File/icon-logo.svg` | `文件:Icon-logo.svg` |
| `code/docs/guide/page-authoring` | `Docs:guide/page-authoring` |
| `code/首页` | `首页` |

## 架构要点

- **Lua 优先**：资源 URL 生成 / 去重 / 消毒（`模块:Libs`）、`<head>` 内容校验（`模块:Rehead`）都在服务端完成；
  `MediaWiki:Common.js` 只负责读取结果并注入。
- 页面通过模板声明依赖：

  ```wikitext
  {{rehead|title=页面标题}}
  {{libs|css=daisyui|js=tailwind|cleanup=true|rehead=true}}
  {{Navbar}}
  ```

- 第三方库统一走 jsdelivr CDN（Miraheze CSP 白名单），本站不托管第三方 JS/CSS。
- UI：daisyUI + Tailwind；文档页正文使用 Bootstrap 原生类。

## 发布

没有构建流程。站点有 Cloudflare 防护，bot 账号基本无法登录，因此不使用 bot：
修改 `code/` 下的文件后，通过浏览器 MCP 在**已登录**的 wiki 页面控制台直接提交：

```js
new mw.Api().postWithToken('csrf', {
  action: 'edit',
  title: '模块:Navbar',          // 目标 wiki 页面
  text: '...文件内容...',
  summary: '同步自 GitHub',
});
```

有依赖关系时先提交 `模块:` / `模板:`，再提交使用它们的页面；提交后在浏览器中打开页面验证。

## 开发流程（OpenSpec）

使用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 管理需求与变更：

1. `/opsx-explore` — 讨论想法
2. `/opsx-propose "描述"` — 生成 proposal / specs / design / tasks
3. `/opsx-apply` — 按任务实现
4. 提交到 wiki 并验证后 `/opsx-archive` — 归档并合并规格

## 许可

[MIT](LICENSE)
