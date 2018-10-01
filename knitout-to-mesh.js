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

function Edge(type) {
	this.type = type;
};

Edge.prototype.EMPTY = "edge-empty";
Edge.prototype.YARN = "edge-yarn";
Edge.prototype.LOOP = "edge-loop";

//--------------------------------------

function Face() {
	this.leftEdges = []; //bottom-to-top
	this.rightEdges = []; //bottom-to-top
	this.bottomEdges = []; //left-to-right
	this.topEdges = []; //left-to-right
};

//--------------------------------------

function Column() {
	this.topEdges = []; //edges at the top of the top face (left-to-right)
	this.leftEdges = []; //edges above faces on the left (bottom-to-top)
	this.rightEdges = []; //edges above faces on the right (bottom-to-top)
	this.left = null;
	this.right = null;
};

Column.prototype.addFace = function Column_addFace(face) {
	//link top of column to bottom of face:
	if (this.topEdges.length !== 0) {
		console.assert(face.bottomEdges.length === this.topEdges.length, "bottom of face matches top of column (length)");
		for (let i = 0; i < face.bottomEdges.length; ++i) {
			this.topEdges[i].link(face.bottomEdges[i]); //will assert() on bad type match
		}
	} else {
		for (let i = 0; i < face.bottomEdges.length; ++i) {
			console.assert(face.bottomEdges[i].type === Edge.EMPTY, "bottom of face matches top of empty column");
		}
	}

	//link any proud edges on left column:
	let onLeft = face.leftEdges.slice();
	if (this.left && this.left.rightEdges.length) {
		console.assert(!this.leftEdges.length, "can't have left column right edges and local left edges at the same time.");
		while (onLeft.length && this.left.rightEdges.length) {
			//link bottom-most of each edge list:
			onLeft.shift().link(this.left.rightEdges.shift());
		}
	}
	if (onLeft.length) {
		console.assert(!this.left || this.left.rightEdges.length === 0, "Must not have a left column with extra edges.");
		this.leftEdges.push(...onLeft);
	}

	//link any proud edges on right column:
	let onRight = face.rightEdges.slice();
	if (this.right && this.right.leftEdges.length) {
		console.assert(!this.rightEdges.length, "can't have right column left edges and local right edges at the same time.");
		while (onRight.length && this.right.leftEdges.length) {
			//link bottom-most of each edge list:
			onRight.shift().link(this.right.leftEdges.shift());
		}
	}
	if (onRight.length) {
		console.assert(!this.right || this.right.leftEdges.length === 0, "Must not have a right column with extra edges.");
		this.rightEdges.push(...onRight);
	}

	//store top edges for future linking:
	this.topEdges = face.topEdges.slice();

};

//--------------------------------------

function MeshMachine() {
	this.carriers = []; //carriers, front-to-back. Each is {name:"A", yarnColumn:...(?)}
	this.needleColumns = {};
	this.yarnColumns = {};
};

//Helpers:

function previousNeedle(n) {
	let m = /^([fb]s?)([-+]?\d+)$/.match(n);
	console.assert(m, "previousNeedle must be passed needle; got '" + n + "' instead.");
	return m.group(1) + (parseInt(m[2])-1).toString();
}

function nextNeedle(n) {
	let m = /^([fb]s?)([-+]?\d+)$/.match(n);
	console.assert(m, "nextNeedle must be passed needle; got '" + n + "' instead.");
	return m.group(1) + (parseInt(m[2])+1).toString();
}

//yarn column before given needle when knitting in direction d:
MeshMachine.prototype.getYarnColumn = function MeshMachine_getYarnColumnBefore(d, n, create) {
	if (typeof(create) === 'undefined') create = true;
	if (d === '-') {
		return this.getYarnColumnBefore('+', nextNeedle(n), create);
	}
	if (!(n in this.yarnColumns)) {
		if (!create) return null;

		let column = new Column();
		this.yarnColumns[n] = column;

		let left = this.getNeedleColumn(previousNeedle(n), false);
		if (left !== null) {
			console.assert(left.rightColumn === null, "shouldn't be linked");
			column.left = left;
			left.right = column;
		}
		let right = this.getNeedleColumn(n, false);
		if (right !== null) {
			console.assert(right.leftColumn === null, "shouldn't be linked");
			column.right = right;
			right.left = column;
		}
	}
	return this.yarnColumns[n];
};

