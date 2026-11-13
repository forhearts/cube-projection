# Agent API Tool — 为 AI agent 提供绕过 Cloudflare 的提交接口

## 问题

- 站点部署在 Miraheze，受 Cloudflare 防护
- Bot 账号无法绕过 Cloudflare，无法通过 API 提交编辑
- 目前只能手动在浏览器控制台用 `mw.Api().postWithToken('csrf', {...})` 提交
- 不方便 agent 程序化地提交代码变更

## 解决方案

提供一个 Tool 页面（`Tool:AI接口`），通过浏览器的已登录会话代理 agent 的提交请求：

1. **Tool:AI接口** — 网页界面 + API 端点
   - Agent 访问此页，向其发送 POST 请求
   - 请求包含：目标页面、新内容、编辑摘要
   - 页面代理 agent 的请求，使用浏览器的 CSRF token 提交到 MediaWiki

2. **核心实现** — `MediaWiki:AgentAPI.js`
   - 实时监听来自 agent 的 FETCH 请求
   - 调用 `mw.Api().postWithToken('csrf', {...})` 代理提交
   - 返回编辑结果：成功、失败原因、新修订号等

3. **Module:Libs** 注册新脚本
   - 添加 `agentapi = { page = 'MediaWiki:AgentAPI.js', version = '1' }`

## 范围

- 单页面编辑（原则上支持批量，但优先单页）
- 仅支持标准 wikitext 编辑（不支持 VisualEditor 或 Flow）
- 调用者必须是已登录用户的浏览器（会话绑定）

## 验收标准

- Agent 可以向 `Tool:AI接口` 发送编辑请求
- 请求格式：`POST { title, text, summary }`
- 响应格式：`{ success: true/false, pageid, revid, error? }`
- 浏览器打开目标页面可见更新
