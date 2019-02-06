"use strict";

//--------------------------------------

function Columns() {
	this.minIndex = Infinity;
	this.maxIndex = -Infinity;
	this.storage = [];
}

Columns.prototype.getColumn = function Columns_getColumn(i) {
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
	this.ports = { '-':[], '+':[], 'v':[], '^':[], 'x':[], 'o':[] };
}

YarnCell.prototype.addOut = function YarnCell_addOut(dir, yarn) {
	console.assert(dir in this.ports, "Wanted be valid direction, got '" + dir + "'.");
	this.ports[dir].push(yarn);
};

YarnCell.prototype.canAbsorb = function YarnCell_canAbsorb(below) {
	//NOTE: doesn't take into account yarn starts! (Though I'm not 100% sure there is a way for this to go wrong.)
	//NOTE: doesn't take into account yarns crossing themselves! (Again, not sure this ever happens.)

	//DEBUG:
	let counts = {};
	for (let pn in this.ports) {
		this.ports[pn].forEach(function(yn){
			if (!(yn in counts)) counts[yn] = 0;
			counts[yn] += 1;
		});
	}
	for (let yn in counts) {
		console.assert(counts[yn] <= 2, "Yarn appears more than twice (" + counts[yn] + " times) in cell before merge: ", this);
	}


	//Don't collapse if in/out ports overlap:
	if (below.ports['-'].length && this.ports['-'].length) return false;
	if (below.ports['+'].length && this.ports['+'].length) return false;
	if (below.ports['x'].length && this.ports['x'].length) return false;
	if (below.ports['o'].length && this.ports['o'].length) return false;

	//Don't collapse if same yarn appears in each but doesn't pass though bottom port:
	let yarns = {};
	//all yarns mentioned in this:
	for (let p in this.ports) {
		this.ports[p].forEach(function(cn){
			yarns[cn] = true;
		});
	}
	//remove yarns passing through bottom port:
	this.ports['v'].forEach(function(cn){
		delete yarns[cn];
	});

	//if other has any of the yarns above, can't absorb:
	for (let p in below.ports) {
		if (below.ports[p].some(function(cn){
			return (cn in yarns);
		})) {
			return false;
		}
	}

	return true;
};

