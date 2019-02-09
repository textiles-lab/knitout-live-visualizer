"use strict";

const VectorTiles = {};

VectorTiles.LoopWidth = 13;
VectorTiles.YarnWidth = 7;
VectorTiles.TileHeight = 9;

function Drawing() {
	this.back = {}; //{ style:{style: , lines:[ [x0, y0, x1, y1, ... ], ... ]}, ... }
	this.middle = {};
	this.front = {};
}

let defaultStyle = {color:'#f0f'};
let freshKey = 0;

Drawing.prototype.addLine = function Drawing_addLine(layer, styles, label, pts, ofs, z) {
	if (typeof(ofs) === 'undefined') ofs = {x:0.0, y:0.0};
	if (typeof(z) === 'undefined') z = 0;

	let style = styles[label];
	if (!style) style = defaultStyle;
	if (!('key' in style)) {
		style.key = (freshKey++).toString();
	}
	if (!(style.key in layer)) {
		layer[style.key] = {style:style, lines:[]};
	}
	let g = layer[style.key];
	if (typeof(ofs) !== 'undefined') {
		pts = pts.slice();
		for (let i = 0; i < pts.length; i += 2) {
			pts[i] += ofs.x;
			pts[i+1] += ofs.y;
		}
	}
	while (z >= g.lines.length) {
		g.lines.push([]);
	}
	g.lines[z].push(pts);
};

VectorTiles.makeDrawing = function Vectortiles_makeDrawing() {
	return new Drawing();
};


/*let STYLES = {
	'1':'#f00',
	'2':'#0f0',
	'3':'#800',
	'4':'#080',
	'5':'#afe9af',
};
function yarnStyle(y, colors) {
	if (y in colors) {
		return colors[y];
	}
	if (!(y in STYLES)) {
		STYLES[y] = '#f0f';
	}
	return STYLES[y];
};*/

