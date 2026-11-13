# 功能需求：Agent API 代理提交接口

## Why

Bot 账号无法越过 Cloudflare 防护访问 wiki API。提供一个浏览器代理接口，让 agent 可通过已登录用户的浏览器会话提交代码变更，避免手动复制粘贴。

## ADDED Requirements

## 需求 1：POST 请求接收与提交

页面提供 `/api/edit` 端点（虚拟），接收 Agent 发送的编辑请求。

### 参数

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | wiki 页面名（如 `模块:Navbar`） |
| `text` | string | 新页面内容 |
| `summary` | string | 编辑摘要（如 `feat: 移动端适配`） |

### 响应格式

成功：
```json
{ "success": true, "pageid": 123, "revid": 456, "timestamp": "2024-01-15T10:30:00Z" }
```

失败：
```json
{ "success": false, "error": "editconflict|badarticlename|...", "message": "..." }
```

### 场景

#### Scenario: Agent 提交新建脚本

- **WHEN** Agent POST 到 `/Tool:AI接口` 携带 `{ title: 'MediaWiki:TestScript.js', text: 'console.log(...)', summary: 'test' }`
- **THEN** 页面调用 `mw.Api().postWithToken('csrf', { action: 'edit', ... })` 并返回 `{ success: true, revid: ... }`
- **AND** 浏览器打开 `MediaWiki:TestScript.js?action=raw` 可见新代码

#### Scenario: 页面不存在时创建

- **WHEN** Agent 提交到不存在的页面
- **THEN** 返回成功，新页面被创建

#### Scenario: 编辑冲突处理

- **WHEN** 两个 Agent 同时编辑同一页面
- **THEN** 后提交的返回 `{ success: false, error: 'editconflict' }`

## 需求 2：安全性 — CSRF 与会话保护

所有提交必须通过已登录用户的浏览器会话，使用 MediaWiki 的 CSRF token。

### 场景

#### Scenario: 无效会话请求被拒绝

- **WHEN** Agent 从未登录用户的浏览器请求 `/Tool:AI接口`（`mw.config.get('wgUserName')` 为 null）
- **THEN** 返回 `{ success: false, error: 'not_logged_in' }`

#### Scenario: CSRF 由浏览器 MediaWiki 负责

- **WHEN** 浏览器代理请求时调用 `mw.Api().postWithToken('csrf', ...)`
- **THEN** MediaWiki 自动验证 CSRF token；若无效则 API 拒绝

## 需求 3：错误恢复与日志

页面显示最近 10 条提交的状态（标题、摘要、结果、时间戳）。

### 场景

#### Scenario: 提交历史查看

- **WHEN** 用户打开 `Tool:AI接口`
- **THEN** 页面显示历史列表，最新的在前
- **AND** 点击条目可查看完整错误信息

---

**实现建议**

- 浏览器端：`MediaWiki:AgentAPI.js`
  - 监听全局 `window` 上的自定义事件或直接暴露 API 函数
  - 或简单方案：Agent 直接调用 `window.agentAPI = { submit: async (title, text, summary) => {...} }`
- 存储历史：使用浏览器 `localStorage` 或页面 DOM（刷新后丢失）
