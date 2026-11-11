## Purpose

规定站点页面在手机窄屏下的显示行为：页面按设备宽度渲染、不出现横向滚动，导航与各页面的关键控件在窄屏下都能看到并使用。

## ADDED Requirements

### Requirement: 默认按设备宽度渲染

使用 `{{rehead}}` 重写 `<head>` 的页面 MUST 带有 `width=device-width` 的 viewport meta，即使页面没有自行声明。
页面在 `meta=` 参数中声明了 `name:viewport` 时，系统 SHALL 只保留页面声明的那一条，不得重复输出。

#### Scenario: 页面未声明 viewport

- **WHEN** 页面使用 `{{rehead|title=...}}` 且 `meta=` 中没有 viewport，在 390px 宽的手机上打开
- **THEN** `<head>` 中恰有一条 `<meta name="viewport">`，其 content 含 `width=device-width`，`window.innerWidth` 等于设备宽度 390

#### Scenario: 页面自行声明 viewport

- **WHEN** 页面在 `meta=` 中写了 `name:viewport, content:width=device-width, initial-scale=1.0, maximum-scale=1`
- **THEN** `<head>` 中恰有一条 viewport meta，content 为页面声明的值

### Requirement: 窄屏无横向溢出

在 320px–767px 宽的视口中，首页、观测档案库、Tool:搜索、Tool:控制台、论坛及 Docs: 文档页 MUST NOT 产生页面级横向滚动（`document.documentElement.scrollWidth` 不大于 `innerWidth`）。
代码块、宽表格等本身超宽的内容 SHALL 在自身容器内横向滚动。

#### Scenario: 手机打开各页面

- **WHEN** 在 390×844 视口打开上述任一页面并等待脚本加载完成
- **THEN** `scrollWidth <= innerWidth`

#### Scenario: 文档页含宽表格

- **WHEN** 文档正文含列数较多的表格，在 390px 宽视口打开
- **THEN** 表格在自身区域内可横向滚动，页面整体不横向滚动

### Requirement: 窄屏下导航链接可达

导航栏在桌面端中间显示的 `links` 链接，在窄屏（< 1024px）下 MUST 仍可通过「更多」下拉菜单访问；桌面端下拉菜单中 SHALL NOT 重复出现这些链接。

#### Scenario: 手机上使用带 links 的导航栏

- **WHEN** 页面使用 `{{Navbar|links=观测档案库,/wiki/观测档案库}}`，在 390px 宽视口打开并点开「更多」
- **THEN** 下拉菜单中出现「观测档案库」链接，点击后跳转到该页

#### Scenario: 桌面端不重复

- **WHEN** 同一页面在 1280px 宽视口打开并点开「更多」
- **THEN** 「观测档案库」只出现在导航栏中间，不出现在下拉菜单中

### Requirement: 文档页窄屏布局

文档页（使用 `{{docs/layout}}`）在窄屏（< 768px）下，目录 MUST 显示在正文上方且不占用正文的横向空间，正文 SHALL 占满视口宽度（扣除内边距）。

#### Scenario: 手机打开文档页

- **WHEN** 在 390px 宽视口打开 `Docs:guide/page-authoring`
- **THEN** 目录位于正文上方，正文区域宽度不小于视口宽度的 85%，当前页在目录中高亮

#### Scenario: 桌面端保持侧边栏

- **WHEN** 在 1280px 宽视口打开同一页面
- **THEN** 目录仍为左侧 280px 宽的侧边栏

### Requirement: 首页窄屏显示

首页的欢迎文字与「前往观测档案库」按钮在窄屏下 MUST 完整显示在按钮边框内且不折行溢出；背景流体动画 SHALL NOT 超出视口宽度。

#### Scenario: 手机打开首页

- **WHEN** 在 320px 或 390px 宽视口打开首页
- **THEN** 按钮文字为单行且位于按钮边框内，流体画布宽度不大于视口宽度

### Requirement: 工具页控件窄屏可用

观测档案库、Tool:搜索、Tool:控制台中由脚本生成的搜索输入框在窄屏下 MUST 不超出容器且与相邻按钮同屏可见；过滤选项在窄屏下 SHALL 按行横向排列，使结果列表在首屏或靠近首屏处开始。

#### Scenario: 手机打开搜索页

- **WHEN** 在 390px 宽视口打开 `Tool:搜索`
- **THEN** 查询输入框与「Go」按钮在同一视口宽度内完整可见，可输入并提交查询

#### Scenario: 手机打开观测档案库

- **WHEN** 在 390px 宽视口打开 `观测档案库`
- **THEN** 搜索输入框不超出容器，「排序」选项横向排列而非每项独占一行
