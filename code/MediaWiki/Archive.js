/*global mw*/
/**
 * MediaWiki:Archive.js — 观测档案库
 *
 * 由 {{libs|js=archive}} 加载（Module:Libs 注册为站内页面，action=raw 输出）。
 * 通过 MediaWiki API 动态拉取分类成员并渲染。
 *
 * 结构仿照 archive.org/details/texts 的 collection-page 布局
 * （#page-container > tab-manager > div:nth-child(1) 内的
 *  #collection-search-container + #collection-browser-container）：
 *
 *   #archive-search-container   搜索区
 *   #archive-browser-container
 *   └─ #content-container
 *      ├─ #left-column          过滤栏（facet-group：排序 / 首字母）
 *      └─ #right-column > #results
 *         ├─ #results-heading   结果计数
 *         ├─ #list-header       列头
 *         └─ #list-container    列表行（无封面，纯列表）
 *
 * 注意：MediaWiki Sanitizer 会过滤 wikitext 中的 <input>/<select>/<button> 等标签，
 * 因此所有控件都由本脚本动态创建。
 */
( function () {
	"use strict";

	var searchContainer = document.getElementById( "archive-search-container" );
	var browserContainer = document.getElementById( "archive-browser-container" );
	if ( !browserContainer ) {
		return;
	}

	var members = [];
	var sort = "az"; // az | za | new
	var letter = ""; // 首字母过滤
	var page = 0;
	var PAGE_SIZE = 20;

	// ---- 搜索区（collection-search-container） ----

	function buildSearch() {
		if ( !searchContainer ) {
			return;
		}
		searchContainer.textContent = "";
		var wrap = document.createElement( "div" );
		wrap.className = "flex flex-wrap items-center gap-3 mb-6";

		var input = document.createElement( "input" );
		input.id = "archive-search";
		input.type = "search";
		input.placeholder = "搜索条目…";
		input.className = "input input-bordered input-sm w-64";

		var count = document.createElement( "span" );
		count.id = "archive-count";
		count.className = "text-sm text-base-content/60";

		var status = document.createElement( "span" );
		status.id = "archive-status";
		status.className = "text-sm text-base-content/60";

		wrap.appendChild( input );
		wrap.appendChild( count );
		wrap.appendChild( status );
		searchContainer.appendChild( wrap );

		var timer = null;
		input.addEventListener( "input", function () {
			clearTimeout( timer );
			timer = setTimeout( function () {
				page = 0;
				render();
			}, 150 );
		} );
	}

	// ---- 浏览区（collection-browser-container） ----

	function buildBrowser() {
		browserContainer.textContent = "";

		var cc = document.createElement( "div" );
		cc.id = "content-container";
		cc.className = "flex flex-col md:flex-row gap-6";

		// 左栏：过滤
		var left = document.createElement( "div" );
		left.id = "left-column";
		left.className = "md:w-56 flex-none";

		var facets = document.createElement( "div" );
		facets.id = "facets-container";
		facets.className = "flex flex-col gap-5";

		facets.appendChild( makeFacetGroup( "排序", [
			[ "az", "标题 A-Z" ],
			[ "za", "标题 Z-A" ],
			[ "new", "最近添加" ]
		], "sort" ) );
		facets.appendChild( makeLetterGroup() );

		left.appendChild( facets );
		cc.appendChild( left );

		// 右栏：结果
		var right = document.createElement( "div" );
		right.id = "right-column";
		right.className = "flex-1 min-w-0";

		var results = document.createElement( "section" );
		results.id = "results";

		var heading = document.createElement( "h2" );
		heading.id = "results-heading";
		heading.className = "text-lg font-bold mb-3";
		results.appendChild( heading );

		var listHeader = document.createElement( "div" );
		listHeader.id = "list-header";
		listHeader.className =
			"flex items-center gap-3 px-4 py-2 text-xs text-base-content/50 " +
			"border-b border-base-200";
		var th1 = document.createElement( "span" );
		th1.className = "flex-1";
		th1.textContent = "标题";
		var th2 = document.createElement( "span" );
		th2.className = "w-8 text-right";
		th2.textContent = "";
		listHeader.appendChild( th1 );
		listHeader.appendChild( th2 );
		results.appendChild( listHeader );

		var list = document.createElement( "div" );
		list.id = "list-container";
		list.className =
			"flex flex-col divide-y divide-base-200 border border-base-300 " +
			"rounded-xl overflow-hidden";
		results.appendChild( list );

		var pager = document.createElement( "div" );
		pager.id = "archive-pager";
		pager.className = "flex items-center justify-center gap-4 mt-6";
		results.appendChild( pager );

		right.appendChild( results );
		cc.appendChild( right );

		browserContainer.appendChild( cc );

		buildPager();
	}

	// 过滤组（facet-group）
	function makeFacetGroup( title, options, type ) {
		var sec = document.createElement( "section" );
		sec.className = "facet-group";

		var h = document.createElement( "h3" );
		h.className = "text-sm font-semibold mb-2 text-base-content/70";
		h.textContent = title;
		sec.appendChild( h );

		var list = document.createElement( "div" );
		list.className = "flex flex-col gap-1";

		options.forEach( function ( o ) {
			var label = document.createElement( "label" );
			label.className =
				"flex items-center gap-2 text-sm cursor-pointer " +
				"hover:text-primary transition-colors";

			var radio = document.createElement( "input" );
			radio.type = "radio";
			radio.name = type;
			radio.value = o[ 0 ];
			radio.className = "radio radio-xs";
			if ( o[ 0 ] === "az" ) {
				radio.checked = true;
			}

			var span = document.createElement( "span" );
			span.textContent = o[ 1 ];

			label.appendChild( radio );
			label.appendChild( span );
			list.appendChild( label );

			radio.addEventListener( "change", function () {
				page = 0;
				sort = o[ 0 ];
				render();
			} );
		} );

		sec.appendChild( list );
		return sec;
	}

	// 首字母过滤组
	function makeLetterGroup() {
		var sec = document.createElement( "section" );
		sec.className = "facet-group";

		var h = document.createElement( "h3" );
		h.className = "text-sm font-semibold mb-2 text-base-content/70";
		h.textContent = "首字母";
		sec.appendChild( h );

		var wrap = document.createElement( "div" );
		wrap.className = "flex flex-wrap gap-1";

		"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split( "" ).forEach( function ( L ) {
			var b = document.createElement( "button" );
			b.className = "btn btn-xs btn-ghost";
			b.textContent = L;
			b.addEventListener( "click", function () {
				letter = letter === L ? "" : L;
				page = 0;
				render();
			} );
			wrap.appendChild( b );
		} );

		sec.appendChild( wrap );
		return sec;
	}

	// 分页
	function buildPager() {
		var pager = document.getElementById( "archive-pager" );
		if ( !pager ) {
			return;
		}
		pager.textContent = "";

		var prev = document.createElement( "button" );
		prev.id = "archive-prev";
		prev.className = "btn btn-sm btn-ghost";
		prev.textContent = "← 上一页";

		var pageEl = document.createElement( "span" );
		pageEl.id = "archive-page";
		pageEl.className = "text-sm text-base-content/60";

		var next = document.createElement( "button" );
		next.id = "archive-next";
		next.className = "btn btn-sm btn-ghost";
		next.textContent = "下一页 →";

		pager.appendChild( prev );
		pager.appendChild( pageEl );
		pager.appendChild( next );

		prev.addEventListener( "click", function () {
			if ( page > 0 ) {
				page--;
				render();
			}
		} );
		next.addEventListener( "click", function () {
			page++;
			render();
		} );
	}

	// ---- 数据 ----

	function load() {
		var status = document.getElementById( "archive-status" );
		if ( status ) {
			status.textContent = "正在同步观测数据…";
		}
		// CirrusSearch:incategory + 标题前缀,拿到创建者(最早修订)
		var url =
			"/w/api.php?action=query&generator=categorymembers" +
			"&gcmtitle=Category:Works&gcmlimit=500" +
			"&prop=revisions&rvdir=newer&rvlimit=1&rvprop=user|timestamp" +
			"&format=json&formatversion=2";
		fetch( url, { credentials: "same-origin" } )
			.then( function ( r ) {
				return r.json();
			} )
			.then( function ( data ) {
				// generator 返回 pages:提取标题+pageid+创建者
				var pages = ( data.query && data.query.pages ) || {};
				members = Object.keys( pages ).map( function ( pageid ) {
					var p = pages[ pageid ];
					return { title: p.title, pageid: p.pageid, creator: ( p.revisions && p.revisions[ 0 ] ) ? p.revisions[ 0 ].user : "" };
				} );
				render();
			} )
			.catch( function ( err ) {
				mw.log.error( "[archive] 拉取成员失败: ", err );
				if ( status ) {
					status.textContent = "同步失败,请刷新重试。";
				}
			} );
	}

	// 过滤 + 排序
	function getFiltered() {
		var input = document.getElementById( "archive-search" );
		var query = input ? input.value.trim().toLowerCase() : "";

		var filtered = members.filter( function ( m ) {
			if ( query && m.title.toLowerCase().indexOf( query ) === -1 ) {
				return false;
			}
			if ( letter ) {
				var first = m.title.charAt( 0 ).toUpperCase();
				if ( first !== letter ) {
					return false;
				}
			}
			return true;
		} );

		filtered.sort( function ( a, b ) {
			if ( sort === "za" ) {
				return b.title.localeCompare( a.title, "zh" );
			}
			if ( sort === "new" ) {
				return ( b.pageid || 0 ) - ( a.pageid || 0 );
			}
			return a.title.localeCompare( b.title, "zh" );
		} );
		return filtered;
	}

	// 渲染（完全防御：先确保浏览区容器存在，再统一获取引用，避免 fetch 回调晚于 DOM 重建）
	function render() {
		var filtered = getFiltered();
		var total = filtered.length;
		var pages = Math.max( 1, Math.ceil( total / PAGE_SIZE ) );
		if ( page >= pages ) {
			page = pages - 1;
		}
		if ( page < 0 ) {
			page = 0;
		}
		var slice = filtered.slice( page * PAGE_SIZE, ( page + 1 ) * PAGE_SIZE );

		// 确保浏览区 DOM 存在（cleanup/DOM 重建可能导致容器丢失）
		if ( !document.getElementById( "list-container" ) ) {
			buildBrowser();
		}

		var count = document.getElementById( "archive-count" );
		if ( count ) {
			count.textContent = total + " 条记录";
		}
		var status = document.getElementById( "archive-status" );
		if ( status ) {
			status.textContent = "";
		}
		var heading = document.getElementById( "results-heading" );
		if ( heading ) {
			heading.textContent = total + " 条记录";
		}
		var pageEl = document.getElementById( "archive-page" );
		if ( pageEl ) {
			pageEl.textContent = ( page + 1 ) + " / " + pages;
		}
		var prev = document.getElementById( "archive-prev" );
		if ( prev ) {
			prev.disabled = page <= 0;
		}
		var next = document.getElementById( "archive-next" );
		if ( next ) {
			next.disabled = page >= pages - 1;
		}

		var list = document.getElementById( "list-container" );
		if ( !list ) {
			return;
		}
		list.textContent = "";
		if ( !slice.length ) {
			var empty = document.createElement( "div" );
			empty.className = "text-center py-16 text-base-content/50";
			empty.textContent = members.length ? "没有匹配的条目。" : "暂无条目。";
			list.appendChild( empty );
			return;
		}

		slice.forEach( function ( m ) {
			var row = document.createElement( "a" );
			row.href = m.title.replace( / /g, "_" );
			row.className =
				"group flex items-center gap-3 px-4 py-3 bg-base-100/80 " +
				"hover:bg-primary/5 transition-colors";
			row.style.textDecoration = "none";

			var title = document.createElement( "span" );
			title.className =
				"flex-1 min-w-0 truncate text-base-content " +
				"group-hover:text-primary transition-colors";
			title.textContent = m.title;

			var arrow = document.createElement( "span" );
			arrow.className =
				"text-base-content/40 group-hover:text-primary " +
				"group-hover:translate-x-1 transition-all";
			arrow.textContent = "→";

			row.appendChild( title );
			row.appendChild( arrow );
			list.appendChild( row );
		} );
	}

	buildSearch();
	buildBrowser();
	load();
} )();
