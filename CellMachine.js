"use strict";

//--------------------------------------

function Columns() {
	this.minIndex = Infinity;
	this.maxIndex = -Infinity;
	this.storage = [];
}

Columns.prototype.getColumn = function Columns_getColumn(i,create) {
	if (typeof(create) === 'undefined') {
		create = true;
	}
	if (!create && (i < this.minIndex || i > this.maxIndex)) {
		return false;
	}

	if (this.maxIndex < this.minIndex) {
		this.minIndex = this.maxIndex = i;
		this.storage = [[]];
	}
	while (i < this.minIndex) {
		this.minIndex -= 1;
		this.storage.unshift([]);
	}
	while (i > this.maxIndex) {
		this.maxIndex += 1;
		this.storage.push([]);
	}
	return this.storage[i - this.minIndex];
};

//--------------------------------------

const NEEDLE_REGEX = /^([fb]s?)([-+]?\d+)$/;

function previousNeedle(n) {
	let m = n.match(NEEDLE_REGEX);
	console.assert(m, "previousNeedle must be passed needle; got '" + n + "' instead.");
	return m[1] + (parseInt(m[2])-1).toString();
}

function nextNeedle(n) {
	let m = n.match(NEEDLE_REGEX);
	console.assert(m, "nextNeedle must be passed needle; got '" + n + "' instead.");
	return m[1] + (parseInt(m[2])+1).toString();
}


function needleIndex(n) {
	let m = n.match(NEEDLE_REGEX);
	console.assert(m, "needleIndex must be passed needle; got '" + n + "' instead.");
	return 2*parseInt(m[2]);
}

function needleBed(n) {
	let m = n.match(NEEDLE_REGEX);
	console.assert(m, "needleBed must be passed needle; got '" + n + "' instead.");
	return m[1];
}

//the index of the yarn column before needle n if making a stitch in direction d:
function yarnBeforeIndex(d, n) {
	if (d === '+') {
		return needleIndex(n) - 1;
	} else if (d === '-') {
		return needleIndex(n) + 1;
	} else {
		console.assert(d === '+' || d === '-', "Direction must be + or -.");
	}
}

//the index of the yarn just after needle n if making a stitch in direction d:
function yarnAfterIndex(d, n) {
	if (d === '+') {
		return needleIndex(n) + 1;
	} else if (d === '-') {
		return needleIndex(n) - 1;
	} else {
		console.assert(d === '+' || d === '-', "Direction must be + or -.");
	}
}


//--------------------------------------

function YarnCell() {
	this.y = 0;
	//port layout in cell:
	//       ^-      ^+
	//  +----|-----|----+
	//  |               |
	//- - x-   X- X+    x+ - +
	//  |               |
	//  +----|-----|----+
	//       v-      v+
	//
	// ('o' ports are in the same place as 'x' ports)
	// ('o' ports point toward us, 'x' point in)
	this.ports = {
		'^-':[], '^+':[],
		'-':[], 'x-':[], 'X-':[], 'X+':[], 'x+':[], '+':[],
		'o-':[], 'O-':[], 'O+':[], 'o+':[],
		'v-':[], 'v+':[]
	};
	this.segs = []; //like: {cn:'A', from:'^-', to:'x+'}
}

YarnCell.prototype.addSeg = function YarnCell_addSeg(yarn, from, to) {
	console.assert((from == '') || from in this.ports, "Wanted be valid from port, got '" + from + "'.");
	console.assert((to == '') || to in this.ports, "Wanted be valid to port, got '" + to + "'.");
	this.segs.push({cn:yarn, from:from, to:to});
	if (from !== '') this.addOut_(from, yarn);
	if (to !== '') this.addOut_(to, yarn);
};

YarnCell.prototype.addOut_ = function YarnCell_addOut(dir, yarn) {
	console.assert(dir in this.ports, "Wanted be valid direction, got '" + dir + "'.");
	this.ports[dir].push(yarn);
};

YarnCell.prototype.canAbsorb = function YarnCell_canAbsorb(below) {
	//NOTE: doesn't take into account yarn starts! (Though I'm not 100% sure there is a way for this to go wrong.)
	//NOTE: doesn't take into account yarns crossing themselves! (Again, not sure this ever happens.)

	//Don't collapse if any side ports overlap:
	if (['-','+','x-','X-','X+','x+','o-','O-','O+','o+'].some(function(pn){
		return below.ports[pn].length && this.ports[pn].length;
	}, this)) {
		//console.log("  NO: overlap"); //DEBUG
		return false;
	}

	return true;
};

