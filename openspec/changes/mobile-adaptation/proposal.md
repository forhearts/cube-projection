## Why

手机访问时站点体验很差：`{{rehead}}` 重写 `<head>` 时把 MediaWiki 自带的 viewport meta 一并删掉，而大多数页面没有自行声明，手机按桌面宽度渲染；
同时导航栏中间链接、文档侧边栏、首页按钮、流体画布、搜索/档案库输入框等都按桌面尺寸写死，窄屏下不可用或溢出。

## What Changes

- `{{rehead}}` 默认输出 `<meta name="viewport" content="width=device-width, initial-scale=1">`；页面在 `meta=` 中自行声明 viewport 时以页面为准（不重复输出）。
- 导航栏 `links` 在窄屏下不再丢失：桌面端仍显示在中间，窄屏收进「更多」下拉菜单。
- 文档外壳 `{{docs/layout}}` 窄屏下侧边栏改为顶部紧凑目录，正文占满宽度，宽表格可横向滚动。
- 首页「前往观测档案库」按钮不再折行溢出；流体画布不超过屏幕宽度。
- 搜索 / 观测档案库 / 控制台：输入框窄屏下占满可用宽度；过滤选项窄屏下横向排列，减少结果区被推到下方的距离。
- 同步更新 `{{rehead}}`、`{{Navbar}}` 的模板文档与编写指南中关于 viewport 的说明。

## Capabilities

### New Capabilities

- `mobile-layout`: 站点页面在手机窄屏（≥ 320px 宽）下的显示行为 —— 默认 viewport、无横向溢出、导航可达、各页面关键控件可用。

### Modified Capabilities

（无，`openspec/specs/` 目前为空）

## Impact

受影响的 wiki 页面（本地路径 → wiki 页面名）：

| 本地路径 | wiki 页面 |
| --- | --- |
| `code/Module/Rehead` | `模块:Rehead` |
| `code/Module/Navbar` | `模块:Navbar` |
| `code/Template/docs/layout` | `模板:docs/layout` |
| `code/MediaWiki/Fluid.js` | `MediaWiki:Fluid.js` |
| `code/MediaWiki/Search.js` | `MediaWiki:Search.js` |
| `code/MediaWiki/Archive.js` | `MediaWiki:Archive.js` |
| `code/MediaWiki/Console.js` | `MediaWiki:Console.js` |
| `code/首页` | `首页` |
| `code/Template/rehead`（文档部分） | `模板:rehead` |
| `code/Template/Navbar`（文档部分） | `模板:Navbar` |
| `code/docs/guide/page-authoring` | `Docs:guide/page-authoring` |
| `code/docs/guide/templates` | `Docs:guide/templates` |

间接受益（无需修改，依赖上述模块/模板）：`观测档案库`、`Tool:搜索`、`Tool:控制台`、`论坛`、所有 `Docs:` 页面。

## 不在范围内

- 不改 MobileFrontend / Minerva 皮肤配置，也不新建 `MediaWiki:Mobile.js` / `MediaWiki:Minerva.css`（`cleanup=true` 页面已清掉皮肤界面，两种皮肤下行为一致）。
- `模块:NavbarLight` / `模板:NavbarLight` 当前没有页面使用，不改。
- `MediaWiki:Ink.js`（墨水游戏）与 `论坛` 的 `<forum>` 列表输出不做专门适配。
- 不做深色模式、触摸手势、PWA 等移动端增强功能。
- 不修改 `_local/` 与 `prototypes/` 下的任何文件。