YarnCell.prototype.absorb = function YarnCell_absorb(below) {
	below.ports['^'].forEach(function(cn){
		let idx = this.ports['v'].indexOf(cn);
		if (idx !== -1) {
			//block consumes yarn, so just remove the input port (it will get added back by below):
			this.ports['v'].splice(idx, 1);
		} else {
			//yarn continues through to the top:
			this.ports['^'].push(cn);
		}
	}, this);
	this.ports['v'].push(...below.ports['v']);
	this.ports['+'].push(...below.ports['+']);
	this.ports['-'].push(...below.ports['-']);
	this.ports['x'].push(...below.ports['x']);
	this.ports['o'].push(...below.ports['o']);

	//DEBUG:
	let counts = {};
	for (let pn in this.ports) {
		this.ports[pn].forEach(function(yn){
			if (!(yn in counts)) counts[yn] = 0;
			counts[yn] += 1;
		});
	}
	for (let yn in counts) {
		console.assert(counts[yn] <= 2, "Yarn appears more than twice (" + counts[yn] + " times) in merged cell: ", this);
	}

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

LoopCell.prototype.addOut = YarnCell.prototype.addOut;

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
	this.carriers = []; //carriers, front-to-back. Each is {name:"A", yarnColumn:...(?)}
	this.beds = {
		b:new Columns(),
		f:new Columns()
	};
	this.crosses = []; //<-- yarn crossings between beds
	this.topRow = 0;
	this.styles = {}; //<-- space-separated carrier sets => {color: , ...} objects; set with x-vis-color command
	this.defaultStyles = {};
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

CellMachine.prototype.dumpObj = function CellMachine_dumpObj(objFile) {
	//Dump obj faces. Y-up. Front bed at Z=1, back bed at Z=-1 .

	let minIndex = Infinity;
	let maxIndex = -Infinity;
	for (let bn in this.beds) {
		minIndex = Math.min(minIndex, this.beds[bn].minIndex);
		maxIndex = Math.max(maxIndex, this.beds[bn].maxIndex);
	}
	if (minIndex > maxIndex) return;
	console.log("Raster is [" + minIndex + "," + maxIndex + "]x[" + 0 + "," + this.topRow + "]:");
	
	let outColumns = {
		f:[], b:[]
	};
	for (let i = minIndex; i <= maxIndex; ++i) {
		outColumns.f.push([]);
		outColumns.b.push([]);
	}

	let rasterWidth = maxIndex+1-minIndex;
	['f','b'].forEach(function(bn) {
		for (let i = minIndex; i <= maxIndex; ++i) {
			let column = outColumns[bn][i - minIndex];
			let y = 0;
			let cs = []; //active loops/yarns from previous faces.
			function emptyCell(y) {
				let cell = (i % 2 === 0 ? new LoopCell('m') : new YarnCell());
				cell.y = y;
				cs.forEach(function (cn) {
					cell.addOut('v', cn);
					cell.addOut('^', cn);
				});
				return cell;
			}
			this.beds[bn].getColumn(i).forEach(function(c){
				while (y < c.y) {
					column.push( emptyCell(y) );
					++y;
				}
				column.push(c);
				++y;
				c.ports['v'].forEach(function (cn) {
					let idx = cs.indexOf(cn);
					console.assert(idx !== -1, "Face should have only active yarns as inputs.");
					cs.splice(idx, 1);
				});
				console.assert(cs.length === 0, "Should have accounted for extra yarns in the face.", cs, c);
				c.ports['^'].forEach(function (cn) {
					cs.push(cn);
				});
			});
			while (y <= this.topRow) {
				column.push( emptyCell(y) );
				++y;
			}
			//TODO: explicit drop face?
		}
	}, this);

	let verts = [];
	let faces = [];
	let labels = [];
	let uvs = [];

	uvs.push(
		"vt " + (0.0/4.0) + " " + (0.0/4.0),
		"vt " + (1.0/4.0) + " " + (0.0/4.0),
		"vt " + (1.0/4.0) + " " + (1.0/4.0),
		"vt " + (0.0/4.0) + " " + (1.0/4.0)
	);
	const unknownUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (0.0/4.0) + " " + (3.0/4.0),
		"vt " + (1.0/4.0) + " " + (3.0/4.0),
		"vt " + (1.0/4.0) + " " + (4.0/4.0),
		"vt " + (0.0/4.0) + " " + (4.0/4.0)
	);
	const backKnitUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (1.0/4.0) + " " + (3.0/4.0),
		"vt " + (2.0/4.0) + " " + (3.0/4.0),
		"vt " + (2.0/4.0) + " " + (4.0/4.0),
		"vt " + (1.0/4.0) + " " + (4.0/4.0)
	);
	const frontKnitUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (0.0/4.0) + " " + (2.0/4.0),
		"vt " + (1.0/4.0) + " " + (2.0/4.0),
		"vt " + (1.0/4.0) + " " + (3.0/4.0),
		"vt " + (0.0/4.0) + " " + (3.0/4.0)
	);
	const backTuckUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (1.0/4.0) + " " + (2.0/4.0),
		"vt " + (2.0/4.0) + " " + (2.0/4.0),
		"vt " + (2.0/4.0) + " " + (3.0/4.0),
		"vt " + (1.0/4.0) + " " + (3.0/4.0)
	);
	const frontTuckUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (0.0/4.0) + " " + (1.0/4.0),
		"vt " + (1.0/4.0) + " " + (1.0/4.0),
		"vt " + (1.0/4.0) + " " + (2.0/4.0),
		"vt " + (0.0/4.0) + " " + (2.0/4.0)
	);
	const backMissUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (1.0/4.0) + " " + (1.0/4.0),
		"vt " + (2.0/4.0) + " " + (1.0/4.0),
		"vt " + (2.0/4.0) + " " + (2.0/4.0),
		"vt " + (1.0/4.0) + " " + (2.0/4.0)
	);
	const frontMissUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (2.0/4.0) + " " + (1.0/4.0),
		"vt " + (3.0/4.0) + " " + (1.0/4.0),
		"vt " + (2.0/4.0) + " " + (2.0/4.0),
		"vt " + (3.0/4.0) + " " + (2.0/4.0)
	);
	const looplessMissUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	uvs.push(
		"vt " + (3.0/4.0) + " " + (1.0/4.0),
		"vt " + (4.0/4.0) + " " + (1.0/4.0),
		"vt " + (3.0/4.0) + " " + (2.0/4.0),
		"vt " + (4.0/4.0) + " " + (2.0/4.0)
	);
	const yarnlessMissUVs = [uvs.length-3, uvs.length-2, uvs.length-1, uvs.length];

	let lookup = {};
	function getVertexStr(x,y,z) {
		let vs = "v"
			+ " " + x
			+ " " + y
			+ " " + z;
		if (!(vs in lookup)) {
			lookup[vs] = verts.length + 1;
			verts.push(vs);
		}
		return lookup[vs];
	};

	//connect faces / allocate vertices:
	for (let i = minIndex; i <= maxIndex; ++i) {
		let bColumn = outColumns.b[i-minIndex];
		let fColumn = outColumns.f[i-minIndex];
		console.assert(fColumn.length === bColumn.length, "same size grids");
		for (let y = 0; y < fColumn.length; ++y) {
			let b = bColumn[y];
			let f = fColumn[y];
			console.assert(b.ports["x"].length === 0, "can't leave backward from back bed");
			console.assert(f.ports["o"].length === 0, "can't leave forward from front bed");
			if (b.ports["o"].length !== 0 || f.ports["x"].length !== 0) {
				console.assert(b.ports["o"].length === f.ports["x"].length, "should have same yarns leaving front as arriving at back");
				//TODO: do something about that....
			} else {
				//Front face stuff:
				let uvs = unknownUVs;
				if (f instanceof YarnCell) {
					labels.push( "ty 0 0 0 0" );
				} else if (f instanceof LoopCell) {
					if (f.type === "k") uvs = frontKnitUVs;
					else if (f.type === "t") uvs = frontTuckUVs;
					else if (f.type === "m") {
						let hasLoop = !(f.ports['v'].length === 0 && f.ports['^'].length === 0);
						let hasYarn = !(f.ports['-'].length === 0 && f.ports['+'].length === 0);
						if (hasLoop && hasYarn) uvs = frontMissUVs;
						else if (hasLoop) uvs = yarnlessMissUVs;
						else if (hasYarn) uvs = looplessMissUVs;
						else /* TODO: blank faces? */;
					}
					if (f.type === "k" || f.type === "t" || f.type === "m") {
						labels.push( "t" + f.type + " 1 0 1 0" );
					} else {
						console.assert(false, "not sure how to label this face: ", f);
					}
				} else {
					console.assert(f instanceof YarnCell ||  b instanceof LoopCell, "must be Yarn or Loop");
				}
				faces.push(
					"f"
					+ " " + getVertexStr(i, y, 1) + "/" + uvs[0]
					+ " " + getVertexStr(i+1, y, 1) + "/" + uvs[1]
					+ " " + getVertexStr(i+1, y+1, 1) + "/" + uvs[2]
					+ " " + getVertexStr(i, y+1, 1) + "/" + uvs[3]
				);


				//Back face stuff:
				uvs = unknownUVs;
				if (b instanceof YarnCell) {
					labels.push( "ty 0 0 0 0" );
				} else if (b instanceof LoopCell) {
					if (b.type === "k") uvs = backKnitUVs;
					else if (b.type === "t") uvs = backTuckUVs;
					else if (b.type === "m") {
						let hasLoop = !(b.ports['v'].length === 0 && b.ports['^'].length === 0);
						let hasYarn = !(b.ports['-'].length === 0 && b.ports['+'].length === 0);
						if (hasLoop && hasYarn) uvs = backMissUVs;
						else if (hasLoop) uvs = yarnlessMissUVs;
						else if (hasYarn) uvs = looplessMissUVs;
						else /* TODO: blank faces? */;
					}
					if (b.type === "k" || b.type === "t" || b.type === "m") {
						labels.push( "t" + b.type + " 1 0 1 0" );
					} else {
						console.assert(false, "not sure how to label this face: ", b);
					}
				} else {
					console.assert(f instanceof YarnCell ||  b instanceof LoopCell, "must be Yarn or Loop");
				}
				faces.push(
					"f"
					+ " " + getVertexStr(i, y, -1) + "/" + uvs[0]
					+ " " + getVertexStr(i+1, y, -1) + "/" + uvs[1]
					+ " " + getVertexStr(i+1, y+1, -1) + "/" + uvs[2]
					+ " " + getVertexStr(i, y+1, -1) + "/" + uvs[3]
				);


			}
		}
	}

	return verts.join("\n") + "\n" + uvs.join("\n") + "\n" + faces.join("\n") + "\n" + labels.join("\n") + "\n";
};