YarnCell.prototype.absorb = function YarnCell_absorb(below) {

	/*
	//DEBUG:
	console.log("Absorb:");
	//console.log(JSON.stringify(this.segs));
	//console.log(JSON.stringify(below.segs));
	console.log(
		"^" + JSON.stringify(this.ports['^-'])
		+ JSON.stringify(this.ports['^+'])
		+ " v"
		+ JSON.stringify(this.ports['v-'])
		+ JSON.stringify(this.ports['v+'])
		);
	console.log(
		"^" + JSON.stringify(below.ports['^-'])
		+ JSON.stringify(below.ports['^+'])
		+ " v"
		+ JSON.stringify(below.ports['v-'])
		+ JSON.stringify(below.ports['v+'])
		);
	*/


	let connect = { '-':{}, '+':{} };

	let segs = [];

	below.segs.forEach(function(seg){
		console.assert(['^-','^+'].indexOf(seg.from) === -1, "always top to");
		if (seg.to === '^-') {
			console.assert(!(seg.cn in connect['-']), "no dulicate exist please");
			connect['-'][seg.cn] = seg.from;
		} else if (seg.to === '^+') {
			console.assert(!(seg.cn in connect['+']), "no dulicate exist please");
			connect['+'][seg.cn] = seg.from;
		} else {
			segs.push(seg);
		}
	}, this);

	this.segs.forEach(function(seg){
		console.assert(['v-','v+'].indexOf(seg.to) === -1, "always bottom from");
		if (seg.from === 'v-') {
			console.assert(seg.cn in connect['-'], "must connect");
			seg.from = connect['-'][seg.cn];
			delete connect['-'][seg.cn];
		} else if (seg.from === 'v+') {
			console.assert(seg.cn in connect['+'], "must connect");
			seg.from = connect['+'][seg.cn];
			delete connect['+'][seg.cn];
		}
		segs.push(seg);
	}, this);

	for (let cn in connect['-']) {
		console.assert(false, "Segment '" + cn + "' is dangling on - side");
	}
	for (let cn in connect['+']) {
		console.assert(false, "Segment '" + cn + "' is dangling on + side");
	}

	//record port orders for later use:
	let orders = {'v-':[], 'v+':[]};
	for (let pn in this.ports) {
		if (pn === 'v-' || pn === 'v+') continue;
		orders[pn] = this.ports[pn].slice();
	}
	for (let pn in below.ports) {
		if (pn === '^-' || pn === '^+') continue;
		if (below.ports[pn].length === 0) continue;
		console.assert(orders[pn].length === 0, "no overlap");
		orders[pn] = below.ports[pn].slice();
	}

	//rebuild from segs:
	for (let pn in this.ports) {
		this.ports[pn].splice(0, this.ports[pn].length);
		console.assert(this.ports[pn].length === 0, "did clear");
	}

	this.segs.splice(0, this.segs.length);
	console.assert(this.segs.length === 0, "did clear");

	segs.forEach(function(seg){
		this.addSeg(seg.cn, seg.from, seg.to);
	}, this);

	//apply port orders:
	for (let pn in orders) {
		console.assert(this.ports[pn].length == orders[pn].length, "same count");
		this.ports[pn].forEach(function(cn){
			console.assert(orders[pn].indexOf(cn) !== -1, "same yarns");
		}, this);
		this.ports[pn] = orders[pn];
	}

	/*
	//DEBUG
	//console.log(" --> " + JSON.stringify(this.segs));
	console.log(" ---> " +
		"^" + JSON.stringify(this.ports['^-'])
		+ JSON.stringify(this.ports['^+'])
		+ " v"
		+ JSON.stringify(this.ports['v-'])
		+ JSON.stringify(this.ports['v+'])
		);
	*/

};

YarnCell.prototype.desc = function YarnCell_desc() {
	let bits = 0;
	bits |= (this.ports['-'].length ? 1 : 0);
	bits |= (this.ports['+'].length ? 2 : 0);
	bits |= (this.ports['v'].length ? 4 : 0);
	bits |= (this.ports['^'].length ? 8 : 0);
	const chars = [
		' ', '╴', '╶', '─',
		'╷', '╮', '╭', '┬',
		'╵', '╯', '╰', '┴',
		'│', '┤', '├', '┼'
	];
	return chars[bits];
};

function LoopCell(type) {
	this.type = type;
	this.y = 0;
	this.ports = { '-':[], '+':[], 'v':[], '^':[], 'x':[], 'o':[] };
}

LoopCell.prototype.addOut = function LoopCell_addOut(dir, yarn) {
	console.assert(dir in this.ports, "Wanted be valid direction, got '" + dir + "'.");
	this.ports[dir].push(yarn);
};


LoopCell.prototype.canAbsorb = function LoopCell_canAbsorb(below) {
	return false;
};

LoopCell.prototype.desc = function LoopCell_desc() {
	const map = {
		m:'┄',
		t:'∧',
		k:'∩',
		x:'╻',
		X:'╹',
		s:'┰',
		S:'┸'
	};
	if (this.type in map) {
		return map[this.type];
	} else {
		return this.type;
	}
};

//--------------------------------------

function CellMachine() {
	this.carriers = []; //carriers, front-to-back. Each is {name:"A", after:{n:, d:}, index:}
	this.beds = {
		b:new Columns(),
		bs:new Columns(),
		fs:new Columns(),
		f:new Columns()
	};
	this.crosses = []; //<-- yarn crossings between beds
	this.topRow = 0;
	this.styles = {}; //<-- space-separated carrier sets => {color: , ...} objects; set with x-vis-color command

	this.racking = 0.0; //<-- racking, N or N + 0.25

	this.defaultStyles = {};
	this.currentSource = ""; //<-- current source line from ;!source: comments; will be passed 
};

//Helpers:

CellMachine.prototype.getCarrier = function CellMachine_getCarrier(cn) {
	let idx = -1;
	this.carriers.forEach(function(c,ci){
		if(c.name === cn){
			idx = ci;
		}
	}, this);
	console.assert(idx >= 0, "Carrier exists");
	return this.carriers[idx];
};

