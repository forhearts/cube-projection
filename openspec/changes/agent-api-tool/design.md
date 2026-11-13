# 设计

## 架构

```
Agent (Python script)
    ↓ HTTP POST
已登录用户浏览器
    ↓ JavaScript (fetch)
Tool:AI接口 页面
    ↓ Tailwind UI 显示历史 + 暴露 window.agentAPI
MediaWiki:AgentAPI.js
    ↓ mw.Api().postWithToken('csrf')
MediaWiki API (编辑端点)
    ↓ 提交到 wiki
```

## 实现策略

### 1. 页面结构（`code/Tool/AI接口`）

```wikitext
{{rehead|title=AI 接口 - Agent 代理编辑工具}}
{{libs|css=daisyui|js=tailwind,agentapi|cleanup=true|rehead=true}}

<div class="p-6">
<h1>Agent API</h1>
<p>为 AI agent 提供 wiki 编辑代理接口。访问此页后，agent 可向你的浏览器发送编辑请求。</p>
<div id="api-status"></div>
<div id="api-history"></div>
</div>
```

### 2. 脚本逻辑（`MediaWiki:AgentAPI.js`）

```javascript
// 暴露全局 API
window.agentAPI = {
  submit: async (title, text, summary) => {
    // 检查登录状态
    const userName = mw.config.get('wgUserName');
    if (!userName) {
      return { success: false, error: 'not_logged_in' };
    }

    // 调用 MediaWiki API
    try {
      const result = await new mw.Api().postWithToken('csrf', {
        action: 'edit',
        title: title,
        text: text,
        summary: summary,
        format: 'json'
      });

      if (result.edit && result.edit.result === 'Success') {
        logHistory(title, summary, 'success', result.edit.pageid, result.edit.lastrevid);
        return {
          success: true,
          pageid: result.edit.pageid,
          revid: result.edit.lastrevid,
          timestamp: new Date().toISOString()
        };
      } else {
        const msg = result.error ? result.error.info : 'Unknown error';
        logHistory(title, summary, 'error', null, null, msg);
        return {
          success: false,
          error: result.error?.code || 'unknown',
          message: msg
        };
      }
    } catch (e) {
      logHistory(title, summary, 'error', null, null, e.message);
      return { success: false, error: 'network_error', message: e.message };
    }
  }
};

// 简单日志（localStorage）
function logHistory(title, summary, status, pageid, revid, error) {
  const log = JSON.parse(localStorage.getItem('agentAPI_log') || '[]');
  log.unshift({
    title, summary, status, pageid, revid, error,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('agentAPI_log', JSON.stringify(log.slice(0, 50)));
  updateHistoryUI();
}

// 显示历史
function updateHistoryUI() {
  const log = JSON.parse(localStorage.getItem('agentAPI_log') || '[]');
  const el = document.getElementById('api-history');
  if (!el) return;
  
  el.innerHTML = '<h2>最近提交</h2>' + log.map(item => `
    <div class="card bg-base-100 shadow-sm mb-2">
      <div class="card-body p-3">
        <div class="text-sm"><strong>${item.title}</strong> — ${item.summary}</div>
        <div class="text-xs text-base-content/50">${item.status === 'success' ? '✓ 成功' : '✗ ' + item.error}</div>
        <div class="text-xs text-base-content/30">${item.timestamp}</div>
      </div>
    </div>
  `).join('');
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  updateHistoryUI();
  document.getElementById('api-status').innerHTML = `<div class="alert alert-info">
    登录为 <strong>${mw.config.get('wgUserName') || '未登录'}</strong>。
    Agent 可调用 <code>window.agentAPI.submit(title, text, summary)</code> 提交编辑。
  </div>`;
});
```

### 3. 模块注册（`Module/Libs`）

在 `LIBRARIES.js` 表中添加：

```lua
agentapi = {
  page = 'MediaWiki:AgentAPI.js',
  version = '1',
  depends = {}
}
```

### 4. 对 Agent 的 API 使用说明

Agent 在已登录浏览器页面中运行此代码：

```javascript
const result = await window.agentAPI.submit(
  '模块:Navbar',                    // 目标页面
  '{{新内容}}',                     // 文本
  'feat: 移动端适配'                // 摘要
);
console.log(result); // { success: true, pageid: 123, revid: 456, ... }
```

## 决策

- **UI 简洁**：仅显示历史日志，不需要表单（Agent 直接调用 API）
- **会话绑定**：`window.agentAPI` 对象访问浏览器的登录用户信息，无法跨域
- **历史持久化**：用 localStorage 保留最近 50 条记录（页面刷新后丢失）
- **错误处理**：所有错误通过 MediaWiki API 原生错误码返回，agent 可自行判断

## 风险

- localStorage 在浏览器本地易访问；若需隐私保护应改用会话存储或后端存储
- Agent 脚本必须在已登录用户的浏览器标签中手动执行，不能后台自动运行
