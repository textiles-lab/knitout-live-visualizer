#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//parse command line
if (process.argv.length != 4) {
	console.error("Usage:\nknitout-to-mesh.js <in.knitout> <out.obj>");
	process.exitCode = 1;
	return;
}
let knitoutFile = process.argv[2];
let objFile = process.argv[3];

console.log("Will process knitout from '" + knitoutFile + "' to generate mesh '" + objFile + "'.");


//parseKnitout will parse knitout, catch syntax errors, and dispatch to calls on 'machine', an abstract knitting machine:
function parseKnitout(codeText, machine) {
	var errors = [];
	var warnings = [];

	var carrierNames = [];

	var inCommentHeader = true;
	var end = false;
	
	codeText.split("\n").forEach(function(line, lineNumber) {
		if (end) return;
		function addError(info) {
			console.log("Parse Error on line " + lineNumber + ": " + info);
			errors.push({lineNumber:lineNumber, text:info});
		}
		function addWarning(info) {
			console.log("Parse Warning on line " + lineNumber + ": " + info);
			warnings.push({lineNumber:lineNumber, text:info});
		}

		//magic first line:
		if (lineNumber == 0) {
			//knitout must begin with ';!knitout-N'.
			var m = line.match(/^;!knitout-(\d+)$/);
			if (m !== null) {
				if (parseInt(m[1]) != 2) {
					addWarning("Parsed version (" + m.groups(1) + ") is not what was expected.");
				}
			} else {
				addError("Knitout should always start with a '!;knitout-2' line.");
			}
			//nothing more to do with the first line.
			return;
		}

		//comment header lines:
		var m = line.match(/^;;([^:]+): (.*)$/);
		if (m !== null) {
			if (!inCommentHeader) {
				addWarning("Comment-header-like line outside comment header.");
			} else {
				var name = m[1];
				var value = m[2];
				console.log("Comment header: '" + name + "' is '" + value + "'.");
				//TODO: handle comment headers.
				if (name === "Carriers") {
					carrierNames = value.split(" ");
					machine.setCarriers(carrierNames);
					console.log("Carrier names (front-to-back): ", carrierNames);
				}
				return; //nothing left to do with this line.
			}
		} else {
			inCommentHeader = false;
		}

		//split line into op and comment parts:
		var m = line.match(/^([^;]*)(;.*)?$/);
		if (m === null) {
			console.log("Weird, our line regex should have gotten everything.");
			return;
		}
		var tokens = m[1].split(/[ \t]+/);
		var comment = m[2];

		//TODO: handle !source: directive in comment

		//trim leading/trailing whitespace from operation token list:
		if (tokens.length !== 0 && tokens[0] === "") tokens.shift();
		if (tokens.length !== 0 && tokens[tokens.length-1] === "") tokens.pop();

		if (tokens.length === 0) {
			//empty operation: nothing to do
			return;
		}

		var op = tokens.shift();

		function parseCarrierSet(tokens) {
			//check that tokens are in carrierNames and aren't repeated:
			var usedAlready = {};
			tokens.forEach(function(name){
				if (carrierNames.indexOf(name) == -1) {
					throw "Carrier name does not appear in Carriers header.";
				}
				if (name in usedAlready) {
					throw "Carrier name appears twice in carrier set.";
				}
				usedAlready[name] = true;
			});
			return tokens.slice();
		}
		function parseStitchValue(token) {
			if (!/^[-+]?(\.\d+|\d+.\d*|\d+)$/.test(token)) {
				throw "Stitch value [" + token + "] must be a simple floating point value.";
			}
			return parseFloat(token);
		}
		function parseRackingValue(token) {
			if (!/^[-+]?(\.\d+|\d+.\d*|\d+)$/.test(token)) {
				throw "Racking value [" + token + "] must be a simple floating point value.";
			}
			return parseFloat(token);
		}
		function parseDirection(token) {
			if (!(token === '-' || token === '+')) {
				throw "Direction [" + token + "] must be '+' or '-'.";
			}
			return token;
		}
		function parseNeedle(token) {
			if (!/^([fb]s?)([-+]?\d+)$/.test(token)) throw "Needle [" + token + "] must be f,b,fs, or bs followed by an integer.";
			return token;
		}


		//dispatch all basic knitout functions to the machine, catch anything thrown and add to errors:
		try {
			//all the in/out/hook ops take a carrierset as an argument:
			if (["in", "out", "inhook", "releasehook", "outhook"].indexOf(op) !== -1) {
				var cs = parseCarrierSet(tokens);
				machine[op](cs);
			} else if (op === "stitch") {
				if (tokens.length !== 2) throw "stitch takes exactly two arguments";
				var l = parseStitchValue(tokens[0]);
				var t = parseStitchValue(tokens[1]);
				machine.stitch(l, t);
			} else if (op === "rack") {
				if (tokens.length !== 1) throw "rack takes exactly one argument";
				var r = parseRackingValue(tokens[0]);
				machine.rack(r);
			} else if (op === "knit" || op === "drop") {
				if (op === "drop") {
					if (tokens.length !== 1) throw "drop takes exactly one argument";
					//interpret drop as "knit + N":
					tokens.unshift("+");
				}
				if (tokens.length < 2) throw "knit requires at least two arguments";
				var d = parseDirection(tokens.shift());
				var n = parseNeedle(tokens.shift());
				var cs = parseCarrierSet(tokens);
				machine.knit(d, n, cs);
			} else if (op === "tuck" || op === "amiss") {
				if (op === "amiss") {
					if (tokens.length !== 1) throw "amiss takes exactly one argument";
					tokens.unshift("+");
				}
				if (tokens.length < 2) throw "tuck requires at least two arguments";
				var d = parseDirection(tokens.shift());
				var n = parseNeedle(tokens.shift());
				var cs = parseCarrierSet(tokens);
				machine.tuck(d, n, cs);
			} else if (op === "split" || op === "xfer") {
				if (op === "xfer") {
					if (tokens.length !== 2) throw "xfer takes exactly two arguments";
					tokens.unshift("+");
				}
				if (tokens.length < 3) throw "split requires at least three arguments";
				var d = parseDirection(tokens.shift());
				var n = parseNeedle(tokens.shift());
				var n2 = parseNeedle(tokens.shift());
				var cs = parseCarrierSet(tokens);
				machine.split(d, n, n2, cs);
			} else if (op === "miss") {
				if (tokens.length < 2) throw "miss requires at least two arguments";
				var d = parseDirection(tokens.shift());
				var n = parseNeedle(tokens.shift());
				var cs = parseCarrierSet(tokens);
				machine.miss(d, n, cs);
			} else if (op === "pause") {
				if (tokens.length !== 0) throw "pause takes no arguments";
				machine.pause();
			} else if (op === "x-end") {
				end = true;
			} else {
				if (op.startsWith("x-")) {
					addWarning("Unrecognized extension operation '" + op + "'.");
				} else {
					addError("Unrecognized operation.");
				}
			}
		} catch (e) {
			if (typeof(e) === "string") {
				addError(e);
			} else {
				addError("[error that wasn't a string]");
				throw e;
				//console.log(e); //DEBUG
			}
		}

	});
}

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