CellMachine.prototype.dump = function CellMachine_dump() {
	//dump to ascii grid.
	let minIndex = Infinity;
	let maxIndex = -Infinity;
	for (let bn in this.beds) {
		minIndex = Math.min(minIndex, this.beds[bn].minIndex);
		maxIndex = Math.max(maxIndex, this.beds[bn].maxIndex);
	}
	if (minIndex > maxIndex) return;
	console.log("Raster is [" + minIndex + "," + maxIndex + "]x[" + 0 + "," + this.topRow + "]:");
	
	let outRows = [];

	let rasterWidth = maxIndex+1-minIndex;
	['f','b'].forEach(function(bn) {
		let outIndex = 0;
		function outRow(row) {
			if (outIndex >= outRows.length) {
				outRows.push("");
			}
			if (outRows[outIndex] != "") outRows[outIndex] += " | ";
			outRows[outIndex] += row;
			outIndex += 1;
		}

		let raster = new Array(rasterWidth * (this.topRow+1));
		for (let i = minIndex; i <= maxIndex; ++i) {
			this.beds[bn].getColumn(i).forEach(function(c){
				let y = c.y;
				let x = i - minIndex;
				console.assert(typeof(raster[y * rasterWidth + x]) === 'undefined', "no stacks");
				raster[y * rasterWidth + x] = c.desc();
			});
		}

		let maxY = Math.min(2000, this.topRow); //DEBUG -- should be this.topRow
		for (let y = maxY; y >= 0; --y) {
			let row = "";
			for (let x = 0; x < rasterWidth; ++x) {
				if (typeof(raster[y * rasterWidth + x]) !== 'undefined') {
					row += raster[y * rasterWidth + x];
				} else {
					row += ' ';
				}
			}
			outRow(row);
		}
	}, this);

	console.log(outRows.join("\n"));

};

CellMachine.prototype.addCells = function CellMachine_addCells(b, list, cross) {
	console.assert(b in this.beds, "Wanted valid bed, got '" + b + "'.");

	let y = this.topRow;

	if (typeof(cross) !== 'undefined') {
		let bi, fi;
        
		let bp = '';
		let fp = '';
		if (cross.b === 'b' && cross.b2 === 'f') {
			bi = cross.i; fi = cross.i2;
			if ('port' in cross) bp = cross.port;
			if ('port2' in cross) fp = cross.port2;
		} else { console.assert(cross.b === 'f' && cross.b2 === 'b', "must cross f <-> b");
			fi = cross.i; bi = cross.i2;
			if ('port' in cross) fp = cross.port;
			if ('port2' in cross) bp = cross.port2;
		}
		const px = {
			'':0.5,
			'o-':0.00, 'x-':0.00,
			'O-':0.25, 'X-':0.25,
			'O+':0.50, 'X+':0.50,
			'o+':0.75, 'x+':0.75
		};
		console.assert(bp in px && fp in px, "port names should exist");
        let bx = bi + px[bp];
		let fx = fi + px[fp];
		cross.bx = bx;
		cross.fx = fx;
		this.crosses.some(function(cross2){
			if (cross2.y < y) return true; //early out when reach earlier portion of list
			let bx2 = cross2.bx;
			let fx2 = cross2.fx;

			if (fx < fx2 && bx < bx2) return;
			if (fx > fx2 && bx > bx2) return;

			y = cross2.y + 1;
		});
	}

	list.forEach(function(icell){
		let bed = this.beds[('bed' in icell ? icell.bed : b)];
		let column = bed.getColumn(icell.i);
		if (column.length) {
			let back = column[column.length-1];
			if (back.y >= y) {
				y = back.y;
				if (!icell.cell.canAbsorb(back)) {
					y = back.y + 1;
				}
			}
		}
	}, this);

	list.forEach(function(icell){
		let bed = this.beds[('bed' in icell ? icell.bed : b)];
		icell.cell.y = y;
		icell.cell.styles = this.styles;
		let column = bed.getColumn(icell.i);

		function dump() {
			if ('v' in icell.cell.ports) {
				console.log("Adding " + JSON.stringify(icell.cell.ports['v']) + " over " + (column.length ? JSON.stringify(column[column.length-1].ports['^']) : "empty column"));
			} else {
				console.log("Adding "
					+ JSON.stringify(icell.cell.ports['v-'])
					+ " | " + JSON.stringify(icell.cell.ports['v+'])
					+ " over "
					+ (column.length ?
						JSON.stringify(column[column.length-1].ports['^-'])
						+ " | " + JSON.stringify(column[column.length-1].ports['^+'])
						: "empty column"));
			}
			return false;
		}

		//Add empty cells to hold trailing loops/yarns:
		if (icell.i % 2 === 0) {
			let cs = icell.cell.ports['v'];
			//had better be exactly the same stack from below:
			if (cs.length) {
				console.assert((column.length && JSON.stringify(column[column.length-1].ports['^']) === JSON.stringify(cs)) || dump(), "loops out should always be exactly loops in.");
				while (column[column.length-1].y + 1 < y) {
					let empty = new LoopCell('m');
					empty.y = column[column.length-1].y + 1;
					cs.forEach(function (cn) {
						empty.addOut('v', cn);
						empty.addOut('^', cn);
					});
					empty.styles = column[column.length-1].styles;
					column.push(empty);
				}
			} else {
				console.assert(column.length === 0 || column[column.length-1].ports['^'].length === 0 || dump(), "loops out should match loops in.");
			}
		} else {
			let csL = icell.cell.ports['v-'];
			let csR = icell.cell.ports['v+'];
			if (csL.length || csR.length) {
				console.assert((column.length
					&& JSON.stringify(column[column.length-1].ports['^-']) === JSON.stringify(csL)
					&& JSON.stringify(column[column.length-1].ports['^+']) === JSON.stringify(csR) ) || dump(), "yarn out should always be exactly yarn in.");
				//had better be exactly the same stack from below:
				while (column[column.length-1].y + 1 < y) {
					let empty = new YarnCell();
					empty.y = column[column.length-1].y + 1;
					csL.forEach(function (cn) {
						empty.addSeg(cn, 'v-', '^-');
					});
					csR.forEach(function (cn) {
						empty.addSeg(cn, 'v+', '^+');
					});
					empty.styles = column[column.length-1].styles;
					column.push(empty);
				}
			} else {
				console.assert(column.length === 0 || (
					column[column.length-1].ports['^-'].length === 0
					&& column[column.length-1].ports['^+'].length === 0
					) || dump(), "yarns out should always be exactly yarns in.");
			}

		}
		if (column.length) {
			let back = column[column.length-1];
			if (back.y === y) {
				icell.cell.absorb(back);
				column.pop();
			}
		}
		icell.cell.source = this.currentSource;
		column.push(icell.cell);
	}, this);

	this.topRow = y;

	if (typeof(cross) !== 'undefined') {
		cross.y = y;
		cross.styles = this.styles;
		//DEBUG: console.log(cross.b + cross.i + " -> " + cross.b2 + cross.i2 + " @ " + cross.y + " " + JSON.stringify(cross.yarns));
		this.crosses.unshift(cross); //keep list sorted in descending order
	}
};

