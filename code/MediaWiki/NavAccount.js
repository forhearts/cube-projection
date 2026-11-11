/*global mw*/
/**
 * MediaWiki:NavAccount.js — 导航栏账户项（独立小脚本，不依赖 Common.js 业务逻辑）
 *
 * 由 {{libs|js=navaccount}} 加载（Module:Libs 注册为站内页面，action=raw 输出）。
 *
 * 为什么不用服务端方案：
 *   - {{USERNAME}} 在 Miraheze 被禁用（渲染成 模板:USERNAME）
 *   - mw.user.getName() 在 Scribunto 里不可用（mw.user 为 nil）
 *   - 页面渲染是服务端缓存，解析器/模板永远拿不到"当前用户"
 * 因此只能在客户端用 mw.config.get('wgUserName') 判断。
 *
 * 行为：
 *   - 已登录 → 把 #nav-account 改为指向当前用户页（User:用户名）的链接
 *   - 未登录 → 改为指向 Special:CreateAccount（创建账户）
 */
( function () {
	"use strict";

	var account = document.getElementById( "nav-account" );
	if ( !account ) {
		return;
	}

	var userName = mw.config.get( "wgUserName" );
	var link = document.createElement( "a" );
	if ( userName ) {
		link.href = mw.util.getUrl( "User:" + userName );
		link.textContent = "账户";
	} else {
		link.href = mw.util.getUrl( "Special:CreateAccount" );
		link.textContent = "创建账户";
	}
	account.textContent = "";
	account.appendChild( link );
} )();
