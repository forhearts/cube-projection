/*global mw, inkjs*/
/**
 * MediaWiki:Ink.js — Ink 文字冒险游戏 Player(平台可信 Runtime)
 *
 * 由 {{libs|js=ink,inkplayer}} 加载：
 *   - ink     → inkjs 2.3.0(CDN,UMD,挂到 window.inkjs)
 *   - inkplayer → 本脚本
 *
 * 游戏 JSON 通过 rehead 的 link 参数声明(白名单校验)：
 *   {{rehead|link=ink-game:https://cdn.jsdelivr.net/.../story.json}}
 * 或站内文件：link=ink-game:/wiki/File:story.json
 *
 * 管线：<link rel="ink-game" href=...> → InkGameLoader → fetch → JSON
 *       → new inkjs.Story(json) → InkStory(adapter) → InkRenderer → DOM
 *
 * 安全设计：
 *   - Ink JSON 是不可信数据，仅交给 inkjs 解释(Ink 脚本语言，非 JavaScript)
 *   - 文本/选择/标签一律用 textContent 写入 DOM,绝不 innerHTML
 *   - 错误消息用文本节点展示，不注入 HTML
 *   - 不 eval / new Function / document.write
 */
( function () {
	"use strict";

	function log() {
		mw.log.apply( mw, [ "[ink] " + arguments[ 0 ] ].concat( Array.prototype.slice.call( arguments, 1 ) ) );
	}

	// ---------- InkGameLoader ----------

	var Loader = {
		/**
		 * 发现页面内 link[rel="ink-game"] 并加载。
		 * @param {string} selectors 额外选择器(默认 'link[rel="ink-game"]')
		 * @return {Promise<Array>} 每个游戏 {name, story} 数组
		 */
		discover: function ( selectors ) {
			var links = document.querySelectorAll( selectors || 'link[rel="ink-game"]' );
			var games = [];
			Array.prototype.forEach.call( links, function ( el ) {
				var href = el.getAttribute( "href" ) || "";
				if ( href ) {
					games.push( { name: el.getAttribute( "data-name" ) || "", href: href, el: el } );
				}
			} );
			return games;
		},

		/**
		 * 加载一个游戏：fetch → 文本 → 剥离注释前缀 → JSON → Story
		 *
		 * 兼容两种上传方式：
		 *   - API 创建：File:xxx.json（contentmodel=json，无前缀）
		 *   - 特殊:上传：File:xxx.json.txt（MIME 校验要求内容为纯文本，
		 *     用户需在 JSON 前加一行 // 注释，如：
		 *       // Ink story (JSON follows)
		 *       {"inkVersion":21,...}
		 *     本函数自动剥离首行 // 注释后再解析）
		 *
		 * @param {string} href
		 * @return {Promise} resolve(story)
		 */
		loadStory: function ( href ) {
			return fetch( href, { credentials: "same-origin" } )
				.then( function ( r ) {
					if ( !r.ok ) {
						throw new Error( "HTTP " + r.status + " " + r.statusText );
					}
					return r.text();
				} )
				.then( function ( text ) {
					// 剥离首行 // 注释（特殊:上传的 .txt 文件需要）
					var clean = String( text ).replace( /^\/\/[^\n]*\n?/, "" );
					var json = null;
					try {
						json = JSON.parse( clean );
					} catch ( e ) {
						throw new Error( "JSON 解析失败: " + e.message );
					}
					return new inkjs.Story( json );
				} );
		}
	};

	// ---------- InkStory(adapter) ----------

	var InkStory = {
		canContinue: function ( story ) {
			return story && story.canContinue;
		},
		continueText: function ( story ) {
			return story.Continue();
		},
		choices: function ( story ) {
			return story ? story.currentChoices || [] : [];
		},
		choose: function ( story, index ) {
			story.ChooseChoiceIndex( index );
		},
		save: function ( story ) {
			if ( story && story.state && story.state.toJson ) {
				return story.state.toJson();
			}
			return null;
		},
		load: function ( story, json ) {
			if ( story && story.state && story.state.LoadJson ) {
				story.state.LoadJson( json );
				return true;
			}
			return false;
		}
	};

	// ---------- InkRenderer ----------

	var Renderer = {
		/**
		 * 在容器内构建游戏 DOM。
		 * @param {HTMLElement} container
		 * @return {Object} { storyEl, choicesEl, statusEl }
		 */
		build: function ( container ) {
			container.textContent = "";
			container.className = "ink-game";

			var storyEl = document.createElement( "div" );
			storyEl.className = "ink-story";
			container.appendChild( storyEl );

			var choicesEl = document.createElement( "div" );
			choicesEl.className = "ink-choices";
			container.appendChild( choicesEl );

			var controlsEl = document.createElement( "div" );
			controlsEl.className = "ink-controls";
			container.appendChild( controlsEl );

			return { storyEl: storyEl, choicesEl: choicesEl, controlsEl: controlsEl };
		},

		/**
		 * 安全追加一段文本(文本节点,绝不 innerHTML)。
		 */
		appendText: function ( el, text ) {
			if ( !text ) {
				return;
			}
			// 段落分隔
			var lines = String( text ).split( "\n" );
			lines.forEach( function ( line ) {
				var p = document.createElement( "p" );
				p.textContent = line;
				el.appendChild( p );
			} );
		},

		/**
		 * 渲染选择按钮。
		 * @param {Array} choices inkjs 的 currentChoices
		 * @param {Function} onPick(index)
		 */
		renderChoices: function ( el, choices, onPick ) {
			el.textContent = "";
			choices.forEach( function ( c, i ) {
				var btn = document.createElement( "button" );
				btn.className = "ink-choice";
				btn.textContent = c.text; // 纯文本,不可执行
				btn.addEventListener( "click", function () {
					onPick( i );
				} );
				el.appendChild( btn );
			} );
		},

		/**
		 * 显示结束状态。
		 */
		renderEnd: function ( el ) {
			el.textContent = "";
			var end = document.createElement( "p" );
			end.className = "ink-end";
			end.textContent = "—— 故事结束 ——";
			el.appendChild( end );
		},

		/**
		 * 显示错误(文本方式)。
		 */
		renderError: function ( el, message ) {
			el.textContent = "";
			var err = document.createElement( "p" );
			err.className = "ink-error";
			err.textContent = "游戏加载失败: " + message;
			el.appendChild( err );
		}
	};

	// ---------- Player(整合) ----------

	function createPlayer( container, href ) {
		var dom = Renderer.build( container );
		var story = null;
		var busy = false;

		function continueStory() {
			if ( busy || !story ) {
				return;
			}
			busy = true;
			try {
				// 输出可继续的文本
				while ( story.canContinue ) {
					var t = story.Continue();
					Renderer.appendText( dom.storyEl, t );
				}
				// 选择
				var choices = InkStory.choices( story );
				if ( choices.length > 0 ) {
					Renderer.renderChoices( dom.choicesEl, choices, function ( i ) {
						busy = false;
						InkStory.choose( story, i );
						continueStory();
					} );
					renderControls();
				} else {
					// 无选择且不能继续 = END
					Renderer.renderEnd( dom.choicesEl );
					renderControls( true );
				}
			} catch ( e ) {
				busy = false;
				log( "故事运行时错误: ", e );
				Renderer.renderError( dom.choicesEl, e && e.message ? e.message : String( e ) );
			} finally {
				busy = false;
			}
		}

		function renderControls( ended ) {
			dom.controlsEl.textContent = "";
			// 保存 / 载入(可选,第一阶段提供)
			var saveBtn = document.createElement( "button" );
			saveBtn.className = "ink-control";
			saveBtn.textContent = "存档";
			saveBtn.addEventListener( "click", function () {
				var state = InkStory.save( story );
				if ( state ) {
					try {
						localStorage.setItem( "ink-save-" + href, state );
						log( "已存档" );
					} catch ( e ) {
						log( "存档失败: ", e );
					}
				}
			} );
			dom.controlsEl.appendChild( saveBtn );

			var loadBtn = document.createElement( "button" );
			loadBtn.className = "ink-control";
			loadBtn.textContent = "读档";
			loadBtn.addEventListener( "click", function () {
				try {
					var state = localStorage.getItem( "ink-save-" + href );
					if ( state && InkStory.load( story, state ) ) {
						// 重绘
						dom.storyEl.textContent = "";
						busy = false;
						continueStory();
					}
				} catch ( e ) {
					log( "读档失败: ", e );
				}
			} );
			dom.controlsEl.appendChild( loadBtn );

			var resetBtn = document.createElement( "button" );
			resetBtn.className = "ink-control";
			resetBtn.textContent = "重新开始";
			resetBtn.addEventListener( "click", function () {
				Loader.loadStory( href )
					.then( function ( s ) {
						story = s;
						dom.storyEl.textContent = "";
						busy = false;
						continueStory();
					} )
					.catch( function ( err ) {
						Renderer.renderError( dom.choicesEl, err && err.message ? err.message : String( err ) );
					} );
			} );
			dom.controlsEl.appendChild( resetBtn );
		}

		// 初始加载
		Renderer.appendText( dom.storyEl, "正在加载游戏…" );
		Loader.loadStory( href )
			.then( function ( s ) {
				story = s;
				dom.storyEl.textContent = "";
				continueStory();
			} )
			.catch( function ( err ) {
				log( "加载失败: ", err );
				Renderer.renderError( dom.storyEl, err && err.message ? err.message : String( err ) );
			} );

		return {
			container: container,
			state: function () {
				return InkStory.save( story );
			},
			restore: function ( json ) {
				if ( story && InkStory.load( story, json ) ) {
					dom.storyEl.textContent = "";
					busy = false;
					continueStory();
					return true;
				}
				return false;
			}
		};
	}

	// ---------- 入口 ----------

	// 等待 inkjs 就绪(getScript 返回后全局可用)
	function waitInkjs( timeoutMs ) {
		return new Promise( function ( resolve ) {
			if ( window.inkjs ) {
				resolve();
				return;
			}
			var tries = 0;
			var timer = setInterval( function () {
				tries++;
				if ( window.inkjs ) {
					clearInterval( timer );
					resolve();
				} else if ( tries * 100 > ( timeoutMs || 8000 ) ) {
					clearInterval( timer );
					resolve(); // 超时也 resolve，由 init 报错
				}
			}, 100 );
		} );
	}

	function init() {
		waitInkjs( 8000 ).then( function () {
			if ( !window.inkjs ) {
				mw.log.error( "[ink] inkjs 未加载（8s 超时）" );
				return;
			}
			var games = Loader.discover();
			if ( !games.length ) {
				return;
			}
			games.forEach( function ( g ) {
				// 挂载点：页面中显式声明 <div class="ink-mount" data-ink="href或index">
				// 匹配规则：data-ink 等于完整 href，或与 link 顺序对应（未声明时用第一个）
				var mounts = document.querySelectorAll( '.ink-mount[data-ink]' );
				var mount = null;
				Array.prototype.forEach.call( mounts, function ( m ) {
					if ( !mount && ( m.getAttribute( "data-ink" ) === g.href ||
						m.getAttribute( "data-ink" ) === "auto" ) ) {
						mount = m;
					}
				} );
				if ( !mount ) {
					mount = document.querySelector( '.ink-mount' );
				}
				if ( !mount ) {
					mw.log.warn( "[ink] 未找到挂载点，link href=" + g.href );
					return;
				}
				createPlayer( mount, g.href );
			} );
		} );
	}

	if ( document.readyState === "loading" ) {
		document.addEventListener( "DOMContentLoaded", init );
	} else {
		init();
	}

	// 暴露 API(供页面脚本/调试使用,均为文本安全接口)
	window.CPIink = {
		Loader: Loader,
		InkStory: InkStory,
		Renderer: Renderer,
		createPlayer: createPlayer
	};
} )();