//helper: order port based on carrier order:
CellMachine.prototype.sortPort = function(port) {
	let me = this;
	port.sort(function(a,b){ return me.getCarrier(a).index - me.getCarrier(b).index; });
	for (let i = 1; i < port.length; ++i) {
		console.assert(this.getCarrier(port[i-1]).index < this.getCarrier(port[i]).index, "port is, indeed, sorted.");
	}
};

//bring carriers to *before* n in direction d:
CellMachine.prototype.bringCarriers = function CellMachine_bringCarriers(d, n, cs) {
	cs.forEach(function(cn){
		console.assert('in' in this.getCarrier(cn), "Can only bring carriers that are in.");
	}, this);

	//New: gather up carriers and move 'em on over, ending with upward yarn on the proper needle and everything.
	if (cs.length === 0) return;

	//goal: move all carriers to the given side of the given (front bed) index:
	let targetIndex;
	let targetSide;
	//ports used in case of crossing:
	let crossFrom = '';
	let crossTo = '';
	if (needleBed(n) === 'f') {
		targetIndex = yarnBeforeIndex(d, n);
		targetSide = d;
	} else { console.assert(needleBed(n) === 'b', "only support 'f' and 'b' beds at the moment.");
		//pick the index across from the needle's before at the current racking:
		targetIndex = yarnBeforeIndex(d, 'f' + (needleIndex(n)/2 + Math.floor(this.racking)));
		if (this.racking === Math.floor(this.racking)) {
			crossFrom = 'x' + d;
			crossTo = 'o' + d;
			targetSide = d;
		} else {
			console.assert(Math.floor(this.racking) + 0.25 === this.racking, "Integer or quarter pitch only.");
			//at quarter pitch, the bins line up a bit differently:
			//       +|b0|-      +|b1|-
			// +|f0|-      +|f1|-      +|
			if (d === '+') {
				targetIndex += 2; //(b0,+) would yield the bin left of f0, move to right
				targetSide = '-'; //target left side
				crossFrom = 'X-'; //cross on inside of lanes
				crossTo = 'o+'; //arrive at edge (not that it matters)
			} else {
				//(b0,-) would yield the bin right of f0
				targetSide = '+'; //target right side of bin
				crossFrom = 'X+'; //cross on inside of lanes
				crossTo = 'o-'; //arrive at edge (not that it matters)
			}
		}
	}

	//figure out range of where carriers are parked:
	let minIndex = targetIndex;
	let maxIndex = targetIndex;
	cs.forEach(function(cn){
		let c = this.getCarrier(cn);
		if (c.after) {
			console.assert(needleBed(c.after.n) === 'f', "Carreirs must always be parked on the front.");
			let index = yarnAfterIndex(c.after.d, c.after.n);
			minIndex = Math.min(minIndex, index);
			maxIndex = Math.max(maxIndex, index);
		}
	}, this);

	let cells = [];

	//left-to-right sweep:
	let movingRight = [];
	for (let i = minIndex; i < targetIndex; ++i) {
		let front = this.beds['f'].getColumn(i);

		if (i % 2 === 0) {
			//loop tile
			let up = (front.length ? front[front.length-1].ports['^'] : []);

			let miss = new LoopCell('m');
			up.forEach(function(cn){
				miss.addOut('v', cn);
				miss.addOut('^', cn);
			}, this);
			movingRight.forEach(function(cn) {
				miss.addOut('-', cn);
				miss.addOut('+', cn);
			}, this);
			cells.push({i:i, cell:miss});
		} else {
			//yarn tile
			let cell = new YarnCell();
			let movingFrom = {};
			movingRight.forEach(function(cn){
				movingFrom[cn] = '-';
			});

			['-','+'].forEach(function(side){
				let up = (front.length ? front[front.length-1].ports['^'+side] : []);
				
				up.forEach(function(cn){
					if (cs.indexOf(cn) === -1) {
						cell.addSeg(cn, 'v'+side, '^'+side);
					} else {
						movingFrom[cn] = 'v'+side;
						console.assert(movingRight.indexOf(cn) === -1, "can't get a yarn twice");
						movingRight.push(cn);
					}
				}, this);
			}, this);

			movingRight.sort(function(a,b){
				return cs.indexOf(a) - cs.indexOf(b);
			});
			for (let i = 1; i < movingRight.length; ++i) {
				console.assert(cs.indexOf(movingRight[i-1]) < cs.indexOf(movingRight[i]), "the plating sort is working.");
			}
			movingRight.forEach(function(cn){
				cell.addSeg(cn, movingFrom[cn], '+');
			}, this);

			this.sortPort(cell.ports['v+']);
			this.sortPort(cell.ports['v-']);

			cells.push({i:i, cell:cell});
		}
	}

	//right-to-left sweep:
	let movingLeft = [];
	for (let i = maxIndex; i > targetIndex; --i) {
		let front = this.beds['f'].getColumn(i);

		if (i % 2 === 0) {
			//loop tile
			let up = (front.length ? front[front.length-1].ports['^'] : []);

			let miss = new LoopCell('m');
			up.forEach(function(cn){
				miss.addOut('v', cn);
				miss.addOut('^', cn);
			}, this);
			movingLeft.forEach(function(cn) {
				miss.addOut('+', cn);
				miss.addOut('-', cn);
			}, this);
			cells.push({i:i, cell:miss});
		} else {
			//yarn tile
			let cell = new YarnCell();
			let movingFrom = {};
			movingLeft.forEach(function(cn){
				movingFrom[cn] = '+';
			});

			['-','+'].forEach(function(side){
				let up = (front.length ? front[front.length-1].ports['^'+side] : []);
				
				up.forEach(function(cn){
					if (cs.indexOf(cn) === -1) {
						cell.addSeg(cn, 'v'+side, '^'+side);
					} else {
						movingFrom[cn] = 'v'+side;
						console.assert(movingLeft.indexOf(cn) === -1, "can't get a yarn twice");
						movingLeft.push(cn);
					}
				}, this);
			}, this);

			movingLeft.sort(function(a,b){
				return cs.indexOf(a) - cs.indexOf(b);
			});
			for (let i = 1; i < movingLeft.length; ++i) {
				console.assert(cs.indexOf(movingLeft[i-1]) < cs.indexOf(movingLeft[i]), "the plating sort is working.");
			}
			movingLeft.forEach(function(cn){
				cell.addSeg(cn, movingFrom[cn], '-');
			}, this);

			this.sortPort(cell.ports['v+']);
			this.sortPort(cell.ports['v-']);

			cells.push({i:i, cell:cell});
		}
	}

	{ //turn everything upward:
		let turn = new YarnCell();
		let front = this.beds['f'].getColumn(targetIndex);
		let upLeft = (front.length ? front[front.length-1].ports['^-'] : []);
		let upRight = (front.length ? front[front.length-1].ports['^+'] : []);

		let outSide = '^' + targetSide;
		upLeft.forEach(function(cn){
			if (cs.indexOf(cn) !== -1) {
				turn.addSeg(cn, 'v-', outSide);
			} else {
				turn.addSeg(cn, 'v-', '^-');
			}
		}, this);
		upRight.forEach(function(cn){
			if (cs.indexOf(cn) !== -1) {
				turn.addSeg(cn, 'v+', outSide);
			} else {
				turn.addSeg(cn, 'v+', '^+');
			}
		}, this);
		movingLeft.forEach(function(cn){
			turn.addSeg(cn, '+', outSide);
		}, this);
		movingRight.forEach(function(cn){
			turn.addSeg(cn, '-', outSide);
		}, this);

		//start any carriers not already mentioned:
		cs.forEach(function(cn){
			if (turn.ports[outSide].indexOf(cn) === -1) {
				turn.addSeg(cn, '', outSide);
				//add an 'after' field just to be sure:
				let c = this.getCarrier(cn);
				console.assert(!('after' in c), "if not gotten, must not have been used yet");
				c.after = {d:(targetSide === '+' ? '-' : '+'), n:'f' + Math.floor(targetIndex/2)};
			}
		}, this);
		this.sortPort(turn.ports[outSide]);
		cells.push({i:targetIndex, cell:turn});
	}
	/*
	//DEBUG:
	console.log("----");
	cells.forEach(function(cell){
		if ('^-' in cell.cell.ports) {
			console.log(
				"^" + JSON.stringify(cell.cell.ports['^-'])
				+ JSON.stringify(cell.cell.ports['^+'])
				+ " v"
				+ JSON.stringify(cell.cell.ports['v-'])
				+ JSON.stringify(cell.cell.ports['v+'])
				);
		}
	});
	console.log(cells); //DEBUG
	*/

	this.addCells('f', cells);

	//if needed, bridge to back:
	if (needleBed(n) !== 'f') {
		console.assert(needleBed(n) === 'b', "only f/b supported.");

		//make bridge to the back bed:
		let cells = [];
		let toBack = new YarnCell();

		let front = this.beds['f'].getColumn(targetIndex);

		//console.log(JSON.stringify(front)); //DEBUG
		let found = 0;
		['-','+'].forEach(function(side){
			let up = (front.length ? front[front.length-1].ports['^'+side] : []);
			//console.log(side + ": " + JSON.stringify(up)); //DEBUG
			up.forEach(function(cn){
				if (cs.indexOf(cn) !== -1) {
					console.assert(targetSide === side, "all yarns should be on correct side");
					++found;
				} else {
					toBack.addSeg(cn, 'v'+side, '^'+side);
				}
			}, this);
		}, this);
		//console.log(cs); //DEBUG
		console.assert(found === cs.length, "got all carriers");

		cs.forEach(function(cn){
			toBack.addSeg(cn, 'v'+targetSide, crossFrom);
		}, this);

		cells.push({bed:'f', i:targetIndex, cell:toBack});

		let fromFront = new YarnCell();
		cs.forEach(function(cn){
			fromFront.addSeg(cn, crossTo, '^'+d); //not targetSide because of quarter pitch racking
		}, this);

		cells.push({bed:'b', i:yarnBeforeIndex(d,n), cell:fromFront});
		const cross = {
			yarns:cs.slice(),
			b:'f', i:targetIndex, port:crossFrom,
			b2:'b', i2:yarnBeforeIndex(d,n), port2:crossTo,
			type:'y'
		};
		this.addCells('f', cells, cross);
	}

	//mark carriers:
	cs.forEach(function(cn){
		let c = this.getCarrier(cn);
		console.assert('after' in c, "All moved carriers should be after something.");
		delete c.after;
		//mark all carriers as before something, since they just got moved:
		c.before = {d:d, n:n};
	}, this);
	

};

