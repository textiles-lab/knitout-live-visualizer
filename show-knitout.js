"use strict";

const TileSet = VectorTiles;

const SHOW_FRONT = { front:1.0, back:0.0 };
const SHOW_BACK = { front:0.0, back:1.0 };
const SHOW_BOTH = { front:1.0, back:0.5 };

//make a canvas into a knitout visualizer:
function ShowKnitout(canvas) {
	canvas.showKnitout = this;
	canvas.tabIndex = 0;

	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');

	this.code = document.getElementById(canvas.dataset.code);

	this.columns = 0;
	this.rows = 0;
	this.grids = { b:[], f:[] };
	this.columnX = [];
	this.width = 0.0;
	this.height = 0.0;

	this.show = SHOW_BOTH;

	this.reparse();
	this.camera = {
		x: 0.5 * this.width,
		y: 0.5 * this.height,
		portion: 1.0 //view 'portion' portion of item along shortest axis
	};

	//this.showTiles(); //DEBUG

	this.mouse = {
		x:NaN,
		y:NaN
	};

	const me = this;
	canvas.addEventListener('mousemove', function(evt){
		evt.preventDefault();
		var rect = canvas.getBoundingClientRect();
		let oldX = me.mouse.x;
		let oldY = me.mouse.y;
		me.mouse.x = ( (evt.clientX - rect.left) / rect.width * canvas.width );
		me.mouse.y = ( (evt.clientY - rect.top) / rect.height * canvas.height );

		if (evt.buttons & 1) {
			let deltaX = me.mouse.x - oldX;
			let deltaY = me.mouse.y - oldY;
			if (me.currentTransform && deltaX === deltaX && deltaY === deltaY) {
				me.camera.x -= deltaX / me.currentTransform[0];
				me.camera.y -= deltaY / me.currentTransform[3];
			}
		}

		me.requestDraw();
		return false;
	});
	canvas.addEventListener('wheel', function(evt){
		evt.preventDefault();

		let oldX = (me.mouse.x - me.currentTransform[4]) / me.currentTransform[0];
		let oldY = (me.mouse.y - me.currentTransform[5]) / me.currentTransform[3];

		me.camera.portion *= Math.pow(0.5, -evt.deltaY / 300.0);

		me.setCurrentTransform();

		let newX = (me.mouse.x - me.currentTransform[4]) / me.currentTransform[0];
		let newY = (me.mouse.y - me.currentTransform[5]) / me.currentTransform[3];

		me.camera.x += (oldX - newX);
		me.camera.y += (oldY - newY);

		me.requestDraw();

		return false;
	});

	canvas.addEventListener('keydown', function(evt){
		console.log(evt);
		if (evt.code === "ShiftLeft" || evt.code === "ShiftRight") {
			evt.preventDefault();
			me.show = SHOW_BACK;
			me.requestDraw();
			return false;
		}
		if (evt.code === "Space") {
			evt.preventDefault();
			if (me.hovered) {
				console.log(me.hovered.tile.src);
			}
			me.requestDraw();
			return false;
		}
	});

	canvas.addEventListener('keyup', function(evt){
		console.log(evt);
		if (evt.code === "ShiftLeft" || evt.code === "ShiftRight") {
			evt.preventDefault();
			me.show = SHOW_BOTH;
			me.requestDraw();
			return false;
		}
	});


}

ShowKnitout.prototype.setCurrentTransform = function ShowKnitout_setCurrentTransform() {
	let rect = this.canvas.getBoundingClientRect();
	const w = Math.round(rect.width * window.devicePixelRatio);
	const h = Math.round(rect.height * window.devicePixelRatio);

	const scale = Math.min(w / (this.camera.portion * this.width), h / (this.camera.portion * this.height));

	this.currentTransform = [scale,0, 0,-scale, 0.5*w-scale*this.camera.x, 0.5*h+scale*this.camera.y];
};

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
	this.setCurrentTransform();
	ctx.setTransform(...this.currentTransform);

	if (this.show.back !== 0.0) {
		//draw lines from back bed:
		for (let row = 0; row < this.rows; ++row) {
			let y = row * 9.0;
			for (let col = 0; col < this.columns; ++col) {
				let x = this.columnX[col];
				let g = this.grids.b[row * this.columns + col];
				if (g) {
					TileSet.draw(ctx, x, y, g);
				}
			}
		}
		if (this.show.back < 1.0) {
			//fade them slightly:
			ctx.globalAlpha = 1.0 - this.show.back;
			ctx.fillStyle = "#888";
			ctx.fillRect(0,0, w,h);
			ctx.globalAlpha = 1.0;
		}
	}

	//draw lines from front bed:
	if (this.show.front !== 0.0) {
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
	}
	
	//update selection:
	let mx = (this.mouse.x - this.currentTransform[4]) / this.currentTransform[0];
	let my = (this.mouse.y - this.currentTransform[5]) / this.currentTransform[3];
	this.hovered = null;
	let row = Math.floor(my / TileSet.TileHeight);
	if (row >= 0 && row < this.rows && 0 <= mx && mx <= this.width && this.columns) {
		let col = this.columnX.length - 1;
		while (col > 0 && this.columnX[col] > mx) --col;
		if (this.show.front > 0.0) {
			if (this.grids.f[row * this.columns + col]) {
				this.hovered = {
					bed:'f',
					row:row,
					col:col,
					tile:this.grids.f[row * this.columns + col]
				};
			}
		}
		if (this.show.back > 0.0 && !this.hovered) {
			if (this.grids.b[row * this.columns + col]) {
				this.hovered = {
					bed:'b',
					row:row,
					col:col,
					tile:this.grids.b[row * this.columns + col]
				};
			}

		}
	}

	//draw selection:
	if (this.hovered) {
		const x = this.columnX[this.hovered.col];
		const width = (this.hovered.col + 1 < this.columnX.length ? this.columnX[this.hovered.col+1] : this.width) - x;
		const y = TileSet.TileHeight * this.hovered.row;
		const height = TileSet.TileHeight;
		ctx.beginPath();
		ctx.moveTo(x,y);
		ctx.lineTo(x+width,y);
		ctx.lineTo(x+width,y+height);
		ctx.lineTo(x,y+height);
		ctx.closePath();
		ctx.strokeStyle = (this.hovered.bed === 'f' ? '#fff' : '#ddd');
		ctx.stroke();
	}

	//DEBUG: draw mouse:
	ctx.beginPath();
	ctx.moveTo(mx - 1.0, my - 1.0);
	ctx.lineTo(mx + 1.0, my + 1.0);
	ctx.moveTo(mx - 1.0, my + 1.0);
	ctx.lineTo(mx + 1.0, my - 1.0);
	ctx.lineWidth = 1.0;
	ctx.strokeStyle = '#fff';
	ctx.stroke();

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
					if (this.grids.f[y * this.columns + (i - minIndex)]) {
						this.grids.f[y * this.columns + (i - minIndex)].src = f;
					} else {
						console.warn("No tile for", f);
					}
				}
				if (b) {
					const loops = b.ports['v'];
					const yarns = b.ports['+'];
					const incoming = b.ports['o'];
					this.grids.b[y * this.columns + (i - minIndex)] =
						TileSet.makeLoopTile(b.type, 'b', loops, yarns, incoming);
					if (this.grids.b[y * this.columns + (i - minIndex)]) {
						this.grids.b[y * this.columns + (i - minIndex)].src = b;
					} else {
						console.warn("No tile for", b);
					}
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

