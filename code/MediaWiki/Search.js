/*global mw*/
/**
 * MediaWiki:Search.js — 搜索结果控制台(Tool:搜索 页面)
 *
 * 由 {{libs|js=search}} 加载(Module:Libs 注册为站内页面,action=raw 输出)。
 *
 * 本页基于 CirrusSearch 构建——CirrusSearch 是 MediaWiki 对 Elasticsearch
 * 的封装,list=search API 即 ES 查询层。页面仿 Kibana/EUI Search Bar 交互:
 *
 *   - 顶部：查询输入框(直接输入 Elasticsearch 查询语法)
 *   - 筛选器栏：已激活的 filter chip(命名空间/分类),可点 × 移除
 *   - 左栏：ES 查询控制(命名空间多选、排序、语法快捷插入)
 *   - 右栏：结果列表(摘要/字数/更新时间)
 *
 * 支持的 Elasticsearch / CirrusSearch 语法(直接输入即生效):
 *   incategory:Works          按分类过滤(ES term query)
 *   insource:"全文内容"        正文全文匹配(ES match_phrase)
 *   prefix:页面名             标题前缀(ES prefix query)
 *   deepcat:分类名           递归分类
 *   Uni*                     通配符(ES wildcard)
 *   A AND B / A OR B / -A    布尔运算
 *   "精确短语"               短语匹配
 *
 * 排序(srsort):
 *   relevance              相关度(ES _score,默认)
 *   incoming_links_desc    被链接数(ES field sort)
 *   create_timestamp_desc  创建时间
 *
 * 注意：MediaWiki Sanitizer 会过滤 wikitext 中的 <input>/<button> 等标签，
 * 因此所有控件都由本脚本动态创建。
 */