VectorTiles.draw = function VectorTiles_draw(ctx, drawing, options) {
	let frontOfs = options.frontOfs || {x:0.0, y:0.0};
	let backOfs = options.backOfs || {x:0.0, y:0.0};
	let frontTintRGBA = options.frontTintRGBA || [1.0, 1.0, 1.0, 0.0];
	let middleTintRGBA = options.middleTintRGBA || [1.0, 1.0, 1.0, 0.0];
	let backTintRGBA = options.backTintRGBA || [1.0, 1.0, 1.0, 0.0];

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeWidth = 1.0;

	function tint(color, tintRGBA) {
		let colorRGB;

		console.assert(
			/^#[0-9A-Fa-f]{3}$/.test(color)
			|| /^#[0-9A-Fa-f]{6}$/.test(color), "tint only works with hex 6/3-tuples");
		if (color.length === 7) {
			colorRGB = [
				parseInt(color.substr(1,2), 16) / 255.0,
				parseInt(color.substr(3,2), 16) / 255.0,
				parseInt(color.substr(5,2), 16) / 255.0
			];
		} else if (color.length === 4) {
			colorRGB = [
				parseInt(color.substr(1,1) + color.substr(1,1), 16) / 255.0,
				parseInt(color.substr(2,1) + color.substr(2,1), 16) / 255.0,
				parseInt(color.substr(3,1) + color.substr(3,1), 16) / 255.0
			];
		}
		colorRGB[0] = (tintRGBA[0] - colorRGB[0]) * tintRGBA[3] + colorRGB[0];
		colorRGB[1] = (tintRGBA[1] - colorRGB[1]) * tintRGBA[3] + colorRGB[1];
		colorRGB[2] = (tintRGBA[2] - colorRGB[2]) * tintRGBA[3] + colorRGB[2];

		function h2(v) {
			let r = Math.max(0, Math.min(255, Math.round(255 * v))).toString(16);
			if (r.length < 2) r = '0' + r;
			return r;
		}

		return '#' + h2(colorRGB[0]) + h2(colorRGB[1]) + h2(colorRGB[2]);

	}

	function drawGroups(layer, layerTintRGBA) {
		let again = true;
		let z = 0;
		while (again) {
			again = false;
			for (let sk in layer) {
				let g = layer[sk];
				if (z >= layer[sk].lines.length) continue;
				again = true;
				ctx.strokeStyle = tint(g.style.color, layerTintRGBA);
				ctx.beginPath();
				g.lines[z].forEach(function(line){
					ctx.moveTo(line[0], line[1]);
					for (let i = 2; i < line.length; i += 2) {
						ctx.lineTo(line[i], line[i+1]);
					}
				});
				ctx.stroke();
			}
			z += 1;
		}
	}

	ctx.translate(backOfs.x, backOfs.y);
	drawGroups(drawing.back, backTintRGBA);
	ctx.translate(-backOfs.x, -backOfs.y);

	for (let sk in drawing.middle) {
		let g = drawing.middle[sk];
		ctx.strokeStyle = tint(g.style.color, middleTintRGBA);
		ctx.beginPath();
		g.lines.forEach(function(lines,z) {
			lines.forEach(function(line){
				console.assert(line.length === 4, "bridges should be [fx,fy,bx,by]");
				ctx.moveTo(line[0] + frontOfs.x, line[1] + frontOfs.y);
				ctx.lineTo(line[2] + backOfs.x, line[3] + backOfs.y);
			});
		});
		ctx.stroke();
	}


	ctx.translate(frontOfs.x, frontOfs.y);
	drawGroups(drawing.front, frontTintRGBA);
	ctx.translate(-frontOfs.x, -frontOfs.y);

	ctx.restore();
};

//helpers:

//index and bed y to lower left corner position:
function tileLowerLeft(i, y) {
	return {
		x: Math.floor(i / 2) * (VectorTiles.LoopWidth + VectorTiles.YarnWidth) + (i % 2 === 0 ? 0 : VectorTiles.LoopWidth) - 0.5 * VectorTiles.LoopWidth,
		y: y * VectorTiles.TileHeight
	};
}

VectorTiles.tileLowerLeft = tileLowerLeft;

//                       1 1 1
//   0 1 2 3 4 5 6 7 8 9 0 1 2
// 8 . . . . a b . b a . . . .
// 7 . A A A A A A A A A A A .
// 6 . A B B B B B B B B B A .
// 5 . A B . a b . b a . B A .
// 4 a a a a a b . b a a a a a
// 3 b b b b b b . b b b b b b
// 2 . A B . . . . . . . B A .
// 1 . A A A A . . . A A A A .
// 0 . . B B A B . B A B B . .

VectorTiles.addCross = function VectorTiles_addCross(drawing, cross) {
	console.assert(typeof(cross.type) === 'string', "Expecting cross to have 'type' string");
	console.assert(typeof(cross.styles) === 'object', "Expecting cross to have 'styles' reference");
	console.assert(typeof(cross.i) === 'number' && typeof(cross.i2) === 'number', "Expecting cross to have i, i2 indices");
	console.assert(typeof(cross.b) === 'string' && typeof(cross.b2) === 'string', "Expecting cross to have b, b2 strings");
	console.assert(Array.isArray(cross.yarns), "Expecting cross to have 'yarns' array.");

	if (cross.type === 'y') {
		console.assert(typeof(cross.port) === 'string' && typeof(cross.port2) === 'string', "Expecting cross of yarn type to have port, port2 strings");

		let ports = {
			'o-':{x:0.5, y0:6.5, y1:5.5},
			'x-':{x:0.5, y0:6.5, y1:5.5},
			'O-':{x:3.5, y0:6.5, y1:5.5},
			'X-':{x:3.5, y0:6.5, y1:5.5},
			'O+':{x:3.5, y0:6.5, y1:5.5},
			'X+':{x:3.5, y0:6.5, y1:5.5},
			'o+':{x:6.5, y0:6.5, y1:5.5},
			'x+':{x:6.5, y0:6.5, y1:5.5}
		};

		console.assert(cross.port in ports && cross.port2 in ports, "Expecting cross of yarn type to have known port, port2 strings");

		let pf, pb;

		let front, back;
		if (cross.b === 'f') {
			front = tileLowerLeft(cross.i, cross.y);
			pf = ports[cross.port];
			back = tileLowerLeft(cross.i2, cross.y);
			pb = ports[cross.port2];
		} else {
			front = tileLowerLeft(cross.i2, cross.y);
			pf = ports[cross.port2];
			back = tileLowerLeft(cross.i, cross.y);
			pb = ports[cross.port];
		}

		if (cross.yarns.length >= 1) {
			let l0 = cross.yarns[0];
			drawing.addLine(drawing.middle, cross.styles, l0, [front.x+pf.x, front.y+pf.y0, back.x+pb.x, back.y+pb.y0]);
		}
		if (cross.yarns.length >= 2) {
			let l1 = cross.yarns.slice(1).join(' ');
			drawing.addLine(drawing.middle, cross.styles, l1, [front.x+pf.x, front.y+pf.y1, back.x+pb.x, back.y+pb.y1]);
		}
		return;
	}

	let l,r;
	let y1 = 5.5;
	let y2 = 6.5;
	if (cross.type === 'x') {
		l = 4.5;
		r = 8.5;
	} else if (cross.type === 's') {
		l = 1.5;
		r = 11.5;
	} else {
		console.assert(false, "Unknown cross type.");
	}

	let front, back;
	if (cross.b === 'f') {
		front = tileLowerLeft(cross.i, cross.y);
		front.y += y1;
		back = tileLowerLeft(cross.i2, cross.y);
		back.y += y2;
	} else {
		front = tileLowerLeft(cross.i2, cross.y);
		front.y += y2;
		back = tileLowerLeft(cross.i, cross.y);
		back.y += y1;
	}

	if (cross.yarns.length >= 1) {
		let l0 = cross.yarns[0];
		drawing.addLine(drawing.middle, cross.styles, l0, [front.x+l, front.y, back.x+l, back.y ]);
		drawing.addLine(drawing.middle, cross.styles, l0, [front.x+r, front.y, back.x+r, back.y ]);
	}
	if (cross.yarns.length >= 2) {
		let l1 = cross.yarns.slice(1).join(' ');
		drawing.addLine(drawing.middle, cross.styles, l1, [front.x+l+1.0, front.y, back.x+l+1.0, back.y ]);
		drawing.addLine(drawing.middle, cross.styles, l1, [front.x+r-1.0, front.y, back.x+r-1.0, back.y ]);
	}
};

VectorTiles.addLoopTile = function VectorTiles_addLoopTile(drawing, styles, tile) {
	console.assert(typeof(tile.y) === 'number', "Expecting bed height in loop tile");
	console.assert(typeof(tile.i) === 'number', "Expecting index in loop tile");
	console.assert(typeof(tile.type) === 'string', "Expecting type string in loop tile");
	console.assert(typeof(tile.bed) === 'string', "Expecting bed string in loop tile");
	console.assert(Array.isArray(tile.loops), "Expecting loops array in loop tile");
	console.assert(Array.isArray(tile.yarns), "Expecting yarns array in loop tile");
	console.assert(Array.isArray(tile.across), "Expecting across array in loop tile");

	const type = tile.type;
	const bed = tile.bed;
	const loops = tile.loops;
	const yarns = tile.yarns;
	const across = tile.across;
	if (loops.length === 0 && yarns.length === 0 && across.length === 0) return null;

	let layer = (bed === 'f' ? drawing.front : drawing.back);
	let ll = tileLowerLeft(tile.i, tile.y);

	function doLoops() {
		if (loops.length >= 1) {
			let l0 = loops[0];
			drawing.addLine(layer, styles, l0, [ 4.5, 0.0, 4.5, 9.0 ], ll);
			drawing.addLine(layer, styles, l0, [ 8.5, 0.0, 8.5, 9.0 ], ll);
		}
		if (loops.length >= 2) {
			let l1 = loops.slice(1).join(' ');
			drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 9.0 ], ll);
			drawing.addLine(layer, styles, l1, [ 7.5, 0.0, 7.5, 9.0 ], ll);
		}
	};

	let g = {lines:[]};
	if (type === 'k') {
		if (yarns.length >= 1 && loops.length >= 1) {
			//actually a knit:
			if (bed === 'f') {
				let l0 = loops[0];
				let l = (yarns.length === 1 ? 5.5 : 6.5);
				let r = (yarns.length === 1 ? 7.5 : 6.5);
				drawing.addLine(layer, styles, l0, [ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 7.5, 3.5, 7.5 ], ll);
				drawing.addLine(layer, styles, l0, [ l, 7.5, r, 7.5 ], ll);
				drawing.addLine(layer, styles, l0, [ 9.5, 7.5, 11.5, 7.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ], ll);
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 3.5, 0.5, 2.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 2.5, 2.5, 2.5, 6.5, 3.5, 6.5 ], ll);
					drawing.addLine(layer, styles, l1, [ l, 6.5, r, 6.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 9.5, 6.5, 10.5, 6.5, 10.5, 2.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, 0.5, 9.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 7.5, 0.5, 7.5, 0.0 ], ll);
				}

				l = (loops.length === 1 ? 2.5 : 3.5);
				r = (loops.length === 1 ? 10.5 : 9.5);
				let y0 = yarns[0];
				drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 0.5, 4.5 ], ll);
				drawing.addLine(layer, styles, y0, [ l, 4.5, 4.5, 4.5, 4.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 4.5, r, 4.5 ], ll);
				drawing.addLine(layer, styles, y0, [ 12.5, 4.5, 13.0, 4.5 ], ll);
				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 0.5, 3.5 ], ll);
					drawing.addLine(layer, styles, y1, [ l, 3.5, 5.5, 3.5, 5.5, 9.0 ], ll);
					drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 3.5, r, 3.5 ], ll);
					drawing.addLine(layer, styles, y1, [ 12.5, 3.5, 13.0, 3.5 ], ll);
				}
			} else { console.assert(bed === 'b', "bed should be f/b");
				let h = (yarns.length === 1 ? 3.5 : 2.5);
				let l0 = loops[0];
				drawing.addLine(layer, styles, l0, [ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, h ], ll);
				drawing.addLine(layer, styles, l0, [ 1.5, 5.5, 1.5, 7.5, 11.5, 7.5, 11.5, 5.5, ], ll);
				drawing.addLine(layer, styles, l0, [ 11.5, h, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ], ll);
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 3.5, 0.5, 2.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 2.5, 2.5, 2.5, h ], ll);
					drawing.addLine(layer, styles, l1, [ 2.5, 5.5, 2.5, 6.5, 10.5, 6.5, 10.5, 5.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, h, 10.5, 2.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, 0.5, 9.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 7.5, 0.5, 7.5, 0.0 ], ll);
				}

				h = (loops.length === 1 ? 6.5 : 5.5);
				let y0 = yarns[0];
				drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 4.5, 4.5, 4.5, h ], ll);
				drawing.addLine(layer, styles, y0, [ 4.5, 8.5, 4.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 8.5 ], ll);
				drawing.addLine(layer, styles, y0, [ 8.5, h, 8.5, 4.5, 13.0, 4.5 ], ll);

				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 5.5, 3.5, 5.5, h ], ll);
					drawing.addLine(layer, styles, y1, [ 5.5, 8.5, 5.5, 9.0 ], ll);
					drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 8.5 ], ll);
					drawing.addLine(layer, styles, y1, [ 7.5, h, 7.5, 3.5, 13.0, 3.5 ], ll);
				}

			}
		} else if (yarns.length >= 1) {
			//yarns, no loops -> effectively a tuck:
			let y0 = yarns[0];
			drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ], ll);
			drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ], ll);
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ], ll);
			}
		} else if (loops.length >= 1) {
			//loops, no yarns -> drop:
			let l0 = loops[0];
			drawing.addLine(layer, styles, l0, [ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 7.5, 11.5, 7.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ], ll);
			if (loops.length >= 2) {
				let l1 = loops.slice(1).join(' ');
				drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 0.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 3.5, 0.5, 2.5, 0.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 2.5, 2.5, 2.5, 6.5, 10.5, 6.5, 10.5, 2.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 10.5, 0.5, 9.5, 0.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 7.5, 0.5, 7.5, 0.0 ], ll);
			}
		}
	} else if (type === 't') {
		if (bed === 'b') doLoops();
		if (yarns.length >= 1) {
			let y0 = yarns[0];
			drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ], ll);
			drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ], ll);
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ], ll);
			}
		}
		if (bed === 'f') doLoops();
	} else if (type === 'm') {
		if (bed === 'b') doLoops();
		if (yarns.length >= 1) {
			let y0 = yarns[0];
			drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 13.0, 4.5], ll);
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 13.0, 3.5 ], ll);
			}
		}
		if (bed === 'f') doLoops();
	} else if (type === 'S') {
		if (bed === 'b') doLoops();
		if (across.length >= 1) {
			let a0 = across[0];
			drawing.addLine(layer, styles, a0, [ 1.5, 6.5, 1.5, 7.5, 4.5, 7.5, 4.5, 9.0 ], ll);
			drawing.addLine(layer, styles, a0, [ 11.5, 6.5, 11.5, 7.5, 8.5, 7.5, 8.5, 9.0 ], ll);

			if (across.length >= 2) {
				let a1 = across.slice(1).join(' ');
				drawing.addLine(layer, styles, a1, [ 2.5, 6.5, 5.5, 6.5, 5.5, 9.0 ], ll);
				drawing.addLine(layer, styles, a1, [ 10.5, 6.5, 7.5, 6.5, 7.5, 9.0 ], ll);
			}
		}

		if (bed === 'f') doLoops();
	} else if (type === 's') {
		if (yarns.length >= 1 && loops.length >= 1) {
			//TODO: loops === across, right?
			//actually a split:
			if (bed === 'f') {
				let l0 = loops[0];
				drawing.addLine(layer, styles, l0, [ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 5.5, ], ll);
				drawing.addLine(layer, styles, l0, [ 11.5, 5.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ], ll);
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 3.5, 0.5, 2.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 2.5, 2.5, 2.5, 5.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, 5.5, 10.5, 2.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, 0.5, 9.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 7.5, 0.5, 7.5, 0.0 ], ll);
				}

				let l = (loops.length === 1 ? 2.5 : 3.5);
				let r = (loops.length === 1 ? 10.5 : 9.5);
				let y0 = yarns[0];
				drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 0.5, 4.5 ], ll);
				drawing.addLine(layer, styles, y0, [ l, 4.5, 4.5, 4.5, 4.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 4.5, r, 4.5 ], ll);
				drawing.addLine(layer, styles, y0, [ 12.5, 4.5, 13.0, 4.5 ], ll);
				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 0.5, 3.5 ], ll);
					drawing.addLine(layer, styles, y1, [ l, 3.5, 5.5, 3.5, 5.5, 9.0 ], ll);
					drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 3.5, r, 3.5 ], ll);
					drawing.addLine(layer, styles, y1, [ 12.5, 3.5, 13.0, 3.5 ], ll);
				}
			} else { console.assert(bed === 'b', "bed should be f/b");
				let h = (yarns.length === 1 ? 3.5 : 2.5);
				let l0 = loops[0];
				drawing.addLine(layer, styles, l0, [ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, h ], ll);
				drawing.addLine(layer, styles, l0, [ 1.5, 5.5, 1.5, 5.5 ], ll);
				drawing.addLine(layer, styles, l0, [ 11.5, 5.5, 11.5, 5.5 ], ll);
				drawing.addLine(layer, styles, l0, [ 11.5, h, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ], ll);
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 3.5, 0.5, 2.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 2.5, 2.5, 2.5, h ], ll);
					drawing.addLine(layer, styles, l1, [ 2.5, 5.5, 2.5, 5.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, 5.5, 10.5, 5.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, h, 10.5, 2.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 10.5, 0.5, 9.5, 0.5 ], ll);
					drawing.addLine(layer, styles, l1, [ 7.5, 0.5, 7.5, 0.0 ], ll);
				}

				let y0 = yarns[0];
				drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ], ll);

				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ], ll);
					drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ], ll);
				}

			}
		} else if (yarns.length >= 1) {
			//yarns, no loops -> effectively a tuck:
			let y0 = yarns[0];
			drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ], ll);
			drawing.addLine(layer, styles, y0, [ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ], ll);
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ], ll);
				drawing.addLine(layer, styles, y1, [ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ], ll);
			}
		} else if (loops.length >= 1) {
			//loops, no yarns -> drop:
			let l0 = loops[0];
			drawing.addLine(layer, styles, l0, [
				4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 7.5,
				11.5, 7.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0
			]);
			if (loops.length >= 2) {
				let l1 = loops.slice(1).join(' ');
				drawing.addLine(layer, styles, l1, [ 5.5, 0.0, 5.5, 0.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 3.5, 0.5, 2.5, 0.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 2.5, 2.5, 2.5, 6.5, 10.5, 6.5, 10.5, 2.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 10.5, 0.5, 9.5, 0.5 ], ll);
				drawing.addLine(layer, styles, l1, [ 7.5, 0.5, 7.5, 0.0 ], ll);
			}
		}

	} else if (type === 'X') { //xfer target
		if (bed === 'b') doLoops();
		if (across.length >= 1) {
			let a0 = across[0];
			drawing.addLine(layer, styles, a0, [ 4.5, 6.5, 4.5, 9.0 ], ll);
			drawing.addLine(layer, styles, a0, [ 8.5, 6.5, 8.5, 9.0 ], ll);

			if (across.length >= 2) {
				let a1 = across.slice(1).join(' ');
				drawing.addLine(layer, styles, a1, [ 5.5, 6.5, 5.5, 9.0 ], ll);
				drawing.addLine(layer, styles, a1, [ 7.5, 6.5, 7.5, 9.0 ], ll);
			}
		}
		if (bed === 'f') doLoops();
	} else if (type === 'x') {
		//TO CHECK: across === loops, right?
		if (across.length >= 1) {
			let a0 = across[0];
			drawing.addLine(layer, styles, a0, [ 4.5, 0.0, 4.5, 5.5 ], ll);
			drawing.addLine(layer, styles, a0, [ 8.5, 0.0, 8.5, 5.5 ], ll);

			if (across.length >= 2) {
				let a1 = across.slice(1).join(' ');
				drawing.addLine(layer, styles, a1, [ 5.5, 0.0, 5.5, 5.5 ], ll);
				drawing.addLine(layer, styles, a1, [ 7.5, 0.0, 7.5, 5.5 ], ll);
			}
		}
	} else {
		//unknown!
		drawing.addLine(layer, styles, '#f0f', [ 0.0, 0.0, 13.0, 9.0 ], ll);
		drawing.addLine(layer, styles, '#f0f', [ 0.0, 9.0, 13.0, 0.0 ], ll);
	}
	return g;
};