function MeshMachine() {
	this.carriers = []; //carriers, front-to-back. Each is {name:"A", yarnColumn:...(?)}
	this.beds = {
		b:new Columns(),
		f:new Columns()
	};
	this.topRow = 0;
};

//Helpers:

MeshMachine.prototype.dump = function MeshMachine_dump() {
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

		let maxY = Math.min(20, this.topRow); //DEBUG -- should be this.topRow
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

MeshMachine.prototype.addCells = function MeshMachine_addCells(b, list) {
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

MeshMachine.prototype.bringCarrier = function MeshMachine_moveCarrier(d, n, cn) {
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
					let miss = new LoopCell('┄');
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
					let miss = new LoopCell('┄');
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

	this.addCells(targetBed, cells);

	c.at = {d:d, n:n};
};

//Required functions:

MeshMachine.prototype.setCarriers = function MeshMachine_setCarriers(carriers) {
	console.assert(this.carriers.length === 0, "Shouldn't set carriers twice.");
	carriers.forEach(function(c,ci){
		this.carriers.push({name:c, index:ci});
	}, this);
};

MeshMachine.prototype.in = function MeshMachine_in(cs) { /* nothing */ };
MeshMachine.prototype.out = function MeshMachine_out(cs) {
	cs.forEach(function(cn){
		console.assert(cn in this.carriers, "Trying to take out a carrier '" + cn + "' that doesn't exist.");
		let c = this.carriers[cn];
		if (c.at) {
			//TODO: add some sort of yarn out cell?
			delete c.at;
		}
	}, this);
};
MeshMachine.prototype.inhook = function MeshMachine_inhook(cs) { /* nothing */ };
MeshMachine.prototype.releasehook = function MeshMachine_releasehook(cs) { /* nothing */ };
MeshMachine.prototype.outhook = function MeshMachine_outhook(cs) {
	this.out(cs); //hook doesn't matter for this code
};

MeshMachine.prototype.stitch = function MeshMachine_stitch(l, t) {
	//TODO: set leading / stitch values.
};
MeshMachine.prototype.rack = function MeshMachine_rack(r) { /* nothing */ };

MeshMachine.prototype.knitTuck = function MeshMachine_knitTuck(d, n, cs, knitTuck) {
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

MeshMachine.prototype.knit = function MeshMachine_knit(d, n, cs) {
	//build a knit face:
	let knit = new LoopCell('k');
	cs.forEach(function(cn){
		knit.addOut((d === '+' ? '-' : '+'), cn);
		knit.addOut(d, cn);
	}, this);

	this.knitTuck(d, n, cs, knit);
};

MeshMachine.prototype.tuck = function MeshMachine_tuck(d, n, cs) {
	//build a tuck face:
	let tuck = new LoopCell('t');
	cs.forEach(function(cn){
		tuck.addOut((d === '+' ? '-' : '+'), cn);
		tuck.addOut(d, cn);
	}, this);

	this.knitTuck(d, n, cs, tuck);
};

MeshMachine.prototype.split = function MeshMachine_split(d, n, n2, cs) {
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
		//TODO: loop connections?
	}, this);
	cells.push({i:needleIndex(n), cell:xferFrom});

	let xferTo = new LoopCell((cs.length ? 'S' : 'X'));
	//TODO: loop connections?
	cells.push({bed:needleBed(n2), i:needleIndex(n2), cell:xferTo});


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

MeshMachine.prototype.miss = function MeshMachine_miss(d, n, cs) {
	//TODO: resolve whether this should do nothing or whether it should generate lots of yarn movement faces.
};

MeshMachine.prototype.pause = function MeshMachine_pause() { /* nothing */ };


//--------------------------------------
//load file, pass to parser:
const fs = require('fs');
const machine = new MeshMachine();
parseKnitout(fs.readFileSync(knitoutFile, 'utf8'), machine);

machine.dump();
