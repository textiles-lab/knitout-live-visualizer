"use strict";

//knitout frontend
function evalJS(codeText){

//=========== start of knitout.js =============
let machine = null; //can set this as machine header value (if provided), and use it to warn about unsupported extensions
// basic writer
var Writer = function(opts){
	//public data:
	this.carriers = {}; //names of all currently active carriers
	this.needles = {}; //names of all currently-holding-loops needles
	this.racking = 0; //current racking value

	//private data:
	this._carriers = []; //array of carrier names, front-to-back order
	this._operations = []; //array of operations, stored as strings
	this._headers = []; //array of headers. stored as strings


	//fill '_carriers' array from opts.carriers:
	if (typeof(opts) === 'undefined' || !('carriers' in opts)) {
		console.warn("WARNING: options object passed to knitout.Writer does not contain a 'carriers' member. Will assume a default carrier layout (a single carrier named \"A\")");
		this._carriers = ["A"];
	} else {
		if (!Array.isArray(opts.carriers)) throw new Error("opts.carriers should be an array of carrier names");
		opts.carriers.forEach((name) => {
			if (!(typeof(name) === 'string' && name.indexOf(' ') === -1)) {
				throw new Error("Carrier names must be strings that do not contain the space character (' ').");
			}
		});
		this._carriers = opts.carriers.slice();
	}
	//build a 'carriers' header from the '_carriers' list:
	this._headers.push(";;Carriers: " + this._carriers.join(" "));
};

// function that queues header information to header list
Writer.prototype.addHeader = function (name, value) {
	if (name === undefined || value === undefined) {
		throw new Error("Writer.addHeader should be called with a name and a value");
	}

	if (!(typeof(name) === 'string' && name.indexOf(': ') === -1)) {
		throw new Error("Header names must be strings that don't contain the sequence ': '");
	}
	if (!(typeof(value) === 'string' && value.indexOf('\n') === -1)) {
		throw new Error("Header values must be strings that do not contain the LF character ('\\n').");
	}

	//Check for valid headers:
	if (name === "Carriers") {
		throw new Error("Writer.addHeader can't set Carriers header (use the 'carriers' option when creating the writer instead).");
	} else if (name === "Machine") {
		machine = value;
		//no restrictions on value
	} else if (name === "Gauge") {
		if ((typeof(value) !== 'string' && !/^[0-9 ]+$/.test(value))) throw new Error(`Value of 'Gauge' header must be a string representing a number. Provided value: '${value}' is not valid.`);
	} else if (name === "Position") {
		let supported_positions = ['Left', 'Center', 'Right', 'Keep'];
		if (!supported_positions.includes(value)) throw new Error(`'Position' header must have one of the following values: ${supported_positions.join(', ')}. Provided value: '${value}' is not valid.`);
	} else if (name.startsWith("Yarn-")) {
		//check for valid carrier name, warn otherwise
		let carrierName = name.substr(5);
		if (this._carriers.indexOf(carrierName) === -1) {
			console.warn("Warning: header '" + name + "' mentions a carrier that isn't in the carriers list.");
		}
	} else if (name.startsWith('X-')) {
		//all extension header values are okay!
	} else {
		console.warn("Warning: header name '" + name + "' not recognized; header will still be written.");
	}
	this._headers.push(';;' + name + ': ' + value);
};

// escape hatch to dump your custom instruction to knitout
// if you know what you are doing
Writer.prototype.addRawOperation = function( operation ){
	console.warn("Warning: operation added to list as is(string), no error checking performed.");
	this._operations.push(operation);
};

//helpers to extract parameters from argument arrays:
// (these remove the extracted arguments from the start of the array and throw on errors)

//shiftDirection interprets the first element of 'args' as a direction, and throws on error:
// returns '+' or '-'.
function shiftDirection(args) {
	console.assert(Array.isArray(args));
	if (args.length === 0) {
		throw new Error("Direction missing.");
	}
	if (!(args[0] === '+' || args[0] === '-')) {
		throw new Error("Direction should be '+' or '-'.");
	}
	let dir = args.shift();
	return dir;
}

//shiftBedNeedle interprets the first one or two arguments of 'args' as a bed+needle number, and throws on error:
// returns a {bed:, needle:} object.

const BedNeedleRegex = /^([fb]s?)(-?\d+)$/;
const BedRegex = /^[fb]s?$/;
function shiftBedNeedle(args) {
	console.assert(Array.isArray(args));
	if (args.length === 0) {
		throw new Error("Needle missing.");
	}
	let bed, needle;
	//case: bed string, needle number:
	if (typeof(args[0]) === 'string' && BedRegex.test(args[0])) {
		if (args.length < 2 || !Number.isInteger(args[1])) {
			throw new Error("Expecting bed name to be followed by a needle number.");
		}
		bed = args.shift();
		needle = args.shift();
	//case: single string "f12", "b-2", "bs66":
	} else if (typeof(args[0]) === 'string') {
		let m = args[0].match(BedNeedleRegex);
		if (m === null) {
			throw new Error("String '" + args[0] + "' does not look like a compound bed+needle string.");
		}
		bed = m[1];
		needle = parseInt(m[2]);
		args.shift();
	//case: two-member array ["fs", 2]
	} else if (Array.isArray(args[0])) {
		if (!( args[0].length === 2 && typeof(args[0][0]) === 'string' && BedRegex.test(args[0][0]) && Number.isInteger(args[0][1]) )) {
			throw new Error("Bed+needle array should look like [\"f\", 12].");
		}
		bed = args[0][0];
		needle = args[0][1];
		args.shift();
	//case: object {bed:"fs", needle:5}
	} else if (typeof(args[0]) === 'object') {
		if (!( 'bed' in args[0] && typeof(args[0].bed) === 'string' && BedRegex.test(args[0].bed) )) {
			throw new Error("Bed+needle object should have a 'bed' member string naming the bed.");
		}
		if (!( 'needle' in args[0] && Number.isInteger(args[0].needle) )) {
			throw new Error("Bed+needle object should have a 'needle' member integer.");
		}
		bed = args[0].bed;
		needle = args[0].needle;
		args.shift();
	} else {
		throw new Error("Expecting bed+needle as name+number (\"fs\", 6), string (\"b-2\"), array ([\"f\", 6]), or object ({bed:\"bs\", needle:12}). Got '" + JSON.stringify(args) + "'");
	}
	return {bed:bed, needle:needle};
}

//shiftCarrierSet interprets the remaining contents of 'args' as an array of carrier names, and throws on error:
// returns an array of carrier names, e.g., ["C", "A"].
function shiftCarrierSet(args, carrierNames) {
	let carrierSet = [];
	//carrier set as array, e.g., knit(..., ["A", "B"]):
	if (args.length === 1 && Array.isArray(args[0])) {
		carrierSet = args.shift().slice();
	} else {
		//carrier set as parameters, e.g., knit(..., "A", "B");
		carrierSet = args.splice(0,args.length).slice();
	}

	// slightly ugly handling of various ways of typeing "A B", "A, B"
	carrierSet.forEach(function(name, idx){
		let space_split = name.split(" ");
		let first = true;
		space_split.forEach(function(s, sidx){
			if(s == '') return;
			if(first){
				carrierSet[idx] = s;
				first = false;
			}
			else carrierSet.push(s);
		});
	});

	carrierSet.forEach(function(name, idx){
		let comma_split = name.split(",");
		let first = true;
		comma_split.forEach(function(s, sidx){
			if(s =='') return;
			if(first) {
				carrierSet[idx] = s;
				first = false;
			}
			else carrierSet.push(s);
		});

	});


	carrierSet.forEach(function(name){
		if (carrierNames.indexOf(name) === -1) {
			throw new Error("Invalid carrier name '" + name + "'");
		}
	});

	return carrierSet;
}

Writer.prototype.in = function(...args){

	let cs = shiftCarrierSet(args, this._carriers);
	if (cs.length === 0) {
		throw new Error("It doesn't make sense to 'in' on an empty carrier set.");
	}
	cs.forEach(function(cn){
		if (cn in this.carriers) {
			throw new Error("Carrier '" + cn + "' is already in.");
		}
		this.carriers[cn] = {hook:false};
	}, this);

	this._operations.push('in ' + cs.join(' '));

};

Writer.prototype.inhook = function(...args){
	
	let cs = shiftCarrierSet(args, this._carriers);
	if (cs.length === 0) {
		throw new Error("It doesn't make sense to 'inhook' on an empty carrier set.");
	}
	cs.forEach(function(cn){
		if (cn in this.carriers) {
			throw new Error("Carrier '" + cn + "' is already in.");
		}
		this.carriers[cn] = {hook:true};
	}, this);

	this._operations.push('inhook ' + cs.join(' '));

};


Writer.prototype.releasehook = function(...args){

	let cs = shiftCarrierSet(args, this._carriers);
	if (cs.length === 0) {
		throw new Error("It doesn't make sense to 'releasehook' on an empty carrier set.");
	}
	cs.forEach(function(cn){
		if (!(cn in this.carriers)) {
			throw new Error("Carrier '" + cn + "' isn't in.");
		}
		if (!this.carriers[cn].hook) {
			throw new Error("Carrier '" + cn + "' isn't in the hook.");
		}
		this.carriers[cn].hook = false;
	}, this);

	this._operations.push('releasehook ' + cs.join(' '));

};

Writer.prototype.out = function(...args){

	let cs = shiftCarrierSet(args, this._carriers);
	if (cs.length === 0) {
		throw new Error("It doesn't make sense to 'out' on an empty carrier set.");
	}
	cs.forEach(function(cn){
		if (!(cn in this.carriers)) {
			throw new Error("Carrier '" + cn + "' isn't in.");
		}
		delete this.carriers[cn];
	}, this);

	this._operations.push('out ' + cs.join(' '));

};

Writer.prototype.outhook = function(...args){

	let cs = shiftCarrierSet(args, this._carriers);
	if (cs.length === 0) {
		throw new Error("It doesn't make sense to 'outhook' on an empty carrier set.");
	}
	cs.forEach(function(cn){
		if (!(cn in this.carriers)) {
			throw new Error("Carrier '" + cn + "' isn't in.");
		}
		delete this.carriers[cn];
	}, this);

	this._operations.push('outhook ' + cs.join(' '));
};

function isFiniteNumber( n ) {
	if (typeof(n) === 'number' && Number.isFinite(n) && !Number.isNaN(n)) return true;
	return false;
}

Writer.prototype.stitch = function(before, after) {
	if (!(isFiniteNumber(before) && isFiniteNumber(after))) {
		throw new Error("Stitch L and T values must be finite numbers.");
	}

	this._operations.push('stitch ' + before.toString() + ' ' + after.toString());
};

//throw warning if ;;Machine: header is included & machine doesn't support extension
function machineSupport(extension, supported) {
	if (!machine.toUpperCase().includes(supported)) console.warn(`Warning: ${extension} is not supported on ${machine}. Including it anyway.`);
}

// --- extensions ---
Writer.prototype.stitchNumber = function (stitchNumber) {
	if (!(Number.isInteger(stitchNumber) && stitchNumber >= 0)) {
		throw new Error("Stitch numbers are non-negative integer values.");
	}

	this._operations.push('x-stitch-number ' + stitchNumber.toString());
};

Writer.prototype.fabricPresser = function (presserMode) {
	machineSupport('presser mode', 'SWG');
	if(presserMode === 'auto'){
		this._operations.push('x-presser-mode auto');
	}
	else if(presserMode === 'on'){
		this._operations.push('x-presser-mode on');
	}
	else if(presserMode === 'off'){
		this._operations.push('x-presser-mode off');
	}
	else{
		console.warn('Ignoring presser mode extension, unknown mode ' + presserMode + '. Valid modes: on, off, auto');
	}
}

Writer.prototype.visColor = function (hex, carrier) {
	let warning = false;
	if (arguments.length !== 2) {
		warning = true;
		console.warn(`Ignoring vis color extension, since it is meant to take 2 parameters: 1) #hexColorCode and 2) carrierNumber.`);
	}
	if (hex.charAt(0) !== '#') {
		warning = true;
		console.warn(`Ignoring vis color extension, since the first arg is meant to be a hex code to assign the given carrier. Expected e.g. #FF0000`);
	}
	if (this._carriers.indexOf(carrier) === -1) {
		warning = true;
		console.warn(`Ignoring vis color extension, since the second arg is meant to be the carrier number to which you are assigning the color. ${carrier} is not listed in the 'Carriers' header.`);
	}
	if (!warning) this._operations.push(`x-vis-color ${hex} ${carrier}`);
}

Writer.prototype.speedNumber = function (value) {
	//TODO: check to make sure it's within the accepted range
	if (!(Number.isInteger(value) && value >= 0)) {
		console.warn(`Ignoring speed number extension, since provided value: ${value} is not a non-negative integer.`);
	} else this._operations.push(`x-speed-number ${value}`);
};

Writer.prototype.rollerAdvance = function (value) {
	machineSupport('roller advance', 'KNITERATE');
	//TODO: check to make sure it's within the accepted range
	if (!Number.isInteger(value)) {
		console.warn(`Ignoring roller advance extension, since provided value: ${value} is not an integer.`);
	} else this._operations.push(`x-speed-number ${value}`);
	let warning = false;
	if (!warning) this._operations.push(`x-roller-advance ${value}`);
};

Writer.prototype.addRollerAdvance = function (value) {
	machineSupport('add roller advance', 'KNITERATE');
	//TODO: check to make sure it's within the accepted range
	if (!Number.isInteger(value)) {
		console.warn(`Ignoring add roller advance extension, since provided value: ${value} is not an integer.`);
	} else this._operations.push(`x-add-roller-advance ${value}`);
};

Writer.prototype.carrierSpacing = function (value) {
	machineSupport('carrier spacing', 'KNITERATE');
	if (!(Number.isInteger(value) && value > 0)) {
		console.warn(`Ignoring carrier spacing extension, since provided value: ${value} is not a positive integer.`);
	} else this._operations.push(`x-carrier-spacing ${value}`);
};

Writer.prototype.carrierStoppingDistance = function (value) {
	machineSupport('carrier stopping distance', 'KNITERATE');
	if (!(Number.isInteger(value) && value > 0)) {
		console.warn(`Ignoring carrier stopping distance extension, since provided value: ${value} is not a positive integer.`);
	} else this._operations.push(`x-carrier-stopping-distance ${value}`);
};

// --- operations ---//
Writer.prototype.rack = function(rack) {

	if (!(isFiniteNumber(rack))) {
		throw new Error("Racking values must be finite numbers.");
	}

	this.racking = rack;

	this._operations.push('rack ' + rack.toString());
};

Writer.prototype.knit = function(...args) {
	let dir = shiftDirection(args);
	let bn = shiftBedNeedle(args);
	let cs = shiftCarrierSet(args, this._carriers);

	if (cs.length > 0) {
		this.needles[bn.bed + bn.needle.toString()] = true;
	} else {
		delete this.needles[bn.bed + bn.needle.toString()];
	}
	
	this._operations.push('knit ' + dir + ' ' + bn.bed + bn.needle.toString() + ' ' + cs.join(' '));
};

Writer.prototype.tuck  = function(...args) {
	let dir = shiftDirection(args);
	let bn = shiftBedNeedle(args);
	let cs = shiftCarrierSet(args, this._carriers);

	this.needles[bn.bed + bn.needle.toString()] = true;
	
	this._operations.push('tuck ' + dir + ' ' + bn.bed + bn.needle.toString() + ' ' + cs.join(' '));
};

Writer.prototype.split = function(...args) {
	let dir = shiftDirection(args);
	let from = shiftBedNeedle(args);
	let to = shiftBedNeedle(args);
	let cs = shiftCarrierSet(args, this._carriers);

	if ((from.bed + from.needle.toString()) in this.needles) {
		this.needles[to.bed + to.needle.toString()] = true;
		delete this.needles[from.bed + from.needle.toString()];
	}
	if (cs.length > 0) {
		this.needles[from.bed + from.needle.toString()] = true;
	}

	this._operations.push('split ' + dir + ' ' + from.bed + from.needle.toString() + ' ' + to.bed + to.needle.toString() + ' ' + cs.join(' '));
};

Writer.prototype.miss = function(...args) {
	let dir = shiftDirection(args);
	let bn = shiftBedNeedle(args);
	let cs = shiftCarrierSet(args, this._carriers);

	if (cs.length === 0) {
		throw new Error("It doesn't make sense to miss with no carriers.");
	}
	
	this._operations.push('miss ' + dir + ' ' + bn.bed + bn.needle.toString() + ' ' + cs.join(' '));
};


// drop -> knit without yarn, but supported in knitout
Writer.prototype.drop = function(...args) {
	let bn = shiftBedNeedle(args);

	if (args.length !== 0) {
		throw new Error("drop only takes a bed+needle");
	}

	delete this.needles[bn.bed + bn.needle.toString()];
	
	this._operations.push('drop ' + bn.bed + bn.needle.toString());
};

// amiss -> tuck without yarn, but supported in knitout
Writer.prototype.amiss = function(...args) {
	let bn = shiftBedNeedle(args);

	if (args.length !== 0) {
		throw new Error("amiss only takes a bed+needle");
	}

	this._operations.push('amiss ' + bn.bed + bn.needle.toString());
};

// xfer -> split without yarn, but supported in knitout
Writer.prototype.xfer = function(...args) {

	let from = shiftBedNeedle(args);
	let to = shiftBedNeedle(args);

	if (args.length !== 0) {
		throw new Error("xfer only takes two bed+needles");
	}

	if ((from.bed + from.needle.toString()) in this.needles) {
		this.needles[to.bed + to.needle.toString()] = true;
		delete this.needles[from.bed + from.needle.toString()];
	}
	
	this._operations.push('xfer ' + from.bed + from.needle.toString() + ' ' + to.bed + to.needle.toString());
};

// add comments to knitout 
Writer.prototype.comment = function( str ){

	let multi = str.split('\n');
	multi.forEach(function(entry){
		// cannot add header comments with comment
		while(entry.startsWith(';')){
			console.warn('Warning: comment starts with ; use addHeader for adding header comments.');
			entry = entry.substr(1, entry.length);
		}
		this._operations.push(';' + entry.toString());
	}, this);
};

Writer.prototype.pause = function(comment){
	// deals with multi-line comments
	this.comment(comment);
	this._operations.push('pause');
};

Writer.prototype.write = function(filename){
	let version = ';!knitout-2';
	let content = version + '\n' +
		this._headers.join('\n') + '\n' + 
		this._operations.join('\n');
	if (typeof(filename) === 'undefined') {
		console.warn("filename not passed to Writer.write; writing to stdout.");
		console.log(content);
	} else {
		try{
			let fs = require('fs');
			fs.writeFileSync(filename, content + '\n'); //default is utf8 
		} 
		catch(e){
			console.warn("Can't load 'fs'. Did not write file.");
		}
	}
	return content; 
};

// browser-compatibility
if(typeof(module) !== 'undefined'){
	module.exports.Writer = Writer;
}
//=========== end of knitout.js =============

	var knitoutContent = '';

	//will incrementally store Writer outputs here so partial result can be shown on crash:
	let _headers = [];
	let _operations = [];

	//returns lineNumber of the code that generated this knitout operation
    //only applies for tuck, knit, xfer, split, and miss
    //line number,l, will be followed at the end in format: ;l
    //note: don't think frontend supports in line comment anyway? so no conflicts?
    function findLineNumber(depth = 3){
        let err = new Error();
        let stack = err.stack.split(/\n/);

		//NOTE: if these stop working, could just walk stack to first match

		//Chrome:
        let m = stack[depth + 1].match(/<anonymous>:(\d+):(\d+)\)$/);
        if (m) {
            let line = parseInt(m[1]);
            return ' ;!source:'+(line-2);
		}

		//Firefox:
        m = stack[depth].match(/Function:(\d+):(\d+)$/);
        if (m) {
            let line = parseInt(m[1]);
            return ' ;!source:'+(line-2);
		}

		console.log(stack); //DEBUG

		//unknown
		return ';!source:' + (-1);
    }

	//patch Writer to grab operations / headers (maybe?)
	class NewWriter extends Writer {
		constructor(opts) {
			super(opts);
			this._operations.oldPush = this._operations.push;
			this._operations.push = function (...args) {
				const line = findLineNumber();
				for (const arg of args) {
					_operations.push(`${arg}${line}`);
					this.oldPush(`${arg}${line}`);
				}
			};
			_operations.push(...this._operations); //anything already in the array (should be nothing!)

			this._headers.oldPush = this._headers.push;
			this._headers.push = function (...args) {
				_headers.push(...args);
				this.oldPush(...args);
			};
			_headers.push(...this._headers); //anything already in the array (carriers header!)
		}
	}

    function require(path){
        if (path.match("knitout$")) {
            return {Writer:NewWriter};
        }
		if (path === 'fs') {
			return {
				writeFileSync:(fn, content) => {
					console.log(`Would write '${fn}'.`);
					knitoutContent = content;
				}
			}
		}
    }

	let consoleContent = [];

	let captureConsole = {
		log: function() {
			//console.log.apply(console, arguments);
			let str = '';
			for (let i = 0; i < arguments.length; ++i) {
				if (i !== 0) str += ' ';
				str += '' + arguments[i];
			}
			//comment-only lines (e.g. comment header, magic number) get preserved:
			if (str.match(/^\s*;/)) {
				consoleContent.push(str);
			} else {
				//other lines get comments removed, and ;!source: directive added:
				let i = str.indexOf(';');
				if (i !== -1) {
					str = str.substr(0,i);
				}
				consoleContent.push(str + findLineNumber(2));
			}
		},
		warn: function() { console.warn.apply(console, arguments); },
		assert: function() { console.assert.apply(console, arguments); },
		error: function() { console.error.apply(console, arguments); }
	};

	if (codeText.startsWith('#!')) {
		codeText = '//' + codeText;
	}

	try {
		const run = new Function('require', 'console', codeText);
		run(require, captureConsole);
	} catch (e) {
		console.error(`Code failed to run fully:\n ${e}`);
	}

	if (knitoutContent === '') {
		if (_headers.length > 0 || _operations.length > 0) {
			knitoutContent = ';!knitout-2\n' +
				_headers.join('\n') + '\n' + 
				_operations.join('\n') + '\n';

		}
	}
	if (knitoutContent === '') {
		knitoutContent = consoleContent.join('\n');
	}

    return knitoutContent;
}