CellMachine.prototype.makeTurnBefore = function CellMachine_makeTurnBefore(d, n, cs, cells) {
	//to be used after bringCarriers -- makes a turn containing all the carriers in cs,
	//stores it into cells.

	//Turn carriers toward the needle:
	if (cs.length) {
		let turn = new YarnCell();

		let column = this.beds[needleBed(n)].getColumn(yarnBeforeIndex(d,n));
		console.assert(column.length, "carriers must be here already");
		let turned = 0;
		['-','+'].forEach(function(side){
			column[column.length-1].ports['^'+side].forEach(function (cn) {
				if (cs.indexOf(cn) === -1) {
					turn.addSeg(cn, 'v'+side, '^'+side);
				} else {
					console.assert(side === d, "should already be on the right side");
					++turned;
					turn.addSeg(cn, 'v'+side, d);
				}
			}, this);
		}, this);
		console.assert(turned === cs.length, "turned all the yarns");
		cells.push({i:yarnBeforeIndex(d, n), cell:turn});
	}


};


CellMachine.prototype.makeAfter = function CellMachine_makeAfter(d, n, cs, cells, cross) {
	//to be used after building the yarn face

	//turn carriers back up:
	if (cs.length) {
		let turn = new YarnCell();

		let column = this.beds[needleBed(n)].getColumn(yarnAfterIndex(d,n));
		if (column.length) {
			['-','+'].forEach(function(side){
				column[column.length-1].ports['^'+side].forEach(function (cn) {
					console.assert(cs.indexOf(cn) === -1, "shouldn't run into same yarn");
					turn.addSeg(cn, 'v'+side, '^'+side);
				}, this);
			}, this);
		}

		let outSide = (d === '+' ? '-' : '+');

		cs.forEach(function(cn){
			turn.addSeg(cn, outSide, '^'+outSide);
		}, this);
		this.sortPort(turn.ports['^'+outSide]);
        cells.push({i:yarnAfterIndex(d, n), cell:turn});
	}
//    if (typeof(cross) === 'undefined'){
//        this.addCells(needleBed(n), cells, cross);
//    }
	this.addCells(needleBed(n), cells, cross);

	let frontD;
	let frontN;
	let crossTo = '';
	let crossFrom = '';

	//mark carriers:
	if (needleBed(n) === 'f') {
		frontD = d;
		frontN = n;
	} else { console.assert(needleBed(n) === 'b', "Only f/b at the moment");
		frontD = d;
		if (this.racking === Math.floor(this.racking)) {
			//aligned racking:
			frontN = 'f' + (needleIndex(n)/2 + Math.floor(this.racking));
			crossFrom = 'o' + (d === '+' ? '-' : '+');
			crossTo   = 'x' + (d === '+' ? '-' : '+');
		} else { console.assert(Math.floor(this.racking)+0.25 === this.racking, "quarter pitch please");
			//unaligned (e.g. quarter pitch) racking:
			if (d === '+') {
				frontN = 'f' + (needleIndex(n)/2 + Math.floor(this.racking) + 1);
				frontD = '-';
				crossFrom = 'o-';
				crossTo   = 'X+';
			} else { console.assert(d === '-', "+/- only");
				frontN = 'f' + (needleIndex(n)/2 + Math.floor(this.racking));
				frontD = '+';
				crossFrom = 'o+';
				crossTo   = 'X-';
			}
		}

		if (cs.length) {
			//detour: also add bridge from back bed

			let cells = [];
			let toFront = new YarnCell();
			cs.forEach(function(cn){
				toFront.addSeg(cn,'v' + (d === '+' ? '-' : '+'), crossFrom);
			}, this);

			cells.push({bed:'b', i:yarnAfterIndex(d,n), cell:toFront});

			let fromBack = new YarnCell();

			let front = this.beds['f'].getColumn(yarnAfterIndex(frontD, frontN));
			['-','+'].forEach(function(side){
				(front.length ? front[front.length-1].ports['^' + side] : []).forEach(function(cn) {
					console.assert(cs.indexOf(cn) === -1, "shouldn't be over here");
					fromBack.addSeg(cn, 'v'+side, '^'+side);
				}, this);
			}, this);

			cs.forEach(function(cn){
				fromBack.addSeg(cn, crossTo, '^' + (frontD === '+' ? '-' : '+'));
			}, this);
			this.sortPort(fromBack.ports['^' + (frontD === '+' ? '-' : '+')]);

			cells.push({bed:'f', i:yarnAfterIndex(frontD, frontN), cell:fromBack});

			const cross = {
				yarns:cs.slice(),
				b:'b', i:yarnAfterIndex(d,n), port:crossFrom,
				b2:'f', i2:yarnAfterIndex(frontD,frontN), port2:crossTo,
				type:'y'
			};
			this.addCells('f', cells, cross);
		}
	}

	//record 'after' info:
	cs.forEach(function(cn){
		let c = this.getCarrier(cn);
		console.assert('before' in c, "must have been brought");
		console.assert(!('after' in c), "must have been brought, thus no after");
		delete c.before;
		c.after = {d:frontD, n:frontN};
	}, this);


};


