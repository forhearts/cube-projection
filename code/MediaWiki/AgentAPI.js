// MediaWiki:AgentAPI.js — Agent 代理编辑接口
// 暴露 window.agentAPI.submit(title, text, summary) 供 agent 调用

(function() {
	'use strict';

	// 暴露全局 API
	window.agentAPI = {
		submit: async function(title, text, summary) {
			// 检查登录状态
			const userName = mw.config.get('wgUserName');
			if (!userName) {
				return { success: false, error: 'not_logged_in', message: '未登录' };
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
					logHistory(title, summary, 'success', result.edit.pageid, result.edit.lastrevid, '');
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
						error: result.error ? result.error.code : 'unknown',
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
			title: title,
			summary: summary,
			status: status,
			pageid: pageid,
			revid: revid,
			error: error,
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

		let html = '<h2>最近提交</h2>';
		if (log.length === 0) {
			html += '<p class="text-base-content/50">暂无记录</p>';
		} else {
			html += log.map(item => {
				const status = item.status === 'success' ? '✓ 成功' : ('✗ ' + (item.error || '失败'));
				return `<div class="card bg-base-100 shadow-sm mb-2">
					<div class="card-body p-3">
						<div class="text-sm"><strong>${item.title}</strong> — ${item.summary}</div>
						<div class="text-xs text-base-content/50">${status}</div>
						<div class="text-xs text-base-content/30">${item.timestamp}</div>
					</div>
				</div>`;
			}).join('');
		}
		el.innerHTML = html;
	}

	// 初始化
	document.addEventListener('DOMContentLoaded', function() {
		updateHistoryUI();
		const statusEl = document.getElementById('api-status');
		if (statusEl) {
			const userName = mw.config.get('wgUserName');
			const loginStatus = userName
				? `登录为 <strong>${userName}</strong>`
				: '<strong style="color:red">未登录</strong>';
			statusEl.innerHTML = `<div class="alert alert-info">
				${loginStatus}。Agent 可调用 <code>window.agentAPI.submit(title, text, summary)</code> 提交编辑。
			</div>`;
		}
	});
})();
