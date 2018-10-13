"use strict";

const VectorTiles = {};

VectorTiles.LoopWidth = 13;
VectorTiles.YarnWidth = 4;
VectorTiles.TileHeight = 9.0;

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


VectorTiles.makeLoopTile = function VectorTiles_makeLoopTile(type, bed, loops, yarns, across) {
	if (loops.length === 0 && yarns.length === 0 && across.length === 0) return null;

	function doLoops() {
		if (loops.length >= 1) {
			let l0 = loops[0];
			g.lines.push({y:l0, pts:[ 4.5, 0.0, 4.5, 9.0 ]});
			g.lines.push({y:l0, pts:[ 8.5, 0.0, 8.5, 9.0 ]});
		}
		if (loops.length >= 2) {
			let l1 = loops.slice(1).join(' ');
			g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 9.0 ]});
			g.lines.push({y:l1, pts:[ 7.5, 0.0, 7.5, 9.0 ]});
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
				g.lines.push({y:l0, pts:[
					4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 7.5, 3.5, 7.5
				]});
				g.lines.push({y:l0, pts:[ l, 7.5, r, 7.5 ]});
				g.lines.push({y:l0, pts:[
					9.5, 7.5, 11.5, 7.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0
				]});
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 2.5, 2.5, 2.5, 6.5, 3.5, 6.5 ]});
					g.lines.push({y:l1, pts:[ l, 6.5, r, 6.5 ]});
					g.lines.push({y:l1, pts:[ 9.5, 6.5, 10.5, 6.5, 10.5, 2.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
				}

				l = (loops.length === 1 ? 2.5 : 3.5);
				r = (loops.length === 1 ? 10.5 : 9.5);
				let y0 = yarns[0];
				g.lines.push({y:y0, pts:[ 0.0, 4.5, 0.5, 4.5 ]});
				g.lines.push({y:y0, pts:[ l, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
				g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 4.5, r, 4.5 ]});
				g.lines.push({y:y0, pts:[ 12.5, 4.5, 13.0, 4.5 ]});
				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					g.lines.push({y:y1, pts:[ 0.0, 3.5, 0.5, 3.5 ]});
					g.lines.push({y:y1, pts:[ l, 3.5, 5.5, 3.5, 5.5, 9.0 ]});
					g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 3.5, r, 3.5 ]});
					g.lines.push({y:y1, pts:[ 12.5, 3.5, 13.0, 3.5 ]});
				}
			} else { console.assert(bed === 'b', "bed should be f/b");
				let h = (yarns.length === 1 ? 3.5 : 2.5);
				let l0 = loops[0];
				g.lines.push({y:l0, pts:[ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, h ]});
				g.lines.push({y:l0, pts:[ 1.5, 5.5, 1.5, 7.5, 11.5, 7.5, 11.5, 5.5, ]});
				g.lines.push({y:l0, pts:[ 11.5, h, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ]});
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 2.5, 2.5, 2.5, h ]});
					g.lines.push({y:l1, pts:[ 2.5, 5.5, 2.5, 6.5, 10.5, 6.5, 10.5, 5.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, h, 10.5, 2.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
				}

				h = (loops.length === 1 ? 6.5 : 5.5);
				let y0 = yarns[0];
				g.lines.push({y:y0, pts:[ 0.0, 4.5, 4.5, 4.5, 4.5, h ]});
				g.lines.push({y:y0, pts:[ 4.5, 8.5, 4.5, 9.0 ]});
				g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 8.5 ]});
				g.lines.push({y:y0, pts:[ 8.5, h, 8.5, 4.5, 13.0, 4.5 ]});

				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					g.lines.push({y:y1, pts:[ 0.0, 3.5, 5.5, 3.5, 5.5, h ]});
					g.lines.push({y:y1, pts:[ 5.5, 8.5, 5.5, 9.0 ]});
					g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 8.5 ]});
					g.lines.push({y:y1, pts:[ 7.5, h, 7.5, 3.5, 13.0, 3.5 ]});
				}

			}
		} else if (yarns.length >= 1) {
			//yarns, no loops -> effectively a tuck:
			let y0 = yarns[0];
			g.lines.push({y:y0, pts:[ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
			g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ]});
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				g.lines.push({y:y1, pts:[ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ]});
				g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ]});
			}
		} else if (loops.length >= 1) {
			//loops, no yarns -> drop:
			let l0 = loops[0];
			g.lines.push({y:l0, pts:[
				4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 7.5,
				11.5, 7.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0
			]});
			if (loops.length >= 2) {
				let l1 = loops.slice(1).join(' ');
				g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
				g.lines.push({y:l1, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
				g.lines.push({y:l1, pts:[ 2.5, 2.5, 2.5, 6.5, 10.5, 6.5, 10.5, 2.5 ]});
				g.lines.push({y:l1, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
				g.lines.push({y:l1, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
			}
		}
	} else if (type === 't') {
		if (bed === 'b') doLoops();
		if (yarns.length >= 1) {
			let y0 = yarns[0];
			g.lines.push({y:y0, pts:[ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
			g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ]});
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				g.lines.push({y:y1, pts:[ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ]});
				g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ]});
			}
		}
		if (bed === 'f') doLoops();
	} else if (type === 'm') {
		if (bed === 'b') doLoops();
		if (yarns.length >= 1) {
			let y0 = yarns[0];
			g.lines.push({y:y0, pts:[ 0.0, 4.5, 13.0, 4.5]});
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				g.lines.push({y:y1, pts:[ 0.0, 3.5, 13.0, 3.5 ]});
			}
		}
		if (bed === 'f') doLoops();
	} else if (type === 'S') {
		if (bed === 'b') doLoops();
		if (across.length >= 1) {
			let a0 = across[0];
			g.lines.push({y:a0, pts:[ 1.5, 6.5, 1.5, 7.5, 4.5, 7.5, 4.5, 9.0 ]});
			g.lines.push({y:a0, pts:[ 11.5, 6.5, 11.5, 7.5, 8.5, 7.5, 8.5, 9.0 ]});

			if (across.length >= 2) {
				let a1 = across.slice(1).join(' ');
				g.lines.push({y:a1, pts:[ 2.5, 6.5, 5.5, 6.5, 5.5, 9.0 ]});
				g.lines.push({y:a1, pts:[ 10.5, 6.5, 7.5, 6.5, 7.5, 9.0 ]});
			}
		}

		if (bed === 'f') doLoops();
	} else if (type === 's') {
		if (yarns.length >= 1 && loops.length >= 1) {
			//TODO: loops === across, right?
			//actually a split:
			if (bed === 'f') {
				let l0 = loops[0];
				g.lines.push({y:l0, pts:[
					4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 6.5,
				]});
				g.lines.push({y:l0, pts:[
					11.5, 6.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0
				]});
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 2.5, 2.5, 2.5, 6.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, 6.5, 10.5, 2.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
				}

				let l = (loops.length === 1 ? 2.5 : 3.5);
				let r = (loops.length === 1 ? 10.5 : 9.5);
				let y0 = yarns[0];
				g.lines.push({y:y0, pts:[ 0.0, 4.5, 0.5, 4.5 ]});
				g.lines.push({y:y0, pts:[ l, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
				g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 4.5, r, 4.5 ]});
				g.lines.push({y:y0, pts:[ 12.5, 4.5, 13.0, 4.5 ]});
				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					g.lines.push({y:y1, pts:[ 0.0, 3.5, 0.5, 3.5 ]});
					g.lines.push({y:y1, pts:[ l, 3.5, 5.5, 3.5, 5.5, 9.0 ]});
					g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 3.5, r, 3.5 ]});
					g.lines.push({y:y1, pts:[ 12.5, 3.5, 13.0, 3.5 ]});
				}
			} else { console.assert(bed === 'b', "bed should be f/b");
				let h = (yarns.length === 1 ? 3.5 : 2.5);
				let l0 = loops[0];
				g.lines.push({y:l0, pts:[ 4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, h ]});
				g.lines.push({y:l0, pts:[ 1.5, 5.5, 1.5, 6.5 ]});
				g.lines.push({y:l0, pts:[ 11.5, 6.5, 11.5, 5.5 ]});
				g.lines.push({y:l0, pts:[ 11.5, h, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0 ]});
				if (loops.length >= 2) {
					let l1 = loops.slice(1).join(' ');
					g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 2.5, 2.5, 2.5, h ]});
					g.lines.push({y:l1, pts:[ 2.5, 5.5, 2.5, 6.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, 6.5, 10.5, 5.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, h, 10.5, 2.5 ]});
					g.lines.push({y:l1, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
					g.lines.push({y:l1, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
				}

				let y0 = yarns[0];
				g.lines.push({y:y0, pts:[ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
				g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ]});

				if (yarns.length >= 2) {
					let y1 = yarns.slice(1).join(' ');
					g.lines.push({y:y1, pts:[ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ]});
					g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ]});
				}

			}
		} else if (yarns.length >= 1) {
			//yarns, no loops -> effectively a tuck:
			let y0 = yarns[0];
			g.lines.push({y:y0, pts:[ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
			g.lines.push({y:y0, pts:[ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ]});
			if (yarns.length >= 2) {
				let y1 = yarns.slice(1).join(' ');
				g.lines.push({y:y1, pts:[ 0.0, 3.5, 5.5, 3.5, 5.5, 9.0 ]});
				g.lines.push({y:y1, pts:[ 7.5, 9.0, 7.5, 3.5, 13.0, 3.5 ]});
			}
		} else if (loops.length >= 1) {
			//loops, no yarns -> drop:
			let l0 = loops[0];
			g.lines.push({y:l0, pts:[
				4.5, 0.0, 4.5, 1.5, 1.5, 1.5, 1.5, 7.5,
				11.5, 7.5, 11.5, 1.5, 8.5, 1.5, 8.5, 0.0
			]});
			if (loops.length >= 2) {
				let l1 = loops.slice(1).join(' ');
				g.lines.push({y:l1, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
				g.lines.push({y:l1, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
				g.lines.push({y:l1, pts:[ 2.5, 2.5, 2.5, 6.5, 10.5, 6.5, 10.5, 2.5 ]});
				g.lines.push({y:l1, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
				g.lines.push({y:l1, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
			}
		}

	} else if (type === 'X') { //xfer target
		if (bed === 'b') doLoops();
		if (across.length >= 1) {
			let a0 = across[0];
			g.lines.push({y:a0, pts:[ 4.5, 6.5, 4.5, 9.0 ]});
			g.lines.push({y:a0, pts:[ 8.5, 6.5, 8.5, 9.0 ]});

			if (across.length >= 2) {
				let a1 = across.slice(1).join(' ');
				g.lines.push({y:a1, pts:[ 5.5, 6.5, 5.5, 9.0 ]});
				g.lines.push({y:a1, pts:[ 7.5, 6.5, 7.5, 9.0 ]});
			}
		}
		if (bed === 'f') doLoops();
	} else if (type === 'x') {
		//TO CHECK: across === loops, right?
		if (across.length >= 1) {
			let a0 = across[0];
			g.lines.push({y:a0, pts:[ 4.5, 0.0, 4.5, 6.5 ]});
			g.lines.push({y:a0, pts:[ 8.5, 0.0, 8.5, 6.5 ]});

			if (across.length >= 2) {
				let a1 = across.slice(1).join(' ');
				g.lines.push({y:a1, pts:[ 5.5, 0.0, 5.5, 6.5 ]});
				g.lines.push({y:a1, pts:[ 7.5, 0.0, 7.5, 6.5 ]});
			}
		}
	} else {
		//unknown!
		g.lines.push({y:'#f0f', pts:[ 0.0, 0.0, 13.0, 9.0 ]});
		g.lines.push({y:'#f0f', pts:[ 0.0, 9.0, 13.0, 0.0 ]});
	}
	return g;
};

VectorTiles.makeYarnTile = function VectorTiles_makeYarnTile(type, bed, ports) {
	let g = {lines:[]};
	let locs = {};
	function addLoc(yarn, x, y) {
		if (!(yarn in locs)) {
			locs[yarn] = [];
		}
		locs[yarn].push(x,y);
	}
	ports['^'].forEach(function(y){ addLoc(y, 2.0, 9.0); });
	ports['v'].forEach(function(y){ addLoc(y, 2.0, 0.0); });
	ports['-'].forEach(function(y, yi){ addLoc(y, 0.0, (yi === 0 ? 4.5 : 3.5)); });
	ports['+'].forEach(function(y, yi){ addLoc(y, 4.0, (yi === 0 ? 4.5 : 3.5)); });
	ports['o'].forEach(function(y){ addLoc(y, 2.0, 6.5); });
	ports['x'].forEach(function(y){ addLoc(y, 2.0, 6.5); });

	for (let yn in locs) {
		let list = locs[yn];
		if (list.length === 2) {
			g.lines.push({y:yn, pts:[
				2.0, 5.5, list[0], list[1]
			]});
		} else if (list.length === 4) {
			g.lines.push({y:yn, pts:[
				list[0], list[1], list[2], list[3]
			]});
		} else {
			console.warn("yarn tile mentions yarn " + list.length + " times.");
		}
	}

	return g;
};

let STYLES = {
	'1':'#f00',
	'2':'#0f0',
	'3':'#800',
	'4':'#080',
	'5':'#afe9af',
};
function yarnStyle(y) {
	if (!(y in STYLES)) {
		STYLES[y] = '#f0f';
	}
	return STYLES[y];
};

VectorTiles.draw = function VectorTiles_draw(ctx, x, y, tile) {
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	tile.lines.forEach(function(l){
		let pts = l.pts;
		ctx.beginPath();
		for (let i = 0; i < pts.length; i += 2) {
			ctx.lineTo(pts[i] + x, pts[i+1] + y);
		}
		ctx.strokeWidth = 1.0;
		ctx.strokeStyle = yarnStyle(l.y);
		ctx.stroke();
	});
};