//                  
//   0 1 2 3 4 5 6
// 8 . B A . B A .
// 7 . B A . B A .
// 6 x B A x B A x
// 5 x B A x B A x
// 4 a B A a B A a
// 3 b B A b B A b
// 2 . B A . B A .
// 1 . B A . B A .
// 0 . B A . B A .

VectorTiles.addYarnTile = function VectorTiles_addYarnTile(drawing, styles, tile, carriers) {
	console.assert(typeof(tile.y) === 'number', "Expecting bed height in yarn tile");
	console.assert(typeof(tile.i) === 'number', "Expecting index in yarn tile");
	console.assert(typeof(tile.bed) === 'string', "Expecting bed in yarn tile");
	console.assert(typeof(tile.ports) === 'object', "Expecting ports in yarn tile");
	console.assert(Array.isArray(carriers), "Expecting carriers list for sorting");

	const bed = tile.bed;
	const ports = tile.ports;

	let locs = {};
	function addLoc(yarn, x, y) {
		if (!(yarn in locs)) {
			locs[yarn] = [];
		}
		locs[yarn].push(x,y);
	}
	ports['^+'].forEach(function(y, yi){ addLoc(y, (yi === 0 ? 5.5 : 4.5), 9.0); });
	ports['v+'].forEach(function(y, yi){ addLoc(y, (yi === 0 ? 5.5 : 4.5), 0.0); });
	ports['^-'].forEach(function(y, yi){ addLoc(y, (yi === 0 ? 2.5 : 1.5), 9.0); });
	ports['v-'].forEach(function(y, yi){ addLoc(y, (yi === 0 ? 2.5 : 1.5), 0.0); });

	ports['o-'].forEach(function(y, yi){ addLoc(y, 0.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['x-'].forEach(function(y, yi){ addLoc(y, 0.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['O-'].forEach(function(y, yi){ addLoc(y, 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['X-'].forEach(function(y, yi){ addLoc(y, 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['O+'].forEach(function(y, yi){ addLoc(y, 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['X+'].forEach(function(y, yi){ addLoc(y, 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['o+'].forEach(function(y, yi){ addLoc(y, 6.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['x+'].forEach(function(y, yi){ addLoc(y, 6.5, (yi === 0 ? 6.5 : 5.5)); });

	ports['-'].forEach(function(y, yi){ addLoc(y, 0.0, (yi === 0 ? 4.5 : 3.5)); });
	ports['+'].forEach(function(y, yi){ addLoc(y, 7.0, (yi === 0 ? 4.5 : 3.5)); });

	let layer = (bed === 'f' ? drawing.front : drawing.back);

	let ll = tileLowerLeft(tile.i, tile.y);

	for (let yn in locs) {
		let idx = -1;
		carriers.forEach(function(c,ci){
			if(c.name === yn){
				idx = ci;
			}
		});
		console.assert(idx !== -1, "All yarns should appear in carriers");
	}
	carriers.forEach(function(c){
		if (!(c.name in locs)) return;
		let yn = c.name;
		let z = carriers.length - 1 - c.index; //> z => more in front
	//for (let yn in locs) {
		let list = locs[yn];
		if (list.length === 2) {
			drawing.addLine(layer, styles, yn, [
				3.5, 5.5, list[0], list[1]
			], ll, z);
		} else if (list.length === 4) {
			drawing.addLine(layer, styles, yn, [
				list[0], list[1], list[2], list[3]
			], ll, z);
		} else {
			console.warn("yarn tile mentions yarn " + list.length + " times.");
		}
	});
};


