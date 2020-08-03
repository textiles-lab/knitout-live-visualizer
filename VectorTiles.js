"use strict";

const VectorTiles = {};

VectorTiles.LoopWidth = 13;
VectorTiles.YarnWidth = 7;
VectorTiles.TileHeight = 9;

//Check that VectorTilesLib is included before this:
let libSize = 0;
for (const tileName in VectorTilesLib) {
	const tile = VectorTilesLib[tileName];
	for (const label in tile) {
		const lines = tile[label];
		for (const line of lines) {
			console.assert(line.length % 2 == 0, "Line has pairs of coordinates.");
			console.assert(line.length >= 4, "Line has at least two points.");
		}
	}
	++libSize;
}
console.log("VectorTilesLib contains " + libSize + " tiles.");

//tile lines will be stored into a larger grid to accelerate clipping:
const GridSize = 200;

function Drawing() {
	this.back = {}; //{ style:{style: , lines:[ [x0, y0, x1, y1, ... ], ... ]}, ... }
	this.backSliders = {};
	this.middle = {};
	this.frontSliders = {};
	this.front = {};
}

let defaultStyle = {color:'#f0f'};
let freshKey = 0;

Drawing.prototype.addLine = function Drawing_addLine(layer, styles, label, pts, ofs, z) {
	if (typeof(ofs) === 'undefined') ofs = {x:0.0, y:0.0};
	if (typeof(z) === 'undefined') z = 0;

	//add ofs to points:
	pts = pts.slice();
	for (let i = 0; i < pts.length; i += 2) {
		pts[i] += ofs.x;
		pts[i+1] += ofs.y;
	}

	/*
	//NOTE: bounds logic doesn't work with the crossing-lines hack (which uses a [x,y,fs, x,y,bs] format)
	//compute bounds of points:
	let min = {x:Infinity, y:Infinity};
	let max = {x:-Infinity, y:-Infinity};
	for (let i = 0; i < pts.length; i += 2) {
		min.x = Math.min(min.x, pts[i]);
		min.y = Math.min(min.y, pts[i+1]);
		max.x = Math.max(max.x, pts[i]);
		max.y = Math.max(max.y, pts[i+1]);
	}

	if (min.x > max.x) return; //empty!
	*/

	let style = styles[label];
	if (!style) style = defaultStyle;
	if (!('key' in style)) {
		style.key = (freshKey++).toString();
	}
	if (!(style.key in layer)) {
		layer[style.key] = {style:style, grid:[]};
	}

	//update style layer to include bounds:
	let ls = layer[style.key];
	let gridKey = (Math.floor(pts[0] / GridSize)) + " " + (Math.floor(pts[1] / GridSize));

	if (!(gridKey in ls.grid)) {
		ls.grid[gridKey] = [];
	}

	let g = ls.grid[gridKey];
	while (z >= g.length) {
		g.push([]);
	}
	g[z].push(pts);
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
	let frontSlidersOfs = options.frontSlidersOfs || {x:0.75 * frontOfs.x + 0.25 * backOfs.x, y: 0.75 * frontOfs.y + 0.25 * backOfs.y};
	let backSlidersOfs = options.backSlidersOfs || {x:0.25 * frontOfs.x + 0.75 * backOfs.x, y: 0.25 * frontOfs.y + 0.75 * backOfs.y};
	let frontTintRGBA = options.frontTintRGBA || [1.0, 1.0, 1.0, 0.0];
	let middleTintRGBA = options.middleTintRGBA || [1.0, 1.0, 1.0, 0.0];
	let backTintRGBA = options.backTintRGBA || [1.0, 1.0, 1.0, 0.0];

	let viewMin = {x:Infinity, y:Infinity};
	let viewMax = {x:-Infinity, y:-Infinity};
	{ //read view from context:
		let xf = ctx.getTransform();
		xf.invertSelf();

		function doPt(x,y) {
			let tx = xf.a * x + xf.c * y + xf.e;
			let ty = xf.b * x + xf.d * y + xf.f;
			viewMin.x = Math.min(viewMin.x, tx);
			viewMin.y = Math.min(viewMin.y, ty);
			viewMax.x = Math.max(viewMax.x, tx);
			viewMax.y = Math.max(viewMax.y, ty);
		}
		doPt(0,0);
		doPt(0,ctx.canvas.height);
		doPt(ctx.canvas.width,0);
		doPt(ctx.canvas.width,ctx.canvas.height);

		if (viewMin.x > viewMax.x) {
			//empty view
			viewMin.x = viewMax.x = viewMin.y = viewMax.y = 0;
		}
	}

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeWidth = 1.0;

	let gridKeys = [];
	//NOTE: could extend viewMin / viewMax to avoid lines that start outside the view being clipped.
	for (let gx = Math.floor(viewMin.x / GridSize); gx <= Math.ceil(viewMax.x / GridSize); ++gx) {
		for (let gy = Math.floor(viewMin.y / GridSize); gy <= Math.ceil(viewMax.y / GridSize); ++gy) {
			gridKeys.push(gx + " " + gy);
/*
			//DEBUG: show grid
			ctx.fillStyle = '#f0f';
			ctx.fillRect(gx * GridSize + 2, gy * GridSize + 2, GridSize - 4, GridSize - 4);
*/
		}
	}



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
				let ls = layer[sk];
				ctx.strokeStyle = tint(ls.style.color, layerTintRGBA);
				ctx.beginPath();
				gridKeys.forEach(function(gk){
					if (!(gk in ls.grid)) return;
					if (z >= ls.grid[gk].length) return;
					again = true;
					ls.grid[gk][z].forEach(function(line){
						ctx.moveTo(line[0], line[1]);
						for (let i = 2; i < line.length; i += 2) {
							ctx.lineTo(line[i], line[i+1]);
						}
					});
				});
				ctx.stroke();
			}
			z += 1;
		}
	}

	ctx.translate(backOfs.x, backOfs.y);
	drawGroups(drawing.back, backTintRGBA);
	ctx.translate(-backOfs.x, -backOfs.y);

	ctx.translate(backSlidersOfs.x, backSlidersOfs.y);
	drawGroups(drawing.backSliders, backTintRGBA);
	ctx.translate(-backSlidersOfs.x, -backSlidersOfs.y);

	for (let sk in drawing.middle) {
		let ls = drawing.middle[sk];
		ctx.strokeStyle = tint(ls.style.color, middleTintRGBA);
		ctx.beginPath();
		gridKeys.forEach(function(gk){
			if (!(gk in ls.grid)) return;
			ls.grid[gk].forEach(function(lines,z) {
				lines.forEach(function(line){
					console.assert(line.length === 6, "bridges should be [fx,fy,fs,bx,by,bs]");
					ctx.moveTo(line[0] + (line[2] ? frontSlidersOfs.x : frontOfs.x), line[1] + (line[2] ? frontSlidersOfs.y : frontOfs.y));
					ctx.lineTo(line[3] + (line[5] ? backSlidersOfs.x : backOfs.x), line[4] + (line[5] ? backSlidersOfs.y : backOfs.y));
				});
			});
		});
		ctx.stroke();
	}

	ctx.translate(frontSlidersOfs.x, frontSlidersOfs.y);
	drawGroups(drawing.frontSliders, frontTintRGBA);
	ctx.translate(-frontSlidersOfs.x, -frontSlidersOfs.y);

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
		let fs, bs;
		if (cross.b[0] === 'f') {
			fs = (cross.b === 'fs');
			bs = (cross.b2 === 'bs');
			front = tileLowerLeft(cross.i, cross.y);
			pf = ports[cross.port];
			back = tileLowerLeft(cross.i2, cross.y);
			pb = ports[cross.port2];
		} else { console.assert(cross.b[0] === 'b', "yarn crosses should be f* <-> b*");
			bs = (cross.b === 'bs');
			fs = (cross.b2 === 'fs');
			front = tileLowerLeft(cross.i2, cross.y);
			pf = ports[cross.port2];
			back = tileLowerLeft(cross.i, cross.y);
			pb = ports[cross.port];
		}

		if (cross.yarns.length >= 1) {
			let l0 = cross.yarns[cross.yarns.length-1]; //frontmost yarn
			drawing.addLine(drawing.middle, cross.styles, l0, [front.x+pf.x, front.y+pf.y0, fs, back.x+pb.x, back.y+pb.y0, bs]);
		}
		if (cross.yarns.length >= 2) {
			let l1 = cross.yarns.slice(0,cross.yarns.length-1).join(' '); //rearmost yarns(s)
			drawing.addLine(drawing.middle, cross.styles, l1, [front.x+pf.x, front.y+pf.y1, fs, back.x+pb.x, back.y+pb.y1, bs]);
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
	let fs, bs;
	if (cross.b[0] === 'f') {
		fs = (cross.b === 'fs');
		bs = (cross.b2 === 'bs');
		front = tileLowerLeft(cross.i, cross.y);
		front.y += y1;
		back = tileLowerLeft(cross.i2, cross.y);
		back.y += y2;
	} else { console.assert(cross.b[0] === 'b', "loop crosses should be f* <-> b*");
		bs = (cross.b === 'bs');
		fs = (cross.b2 === 'fs');
		front = tileLowerLeft(cross.i2, cross.y);
		front.y += y2;
		back = tileLowerLeft(cross.i, cross.y);
		back.y += y1;
	}

	if (cross.yarns.length >= 1) {
		let l0 = cross.yarns[cross.yarns.length-1]; //frontmost yarn
		drawing.addLine(drawing.middle, cross.styles, l0, [front.x+l, front.y, fs, back.x+l, back.y, bs ]);
		drawing.addLine(drawing.middle, cross.styles, l0, [front.x+r, front.y, fs, back.x+r, back.y, bs ]);
	}
	if (cross.yarns.length >= 2) {
		let l1 = cross.yarns.slice(0,cross.yarns.length-1).join(' '); //rearmost yarns(s)
		drawing.addLine(drawing.middle, cross.styles, l1, [front.x+l+1.0, front.y, fs, back.x+l+1.0, back.y, bs ]);
		drawing.addLine(drawing.middle, cross.styles, l1, [front.x+r-1.0, front.y, fs, back.x+r-1.0, back.y, bs ]);
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
	//loops, yarns, etc are listed in *back-to-front* order!

	const type = tile.type;
	const bed = tile.bed;
	let loops = tile.loops; //gets moved aside in xfer source hack case
	const yarns = tile.yarns;
	const across = tile.across;
	if (loops.length === 0 && yarns.length === 0 && across.length === 0) return null;

	let layer = {
		'b': drawing.back,
		'bs': drawing.backSliders,
		'fs': drawing.frontSliders,
		'f': drawing.front
	}[bed];
	let ll = tileLowerLeft(tile.i, tile.y);

	function doLib(tileName) {
		if (loops.length >= 2) tileName += "-l2";
		else if (loops.length >= 1) tileName += "-l1";

		if (yarns.length >= 2) tileName += "-y2";
		else if (yarns.length >= 1) tileName += "-y1";

		if (across.length >= 2) tileName += "-a2";
		else if (across.length >= 1) tileName += "-a1";

		console.assert(tileName in VectorTilesLib, "Tile '" + tileName + "' is in the library.");

		const tile = VectorTilesLib[tileName];

		function yarnLines(z) {
			if (yarns.length >= 2 && "y2" in tile) {
				let y1 = yarns.slice(0,yarns.length-1).join(' '); //rearmost yarn(s)
				for (const line of tile.y2) {
					drawing.addLine(layer, styles, y1, line, ll, z);
				}
			}
			if (yarns.length >= 1 && "y1" in tile) {
				let y0 = yarns[yarns.length-1]; //frontmost yarn
				for (const line of tile.y1) {
					drawing.addLine(layer, styles, y0, line, ll, z);
				}
			}
		}

		function loopLines(z) {
			if (loops.length >= 2 && "l2" in tile) {
				let l1 = loops.slice(0,loops.length-1).join(' '); //rearmost loop(s)
				for (const line of tile.l2) {
					drawing.addLine(layer, styles, l1, line, ll, z);
				}
			}
			if (loops.length >= 1 && "l1" in tile) {
				let l0 = loops[loops.length-1]; //frontmost loop
				for (const line of tile.l1) {
					drawing.addLine(layer, styles, l0, line, ll, z);
				}
			}
		}

		function acrossLines(z) {
			if (across.length >= 2 && "a2" in tile) {
				let a1 = across.slice(0,across.length-1).join(' '); //rearmost across(s)
				for (const line of tile.a2) {
					drawing.addLine(layer, styles, a1, line, ll, z);
				}
			}
			if (across.length >= 1 && "a1" in tile) {
				let a0 = across[across.length-1]; //frontmost across
				for (const line of tile.a1) {
					drawing.addLine(layer, styles, a0, line, ll, z);
				}
			}
		}


		if (bed[0] == 'f') {
			yarnLines(0);
			acrossLines(1);
			loopLines(2);
		} else {
			loopLines(0);
			acrossLines(1);
			yarnLines(2);
		}

	}

	let g = {lines:[]};
	if (type === 'k') {
		doLib('k-' + bed[0]);
	} else if (type === 't') {
		doLib(type + "-" + bed[0]);
	} else if (type === 'm') {
		doLib(type + "-" + bed[0]);
		/*
		if (bed[0] === 'b') doLoops(0);
		if (yarns.length >= 1) {
			let y0 = yarns[0];
			drawing.addLine(layer, styles, y0, [ 0.0, 4.5, 13.0, 4.5], ll, 1);
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				drawing.addLine(layer, styles, y1, [ 0.0, 3.5, 13.0, 3.5 ], ll, 1);
			}
		}
		if (bed[0] === 'f') doLoops(2);
		*/
	} else if (type === 'S') { //split target:
		doLib('S-' + bed[0]);
	} else if (type === 's') { //split source:
		//TO CHECK: across === loops, right?
		if (JSON.stringify(across) !== JSON.stringify(loops)) {
			console.warn("Expecting across === loops");
		}
		let temp = loops;
		loops = [];
		doLib('s-' + bed[0]);
		loops = temp;
	} else if (type === 'X') { //xfer target:
		doLib('X-' + bed[0]);
	} else if (type === 'x') { //xfer source:
		//TO CHECK: across === loops, right?
		if (JSON.stringify(across) !== JSON.stringify(loops)) {
			console.warn("Expecting across === loops");
		}
		let temp = loops;
		loops = [];
		doLib('x-' + bed[0]);
		loops = temp;
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
	console.assert(typeof(tile.segs) === 'object', "Expecting segs in yarn tile");
	console.assert(Array.isArray(carriers), "Expecting carriers list for sorting");

	const bed = tile.bed;
	const ports = tile.ports;
	const segs = tile.segs;

	let locs = {};
	function addLoc(yarn, port, x, y) {
		console.assert(!((yarn + port) in locs), 'yarns visit ports once');
		locs[yarn + port] = {x:x, y:y};
	}
	ports['^+'].forEach(function(y, yi){ addLoc(y, '^+', (yi === 0 ? 5.5 : 4.5), 9.0); });
	ports['v+'].forEach(function(y, yi){ addLoc(y, 'v+', (yi === 0 ? 5.5 : 4.5), 0.0); });
	ports['^-'].forEach(function(y, yi){ addLoc(y, '^-', (yi === 0 ? 2.5 : 1.5), 9.0); });
	ports['v-'].forEach(function(y, yi){ addLoc(y, 'v-', (yi === 0 ? 2.5 : 1.5), 0.0); });

	ports['o-'].forEach(function(y, yi){ addLoc(y, 'o-', 0.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['x-'].forEach(function(y, yi){ addLoc(y, 'x-', 0.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['O-'].forEach(function(y, yi){ addLoc(y, 'O-', 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['X-'].forEach(function(y, yi){ addLoc(y, 'X-', 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['O+'].forEach(function(y, yi){ addLoc(y, 'O+', 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['X+'].forEach(function(y, yi){ addLoc(y, 'X+', 3.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['o+'].forEach(function(y, yi){ addLoc(y, 'o+', 6.5, (yi === 0 ? 6.5 : 5.5)); });
	ports['x+'].forEach(function(y, yi){ addLoc(y, 'x+', 6.5, (yi === 0 ? 6.5 : 5.5)); });

	ports['-'].forEach(function(y, yi){ addLoc(y, '-', 0.0, (yi === 0 ? 4.5 : 3.5)); });
	ports['+'].forEach(function(y, yi){ addLoc(y, '+', 7.0, (yi === 0 ? 4.5 : 3.5)); });

	let layer = {
		'b': drawing.back,
		'bs': drawing.backSliders,
		'fs': drawing.frontSliders,
		'f': drawing.front
	}[bed];

	let ll = tileLowerLeft(tile.i, tile.y);

	segs.forEach(function(seg) {
		let from = {x:3.5, y:5.5};
		let to = {x:3.5, y:5.5};
		if (seg.from != '') {
			console.assert((seg.cn + seg.from) in locs, "Must have loc for " + seg.cn + seg.from);
			from = locs[seg.cn + seg.from];
		}
		if (seg.to != '') {
			console.assert((seg.cn + seg.to) in locs, "Must have loc for " + seg.cn + seg.to);
			to = locs[seg.cn + seg.to];
		}

		let index = -1;
		carriers.forEach(function(c) {
			if (c.name == seg.cn) index = c.index;
		});
		console.assert(index !== -1, "yarns should be in carriers");

		let z = carriers.length - 1 - index; //> z => more in front

		drawing.addLine(layer, styles, seg.cn, [
			from.x, from.y, to.x, to.y
		], ll, z);
	});
};


