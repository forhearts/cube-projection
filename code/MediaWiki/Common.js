/*global mw*/
/**
 * Common.js — libs 资源注入器 + cleanup + rehead（精简版）
 *
 * 自动识别页面中由 {{libs}} 模板输出的 .mw-use-resource 元素，
 * 读取 data-libs（Module:Libs 生成的 JSON，含 js/css URL 列表）并注入。
 *
 * 支持布尔开关（默认 false）：
 *   data-cleanup=true  → 清空页面，仅保留用户内容（.mw-parser-output）
 *   data-rehead=true   → 用 {{rehead}} 的内容重写 <head>
 *
 * 职责划分（Lua 优先，JS 只做浏览器端必须的事）：
 *   - 资源 URL 生成 / 去重 / 消毒 → Module:Libs（Lua）
 *   - head 内容校验与 HTML 生成 → Module:Rehead（Lua）
 *   - 本文件只负责：读取 JSON、注入资源、cleanup、把 Lua 生成的 head HTML 插入 DOM
 *
 * 性能设计：
 *   - JS 统一走 mw.loader.getScript，交由 RL 管理缓存与去重。
 *   - CSS 用真实 <link> 加载，onload 后才结束 loading。
 *   - rehead/cleanup 在资源注入前独立执行，互不阻塞。
 *   - cleanup 逐个移除页面级节点，避免 innerHTML="" 全量重建。
 */
