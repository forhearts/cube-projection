# Cube's Projection — 文档索引

本站的编写与维护文档统一存放在本目录（`docs/`），使用英文路径命名。

## 目录结构

```
docs/
├── README.md               本索引
├── navigation              侧边栏菜单数据（Docs:navigation）
├── llms.txt                LLM/Agent 机器可读参考文档
├── guide/                  面向页面编辑者的教程
│   ├── quickstart          快速开始
│   ├── page-authoring      页面编写指南（{{libs}} / {{rehead}} 完整参考）
│   ├── templates           模板说明（Navbar / docs/layout 等）
│   ├── agent-api           Agent 接口（通过浏览器会话提交编辑）
│   └── troubleshooting     常见问题排查
└── reference/              完整参考资料
    ├── libs                可用库列表（JS / CSS / daisyUI）
    ├── modules             模块参考（Lua 模块接口说明）
    └── limits              限制与安全（内容过滤、CSP、安全层）
```

## 文档系统架构

文档页由两套模板组成：

**公共外壳**（改一次影响所有文档）：
- `模板:docs/layout` — 顶部 Navbar + 左侧目录侧边栏 + 内容区容器
- `模板:docs/end` — 闭合容器 + 页脚

**导航数据**：
- `Docs:navigation` — 菜单数据（改菜单不动模板）
- `Module:DocsNav` — Lua 读取并渲染侧边栏

文档正文使用 daisyUI 组件类（`hero`、`alert`、`timeline`、`card`、`badge` 等），样式已在 `docs/layout` 模板中按需加载。

文档骨架：

```
{{docs/layout}}

...页面正文（HTML + wikitext）...

{{docs/end}}
```

## 本地路径 ↔ Wiki 页面对照

| 本地文件 | Wiki 页面 |
|---|---|
| `code/docs/guide/quickstart` | `Docs:guide/quickstart` |
| `code/docs/guide/page-authoring` | `Docs:guide/page-authoring` |
| `code/docs/guide/templates` | `Docs:guide/templates` |
| `code/docs/guide/agent-api` | `Docs:guide/agent-api` |
| `code/docs/guide/troubleshooting` | `Docs:guide/troubleshooting` |
| `code/docs/reference/libs` | `Docs:reference/libs` |
| `code/docs/reference/modules` | `Docs:reference/modules` |
| `code/docs/reference/limits` | `Docs:reference/limits` |
| `code/docs/navigation` | `Docs:navigation` |
| `code/docs/llms.txt` | `Docs:llms.txt` |
| `code/Template/docs/layout` | `模板:docs/layout` |
| `code/Template/docs/end` | `模板:docs/end` |
| `code/Module/DocsNav` | `模块:DocsNav` |

## 新增文档步骤

1. 在 `docs/` 下合适的子目录新建英文命名文件（**不带后缀**），内容以 `{{docs/layout}}` 开头、`{{docs/end}}` 结尾
2. 在 `code/docs/navigation` 中添加对应菜单条目（格式：`*链接文本|/wiki/Docs:xxx`）
3. 更新本 README 的目录结构与对照表
4. 按依赖顺序提交到 wiki（先提交被依赖的 Module/Template，再提交 Docs 内容页）

## 提交到 Wiki

站点有 Cloudflare 防护，bot 账号无法登录，统一通过浏览器 Agent API 提交：

```js
// 在 Tool:AI接口 页面的 bsk 会话中：
await window.agentAPI.submit('Docs:guide/xxx', '页面内容…', '编辑摘要')
```

详细流程见 `docs/guide/agent-api`。

**上传顺序（先上传被依赖的）：**
1. `模块:DocsNav`（如有修改）
2. `模板:docs/layout`、`模板:docs/end`（如有修改）
3. `Docs:navigation`（菜单数据）
4. 各 `Docs:*` 内容页

## 面向 Agent 的参考

机器可读的完整参考文档在 `docs/llms.txt`（wiki 页面 `Docs:llms.txt`，`?action=raw` 可取纯文本）。
涵盖：架构概述、{{libs}}/{{rehead}} 参数、Agent API 接口、上传顺序、常见错误排查。