//needle column at needle n:
MeshMachine.prototype.getNeedleColumn = function MeshMachine_getNeedleColumn(n, create) {
	if (typeof(create) === 'undefined') create = true;
	if (!(n in this.needleColumns)) {
		if (!create) return null;

		let column = new Column();
		this.needleColumns[n] = column;

		let left = this.getYarnColumnBefore('+', n, false);
		if (left !== null) {
			console.assert(left.rightColumn === null, "shouldn't be linked");
			column.left = left;
			left.right = column;
		}
		let right = this.getYarnColumnBefore('-', n, false);
		if (right !== null) {
			console.assert(right.leftColumn === null, "shouldn't be linked");
			column.right = right;
			right.left = column;
		}
	}
	return this.needleColumns[n];
};

MeshMachine.prototype.bringCarrier = function MeshMachine_moveCarrier(d, n, cn) {
	console.assert(cn in this.carriers, "Carrier exists.");

	//set up yarn for a given stitch.
	//post-condition: needle just before n in direction d has its top-left face with yarn at exit.
	// i.e. carrier is ready to make stitch at n in direction d
	let c = this.carriers[cn];

	let column = this.getYarnColumn(d,n);

	if (!c.column) {
		//carrier isn't in, so bring in at the top of the target column:

		while (column.left && column.left.

	}

	if (c.column) {
		//carrier is in, and needs to move, potentially
		//NOTE: it should exit from top of column.
		assert(cn in c.column.topEdge.yarns, "carrier exits column through top edge");

	} else {
		//carrier isn't in, add face at top of column.

	}

};

/*
MeshMachine.prototype.assertEven = function MeshMachine_assertEven() {
	//After every stitch, there should be no left or right edges outstanding (except to null columns)
};
*/

//Required functions:

MeshMachine.prototype.setCarriers = function MeshMachine_setCarriers(carriers) {
	console.assert(this.carriers.length === 0, "Shouldn't set carriers twice.");
	carriers.forEach(function(c,ci){
		this.carriers.push({name:c, index:ci});
	}, this);
};

MeshMachine.prototype.in = function MeshMachine_in(cs) { /* nothing */ };
MeshMachine.prototype.out = function MeshMachine_out(cs) {
	//TODO: create yarn-end faces for all carriers in cs
};
MeshMachine.prototype.inhook = function MeshMachine_inhook(cs) { /* nothing */ };
MeshMachine.prototype.releasehook = function MeshMachine_releasehook(cs) { /* nothing */ };
MeshMachine.prototype.outhook = function MeshMachine_outhook(cs) {
	//TODO: create yarn-end faces for all carriers in cs
};

MeshMachine.prototype.stitch = function MeshMachine_stitch(l, t) {
	//TODO: set leading / stitch values.
};
MeshMachine.prototype.rack = function MeshMachine_rack(r) { /* nothing */ };

MeshMachine.prototype.knit = function MeshMachine_knit(d, n, cs) {
	//TODO: knit stitch
	let column = this.getNeedleColumn(n);

	if (cs.length !== 0) {
		this.bringCarrier(d,n,cs[0]);
		//TODO: the rest of the yarns.
	}

	//build a knit face:
	let knit = new Face();
	knit.leftEdges.push(new Edge(Edge.YARN));
	knit.rightEdges.push(new Edge(Edge.YARN));
	//custom top/bottom edges depending on whether loop is empty:
	knit.bottomEdges.push(new Edge((column.topEdges.length === 0 ? Edge.EMPTY : Edge.LOOP)));
	knit.topEdges.push(new Edge((cs.length === 0 ? Edge.EMPTY : Edge.LOOP)));

	//TODO: might need to add a bunch of empty faces to consume extra space in column(?)
	column.addFace(knit);

};

MeshMachine.prototype.tuck = function MeshMachine_tuck(d, n, cs) {
	//TODO: tuck stitch face
};

MeshMachine.prototype.split = function MeshMachine_split(d, n, n2, cs) {
	//TODO: split stitch face
};

MeshMachine.prototype.miss = function MeshMachine_miss(d, n, cs) {
	//TODO: resolve whether this should do nothing or whether it should generate lots of yarn movement faces.
};

MeshMachine.prototype.pause = function MeshMachine_pause() { /* nothing */ };


//--------------------------------------
//load file, pass to parser:
const fs = require('fs');
parseKnitout(fs.readFileSync(knitoutFile, 'utf8'), new MeshMachine());
