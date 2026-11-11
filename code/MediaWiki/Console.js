/*global mw*/
/**
 * MediaWiki:Console.js — 控制台
 *
 * 由 {{libs|js=console}} 加载（Module:Libs 注册为站内页面，action=raw 输出）。
 * 通过 MediaWiki API 拉取分类:Works 成员，仅展示当前用户创建的作品，
 * 以卡片网格展示，提供搜索过滤、打开/编辑/新建入口。
 *
 * 创建者判定：generator=categorymembers + prop=revisions(rvdir=newer 取首个修订)。
 * 未登录时无法判定创建者，显示登录提示。
 *
 * 注意：MediaWiki Sanitizer 会过滤 wikitext 中的 <input>/<button> 等标签，
 * 因此所有控件都由本脚本动态创建。
 */
( function () {
	"use strict";

	var statsEl = document.getElementById( "console-stats" );
	var listEl = document.getElementById( "console-list" );
	if ( !listEl ) {
		return;
	}

	var me = mw.config.get( "wgUserName" ); // 当前登录用户，未登录为 null
	var members = [];
	var query = "";
	var loaded = false;

	// ---- 统计条（搜索 + 计数 + 新建入口） ----

	function buildStats() {
		if ( !statsEl ) {
			return;
		}
		statsEl.textContent = "";
		var wrap = document.createElement( "div" );
		wrap.className = "flex flex-wrap items-center gap-3 mb-6";

		var input = document.createElement( "input" );
		input.id = "console-search";
		input.type = "search";
		input.placeholder = "搜索作品…";
		input.className = "input input-bordered input-sm w-full sm:w-64";

		var count = document.createElement( "span" );
		count.id = "console-count";
		count.className = "text-sm text-base-content/60";

		var status = document.createElement( "span" );
		status.id = "console-status";
		status.className = "text-sm text-base-content/60";

		var create = document.createElement( "a" );
		create.href = "/wiki/特殊:新建页面";
		create.className = "btn btn-sm btn-primary ml-auto";
		create.textContent = "+ 新建作品";
		create.style.textDecoration = "none";

		wrap.appendChild( input );
		wrap.appendChild( count );
		wrap.appendChild( status );
		wrap.appendChild( create );
		statsEl.appendChild( wrap );

		var timer = null;
		input.addEventListener( "input", function () {
			clearTimeout( timer );
			timer = setTimeout( function () {
				query = input.value.trim().toLowerCase();
				render();
			}, 150 );
		} );
	}

	// ---- 作品卡片网格 ----

	function render() {
		var count = document.getElementById( "console-count" );
		var status = document.getElementById( "console-status" );

		// 未登录：提示登录
		if ( !me ) {
			if ( count ) {
				count.textContent = "";
			}
			if ( status ) {
				status.textContent = "";
			}
			listEl.textContent = "";
			var loginWrap = document.createElement( "div" );
			loginWrap.className = "text-center py-16";
			var loginMsg = document.createElement( "p" );
			loginMsg.className = "text-base-content/50 mb-4";
			loginMsg.textContent = "请先登录，查看你创建的作品。";
			var loginBtn = document.createElement( "a" );
			loginBtn.href = "/wiki/特殊:用户登录";
			loginBtn.className = "btn btn-primary";
			loginBtn.textContent = "登录";
			loginBtn.style.textDecoration = "none";
			loginWrap.appendChild( loginMsg );
			loginWrap.appendChild( loginBtn );
			listEl.appendChild( loginWrap );
			return;
		}

		// 过滤：搜索词 + 仅显示我创建的作品
		var filtered = members.filter( function ( m ) {
			if ( m.creator !== me ) {
				return false;
			}
			return !query || m.title.toLowerCase().indexOf( query ) !== -1;
		} );
		filtered.sort( function ( a, b ) {
			return ( b.pageid || 0 ) - ( a.pageid || 0 );
		} );

		if ( count ) {
			count.textContent = filtered.length + " 个作品";
		}
		if ( status ) {
			status.textContent = "";
		}

		listEl.textContent = "";
		if ( !loaded ) {
			var loading = document.createElement( "div" );
			loading.className = "text-center py-16 text-base-content/50";
			loading.textContent = "正在同步作品数据…";
			listEl.appendChild( loading );
			return;
		}

		if ( !filtered.length ) {
			var empty = document.createElement( "div" );
			empty.className = "text-center py-16 text-base-content/50";
			empty.textContent = members.length ?
				"这里没有你创建的作品。" :
				"暂无作品，点击右上角「+ 新建作品」开始。";
			listEl.appendChild( empty );
			return;
		}

		var grid = document.createElement( "div" );
		grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

		filtered.forEach( function ( m ) {
			var card = document.createElement( "div" );
			card.className =
				"card bg-base-100 border border-base-300 " +
				"hover:border-primary transition-colors";

			var body = document.createElement( "div" );
			body.className = "card-body p-5";

			var title = document.createElement( "h3" );
			title.className = "card-title text-base";
			title.textContent = m.title;

			var actions = document.createElement( "div" );
			actions.className = "card-actions mt-3";

			var open = document.createElement( "a" );
			open.href = m.title.replace( / /g, "_" );
			open.className = "btn btn-sm btn-primary";
			open.textContent = "打开";
			open.style.textDecoration = "none";

			var edit = document.createElement( "a" );
			edit.href = "/w/index.php?title=" + encodeURIComponent( m.title ) + "&action=edit";
			edit.className = "btn btn-sm btn-ghost";
			edit.textContent = "编辑";
			edit.style.textDecoration = "none";

			actions.appendChild( open );
			actions.appendChild( edit );
			body.appendChild( title );
			body.appendChild( actions );
			card.appendChild( body );
			grid.appendChild( card );
		} );

		listEl.appendChild( grid );
	}

	// ---- 数据 ----

	function load() {
		var status = document.getElementById( "console-status" );
		if ( status ) {
			status.textContent = "正在同步作品数据…";
		}
		var url =
			"/w/api.php?action=query&generator=categorymembers" +
			"&gcmtitle=Category:Works&gcmlimit=500" +
			"&prop=revisions&rvdir=newer&rvlimit=1&rvprop=user" +
			"&format=json&formatversion=2";
		fetch( url, { credentials: "same-origin" } )
			.then( function ( r ) {
				return r.json();
			} )
			.then( function ( data ) {
				var pages = ( data.query && data.query.pages ) || {};
				members = Object.keys( pages ).map( function ( pageid ) {
					var p = pages[ pageid ];
					var creator = ( p.revisions && p.revisions[ 0 ] ) ?
						p.revisions[ 0 ].user : "";
					return { title: p.title, pageid: p.pageid, creator: creator };
				} );
				loaded = true;
				render();
			} )
			.catch( function ( err ) {
				mw.log.error( "[console] 拉取作品失败: ", err );
				if ( status ) {
					status.textContent = "同步失败，请刷新重试。";
				}
			} );
	}

	buildStats();
	render();
	load();
} )();
