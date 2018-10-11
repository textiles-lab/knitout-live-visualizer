#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

const CellMachine = require("./CellMachine.js").CellMachine;
const parseKnitout = require("./parseKnitout.js").parseKnitout;
const fs = require("fs");

//parse command line
if (process.argv.length != 4) {
	console.error("Usage:\nknitout-to-mesh.js <in.knitout> <out.obj>");
	process.exitCode = 1;
	process.exit(1);
	return;
}
let knitoutFile = process.argv[2];
let objFile = process.argv[3];

console.log("Will process knitout from '" + knitoutFile + "' to generate mesh '" + objFile + "'.");

//--------------------------------------
//load file, pass to parser:

const machine = new CellMachine();
parseKnitout(fs.readFileSync(knitoutFile, 'utf8'), machine);

machine.dump();

fs.writeFileSync(objFile, machine.dumpObj());