//Required functions:
CellMachine.prototype.source = function CellMachine_source(source) {
	this.currentSource = source;
};

CellMachine.prototype.setCarriers = function CellMachine_setCarriers(carriers) {
	function makeStyle(cn, ci) {
		//let's do rainbow around full-saturation colors, assuming 10 carriers.
		let hue = (Math.floor((ci*5.5)%10) + 0.5) / 10.0 * 6.0;
		let r, g, b;
		if (hue < 1.0) {
			r = 1.0;
			g = (hue - 0.0);
			b = 0.0
		} else if (hue < 2.0) {
			r = 1.0 - (hue - 1.0);
			g = 1.0;
			b = 0.0;
		} else if (hue < 3.0) {
			r = 0.0;
			g = 1.0;
			b = (hue - 2.0);
		} else if (hue < 4.0) {
			r = 0.0;
			g = 1.0 - (hue - 3.0);
			b = 1.0;
		} else if (hue < 5.0) {
			r = (hue - 4.0);
			g = 0.0;
			b = 1.0;
		} else { /* (hue < 6.0) */
			r = 1.0;
			g = 0.0;
			b = 1.0 - (hue - 5.0);
		}

		function h2(f) {
			let val = Math.max(0, Math.min(255, Math.round(f * 255))).toString(16);
			if (val.length < 2) val = "0" + val;
			console.assert(val.length === 2, "h2 should always produce a pair of hex digits, darn it");
			return val;
		}

		return {color:'#' + h2(r) + h2(g) + h2(b) }
	};

	console.assert(this.carriers.length === 0, "Shouldn't set carriers twice.");
	carriers.forEach(function(c,ci){
		this.carriers.push({name:c, index:ci});
		this.styles[c] = makeStyle(c, ci);
	}, this);
	this.defaultStyles = this.styles;
};

