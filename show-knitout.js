"use strict";

const TileSet = VectorTiles;

//make a canvas into a knitout visualizer:
function ShowKnitout(canvas) {
	canvas.showKnitout = this;
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');

	this.code = document.getElementById(canvas.dataset.code);

	this.columns = 0;
	this.rows = 0;
	this.grids = { b:[], f:[] };
	this.columnX = [];
	this.width = 0.0;
	this.height = 0.0;

	//this.reparse();
	this.showTiles(); //DEBUG
}

ShowKnitout.prototype.draw = function ShowKnitout_draw() {
	//handle resizing:
	let rect = this.canvas.getBoundingClientRect();
	const w = Math.round(rect.width * window.devicePixelRatio);
	const h = Math.round(rect.height * window.devicePixelRatio);
	this.canvas.width = w;
	this.canvas.height = h;
	this.canvas.style.width = (w / window.devicePixelRatio) + "px";
	this.canvas.style.height = (h / window.devicePixelRatio) + "px";

	//blank and continue:
	const ctx = this.ctx;
	ctx.setTransform(1,0, 0,1, 0,0);
	ctx.fillStyle = "#888";
	ctx.fillRect(0,0, w,h);

	//scale to show whole grid:
	const scale = Math.min(w / this.width, h / this.height);

	ctx.setTransform(scale,0, 0,-scale, 0.5*w-0.5*scale*this.width,0.5*h+0.5*scale*this.height);

	//draw lines from front bed:
	for (let row = 0; row < this.rows; ++row) {
		let y = row * 9.0;
		for (let col = 0; col < this.columns; ++col) {
			let x = this.columnX[col];
			let g = this.grids.f[row * this.columns + col];
			if (g) {
				TileSet.draw(ctx, x, y, g);
			}
		}
	}


};

ShowKnitout.prototype.requestDraw = function ShowKnitout_requestDraw() {
	if (this.drawRequested) return;
	this.drawRequested = true;
	let me = this;
	window.requestAnimationFrame(function(){
		delete me.drawRequested;
		me.draw();
	});
};

ShowKnitout.prototype.showTiles = function ShowKnitout_showTiles() {
	this.requestDraw();

	//clear grids:
	this.columns = 0;
	this.rows = 0;
	this.grids = { b:[], f:[] };
	this.columnX = [];
	this.width = 0.0;
	this.height = 0.0;

	this.rows = 3 * 5;
	this.columns = 3 * 4;

	this.grids.b = new Array(this.rows * this.columns);
	this.grids.f = new Array(this.rows * this.columns);
	for (let col = 0; col < this.columns; ++col) {
		this.columnX.push(col * TileSet.LoopWidth);
	}
	this.width = this.columns * TileSet.LoopWidth;
	this.height = this.rows * TileSet.TileHeight;

	for (let row = 0; row < this.rows; ++row) {
		let r = this.rows - 1 - row;
		for (let col = 0; col < this.columns; ++col) {
			let type = ['k','t','s','x','m'][Math.floor(r / 3)];
			let bed = (col < 6 ? 'f' : 'b');
			if (col < 3 || col >= 9) {
				if (type === 's') type = 'S';
				else if (type === 'x') type = 'X';
				else continue;
			}
			let yarns = [['1','2'],['1'],[]][r % 3];
			let loops = [['3','4'],['3'],[]][col % 3];
			let across = [];
			if (type === 'X' || type === 'S') {
				across = loops;
				loops = yarns;
				yarns = [];
			} else if (type === 'x' || type === 's') {
				across = loops;
			}
			//if (type === 'x' && yarns.length !== 0) continue;
			this.grids.f[row * this.columns + col] = TileSet.makeLoopTile(type, bed, loops, yarns, across);
		}
	}
};

ShowKnitout.prototype.reparse = function ShowKnitout_reparse() {
	const codeText = this.code.innerText;

	const machine = new CellMachine();
	try {
		parseKnitout(codeText, machine);
	} catch (e) {
		console.log("parse error:",e);
	}

	this.requestDraw();

	//clear grids:
	this.columns = 0;
	this.rows = 0;
	this.grids = { b:[], f:[] };
	this.columnX = [];
	this.width = 0.0;
	this.height = 0.0;

	let minIndex = Infinity;
	let maxIndex = -Infinity;
	for (let bn in machine.beds) {
		minIndex = Math.min(minIndex, machine.beds[bn].minIndex);
		maxIndex = Math.max(maxIndex, machine.beds[bn].maxIndex);
	}
	if (minIndex > maxIndex) return;

	//fill grids from machine's columns:
	this.columns = maxIndex - minIndex + 1;
	this.rows = machine.topRow + 1;
	this.grids.b = new Array(this.columns * this.rows);
	this.grids.f = new Array(this.columns * this.rows);

	let x = 0.0;

	for (let i = minIndex; i <= maxIndex; ++i) {
		this.columnX.push(x);
		if (i % 2 === 0) {
			x += TileSet.LoopWidth;
		} else {
			x += TileSet.YarnWidth;
		}
		let bColumn = machine.beds.b.getColumn(i);
		let fColumn = machine.beds.f.getColumn(i);
		let bi = 0;
		let fi = 0;
		for (let y = 0; y < this.rows; ++y) {
			let b = null;
			if (bi < bColumn.length && bColumn[bi].y === y) {
				b = bColumn[bi];
				++bi;
			}
			let f = null;
			if (fi < fColumn.length && fColumn[fi].y === y) {
				f = fColumn[fi];
				++fi;
			}

			if (i % 2 === 0) {
				//stitches:
				if (f) {
					const loops = f.ports['v'];
					const yarns = f.ports['+'];
					const incoming = f.ports['x'];
					this.grids.f[y * this.columns + (i - minIndex)] =
						TileSet.makeLoopTile(f.type, 'f', loops, yarns, incoming);
				}
				if (b) {
					const loops = b.ports['v'];
					const yarns = b.ports['+'];
					const incoming = b.ports['o'];
					this.grids.b[y * this.columns + (i - minIndex)] =
						TileSet.makeLoopTile(b.type, 'b', loops, yarns, incoming);
				}
			} else {
				//yarns:
				if (f) {
					this.grids.f[y * this.columns + (i - minIndex)] =
						TileSet.makeYarnTile(f.type, 'f', f.ports);
				}
				if (b) {
					this.grids.b[y * this.columns + (i - minIndex)] =
						TileSet.makeYarnTile(b.type, 'b', b.ports);
				}
			}
		}
	}
	this.width = x;
	this.height = this.rows * TileSet.TileHeight;
};

//Find all "ShowKnitout" canvases, and attach a ShowKnitout object:
let elts = document.getElementsByClassName("ShowKnitout");
for (let i = 0; i < elts.length; ++i) {
	let elt = elts[i];
	console.assert(elt.tagName === "CANVAS", "ShowKnitouts should be canvases.");
	new ShowKnitout(elt);
}

