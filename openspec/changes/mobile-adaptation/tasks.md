# Tasks

## 1. 默认 viewport（模块:Rehead）

- [x] 1.1 修改 `code/Module/Rehead`：`p.main` 记录 `meta=` 中是否出现 `name` 为 `viewport` 的行，没有则在 title 之后输出 `<meta name="viewport" content="width=device-width, initial-scale=1" />`；验证：用 Scribunto 控制台 API 以新源码执行 `p.main`，分别传入无 viewport 与带 viewport 的 `meta`，输出中都恰有一条 viewport meta
  - 附带修复：`parseMetaLine` 原先按逗号切分后丢弃不含「属性名:」的片段，`content:width=device-width, initial-scale=1.0` 会被截成 `width=device-width`；改为把这类片段并入上一个属性值，属性名限定为 `[%w-]+`
- [x] 1.2 更新 `code/Template/rehead`、`code/docs/guide/page-authoring`、`code/docs/guide/templates` 中的 viewport 说明：注明「默认已输出，仅需覆盖时声明」，示例中去掉多余的 viewport 行；验证：`git grep -n viewport code` 仅剩说明覆盖用法的位置与 `Test/测试页面`

## 2. 导航栏窄屏链接（模块:Navbar）

- [x] 2.1 修改 `code/Module/Navbar`：在「更多」下拉菜单开头为每个 `links` 项输出 `<li class="lg:hidden">`；验证：Scribunto 控制台以 `links=观测档案库,/wiki/观测档案库` 执行，输出中该链接出现两次（一次在 `hidden lg:flex` 中，一次在 `lg:hidden` 的 `<li>` 中）
- [x] 2.2 更新 `code/Template/Navbar` 文档：`links` 说明改为「桌面端显示在中间，窄屏收进更多菜单」；验证：文档描述与 2.1 行为一致

## 3. 文档页窄屏布局（模板:docs/layout）

- [x] 3.1 在 `code/Template/docs/layout` 的 `style=` 末尾追加 `@media (max-width:767px)` 规则：`.docs-body` 纵向、`.docs-sidebar` 取消定宽与右边框并改为紧凑目录、`.docs-content` 缩小内边距并 `overflow-wrap:anywhere`、`table` 改为块级横向滚动；验证：参数中不出现相邻的 `}}`，`action=parse` 预览模板时 `<style>` 内容完整、媒体查询保留

## 4. 首页与流体画布

- [x] 4.1 修改 `code/首页`：欢迎区容器加 `w-full px-4`，按钮加 `whitespace-nowrap` 并改为 `px-8 text-xl sm:px-10 sm:text-2xl`；验证：390px 与 320px 视口下按钮文字单行且在边框内
- [x] 4.2 修改 `code/MediaWiki/Fluid.js`：canvas CSS 宽高改为 `min(480px,90vw)`，绘制尺寸 `SIZE` 不变；验证：390px 视口下 `#fluid-canvas` 的 `getBoundingClientRect().width` ≤ 351

## 5. 工具页控件

- [x] 5.1 修改 `code/MediaWiki/Search.js`：输入框 `min-w-64` → `min-w-0`；`makeControlSection` 行容器改为 `flex flex-row flex-wrap gap-x-4 gap-y-1.5 md:flex-col`；验证：390px 视口下输入框与 Go 按钮同屏可见，命名空间选项横向换行排列
- [x] 5.2 修改 `code/MediaWiki/Archive.js`：输入框 `w-64` → `w-full sm:w-64`；`makeFacetGroup` 列表改为 `flex flex-row flex-wrap gap-x-4 gap-y-1 md:flex-col`；验证：390px 视口下输入框不超出容器，排序选项横向排列
- [x] 5.3 修改 `code/MediaWiki/Console.js`：输入框 `w-64` → `w-full sm:w-64`；验证：390px 视口下输入框不超出容器

## 6. 经浏览器控制台提交到 wiki 并在线验证

- [ ] 6.1 在已登录的 wiki 页面控制台用 `new mw.Api().postWithToken('csrf', {action:'edit', title, text, summary})` 按顺序提交（被依赖的 Module/Template 先提交）：
  1. `模块:Rehead` ← `code/Module/Rehead`
  2. `模块:Navbar` ← `code/Module/Navbar`
  3. `模板:rehead` ← `code/Template/rehead`
  4. `模板:Navbar` ← `code/Template/Navbar`
  5. `模板:docs/layout` ← `code/Template/docs/layout`
  6. `MediaWiki:Fluid.js` ← `code/MediaWiki/Fluid.js`
  7. `MediaWiki:Search.js` ← `code/MediaWiki/Search.js`
  8. `MediaWiki:Archive.js` ← `code/MediaWiki/Archive.js`
  9. `MediaWiki:Console.js` ← `code/MediaWiki/Console.js`
  10. `首页` ← `code/首页`
  11. `Docs:guide/page-authoring` ← `code/docs/guide/page-authoring`
  12. `Docs:guide/templates` ← `code/docs/guide/templates`

  验证：每次 API 返回 `edit.result === "Success"`
- [ ] 6.2 用浏览器手机模拟（390×844）逐页打开 首页、观测档案库、Tool:搜索、Tool:控制台、论坛、Docs:guide/page-authoring：确认恰有一条 viewport meta、`scrollWidth <= innerWidth`，并截图检查 spec 中各场景
- [ ] 6.3 用 1280px 桌面视口复查上述页面，确认布局与修改前一致（导航中间链接、文档左侧栏、过滤选项纵向排列）

## Workflow follow-up

- 本地改动提交到 git 并推送到 GitHub。
- 在线验证通过后执行 `/opsx-archive` 归档本变更。