( function () {
	"use strict";

	var barEl = document.getElementById( "search-box" );   // 顶部查询栏
	var filterEl = document.getElementById( "search-facets" ); // filter chip 栏
	var ctrlEl = document.getElementById( "search-controls" ); // 左栏控制
	var resultEl = document.getElementById( "search-results" ); // 右栏结果

	var query = "";       // 查询串(原始输入,含 ES 语法)
	var nsList = [];      // 激活的命名空间(空 = 全部)
	var sort = "relevance";
	var category = "";    // 激活的分类(incategory)
	var page = 0;
	var PAGE_SIZE = 20;

	var NS_OPTIONS = [
		[ "0", "主命名空间" ],
		[ "1", "讨论" ],
		[ "4", "站点" ],
		[ "6", "文件" ],
		[ "10", "模板" ],
		[ "14", "分类" ],
		[ "828", "模块" ],
		[ "3000", "Docs" ],
		[ "9594", "Tool" ]
	];

	var CAT_OPTIONS = [ "Works" ];

	// ---- 顶部查询栏(EUI Search Bar 风格) ----

	function buildBar() {
		if ( !barEl ) {
			return;
		}
		barEl.textContent = "";

		var panel = document.createElement( "div" );
		panel.className =
			"rounded-xl border border-base-300 bg-base-200/60 " +
			"p-2 flex items-center gap-2";

		var input = document.createElement( "input" );
		input.id = "search-input";
		input.type = "search";
		input.placeholder = "查询…支持 ES 语法：incategory:Works  insource:\"正文\"  Uni*  \"短语\"  A AND B";
		input.className = "input input-bordered flex-1 min-w-0";

		var hint = document.createElement( "span" );
		hint.id = "search-count";
		hint.className = "text-xs text-base-content/50 whitespace-nowrap";
		hint.textContent = "";

		var btn = document.createElement( "button" );
		btn.id = "search-go";
		btn.className = "btn btn-primary btn-sm";
		btn.textContent = "Go";

		panel.appendChild( input );
		panel.appendChild( hint );
		panel.appendChild( btn );
		barEl.appendChild( panel );

		// 语法快捷条(点击插入片段)
		var chips = document.createElement( "div" );
		chips.className = "flex flex-wrap gap-1 mt-2";
		var snippets = [
			[ "分类", "incategory:Works" ],
			[ "正文", 'insource:""' ],
			[ "前缀", "prefix:" ],
			[ "AND", " AND " ],
			[ "OR", " OR " ],
			[ "NOT", " -" ],
			[ "通配符", "*" ],
			[ "短语", '""' ]
		];
		snippets.forEach( function ( s ) {
			var b = document.createElement( "button" );
			b.className = "btn btn-xs btn-ghost border border-base-300";
			b.textContent = s[ 0 ];
			b.title = s[ 1 ];
			b.addEventListener( "click", function () {
				input.focus();
				var start = input.selectionStart || input.value.length;
				var end = input.selectionEnd || input.value.length;
				input.value = input.value.slice( 0, start ) + s[ 1 ] + input.value.slice( end );
				input.focus();
				query = input.value;
				page = 0;
				load();
			} );
			chips.appendChild( b );
		} );
		barEl.appendChild( chips );

		var timer = null;
		input.addEventListener( "input", function () {
			clearTimeout( timer );
			timer = setTimeout( function () {
				query = input.value.trim();
				page = 0;
				load();
			}, 400 );
		} );
		btn.addEventListener( "click", function () {
			query = input.value.trim();
			page = 0;
			load();
		} );
	}

	// ---- 筛选器 chip 栏(已激活的筛选,可移除) ----

	function buildFilterBar() {
		if ( !filterEl ) {
			return;
		}
		filterEl.textContent = "";
		var wrap = document.createElement( "div" );
		wrap.className = "flex flex-wrap items-center gap-2 mb-4 min-h-8";

		var label = document.createElement( "span" );
		label.className = "text-xs text-base-content/50";
		label.textContent = "筛选器：";
		wrap.appendChild( label );

		var has = false;

		// 命名空间 chips
		nsList.forEach( function ( ns ) {
			has = true;
			var opt = NS_OPTIONS.filter( function ( o ) {
				return o[ 0 ] === String( ns );
			} )[ 0 ];
			wrap.appendChild( makeChip( "命名空间: " + ( opt ? opt[ 1 ] : ns ), function () {
				nsList = nsList.filter( function ( n ) {
					return n !== ns;
				} );
				page = 0;
				load();
			} ) );
		} );

		// 分类 chip
		if ( category ) {
			has = true;
			wrap.appendChild( makeChip( "分类: " + category, function () {
				category = "";
				page = 0;
				load();
			} ) );
		}

		if ( !has ) {
			var none = document.createElement( "span" );
			none.className = "text-xs text-base-content/40";
			none.textContent = "无 — 在左侧勾选命名空间或分类";
			wrap.appendChild( none );
		}

		filterEl.appendChild( wrap );
	}

	function makeChip( text, onRemove ) {
		var chip = document.createElement( "span" );
		chip.className =
			"inline-flex items-center gap-1 text-xs rounded-full " +
			"bg-primary/10 text-primary border border-primary/20 px-2 py-0.5";

		var t = document.createElement( "span" );
		t.textContent = text;
		chip.appendChild( t );

		var x = document.createElement( "button" );
		x.className = "btn btn-xs btn-circle btn-ghost ml-0.5";
		x.style.minHeight = "16px";
		x.style.height = "16px";
		x.style.width = "16px";
		x.textContent = "×";
		x.addEventListener( "click", onRemove );
		chip.appendChild( x );

		return chip;
	}

	// ---- 左栏：ES 查询控制 ----

	function buildControls() {
		if ( !ctrlEl ) {
			return;
		}
		ctrlEl.textContent = "";

		// 命名空间多选
		var nsSec = makeControlSection( "命名空间" );
		NS_OPTIONS.forEach( function ( o ) {
			var label = document.createElement( "label" );
			label.className =
				"flex items-center gap-2 text-sm cursor-pointer " +
				"hover:text-primary transition-colors";

			var cb = document.createElement( "input" );
			cb.type = "checkbox";
			cb.value = String( o[ 0 ] );
			cb.className = "checkbox checkbox-xs";
			if ( nsList.indexOf( o[ 0 ] ) !== -1 ) {
				cb.checked = true;
			}

			var span = document.createElement( "span" );
			span.textContent = o[ 1 ];

			label.appendChild( cb );
			label.appendChild( span );
			nsSec.appendRow( label );

			cb.addEventListener( "change", function () {
				if ( cb.checked ) {
					if ( nsList.indexOf( cb.value ) === -1 ) {
						nsList.push( cb.value );
					}
				} else {
					nsList = nsList.filter( function ( n ) {
						return n !== cb.value;
					} );
				}
				page = 0;
				load();
			} );
		} );
		ctrlEl.appendChild( nsSec.el );

		// 分类过滤
		var catSec = makeControlSection( "分类" );
		CAT_OPTIONS.forEach( function ( c ) {
			var label = document.createElement( "label" );
			label.className =
				"flex items-center gap-2 text-sm cursor-pointer " +
				"hover:text-primary transition-colors";

			var cb = document.createElement( "input" );
			cb.type = "checkbox";
			cb.value = c;
			cb.className = "checkbox checkbox-xs";
			if ( category === c ) {
				cb.checked = true;
			}

			var span = document.createElement( "span" );
			span.textContent = c;

			label.appendChild( cb );
			label.appendChild( span );
			catSec.appendRow( label );

			cb.addEventListener( "change", function () {
				category = cb.checked ? c : "";
				page = 0;
				load();
			} );
		} );
		ctrlEl.appendChild( catSec.el );

		// 排序(ES sort)
		var sortSec = makeControlSection( "排序" );
		var sortOpts = [
			[ "relevance", "相关度（ES _score）" ],
			[ "incoming_links_desc", "被链接数最多" ],
			[ "incoming_links_asc", "被链接数最少" ],
			[ "create_timestamp_desc", "创建时间最新" ],
			[ "create_timestamp_asc", "创建时间最旧" ]
		];
		sortOpts.forEach( function ( o ) {
			var label = document.createElement( "label" );
			label.className =
				"flex items-center gap-2 text-sm cursor-pointer " +
				"hover:text-primary transition-colors";

			var radio = document.createElement( "input" );
			radio.type = "radio";
			radio.name = "search-sort";
			radio.value = o[ 0 ];
			radio.className = "radio radio-xs";
			if ( sort === o[ 0 ] ) {
				radio.checked = true;
			}

			var span = document.createElement( "span" );
			span.textContent = o[ 1 ];

			label.appendChild( radio );
			label.appendChild( span );
			sortSec.appendRow( label );

			radio.addEventListener( "change", function () {
				sort = o[ 0 ];
				page = 0;
				load();
			} );
		} );
		ctrlEl.appendChild( sortSec.el );
	}

	// 控制区块容器
	function makeControlSection( title ) {
		var sec = document.createElement( "section" );
		var h = document.createElement( "h3" );
		h.className = "text-xs font-semibold text-base-content/60 mb-2 uppercase tracking-wide";
		h.textContent = title;
		sec.appendChild( h );

		var rows = document.createElement( "div" );
		rows.className = "flex flex-row flex-wrap gap-x-4 gap-y-1.5 md:flex-col";
		sec.appendChild( rows );

		return {
			el: sec,
			appendRow: function ( node ) {
				rows.appendChild( node );
			}
		};
	}

	// ---- 右栏：结果 ----

	function renderResults( data ) {
		resultEl.textContent = "";
		var total = ( data.query && data.query.searchinfo && data.query.searchinfo.totalhits ) || 0;
		var hits = ( data.query && data.query.search ) || [];

		// 计数 + 排序说明
		var header = document.createElement( "div" );
		header.className = "flex items-center justify-between mb-3";
		var count = document.createElement( "div" );
		count.className = "text-sm text-base-content/60";
		count.textContent = total + " 条结果" + ( sort === "relevance" ? " · 按相关度" : "" );
		var esbadge = document.createElement( "span" );
		esbadge.className = "badge badge-ghost badge-xs";
		esbadge.textContent = "Elasticsearch";
		esbadge.title = "基于 CirrusSearch(CirrusSearch 是 MediaWiki 的 Elasticsearch 集成)";
		header.appendChild( count );
		header.appendChild( esbadge );
		resultEl.appendChild( header );

		if ( !hits.length ) {
			var empty = document.createElement( "div" );
			empty.className = "text-center py-16 text-base-content/50";
			empty.textContent = query ? "没有匹配的结果。" : "输入查询词,或点击上方语法片段构建查询。";
			resultEl.appendChild( empty );
			return;
		}

		var list = document.createElement( "div" );
		list.className =
			"flex flex-col divide-y divide-base-200 border border-base-300 " +
			"rounded-xl overflow-hidden";

		hits.forEach( function ( h ) {
			var row = document.createElement( "a" );
			row.href = h.title.replace( / /g, "_" );
			row.className =
				"group flex items-start gap-3 px-4 py-3 bg-base-100/80 " +
				"hover:bg-primary/5 transition-colors";
			row.style.textDecoration = "none";

			var main = document.createElement( "div" );
			main.className = "flex-1 min-w-0";

			// 命名空间徽标(非主命名空间)
			if ( h.ns && h.ns !== 0 ) {
				var nsName = NS_OPTIONS.filter( function ( o ) {
					return o[ 0 ] === String( h.ns );
				} )[ 0 ];
				if ( nsName ) {
					var badge = document.createElement( "span" );
					badge.className = "badge badge-outline badge-xs mr-1.5 align-middle";
					badge.textContent = nsName[ 1 ];
					main.appendChild( badge );
				}
			}

			var title = document.createElement( "span" );
			title.className =
				"font-semibold text-sm text-base-content " +
				"group-hover:text-primary transition-colors align-middle";
			title.textContent = h.title;
			main.appendChild( title );

			if ( h.snippet ) {
				var snip = document.createElement( "div" );
				snip.className = "text-xs text-base-content/60 mt-1 line-clamp-2";
				snip.textContent = h.snippet.replace( /<[^>]+>/g, "" ).slice( 0, 220 );
				main.appendChild( snip );
			}

			var meta = document.createElement( "div" );
			meta.className = "text-xs text-base-content/40 mt-1";
			var parts = [];
			if ( h.wordcount ) {
				parts.push( h.wordcount + " 字" );
			}
			if ( h.timestamp ) {
				parts.push( "更新 " + h.timestamp.slice( 0, 10 ) );
			}
			meta.textContent = parts.join( " · " );
			main.appendChild( meta );

			var arrow = document.createElement( "span" );
			arrow.className =
				"text-base-content/40 group-hover:text-primary " +
				"group-hover:translate-x-1 transition-all";
			arrow.textContent = "→";

			row.appendChild( main );
			row.appendChild( arrow );
			list.appendChild( row );
		} );

		resultEl.appendChild( list );

		// 分页
		var pages = Math.max( 1, Math.ceil( total / PAGE_SIZE ) );
		if ( page >= pages ) {
			page = pages - 1;
		}
		var pager = document.createElement( "div" );
		pager.className = "flex items-center justify-center gap-4 mt-6";

		var prev = document.createElement( "button" );
		prev.className = "btn btn-sm btn-ghost";
		prev.textContent = "← 上一页";
		prev.disabled = page <= 0;
		prev.addEventListener( "click", function () {
			page--;
			load();
		} );

		var pageLabel = document.createElement( "span" );
		pageLabel.className = "text-sm text-base-content/60";
		pageLabel.textContent = ( page + 1 ) + " / " + pages;

		var next = document.createElement( "button" );
		next.className = "btn btn-sm btn-ghost";
		next.textContent = "下一页 →";
		next.disabled = page >= pages - 1;
		next.addEventListener( "click", function () {
			page++;
			load();
		} );

		pager.appendChild( prev );
		pager.appendChild( pageLabel );
		pager.appendChild( next );
		resultEl.appendChild( pager );
	}

	// ---- 数据(组合查询串) ----

	function load() {
		// 合成最终查询串:原始输入 + 分类 + 命名空间作为独立参数
		var raw = query;

		var params = new URLSearchParams( {
			action: "query",
			list: "search",
			srsearch: raw,
			srlimit: String( PAGE_SIZE ),
			sroffset: String( page * PAGE_SIZE ),
			srinfo: "totalhits",
			srprop: "snippet|wordcount|timestamp|size",
			srsort: sort,
			format: "json",
			formatversion: "2"
		} );

		// 分类:追加 incategory:(如用户已手写则不重复)
		if ( category && raw.indexOf( "incategory:" ) === -1 ) {
			params.set( "srsearch", ( raw ? raw + " " : "" ) + "incategory:" + category );
		}

		// 命名空间:空 = 全部;1 个 = srnamespace;多个 = 竖线 join
		if ( nsList.length === 1 ) {
			params.set( "srnamespace", nsList[ 0 ] );
		} else if ( nsList.length > 1 ) {
			params.set( "srnamespace", nsList.join( "|" ) );
		}

		// UI 反馈
		var countEl = document.getElementById( "search-count" );
		if ( countEl ) {
			countEl.textContent = "…";
		}
		buildFilterBar();

		resultEl.textContent = "";
		if ( !raw && !category && nsList.length === 0 ) {
			var hint = document.createElement( "div" );
			hint.className = "text-center py-16 text-base-content/50";
			hint.textContent = "输入查询开始。可组合左侧筛选器构建 Elasticsearch 查询。";
			resultEl.appendChild( hint );
			if ( countEl ) {
				countEl.textContent = "";
			}
			return;
		}

		var loading = document.createElement( "div" );
		loading.className = "text-center py-16 text-base-content/50";
		loading.textContent = "查询 Elasticsearch…";
		resultEl.appendChild( loading );

		fetch( "/w/api.php?" + params.toString(), { credentials: "same-origin" } )
			.then( function ( r ) {
				return r.json();
			} )
			.then( function ( data ) {
				if ( data.error ) {
					resultEl.textContent = "";
					var err = document.createElement( "div" );
					err.className = "text-center py-8 text-error";
					err.textContent = "查询出错: " + ( data.error.info || data.error.code );
					resultEl.appendChild( err );
					if ( countEl ) {
						countEl.textContent = "";
					}
					return;
				}
				var total = ( data.query && data.query.searchinfo && data.query.searchinfo.totalhits ) || 0;
				if ( countEl ) {
					countEl.textContent = total ? total + " 条" : "";
				}
				renderResults( data );
			} )
			.catch( function ( err ) {
				mw.log.error( "[search] 查询失败: ", err );
				resultEl.textContent = "";
				var fail = document.createElement( "div" );
				fail.className = "text-center py-8 text-base-content/50";
				fail.textContent = "查询失败,请重试。";
				resultEl.appendChild( fail );
				if ( countEl ) {
					countEl.textContent = "";
				}
			} );
	}

	buildBar();
	buildControls();
	buildFilterBar();
	load();
} )();