( function () {
	"use strict";

	var LIB_TAG = "data-cp-libs";

	/**
	 * 清空页面：默认仅保留用户内容（.mw-parser-output）。
	 *
	 * 自定义保留：cleanSelectors 为逗号分隔的 CSS 选择器列表（来自 {{libs|clean=...}}）。
	 * 匹配的元素本身会从清理中保留下来，其余全部清除。
	 *
	 * @param {string[]} cleanSelectors 自定义保留选择器列表
	 */
	function cleanup( cleanSelectors ) {
		var content = document.querySelector( ".mw-parser-output" );
		if ( !content ) {
			return;
		}

		// 移除标题内嵌的编辑链接（[编辑 | 编辑源代码]）等界面残留。
		var chromeInside = content.querySelectorAll( ".mw-editsection, .mw-editsection-like, .mw-revision" );
		Array.prototype.forEach.call( chromeInside, function ( el ) {
			el.parentNode.removeChild( el );
		} );

		// 自定义保留：收集匹配元素本身（不保留祖先链，避免把整个 MediaWiki 界面容器带回来）。
		var keep = [];
		var seen = {};
		( cleanSelectors || [] ).forEach( function ( selector ) {
			if ( !selector ) {
				return;
			}
			var nodes = null;
			try {
				nodes = document.querySelectorAll( selector );
			} catch ( e ) {
				mw.log.warn( "[libs] clean 选择器无效: " + selector, e );
				return;
			}
			Array.prototype.forEach.call( nodes, function ( el ) {
				if ( !seen[ el ] ) {
					seen[ el ] = true;
					keep.push( el );
				}
			} );
		} );

		// 保留元素从原位置 detach
		keep.forEach( function ( el ) {
			if ( el.parentNode ) {
				el.parentNode.removeChild( el );
			}
		} );

		var body = document.body;
		while ( body.firstChild ) {
			body.removeChild( body.firstChild );
		}
		body.appendChild( content );
		// 保留元素按原顺序挂回 body（祖先在前）
		keep.forEach( function ( el ) {
			if ( el !== content && el.parentNode !== body ) {
				body.appendChild( el );
			}
		} );
		body.removeAttribute( "class" );
		mw.log( "[libs] cleanup 完成" );
	}

	/**
	 * 用 {{rehead}}（Module:Rehead，Lua）生成的 HTML 重写 <head>。
	 *
	 * Lua 侧已完成白名单校验与转义；这里用 DOMParser 解析（不执行脚本），
	 * 并做最后一道防线：移除任何 script/iframe/object/embed 与事件属性。
	 *
	 * @param {string} rawHtml .mw-rehead 文本节点中的 HTML
	 */
	function rehead( rawHtml ) {
		var head = document.head;

		// 摘出 libs 注入的 script/link
		var kept = [];
		Array.prototype.forEach.call( head.querySelectorAll( "[" + LIB_TAG + "]" ), function ( el ) {
			kept.push( el );
			el.parentNode.removeChild( el );
		} );

		// 清空 head
		while ( head.firstChild ) {
			head.removeChild( head.firstChild );
		}
		head.appendChild( document.createElement( "meta" ) ).setAttribute( "charset", "UTF-8" );

		// 解析 Lua 生成的 HTML（DOMParser 不执行脚本）
		var doc = null;
		try {
			doc = new DOMParser().parseFromString( rawHtml, "text/html" );
		} catch ( e ) {
			doc = null;
		}
		if ( doc ) {
			// 最后一道防线：移除可执行元素与事件属性（head 与 body 都要处理）
			var FORBIDDEN = { script: 1, iframe: 1, object: 1, embed: 1, foreignobject: 1 };
			var all = doc.querySelectorAll( "*" );
			Array.prototype.forEach.call( all, function ( el ) {
				if ( FORBIDDEN[ el.tagName.toLowerCase() ] ) {
					el.parentNode.removeChild( el );
					return;
				}
				Array.prototype.slice.call( el.attributes ).forEach( function ( attr ) {
					if ( attr.name.toLowerCase().indexOf( "on" ) === 0 ) {
						el.removeAttribute( attr.name );
					}
				} );
			} );
			// 移入真实 head（title/meta/style/link 在 doc.head，svg 等其余在 doc.body）
			while ( doc.head.firstChild ) {
				head.appendChild( doc.head.firstChild );
			}
			while ( doc.body.firstChild ) {
				head.appendChild( doc.body.firstChild );
			}
		}

		// 把 libs 资源挂回
		kept.forEach( function ( el ) {
			head.appendChild( el );
		} );
		mw.log( "[libs] rehead 完成" );
	}

	/**
	 * 注入资源。jsUrl 走 RL getScript，cssUrls 用真实 <link>，
	 * mods（ES module，如 stimulus）用动态 <script type="module"> 加载。
	 * 注意：不能用 import() 语法——MediaWiki 的 JavaScriptMinifier（wikimedia/minify 2.9.0）
	 * 不支持动态 import 表达式，会把整个脚本压缩坏。
	 * 返回 Promise，全部资源加载完毕（含失败）后 resolve，用于结束 loading。
	 *
	 * @param {string[]} jsUrls
	 * @param {string[]} cssUrls
	 * @param {string[]} mods
	 * @return {Promise}
	 */
	function inject( jsUrls, cssUrls, mods ) {
		var pending = [];
		( jsUrls || [] ).forEach( function ( url ) {
			if ( typeof url !== "string" || !url ) {
				return;
			}
			// 还原 Module:Libs 为防止 autolink 插入的零宽空格
			url = url.replace( /\u200b/g, "" );
			// getScript 返回 Promise，走 RL 缓存
			pending.push( mw.loader.getScript( url ).catch( function ( err ) {
				mw.log.error( "[libs] 加载 JS 失败: " + url, err );
			} ) );
		} );
		( cssUrls || [] ).forEach( function ( url ) {
			if ( typeof url !== "string" || !url ) {
				return;
			}
			url = url.replace( /\u200b/g, "" );
			pending.push( loadStylesheet( url ) );
		} );
		// ES module：动态创建 <script type="module"> 加载（minifier 安全），
		// 模块内自行把导出挂到 window.Stimulus（见 MediaWiki:Stimulus.js 包装模块）。
		( mods || [] ).forEach( function ( url ) {
			if ( typeof url !== "string" || !url ) {
				return;
			}
			url = url.replace( /\u200b/g, "" );
			pending.push( loadModule( url ) );
		} );
		return Promise.all( pending );
	}

	/**
	 * 用动态内联 <script type="module"> 加载 ES module（直接操作 head，无需 import() 语法）。
	 *
	 * 为什么不用 import()：MediaWiki 的 JavaScriptMinifier（wikimedia/minify 2.9.0）
	 * 不支持动态 import 表达式，会把整个 Common.js 压缩坏（页面空白）。
	 * 这里把 import 语句写在字符串里，minifier 不处理字符串内容，
	 * 浏览器以 module 方式执行时合法；模块导出整体挂到 window.Stimulus。
	 *
	 * @param {string} url
	 * @return {Promise}
	 */
	function loadModule( url ) {
		return new Promise( function ( resolve ) {
			var script = document.createElement( "script" );
			script.type = "module";
			// import 语句在字符串中：minifier 安全；module 执行时合法。
			script.textContent =
				'import * as mod from "' + url.replace( /"/g, '\\"' ) + '";' +
				'if ( !window.Stimulus && mod ) { window.Stimulus = mod; }';
			script.setAttribute( LIB_TAG, "1" );
			document.head.appendChild( script );

			// 轮询 window.Stimulus 就绪（module 脚本的 onload 在部分环境下不可靠）
			var tries = 0;
			var timer = setInterval( function () {
				tries++;
				if ( window.Stimulus ) {
					clearInterval( timer );
					resolve();
				} else if ( tries > 60 ) {
					// 5 秒超时（250ms × 60），避免 loading 遮罩卡死
					clearInterval( timer );
					mw.log.error( "[libs] 加载 ES module 超时: " + url );
					resolve();
				}
			}, 250 );
		} );
	}

	/**
	 * 加载 CSS 并等待其加载完成。
	 * 用真实 <link> 而非 mw.loader.load，便于拿到 onload 结束 loading。
	 *
	 * @param {string} url
	 * @return {Promise}
	 */
	function loadStylesheet( url ) {
		return new Promise( function ( resolve ) {
			var link = document.createElement( "link" );
			link.rel = "stylesheet";
			link.href = url;
			link.setAttribute( LIB_TAG, "1" );
			link.onload = function () {
				resolve();
			};
			link.onerror = function () {
				mw.log.error( "[libs] 加载 CSS 失败: " + url );
				resolve();
			};
			document.head.appendChild( link );
		} );
	}

	/**
	 * 显示全屏 loading 遮罩。
	 *
	 * 样式全部内联：rehead 会清空 head、cleanup 会清空 body，
	 * 依赖外部 CSS（如 Common.css/site styles）会被删除，因此必须自带样式。
	 *
	 * @return {HTMLElement} overlay 元素，用于之后移除
	 */
	function showLoading() {
		var style = document.createElement( "style" );
		style.textContent = "@keyframes cp-loading-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}";
		document.head.appendChild( style );

		var overlay = document.createElement( "div" );
		overlay.id = "cp-loading";
		overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;visibility:visible;";

		var spinner = document.createElement( "div" );
		spinner.style.cssText = "visibility:visible;width:52px;height:52px;border:5px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:cp-loading-spin .8s linear infinite;box-sizing:border-box;";

		var label = document.createElement( "div" );
		label.style.cssText = "visibility:visible;margin-top:18px;color:#6b7280;font:14px/1.5 'Segoe UI',system-ui,sans-serif;";
		label.textContent = "正在加载资源…";

		overlay.appendChild( spinner );
		overlay.appendChild( label );
		document.body.appendChild( overlay );
		return overlay;
	}

	function hideLoading( overlay, timer ) {
		clearTimeout( timer );
		if ( overlay && overlay.parentNode ) {
			overlay.parentNode.removeChild( overlay );
		}
	}

	/**
	 * 确保隐藏样式存在。
	 *
	 * rehead 会清空 head，可能连带移除 site.styles 里的隐藏规则，
	 * 因此在 rehead 之后补一条 JS 生成的 <style>，保证处理阶段页面仍处于隐藏。
	 */
	function ensureHide() {
		if ( document.getElementById( "cp-hide" ) ) {
			return;
		}
		var style = document.createElement( "style" );
		style.id = "cp-hide";
		style.textContent = "html,body{visibility:hidden}body #cp-loading,body #cp-loading *{visibility:visible!important}";
		document.head.appendChild( style );
	}

	/**
	 * 解除加载期隐藏，使页面内容可见。
	 *
	 * 移除 JS 生成的 #cp-hide 样式、带 data-cp-hide 标记的内联隐藏样式，
	 * 并用内联 visibility:visible 覆盖 site.styles 中的隐藏规则。
	 */
	function removeHideCss() {
		var hide = document.getElementById( "cp-hide" );
		if ( hide ) {
			hide.parentNode.removeChild( hide );
		}
		document.body.style.visibility = "visible";
		var els = document.querySelectorAll( "[data-cp-hide]" );
		Array.prototype.forEach.call( els, function ( el ) {
			el.parentNode.removeChild( el );
		} );
	}

	mw.loader.using( [ "mediawiki.util" ] ).then( function () {
		var nodes = document.querySelectorAll( ".mw-use-resource" );
		if ( !nodes.length ) {
			// 普通页面：无加载任务，立即解除隐藏，避免 Common.css 隐藏规则残留。
			removeHideCss();
			return;
		}

		var doCleanup = false;
		var doRehead = false;
		var cleanSelectors = [];
		var jsUrls = [];
		var cssUrls = [];
		var modUrls = [];
		var seen = {};
		Array.prototype.forEach.call( nodes, function ( node ) {
			if ( node.dataset.cleanup === "true" ) {
				doCleanup = true;
			}
			// 自定义保留选择器（逗号分隔），来自 {{libs|clean=...}}
			if ( node.dataset.clean ) {
				node.dataset.clean.split( "," ).forEach( function ( s ) {
					s = s.trim();
					if ( s ) {
						cleanSelectors.push( s );
					}
				} );
			}
			if ( node.dataset.rehead === "true" ) {
				doRehead = true;
			}
			// data-libs 由 Module:Libs 生成，作为文本节点内容输出：
			// textContent 天然解码实体，且不会被 MediaWiki 属性转义破坏。
			var raw = node.textContent;
			if ( raw ) {
				var data = null;
				try {
					data = JSON.parse( raw );
				} catch ( e ) {
					mw.log.error( "[libs] data-libs JSON 解析失败: ", e );
				}
				if ( data ) {
					( data.js || [] ).forEach( function ( url ) {
						if ( url && !seen[ "js:" + url ] ) {
							seen[ "js:" + url ] = true;
							jsUrls.push( url );
						}
					} );
					( data.mods || [] ).forEach( function ( url ) {
						if ( url && !seen[ "mod:" + url ] ) {
							seen[ "mod:" + url ] = true;
							modUrls.push( url );
						}
					} );
					( data.css || [] ).forEach( function ( url ) {
						if ( url && !seen[ "css:" + url ] ) {
							seen[ "css:" + url ] = true;
							cssUrls.push( url );
						}
					} );
				}
			}
			// 移除模板 span（含 JSON 文本），避免出现在最终页面。
			if ( node.parentNode ) {
				node.parentNode.removeChild( node );
			}
		} );

		// rehead 与 cleanup 不依赖资源，先独立执行。
		// rehead 在 cleanup 之前，避免 .mw-rehead 被清掉。
		if ( doRehead ) {
			var reheadNode = document.querySelector( ".mw-rehead" );
			if ( reheadNode ) {
				// HTML 作为文本节点内容；textContent 天然解码实体。
				var rawHtml = reheadNode.textContent;
				reheadNode.parentNode.removeChild( reheadNode );
				rehead( rawHtml );
			} else {
				mw.log.warn( "[libs] 页面声明了 rehead=true 但找不到 .mw-rehead" );
			}
		}
		if ( doCleanup ) {
			cleanup( cleanSelectors );
		}

		// rehead 清空 head 后补回隐藏样式，保证 libs 加载期间页面保持空白。
		// 随后创建 loading 遮罩，加载完成才解除隐藏——顺序上"先盖后显"，杜绝原始页闪现。
		ensureHide();
		var overlay = showLoading();
		var timer = setTimeout( function () {
			removeHideCss();
			hideLoading( overlay, timer );
		}, 15000 );

		return inject( jsUrls, cssUrls, modUrls ).then( function () {
			removeHideCss();
			hideLoading( overlay, timer );
		} );
	} );
} )();
