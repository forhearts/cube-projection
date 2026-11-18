/*global window, console*/
/**
 * StimulusDemo.js — Stimulus 测试用控制器（仅供 Test:库测试 使用，不是正式功能）
 *
 * wikitext 里不能写 <script>，Stimulus 控制器只能放在已登记的站点脚本里。
 * stimulus 以 ES module 与本脚本并行加载，所以先轮询 window.Stimulus 再注册。
 */
( function () {
	"use strict";

	function register( S ) {
		class HelloController extends S.Controller {
			connect() {
				this.outputTarget.textContent = "已连接 ✓";
				this.render();
			}
			increment() {
				this.countValue++;
			}
			reset() {
				this.countValue = 0;
			}
			countValueChanged() {
				this.render();
			}
			render() {
				if ( this.hasCountTarget ) {
					this.countTarget.textContent = String( this.countValue );
				}
			}
		}
		HelloController.targets = [ "output", "count" ];
		HelloController.values = { count: Number };

		S.Application.start().register( "hello", HelloController );
	}

	var tries = 0;
	var timer = setInterval( function () {
		tries++;
		var S = window.Stimulus;
		if ( S && S.Application && S.Controller ) {
			clearInterval( timer );
			register( S );
		} else if ( tries > 100 ) {
			clearInterval( timer );
			console.error( "[stimulusdemo] window.Stimulus 未就绪" );
		}
	}, 100 );
} )();
