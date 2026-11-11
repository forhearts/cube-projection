/*global mw*/
/**
 * MediaWiki:Fluid.js — 首页流体效果
 *
 * 由 {{libs|js=fluid}} 加载（Module:Libs 注册为站内页面，action=raw 输出）。
 * 直接操作 DOM：创建全屏毛玻璃 + 中央一团 Perlin 噪声灰色流体。
 *
 * 为什么用站内 JS 页面而不是页面内嵌 <script>：
 *   MediaWiki 会过滤页面里的 <script>/<style>/<canvas> 标签，
 *   本文件经 action=raw 输出，不经过 MediaWiki 压缩器，可自由书写。
 *
 * 元素全部用内联样式创建，不依赖 <style> 标签。
 */
( function () {
	"use strict";

	// ---- 创建元素（全部内联样式）----
	var canvas = document.createElement( "canvas" );
	canvas.id = "fluid-canvas";
	canvas.style.cssText =
		"position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);" +
		"width:480px;height:480px;z-index:0;display:block;";
	document.body.appendChild( canvas );

	var glass = document.createElement( "div" );
	glass.id = "fluid-glass";
	glass.style.cssText =
		"position:fixed;inset:0;z-index:1;" +
		"background:rgba(255,255,255,0.07);" +
		"backdrop-filter:blur(18px) saturate(1.35);" +
		"-webkit-backdrop-filter:blur(18px) saturate(1.35);";
	document.body.appendChild( glass );

	// 导航栏保持在毛玻璃之上
	var nav = document.querySelector( ".navbar" );
	if ( nav ) {
		nav.style.position = "relative";
		nav.style.zIndex = "2";
	}

	var ctx = canvas.getContext( "2d" );
	if ( !ctx ) {
		return;
	}

	var SIZE = 480;
	canvas.width = SIZE;
	canvas.height = SIZE;

	// ---- Perlin 噪声（3D：x/y/z，z 用时间 → 平滑演变）----
	var perm = new Uint8Array( 512 );
	( function () {
		var p = new Uint8Array( 256 );
		for ( var i = 0; i < 256; i++ ) {
			p[ i ] = i;
		}
		var seed = 1337;
		function rnd() {
			seed = ( seed * 16807 ) % 2147483647;
			return seed / 2147483647;
		}
		for ( var j = 255; j > 0; j-- ) {
			var k = Math.floor( rnd() * ( j + 1 ) );
			var t = p[ j ];
			p[ j ] = p[ k ];
			p[ k ] = t;
		}
		for ( var m = 0; m < 512; m++ ) {
			perm[ m ] = p[ m & 255 ];
		}
	} )();

	function fade( t ) {
		return t * t * t * ( t * ( t * 6 - 15 ) + 10 );
	}
	function lerp( a, b, t ) {
		return a + ( b - a ) * t;
	}
	function grad( hash, x, y, z ) {
		var h = hash & 15;
		var u = h < 8 ? x : y;
		var v = h < 4 ? y : ( h === 12 || h === 14 ? x : z );
		return ( ( h & 1 ) ? -u : u ) + ( ( h & 2 ) ? -v : v );
	}
	function noise3( x, y, z ) {
		var X = Math.floor( x ) & 255,
			Y = Math.floor( y ) & 255,
			Z = Math.floor( z ) & 255;
		x -= Math.floor( x );
		y -= Math.floor( y );
		z -= Math.floor( z );
		var u = fade( x ),
			v = fade( y ),
			w = fade( z );
		var A = perm[ X ] + Y,
			AA = perm[ A ] + Z,
			AB = perm[ A + 1 ] + Z;
		var B = perm[ X + 1 ] + Y,
			BA = perm[ B ] + Z,
			BB = perm[ B + 1 ] + Z;
		return lerp(
			lerp(
				lerp( grad( perm[ AA ], x, y, z ), grad( perm[ BA ], x - 1, y, z ), u ),
				lerp( grad( perm[ AB ], x, y - 1, z ), grad( perm[ BB ], x - 1, y - 1, z ), u ),
				v
			),
			lerp(
				lerp(
					grad( perm[ AA + 1 ], x, y, z - 1 ),
					grad( perm[ BA + 1 ], x - 1, y, z - 1 ),
					u
				),
				lerp(
					grad( perm[ AB + 1 ], x, y - 1, z - 1 ),
					grad( perm[ BB + 1 ], x - 1, y - 1, z - 1 ),
					u
				),
				v
			),
			w
		);
	}

	// 分形叠加：多 octave，让云纹细腻连续
	function fbm( x, y, z, oct ) {
		var v = 0,
			amp = 0.5,
			f = 1,
			total = 0;
		for ( var i = 0; i < oct; i++ ) {
			v += amp * noise3( x * f, y * f, z * f );
			total += amp;
			f *= 2;
			amp *= 0.5;
		}
		return v / total;
	}

	// ---- 低分辨率噪声场，放大上屏（自带柔和）----
	var CW = 180,
		GH = 112;
	var off = document.createElement( "canvas" );
	off.width = CW;
	off.height = GH;
	var octx = off.getContext( "2d" );
	var img = octx.createImageData( CW, GH );
	var data = img.data;

	var t0 = Date.now();

	function render() {
		var time = ( Date.now() - t0 ) / 1000;

		// 形状边界：噪声驱动 → 液滴不断蠕动的轮廓（0=中心 1+=外缘）
		var shapeScale = 2.2;
		var shapeOffset = 0.42;

		for ( var y = 0; y < GH; y++ ) {
			for ( var x = 0; x < CW; x++ ) {
				var u = x / CW,
					v = y / GH;
				var dx = u - 0.5,
					dy = v - 0.5;
				var rr = Math.sqrt( dx * dx + dy * dy ) * 2;

				// 径向噪声扭曲：同一块流体在动，轮廓也随之变形
				var w = noise3( dx * shapeScale + 7.1, dy * shapeScale - 3.3, time * 0.35 );
				var rEdge = rr + w * shapeOffset + 0.06;
				var edge = 1 - rEdge;
				if ( edge < 0 ) {
					edge = 0;
				}

				// 域扭曲：时间推进快 + 大偏移 → 剧烈翻涌（热锅上的水滴）
				var qx = noise3( u * 3.2 + 3.7, v * 3.2, time * 0.5 );
				var qy = noise3( u * 3.2 + 9.2, v * 3.2 + 5.1, time * 0.5 + 1.7 );
				var n = fbm( u * 2.6 + qx * 2.6, v * 2.6 + qy * 2.6, time * 0.55, 4 );

				var val = 0.5 + 0.5 * n; // 0..1
				// 形状边界外的区域直接透明（液体主体之外什么都没有）
				var a = val * val * edge * edge;
				if ( a > 1 ) {
					a = 1;
				}

				// 纯灰色：深灰 → 白，高对比
				var g = Math.round( 30 + 205 * Math.pow( val, 1.5 ) );
				var i = ( y * CW + x ) * 4;
				data[ i ] = g;
				data[ i + 1 ] = g;
				data[ i + 2 ] = g;
				data[ i + 3 ] = Math.round( a * 255 );
			}
		}
		octx.putImageData( img, 0, 0 );

		ctx.clearRect( 0, 0, SIZE, SIZE );
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage( off, 0, 0, SIZE, SIZE );
	}

	function loop() {
		render();
	}
	loop();
	setInterval( loop, 66 );
} )();
