//knitout frontend
function evalJS(codeText){
    // basic writer
    knitoutContent = ''
    var Writer = function(opts){

        //private data:
        this._carriers = []; //array of carrier names, front-to-back order
        this._operations = []; //array of operations, stored as strings
        this._headers = []; //array of headers. stored as strings


        //fill '_carriers' array from opts.carriers:
        if (typeof(opts) === 'undefined' || !('carriers' in opts)) {
            console.warn("WARNING: options object passed to knitout.Writer does not contain a 'carriers' member. Will assume a default carrier layout (a single carrier named \"A\")");
            this._carriers = ["A"];
        } else {
            if (!Array.isArray(opts.carriers)) throw "opts.carriers should be an array of carrier names";
            opts.carriers.forEach((name) => {
                if (!(typeof(name) === 'string' && name.indexOf(' ') === -1)) {
                    throw "Carrier names must be strings that do not contain the space character (' ').";
                }
            });
            this._carriers = opts.carriers.slice();
        }

        //build a 'carriers' header from the '_carriers' list:
        this._headers.push(";;Carriers: " + this._carriers.join(" "));
    };

    // function that queues header information to header list
    Writer.prototype.addHeader = function(name, value) {
        if (name === undefined || value === undefined) {
            throw "Writer.addHeader should be called with a name and a value";
        }

        if (!(typeof(name) === 'string' && name.indexOf(': ') === -1)) {
            throw "Header names must be strings that don't contain the sequence ': '";
        }
        if (!(typeof(value) === 'string' && value.indexOf('\n') === -1)) {
            throw "Header values must be strings that do not contain the LF character ('\\n').";
        }

        //Check for valid headers:
        if (name === "Carriers") {
            throw "Writer.addHeader can't set Carriers header (use the 'carriers' option when creating the writer instead)."
        } else if (name === "Machine") {
            //no restrictions on value
        } else if (name === "Gauge") {
            //TODO: warn if value is not a string representing a number
        } else if (name === "Position") {
            //TODO: commit to a list of values, possibly warn on non-standard value
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

    // helper to return carriers as a string
    let getCarriers = function(carriers){

        if ( carriers === undefined ) return "";

        checkCarriers(carriers);

        return carriers.join(" ");
        // returns a string of carriers
    };

    // helper to return bed-needle as a string
    let getBedNeedle = function(at){

        checkBedNeedle(at);

        if(  typeof(at) === 'string' ){
            return at;
        }
        else {
            let at_arr = Object.keys(at).map(function (key) { return at[key]; });
            return at_arr[0] + at_arr[1].toString();
        }
        // returns a string of bed-needle
    };

    //helpers to extract parameters from argument arrays:
    // (these remove the extracted arguments from the start of the array and throw on errors)

    //shiftDirection interprets the first element of 'args' as a direction, and throws on error:
    // returns '+' or '-'.
    function shiftDirection(args) {
        console.assert(Array.isArray(args));
        if (args.length === 0) {
            throw "Direction missing.";
        }
        if (!(args[0] === '+' || args[0] === '-')) {
            throw "Direction should be '+' or '-'.";
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
            throw "Needle missing.";
        }
        let bed, needle;
        //case: bed string, needle number:
        if (typeof(args[0]) === 'string' && BedRegex.test(args[0])) {
            if (args.length < 2 || !Number.isInteger(args[1])) {
                throw "Expecting bed name to be followed by a needle number.";
            }
            bed = args.shift();
            needle = args.shift();
        //case: single string "f12", "b-2", "bs66":
        } else if (typeof(args[0]) === 'string') {
            let m = args[0].match(BedNeedleRegex);
            if (m === null) {
                throw "String '" + args[0] + "' does not look like a compound bed+needle string.";
            }
            bed = m[1];
            needle = parseInt(m[2]);
            args.shift();
        //case: two-member array ["fs", 2]
        } else if (Array.isArray(args[0])) {
            if (!( args[0].length === 2 && typeof(args[0][0]) === 'string' && BedRegex.test(args[0][0]) && Number.isInteger(args[0][1]) )) {
                throw "Bed+needle array should look like [\"f\", 12].";
            }
            bed = args[0][0];
            needle = args[0][1];
            args.shift();
        //case: object {bed:"fs", needle:5}
        } else if (typeof(args[0]) === 'object') {
            if (!( 'bed' in args[0] && typeof(args[0].bed) === 'string' && BedRegex.test(args[0].bed) )) {
                throw "Bed+needle object should have a 'bed' member string naming the bed.";
            }
            if (!( 'needle' in args[0] && Number.isInteger(args[0].needle) )) {
                throw "Bed+needle object should have a 'needle' member integer.";
            }
            bed = args[0].bed;
            needle = args[0].needle;
            args.shift();
        } else {
            throw "Expecting bed+needle as name+number (\"fs\", 6), string (\"b-2\"), array ([\"f\", 6]), or object ({bed:\"bs\", needle:12})."
        }
        return {bed:bed, needle:needle};
    }

    //shiftCarrierSet interprets the remaining contents of 'args' as an array of carrier names, and throws on error:
    // returns an array of carrier names, e.g., ["C", "A"].
    function shiftCarrierSet(args, carrierNames) {
        console.assert(Array.isArray(args) && Array.isArray(carrierNames));
        let carrierSet = [];
        //carrier set as array, e.g., knit(..., ["A", "B"]):
        if (args.length === 1 && Array.isArray(args[0])) {
            carrierSet = args.shift().slice();
        } else {
        //carrier set as parameters, e.g., knit(..., "A", "B");
            carrierSet = args.splice(0,args.length).slice();
        }

        carrierSet.forEach(function(name){
            if (carrierNames.indexOf(name) === -1) {
                throw "Invalid carrier name '" + name + "'";
            }
        });

        return carrierSet;
    }


    Writer.prototype.in = function(...args){

        let cs = shiftCarrierSet(args, this._carriers);
        if (cs.length === 0) {
            throw "It doesn't make sense to 'in' on an empty carrier set.";
        }

        this._operations.push('in ' + cs.join(' ')+ ' ' + findLineNumber());

    };

    Writer.prototype.inhook = function(...args){

        let cs = shiftCarrierSet(args, this._carriers);
        if (cs.length === 0) {
            throw "It doesn't make sense to 'inhook' on an empty carrier set.";
        }

        this._operations.push('inhook ' + cs.join(' ')+ ' ' + findLineNumber());

    };


    Writer.prototype.releasehook = function(...args){

        let cs = shiftCarrierSet(args, this._carriers);
        if (cs.length === 0) {
            throw "It doesn't make sense to 'releasehook' on an empty carrier set.";
        }

        this._operations.push('releasehook ' + cs.join(' ')+ ' ' + findLineNumber());

    };

    Writer.prototype.out = function(...args){

        let cs = shiftCarrierSet(args, this._carriers);
        if (cs.length === 0) {
            throw "It doesn't make sense to 'out' on an empty carrier set.";
        }

        this._operations.push('out ' + cs.join(' ')+ ' ' + findLineNumber());

    };

    Writer.prototype.outhook = function(...args){

        let cs = shiftCarrierSet(args, this._carriers);
        if (cs.length === 0) {
            throw "It doesn't make sense to 'outhook' on an empty carrier set.";
        }

        this._operations.push('outhook ' + cs.join(' ')+ ' ' + findLineNumber());
    };

    function isFiniteNumber( n ) {
        if (typeof(n) === 'number' && Number.isFinite(n) && !Number.isNaN(n)) return true;
        return false;
    }

    Writer.prototype.stitch = function(before, after) {
        if (!(isFiniteNumber(before) && isFiniteNumber(after))) {
            throw "Stitch L and T values must be finite numbers.";
        }

        this._operations.push('stitch ' + before.toString() + ' ' + after.toString());
    };

    //note: extension!
    Writer.prototype.stitchNumber = function (stitchNumber) {
        if (!(Number.isInteger(stitchNumber) && stitchNumber > 0)) {
            throw "Stitch numbers are positive integer values."
        }

        this._operations.push('x-stitch-number ' + stitchNumber.toString());
    };

    Writer.prototype.rack = function(rack) {

        if (!(isFiniteNumber(rack))) {
            throw "Racking values must be finite numbers.";
        }

        this._operations.push('rack ' + rack.toString());
    };

    //returns lineNumber of the code that generated this knitout operation
    //only applies for tuck, knit, xfer, split, and miss
    //line number,l, will be followed at the end in format: ;l
    //note: don't think frontend supports in line comment anyway? so no conflicts?
    function findLineNumber(){
        let err = new Error();
        let stack = err.stack.split(/\n/);

		//Chrome:
        let m = stack[3].match(/<anonymous>:(\d+):(\d+)\)$/);
        if (m) {
            let line = parseInt(m[1]);
            return ' ;!source:'+(line-2);
		}

		//Firefox:
        m = stack[2].match(/Function:(\d+):(\d+)$/);
        if (m) {
            let line = parseInt(m[1]);
            return ' ;!source:'+(line-2);
		}

		//unknown
		return ';!source:' + (-1);
        /*} else { //this was marked 'Firefox' but doesn't seem to work in Firefox any more?
            let i = 0;
            // Find trace line which starts with OUTER
            while (!stack[i].startsWith("OUTER"))
                i++;
            m = stack[i].match(/(\d+):(\d+)/);
            if (m) {
                let line = parseInt(m[1]);
                return ' ;!source:'+(line-1);
            } else {
                return ';!source:' + (-1);
            }
        }*/
    }
    Writer.prototype.knit = function(...args) {
        let dir = shiftDirection(args);
        let bn = shiftBedNeedle(args);
        let cs = shiftCarrierSet(args, this._carriers);
        line = findLineNumber();
        this._operations.push('knit ' + dir + ' ' + bn.bed + bn.needle.toString() + ' ' + cs.join(' ')+line);
    };

    Writer.prototype.tuck  = function(...args) {
        let dir = shiftDirection(args);
        let bn = shiftBedNeedle(args);
        let cs = shiftCarrierSet(args, this._carriers);
        line = findLineNumber();
        this._operations.push('tuck ' + dir + ' ' + bn.bed + bn.needle.toString() + ' ' + cs.join(' ')+line);
    };

    Writer.prototype.split = function(...args) {
        let dir = shiftDirection(args);
        let from = shiftBedNeedle(args);
        let to = shiftBedNeedle(args);
        let cs = shiftCarrierSet(args, this._carriers);
        line = findLineNumber();
        this._operations.push('split ' + dir + ' ' + from.bed + from.needle.toString() + ' ' + to.bed + to.needle.toString() + ' ' + cs.join(' ')+line);
    };

    Writer.prototype.miss = function(...args) {
        let dir = shiftDirection(args);
        let bn = shiftBedNeedle(args);
        let cs = shiftCarrierSet(args, this._carriers);
        line = findLineNumber();
        if (cs.length === 0) {
            throw "It doesn't make sense to miss with no carriers.";
        }

        this._operations.push('miss ' + dir + ' ' + bn.bed + bn.needle.toString() + ' ' + cs.join(' ')+line);
    };


    // drop -> knit without yarn, but supported in knitout
    Writer.prototype.drop = function(...args) {
        let bn = shiftBedNeedle(args);

        if (args.length !== 0) {
            throw "drop only takes a bed+needle";
        }

        this._operations.push('drop ' + bn.bed + bn.needle.toString() + ' ' + findLineNumber());
    };

    // amiss -> tuck without yarn, but supported in knitout
    Writer.prototype.amiss = function(...args) {
        let bn = shiftBedNeedle(args);

        if (args.length !== 0) {
            throw "amiss only takes a bed+needle";
        }
        line = findLineNumber();
        this._operations.push('amiss ' + bn.bed + bn.needle.toString()+line);
    };

    // xfer -> split without yarn, but supported in knitout
    Writer.prototype.xfer = function(...args) {

        let from = shiftBedNeedle(args);
        let to = shiftBedNeedle(args);

        if (args.length !== 0) {
            throw "xfer only takes two bed+needles";
        }
        line = findLineNumber();
        this._operations.push('xfer ' + from.bed + from.needle.toString() + ' ' + to.bed + to.needle.toString()+line);
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
        this._operations.push('pause'+ ' ' + findLineNumber());
    };

    Writer.prototype.write = function(filename){
        let version = ';!knitout-2';
        let content = version + '\n' +
            this._headers.join('\n') + '\n' +
            this._operations.join('\n') + '\n';
        knitoutContent = content;
    };

    // browser-compatibility
    if(typeof(module) !== 'undefined'){
        module.exports.Writer = Writer;
    }

    function require(path){
        if (path.match("knitout$")) {
            return {Writer:Writer};
        }
    }

	let consoleContent = [];

	let captureConsole = {
		log: function() {
			console.log.apply(console, arguments);
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
				consoleContent.push(str + findLineNumber());
			}
		},
		warn: function() { console.warn.apply(console, arguments); },
		assert: function() { console.assert.apply(console, arguments); },
		error: function() { console.error.apply(console, arguments); }
	};

	if (codeText.startsWith('#!')) {
		codeText = '//' + codeText;
	}

	const run = new Function('require', 'console', codeText);
	run(require, captureConsole);

	if (knitoutContent === '') {
		knitoutContent = consoleContent.join('\n');
	}

    return knitoutContent;
}