CellMachine.prototype.in = function CellMachine_in(cs) {
	cs.forEach(function(cn){
		let c = this.getCarrier(cn);
		console.assert(!('in' in c), "Can't 'in' carrier that's not out.");
		c.in = true;
	}, this);
};
CellMachine.prototype.out = function CellMachine_out(cs) {
	cs.forEach(function(cn){
		let c = this.getCarrier(cn);
		console.assert(('in' in c), "Can't 'out' carrier that's not in.");
		delete c.in;
		if ('after' in c) {
			console.assert(needleBed(c.after.n) === 'f', "carriers are always parked on the front bed.");
			let column = this.beds[needleBed(c.after.n)].getColumn(yarnAfterIndex(c.after.d,c.after.n));
			console.assert(column.length, "can't take a carrier out of an empty yarn column");
			let cell = column[column.length-1];
			let portName = (c.after.d === '+' ? '^-' : '^+')
			let port = cell.ports[portName];
			let idx = port.indexOf(cn);
			console.assert(idx !== -1, "must have yarn in column where it's being removed");
			port.splice(idx, 1);
			let found = false;
			cell.segs.forEach(function(seg){
				if (seg.cn === cn && seg.to === portName) {
					console.assert(!found, "only one seg");
					found = true;
					seg.to = '';
				}
			}, this);
			console.assert(found, "exactly one seg");

			delete c.after;
		}
	}, this);
};
CellMachine.prototype.inhook = function CellMachine_inhook(cs) {
	this.in(cs); //hook doesn't matter for this code
};
CellMachine.prototype.releasehook = function CellMachine_releasehook(cs) { /* nothing */ };
CellMachine.prototype.outhook = function CellMachine_outhook(cs) {
	this.out(cs); //hook doesn't matter for this code
};

CellMachine.prototype.stitch = function CellMachine_stitch(l, t) {
	//TODO: set leading / stitch values.
};
CellMachine.prototype.rack = function CellMachine_rack(r) {
	if (typeof(r) !== "number") throw "Racking must be a number.";
	if (!(Math.floor(r) === r || Math.floor(r) + 0.25 === r)) throw "Racking must be an integer or an integer plus 0.25";
	this.racking = r;
};

CellMachine.prototype.knitTuck = function CellMachine_knitTuck(d, n, cs, knitTuck) {
	//Bring carriers on over:
	this.bringCarriers(d, n, cs);

	let cells = [];

	//Turn carriers toward the needle:
	this.makeTurnBefore(d, n, cs, cells);

	//add the face:
	cells.push({i:needleIndex(n), cell:knitTuck});

	//Do clean-up and marking:
	this.makeAfter(d, n, cs, cells);

};