CellMachine.prototype.addCells = function CellMachine_addCells(b, list, cross) {
	console.assert(b in this.beds, "Wanted valid bed, got '" + b + "'.");

	let y = this.topRow;

	if (typeof(cross) !== 'undefined') {
		let bi, fi;
		if (cross.b === 'b' && cross.b2 === 'f') {
			bi = cross.i; fi = cross.i2;
		} else { console.assert(cross.b === 'f' && cross.b2 === 'b', "must cross f <-> b");
			fi = cross.i; bi = cross.i2;
		}
		this.crosses.some(function(cross2){
			if (cross2.y < y) return true; //early out when reach earlier portion of list
			let bi2, fi2;
			if (cross2.b === 'b' && cross2.b2 === 'f') {
				bi2 = cross2.i; fi2 = cross2.i2;
			} else { console.assert(cross2.b === 'f' && cross2.b2 === 'b', "must cross f <-> b");
				fi2 = cross2.i; bi2 = cross2.i2;
			}

			if (fi < fi2 && bi < bi2) return;
			if (fi > fi2 && bi > bi2) return;

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
			console.log("Adding " + JSON.stringify(icell.cell.ports['v']) + " over " + (column.length ? JSON.stringify(column[column.length-1].ports['^']) : "empty column"));
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
			//TODO: misses for *yarn*
			let cs = icell.cell.ports['v'];
			if (cs.length) {
				console.assert((column.length && JSON.stringify(column[column.length-1].ports['^']) === JSON.stringify(cs)) || dump(), "yarn out should always be exactly yarn in.");
				//had better be exactly the same stack from below:
				while (column[column.length-1].y + 1 < y) {
					let empty = new YarnCell();
					empty.y = column[column.length-1].y + 1;
					cs.forEach(function (cn) {
						empty.addOut('v', cn);
						empty.addOut('^', cn);
					});
					empty.styles = column[column.length-1].styles;
					column.push(empty);
				}
			} else {
				console.assert(column.length === 0 || column[column.length-1].ports['^'].length === 0 || dump(), "yarns out should always be exactly yarns in.");
			}

		}
		if (column.length) {
			let back = column[column.length-1];
			if (back.y === y) {
				icell.cell.absorb(back);
				column.pop();
			}
		}
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

CellMachine.prototype.bringCarrier = function CellMachine_bringCarrier(d, n, cn) {
	
	//set up yarn for a given stitch.
	//post-condition: needle just before n in direction d has yarn from cn exiting via its top face.
	// i.e. carrier is ready to make stitch at n in direction d, after (possibly) turning.
	let c = this.getCarrier(cn);
	let targetBed = needleBed(n);

	if (!c.at) {
		//add yarn-in cell at top of yarnBeforeIndex(d,n)
		let cell = new YarnCell();
		//add existing in/out:
		let column = this.beds[targetBed].getColumn(yarnBeforeIndex(d,n));
		if (column.length) {
			column[column.length-1].ports['^'].forEach(function (cn) {
				cell.addOut('v', cn);
				cell.addOut('^', cn);
			});
		}
		//add yarn start:
		cell.addOut('^', cn);
		this.addCells(targetBed, [{i:yarnBeforeIndex(d,n), cell:cell}]); //might increase this.topRow depending on if cell can be merged, otherwise will add *at* topRow.
		c.at = {d:d, n:n};
		return;
	}

	//okay, carrier is parked at index c.at, with yarn travelling up that column to the top:
	let atBed = needleBed(c.at.n);
	let atIndex = yarnBeforeIndex(c.at.d, c.at.n);
	let targetIndex = yarnBeforeIndex(d, n);


	//TODO: if atBed !== targetBed (...)
	//TODO: really, in general, I guess yarn transit needs to happen on front bed with racking accounted for if there are crossings.

	if (atBed !== targetBed) {
		//move to target bed:
		let cells = [];
		let turn = new YarnCell();
		turn.addOut('v', cn);
		turn.addOut((targetBed === 'f' ? 'o' : 'x'), cn);
		cells.push({bed:atBed, i:atIndex, cell:turn});
		let turn2 = new YarnCell();
		turn2.addOut((targetBed === 'f' ? 'x' : 'o'), cn);
		turn2.addOut('^', cn);
		cells.push({i:atIndex, cell:turn2});
		const cross = {
			yarns:[cn],
			b:atBed, i:atIndex,
			b2:targetBed, i2:atIndex,
			type:'y'
		};
		this.addCells(targetBed, cells, cross);
	}

	let cells = [];
	//traverse yarn right to targetIndex:
	if (atIndex < targetIndex) {
		for (let i = atIndex; i <= targetIndex; ++i) {
			if (i === atIndex) {
				//start by turning to the right:
				let turn = new YarnCell();
				turn.addOut('v', cn);
				turn.addOut('+', cn);
				cells.push({i:i, cell:turn});
			} else if (i < targetIndex) {
				if (i % 2 === 0) { //loop crossing
					let miss = new LoopCell('m');
					miss.addOut('-', cn);
					miss.addOut('+', cn);
					cells.push({i:i, cell:miss});
				} else { //yarn crossing
					let miss = new YarnCell();
					miss.addOut('-', cn);
					miss.addOut('+', cn);
					cells.push({i:i, cell:miss});
				}
			} else if (i === targetIndex) {
				//end by turning up:
				let turn = new YarnCell();
				turn.addOut('-', cn);
				turn.addOut('^', cn);
				cells.push({i:i, cell:turn});
			}
		}
	}

	//traverse yarn left to targetIndex:
	if (atIndex > targetIndex) {
		for (let i = atIndex; i >= targetIndex; --i) {
			if (i === atIndex) {
				//start by turning to the left:
				let turn = new YarnCell();
				turn.addOut('v', cn);
				turn.addOut('-', cn);
				cells.push({i:i, cell:turn});
			} else if (i > targetIndex) {
				if (i % 2 === 0) { //loop crossing
					let miss = new LoopCell('m');
					miss.addOut('+', cn);
					miss.addOut('-', cn);
					cells.push({i:i, cell:miss});
				} else { //yarn crossing
					let miss = new YarnCell();
					miss.addOut('+', cn);
					miss.addOut('-', cn);
					cells.push({i:i, cell:miss});
				}
			} else if (i === targetIndex) {
				//end by turning up:
				let turn = new YarnCell();
				turn.addOut('+', cn);
				turn.addOut('^', cn);
				cells.push({i:i, cell:turn});
			}
		}
	}

	//this seems ~very~ suspicious:
	cells.forEach(function(icell){
		let bed = (icell.bed ? icell.bed : targetBed);
		let c = this.beds[bed].getColumn(icell.i);
		if (c.length) {
			let have = icell.cell.ports['v'].slice();
			c[c.length-1].ports['^'].forEach(function (cn) {
				let idx = have.indexOf(cn);
				if (idx !== -1) { //accounted for already.
					have.splice(idx,1);
					return;
				}
				//TODO: if bed === 'b', add at begin of ports
				icell.cell.addOut('v', cn);
				icell.cell.addOut('^', cn);
			});
		}
	}, this);

	this.addCells(targetBed, cells);

	c.at = {d:d, n:n};
};

//Required functions:

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

CellMachine.prototype.in = function CellMachine_in(cs) { /* nothing */ };
CellMachine.prototype.out = function CellMachine_out(cs) {
	cs.forEach(function(cn){
		let c = this.getCarrier(cn);
		console.assert(c, "Trying to take out a carrier '" + cn + "' that doesn't exist.");
		if (c.at) {
			let column = this.beds['f'].getColumn(yarnBeforeIndex(c.at.d,c.at.n));
			console.assert(column.length, "can't take a carrier out of an empty yarn column");
			let cell = column[column.length-1];
			let idx = cell.ports['^'].indexOf(cn);
			console.assert(idx !== -1, "must have yarn in column where it's being removed");
			cell.ports['^'].splice(idx, 1);

			delete c.at;
		}
	}, this);
};
CellMachine.prototype.inhook = function CellMachine_inhook(cs) { /* nothing */ };
CellMachine.prototype.releasehook = function CellMachine_releasehook(cs) { /* nothing */ };
CellMachine.prototype.outhook = function CellMachine_outhook(cs) {
	this.out(cs); //hook doesn't matter for this code
};

CellMachine.prototype.stitch = function CellMachine_stitch(l, t) {
	//TODO: set leading / stitch values.
};
CellMachine.prototype.rack = function CellMachine_rack(r) { /* nothing */ };

CellMachine.prototype.knitTuck = function CellMachine_knitTuck(d, n, cs, knitTuck) {
	//Bring carriers on over:
	cs.forEach(function(cn){
		this.bringCarrier(d,n,cn);
	}, this);

	let cells = [];

	//Turn carriers toward the needle:
	if (cs.length) {
		let turn = new YarnCell();

		let column = this.beds[needleBed(n)].getColumn(yarnBeforeIndex(d,n));
		console.assert(column.length, "carriers must be here already");
		let turned = 0;
		column[column.length-1].ports['^'].forEach(function (cn) {
			turn.addOut('v', cn);
			if (cs.indexOf(cn) === -1) {
				turn.addOut('^', cn);
			} else {
				++turned;
				turn.addOut(d, cn);
			}
		});
		console.assert(turned === cs.length, "turned all the yarns");
		cells.push({i:yarnBeforeIndex(d, n), cell:turn});
	}

	//add the face:
	cells.push({i:needleIndex(n), cell:knitTuck});

	//turn carriers back up:
	if (cs.length) {
		let nextD = d;
		let nextN = (d === '+' ? nextNeedle(n) : previousNeedle(n));
		cs.forEach(function(cn){
			this.getCarrier(cn).at = {d:nextD, n:nextN};
		}, this);

		let turn = new YarnCell();
		cs.forEach(function(cn){
			turn.addOut((d === '+' ? '-' : '+'), cn);
			turn.addOut('^', cn);
		}, this);

		let column = this.beds[needleBed(n)].getColumn(yarnAfterIndex(d,n));
		if (column.length) {
			column[column.length-1].ports['^'].forEach(function (cn) {
				console.assert(cs.indexOf(cn) === -1, "shouldn't run into same yarn");
				turn.addOut('v', cn);
				turn.addOut('^', cn);
			});
		}

		cells.push({i:yarnAfterIndex(d, n), cell:turn});
	}

	this.addCells(needleBed(n), cells);

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
	cs.forEach(function(cn){
		this.bringCarrier(d,n,cn);
	}, this);

	let cells = [];

	//Turn carriers toward the needle:
	if (cs.length) {
		let turn = new YarnCell();
		cs.forEach(function(cn){
			turn.addOut('v', cn);
			turn.addOut(d, cn);
		}, this);
		cells.push({i:yarnBeforeIndex(d, n), cell:turn});
	}

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

	//turn carriers back up:
	if (cs.length) {
		let turn = new YarnCell();
		let nextD = d;
		let nextN = (d === '+' ? nextNeedle(n) : previousNeedle(n));
		cs.forEach(function(cn){
			turn.addOut((d === '+' ? '-' : '+'), cn);
			turn.addOut('^', cn);
			this.getCarrier(cn).at = {d:nextD, n:nextN};
		}, this);
		cells.push({i:yarnAfterIndex(d, n), cell:turn});
	}

	this.addCells(needleBed(n), cells, cross);
};

CellMachine.prototype.miss = function CellMachine_miss(d, n, cs) {
	//TODO: resolve whether this should do nothing or whether it should generate lots of yarn movement faces.
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
