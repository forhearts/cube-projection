# 任务

## 1. 编写页面（`code/Tool/AI接口`）

- [ ] 1.1 新建 `code/Tool/AI接口`，内容：
  ```wikitext
  {{rehead
  |title=AI 接口 - Agent 代理编辑工具
  |icon=light:{{filepath:Favicon-light.svg}}
  dark:{{filepath:Favicon-dark.svg}}
  }}
  {{libs|css=daisyui|js=tailwind,agentapi|cleanup=true|rehead=true}}
  {{Navbar|extra=文档,/wiki/Docs:guide/page-authoring}}

  <div class="px-6 pt-10 pb-2">
  <h1 class="text-3xl font-bold">Agent API</h1>
  <p class="text-base-content/70 mt-2">为 AI agent 提供 wiki 编辑代理接口。</p>
  </div>

  <div class="px-6 py-6">
  <div id="api-status"></div>
  <div id="api-history" class="mt-6"></div>
  </div>
  ```
  验证：git 追踪新文件

## 2. 编写脚本（`code/MediaWiki/AgentAPI.js`）

- [ ] 2.1 新建 `code/MediaWiki/AgentAPI.js`，实现：
  - 全局 `window.agentAPI` 对象
  - `submit(title, text, summary)` 异步方法
  - 登录检查与错误处理
  - localStorage 历史记录管理

- [ ] 2.2 测试脚本逻辑：
  - 在浏览器打开 `Tool:AI接口`，观察登录状态提示
  - 在控制台手动调用 `window.agentAPI.submit('Test:页面', 'content', 'test')` 
  - 验证响应格式正确，历史记录更新

## 3. 注册库（`code/Module/Libs`）

- [ ] 3.1 在 `code/Module/Libs` 的 `LIBRARIES.js` 表中添加 `agentapi` 条目
  - `page = 'MediaWiki:AgentAPI.js'`
  - `version = '1'`
  - `depends = {}`

- [ ] 3.2 验证：在 wiki 控制台用 Scribunto 测试 `p.build(...)` 包含 agentapi URL

## 4. 浏览器验证

- [ ] 4.1 打开 `Tool:AI接口`（无须登录，查看登录状态提示）
- [ ] 4.2 已登录用户打开该页，查看历史列表
- [ ] 4.3 在控制台测试 `window.agentAPI.submit()`，检查返回值与页面 UI 更新

## 5. 提交到 wiki

- [ ] 5.1 按依赖顺序提交到 wiki：
  1. `模块:Libs` ← `code/Module/Libs`
  2. `MediaWiki:AgentAPI.js` ← `code/MediaWiki/AgentAPI.js`
  3. `Tool:AI接口` ← `code/Tool/AI接口`

- [ ] 5.2 在浏览器打开 `Tool:AI接口` 验证加载正常
- [ ] 5.3 测试编辑功能（需已登录用户浏览器）

## 6. 文档

- [ ] 6.1 补充 `code/docs/guide/page-authoring` 或新建 `code/docs/guide/agent-api`，说明用法：
  - Agent 如何连接浏览器
  - `window.agentAPI.submit()` 签名与示例
  - 错误码含义

## 本地提交与归档

- [ ] 本地改动提交到 git 并推送到 GitHub
- [ ] wiki 验证通过后执行 `/opsx-archive` 归档本变更
