# Design

## Context

- 页面普遍使用 `{{libs|cleanup=true|rehead=true}}`：`MediaWiki:Common.js` 先清空 `<head>`（只保留 `[data-cp-libs]` 资源节点和 `<meta charset>`），再插入 `模块:Rehead` 生成的 head HTML。MediaWiki 自带的 viewport meta 因此丢失，只有 `Test/测试页面` 自行声明了 viewport。
- 手机访问走 MobileFrontend（Minerva 皮肤），但 `Common.js` 照常加载，`cleanup=true` 会清掉皮肤界面，两种皮肤下最终页面结构一致。
- 样式只能来自：Tailwind 浏览器运行时（扫描 DOM class，含 JS 动态添加的 class）、daisyUI CDN、`{{rehead|style=}}` 内联样式、JS 内联样式。wikitext 不能写 `<style>`；本站 Sanitizer 还会转义 `<details>`（已实测），不能依赖原生折叠。
- 本地没有 Lua 运行环境，Lua 改动只能在线验证。

## Goals / Non-Goals

**Goals:**
- 所有改动都在现有模块 / 模板 / 脚本内完成，不新增页面、不新增依赖。
- 桌面端（≥ 1024px）显示效果保持不变。

**Non-Goals:**
- 不为 Minerva 单独写样式（`MediaWiki:Minerva.css` 等保持不存在）。
- 不引入 JS 控制的抽屉 / 汉堡菜单交互。

## Decisions

### 1. viewport 默认值由 `模块:Rehead` 输出（Lua）

`p.main` 解析 `meta=` 时记录是否出现 `name:viewport`；没有则在 `<title>` 之后输出
`<meta name="viewport" content="width=device-width, initial-scale=1" />`。

- 备选：在 `Common.js` 的 `rehead()` 中保留原有 viewport 节点。否决：违背「Lua 优先」，而且 MediaWiki 原值（`minimum-scale=0.25, maximum-scale=5.0`）对本站并无意义；Lua 输出是确定的，可以在 `action=parse` 结果里直接检查。
- 页面声明优先：保留页面覆盖的能力（例如需要禁止缩放的游戏页）。
- 同时修正 `parseMetaLine`：值内含逗号时（viewport 的 content 必然如此），不含「属性名:」的片段并入上一个属性值，而不是被丢弃。

### 2. 导航栏 links 在窄屏下复制进「更多」菜单（Lua）

`模块:Navbar` 在下拉菜单开头为每个 `links` 项输出 `<li class="lg:hidden">`，与中间区域的 `hidden lg:flex` 互补。

- 备选：单独输出一个 `lg:hidden` 汉堡按钮。否决：导航栏右侧已有「更多」，再加一个按钮在 320px 宽度下会挤占品牌区；复用现有下拉不需要任何 JS。

### 3. 文档页窄屏布局用 `{{docs/layout}}` 内联样式里的媒体查询

`@media (max-width: 767px)` 下：`.docs-body` 改为纵向排列；`.docs-sidebar` 取消固定宽度和右边框，改为底部分隔线；目录项改为 `inline-block` 换行排列成紧凑目录；`.docs-content` 减小内边距并加 `overflow-wrap: anywhere`；表格 `display:block; overflow-x:auto`。

- 备选：用 Tailwind 响应式 class 改写 `模块:DocsNav` 的 HTML。否决：文档外壳现有样式全部集中在 `{{docs/layout}}`，就地加媒体查询改动最小，`模块:DocsNav` 无需改动。
- 备选：可折叠目录。否决：`<details>` 被 Sanitizer 转义；用 JS 实现违背「JS 最小化」。当前目录只有 4 项，平铺占用空间很小。
- 注意：模板参数中不能出现 `}}` / `{{`，嵌套规则的闭合括号之间要用换行或空格隔开。

### 4. 首页：修正绝对定位容器的可用宽度

欢迎区容器使用 `left-1/2 -translate-x-1/2` 绝对定位，没有设置宽度时可用宽度只有视口的一半，这是按钮在手机上折行溢出的根因。容器加 `w-full px-4`，按钮加 `whitespace-nowrap`，窄屏下内边距和字号缩小（`px-8 text-xl sm:px-10 sm:text-2xl`）。

### 5. 流体画布：CSS 尺寸改为 `min(480px, 90vw)`

只改 `MediaWiki:Fluid.js` 中 canvas 的 CSS 宽高；绘制分辨率 `SIZE = 480` 保持不变，由浏览器缩放，不需要监听 resize。

### 6. 工具页：只调整脚本生成元素的 class

- 搜索输入框 `min-w-64` → `min-w-0`（仍为 `flex-1`）。档案库、控制台输入框 `w-64` → `w-full sm:w-64`。
- 过滤选项行容器 `flex flex-col` → `flex flex-row flex-wrap gap-x-4 md:flex-col`（`Search.js` 的 `makeControlSection`、`Archive.js` 的 `makeFacetGroup`）。
- Tailwind 浏览器运行时会监听 DOM 变化生成新 class，现有代码已在依赖这一点（如 `md:flex-row`）。

## Risks / Trade-offs

- [daisyUI CDN 样式与 Tailwind 工具类的优先级不确定，`h-auto` 之类的覆盖可能失效] → 首页按钮只用不与 daisyUI 冲突的 `whitespace-nowrap`、`px-*`、`text-*`，上线后用截图确认。
- [`{{docs/layout}}` 样式写错会让所有文档页失去样式] → 先用 `action=parse` 预览模板输出，确认 `<style>` 完整后再提交；回滚只需恢复上一版本。
- [Lua 改动无法本地运行] → 提交前用 Scribunto 控制台 API（`action=scribunto-console`，传入修改后的模块源码，不保存）跑一遍 `p.main`，确认输出。

## Migration Plan

1. 按 tasks.md 修改本地文件并提交到 git。
2. 在已登录的浏览器页面控制台按顺序提交：`模块:Rehead` → `模块:Navbar` → `模板:docs/layout` → `MediaWiki:*.js` → `首页` → 文档类页面。
3. 用浏览器手机模拟（390×844）与桌面视口逐页验证。
4. 回滚：在 wiki 上回退对应页面到上一版本，或用 git 中旧版本内容重新提交。
