# Cube's Projection — 文档索引

本站的编写与维护文档统一存放在本目录（`docs/`），使用英文路径命名，
方便后续扩展（如新增 `about/`、`reference/` 等）。

## 结构

```
docs/
├── README.md              # 本索引
├── navigation             # 侧边栏菜单数据
└── guide/                 # 面向页面编辑者的教程
    └── page-authoring     # 页面编写指南
```

## 文档系统架构

文档页由两套模板组成：

**1. 公共外壳**（改一次影响所有文档）：
- `模板:docs/layout` — 顶部导航栏 + 左侧目录侧边栏 + 内容区容器（含 {{libs}}/{{rehead}} 声明）
- `模板:docs/end` — 闭合容器 + 页脚

**2. 导航数据**：
- `Docs:navigation` — 菜单数据（改菜单不动模板）
- `Module:DocsNav` — Lua 读取并渲染侧边栏

文档正文直接使用 Bootstrap 原生类（`alert`、`pre`、`h2` 等），不再单独维护内容组件模板。

一个文档页面的骨架：

```
{{docs/layout}}

...页面正文...
（正文使用 Bootstrap 类排版：<h2 class="h3">、<pre class="bg-body-tertiary">、
  <div class="alert alert-warning"> 等）

{{docs/end}}
```

## 新增文档步骤

1. 在 `docs/` 下新建英文命名的文件（**不带后缀**），内容以 `{{docs/layout}}` 开头、`{{docs/end}}` 结尾
2. 在 `Docs:navigation` 中添加对应菜单条目
3. 提交到 wiki（命名空间 `Docs` 下，如 `Docs:guide/xxx`），方式见下节

## 提交到 wiki

站点有 Cloudflare 防护，bot 基本登不上，统一通过浏览器 MCP 在已登录的 wiki 页面控制台提交：
`new mw.Api().postWithToken('csrf', { action: 'edit', title: 'Docs:guide/xxx', text: '...' })`。
本地文件路径对应 wiki 页面路径（`docs/` 目录映射到 `Docs:` 命名空间）：
- `docs/guide/page-authoring` → `Docs:guide/page-authoring`
- `docs/navigation` → `Docs:navigation`
- `Template/docs/layout` → `模板:docs/layout`（文件名与模板名一致）
- `Template/docs/end` → `模板:docs/end`
- `Module/DocsNav` → `模块:DocsNav`