CellMachine.prototype.knit = function CellMachine_knit(d, n, cs) {
	//build a knit face:
	let knit = new LoopCell('k');
	//add loop inputs from the column:
	let c = this.beds[needleBed(n)].getColumn(needleIndex(n));
	if (c.length) {
		c[c.length-1].ports['^'].forEach(function (cn) {
			knit.addOut('v', cn);
		});
	}

	cs.forEach(function(cn){
		knit.addOut((d === '+' ? '-' : '+'), cn);
		knit.addOut('^', cn);
		knit.addOut(d, cn);
	}, this);

	this.knitTuck(d, n, cs, knit);
};

CellMachine.prototype.tuck = function CellMachine_tuck(d, n, cs) {
	//build a tuck face:
	let tuck = new LoopCell('t');

	function addLoops() {
		//add loop inputs from the column:
		let c = this.beds[needleBed(n)].getColumn(needleIndex(n));
		//NOTE: need to mind the back-to-front ordering!
		if (c.length) {
			c[c.length-1].ports['^'].forEach(function (cn) {
				tuck.addOut('v', cn);
				tuck.addOut('^', cn);
			});
		}
	}

	if (needleBed(n) === 'b') addLoops.call(this);

	cs.forEach(function(cn){
		tuck.addOut((d === '+' ? '-' : '+'), cn);
		tuck.addOut('^', cn);
		tuck.addOut(d, cn);
	}, this);

	if (needleBed(n) === 'f') addLoops.call(this);

	this.knitTuck(d, n, cs, tuck);
};

CellMachine.prototype.split = function CellMachine_split(d, n, n2, cs) {
	//TODO: splitting *nothing* is the same as tucking.

	//Bring carriers on over:
	this.bringCarriers(d, n, cs);

	let cells = [];

	//Turn carriers toward the needle:
	this.makeTurnBefore(d, n, cs, cells);

	//add a pair of faces:
	let xferFrom = new LoopCell((cs.length ? 's' : 'x'));

	cs.forEach(function(cn){
		xferFrom.addOut((d === '+' ? '-' : '+'), cn);
		xferFrom.addOut('^', cn);
		xferFrom.addOut(d, cn);
	}, this);

	cells.push({i:needleIndex(n), cell:xferFrom});

	let xferTo = new LoopCell((cs.length ? 'S' : 'X'));
	cells.push({bed:needleBed(n2), i:needleIndex(n2), cell:xferTo});

	let fromPort = (needleBed(n) === 'f' ? 'x' : 'o');
	let toPort = (needleBed(n) === 'f' ? 'o' : 'x');

	const cross = {
		yarns:[],
		b:needleBed(n), i:needleIndex(n),
		b2:needleBed(n2), i2:needleIndex(n2),
		type:(cs.length === 0 ? 'x' : 's')
	};
	console.assert('i' in cross && 'i2' in cross, "cross should have indices for from and to");

	function addToLoops() {
		//add loops under the target:
		let c2 = this.beds[needleBed(n2)].getColumn(needleIndex(n2));
		if (c2.length) {
			c2[c2.length-1].ports['^'].forEach(function (cn) {
				xferTo.addOut('v', cn);
				xferTo.addOut('^', cn);
			});
		}
	}

	if (needleBed(n2) === 'b') addToLoops.call(this);

	//add loop connections from the column:
	let c = this.beds[needleBed(n)].getColumn(needleIndex(n));
	if (c.length) {
		c[c.length-1].ports['^'].forEach(function (cn) {
			xferFrom.addOut('v', cn);
			xferFrom.addOut(fromPort, cn);
			xferTo.addOut(toPort, cn);
			xferTo.addOut('^', cn);
			cross.yarns.push(cn); //<-- add yarn to crossing
		});
	}

	if (needleBed(n2) === 'f') addToLoops.call(this);

	//Do clean-up and marking:
	this.makeAfter(d, n, cs, cells, cross);
};

CellMachine.prototype.miss = function CellMachine_miss(d, n, cs) {
	//build a miss face:
	let miss = new LoopCell('m');

	//add loop inputs from the column:
	let c = this.beds[needleBed(n)].getColumn(needleIndex(n));
	if (c.length) {
		c[c.length-1].ports['^'].forEach(function (cn) {
			miss.addOut('v', cn);
			miss.addOut('^', cn);
		});
	}

	cs.forEach(function(cn){
		miss.addOut((d === '+' ? '-' : '+'), cn);
		miss.addOut(d, cn);
	}, this);

	this.knitTuck(d, n, cs, miss);
};

CellMachine.prototype.pause = function CellMachine_pause() { /* nothing */ };

CellMachine.prototype['x-vis-color'] = function Cellmachine_x_vis_color(args) {
	let toks = Array.from(arguments);
	let color = toks.shift();
	let cs = toks;
	let key = cs.join(' ');

	//colors gets copied before update (so that cells can reference colors at their moment of creation):
	let oldStyles = this.styles;
	this.styles = {};
	Object.assign(this.styles, oldStyles);

	//update colors:
	if (color === 'auto') {
		if (key in this.defaultStyles) {
			this.styles[key] = this.defaultStyles[key]
		} else {
			delete this.styles[key];
		}
	} else {
		this.styles[key] = {color:color};
	}
};

if (typeof(module) !== "undefined") {
	module.exports.CellMachine = CellMachine;
}
