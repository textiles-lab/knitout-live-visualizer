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
	this.topRow = 0;
};

//Helpers:

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


CellMachine.prototype.addCells = function CellMachine_addCells(b, list) {
	console.assert(b in this.beds, "Wanted valid bed, got '" + b + "'.");

	let y = this.topRow;
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
		let column = bed.getColumn(icell.i);
		if (icell.cell.ports['v'].length) {
			/*//add misses!
			while (column.length && column[column.length-1].y + 1 < y) {
				let empty;
				if (icell.i % 2 === 0) {
					empty = new LoopCell('k');
					column
				} else {
				}
			}*/
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
};

CellMachine.prototype.bringCarrier = function CellMachine_moveCarrier(d, n, cn) {
	console.assert(cn in this.carriers, "Carrier exists.");

	//set up yarn for a given stitch.
	//post-condition: needle just before n in direction d has yarn from cn exiting via its top face.
	// i.e. carrier is ready to make stitch at n in direction d, after (possibly) turning.
	let c = this.carriers[cn];

	let targetBed = needleBed(n);

	if (!c.at) {
		//add yarn-in cell at top of yarnBeforeIndex(d,n)
		let cell = new YarnCell();
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
		let cross = [];
		let turn = new YarnCell();
		turn.addOut('v', cn);
		turn.addOut((targetBed === 'f' ? 'o' : 'x'), cn);
		cross.push({bed:atBed, i:atIndex, cell:turn});
		let turn2 = new YarnCell();
		turn2.addOut((targetBed === 'f' ? 'x' : 'o'), cn);
		turn2.addOut('^', cn);
		cross.push({i:atIndex, cell:turn2});
		this.addCells(targetBed, cross);
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

	cells.forEach(function(icell){
		let bed = (icell.bed ? icell.bed : targetBed);
		let c = this.beds[bed].getColumn(icell.i);
		if (c.length) {
			c[c.length-1].ports['^'].forEach(function (cn) {
				if (icell.cell.ports['v'].indexOf(cn) !== -1) return; //accounted for already.
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
	console.assert(this.carriers.length === 0, "Shouldn't set carriers twice.");
	carriers.forEach(function(c,ci){
		this.carriers.push({name:c, index:ci});
	}, this);
};

CellMachine.prototype.in = function CellMachine_in(cs) { /* nothing */ };
CellMachine.prototype.out = function CellMachine_out(cs) {
	cs.forEach(function(cn){
		console.assert(cn in this.carriers, "Trying to take out a carrier '" + cn + "' that doesn't exist.");
		let c = this.carriers[cn];
		if (c.at) {
			//TODO: add some sort of yarn out cell?
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
		cs.forEach(function(cn){
			turn.addOut('v', cn);
			turn.addOut(d, cn);
		}, this);
		cells.push({i:yarnBeforeIndex(d, n), cell:turn});
	}

	//add the face:
	cells.push({i:needleIndex(n), cell:knitTuck});

	//turn carriers back up:
	if (cs.length) {
		let turn = new YarnCell();
		let nextD = d;
		let nextN = (d === '+' ? nextNeedle(n) : previousNeedle(n));
		cs.forEach(function(cn){
			turn.addOut((d === '+' ? '-' : '+'), cn);
			turn.addOut('^', cn);
			this.carriers[cn].at = {d:nextD, n:nextN};
		}, this);
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
		xferFrom.addOut(d, cn);
	}, this);

	cells.push({i:needleIndex(n), cell:xferFrom});

	let xferTo = new LoopCell((cs.length ? 'S' : 'X'));
	cells.push({bed:needleBed(n2), i:needleIndex(n2), cell:xferTo});

	let fromPort = (needleBed(n) === 'f' ? 'x' : 'o');
	let toPort = (needleBed(n) === 'f' ? 'o' : 'x');

	function addToLoops() {
		//add loops under the target:
		let c2 = this.beds[needleBed(n2)].getColumn(needleIndex(n2));
		if (c2.length) {
			c2[c2.length-1].ports['^'].forEach(function (cn) {
				xferTo.addOut(toPort, cn);
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
			xferTo.addOut('v', cn);
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
			this.carriers[cn].at = {d:nextD, n:nextN};
		}, this);
		cells.push({i:yarnAfterIndex(d, n), cell:turn});
	}

	this.addCells(needleBed(n), cells);

};

CellMachine.prototype.miss = function CellMachine_miss(d, n, cs) {
	//TODO: resolve whether this should do nothing or whether it should generate lots of yarn movement faces.
};

CellMachine.prototype.pause = function CellMachine_pause() { /* nothing */ };

if (typeof(module) !== "undefined") {
	module.exports.CellMachine = CellMachine;
}
