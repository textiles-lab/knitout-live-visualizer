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

	//these are used to do stitch selection and view panning:
	this.clearDrawing();

	this.show = SHOW_BOTH;

	this.camera = {
		x: 0.0,
		y: 0.0,
		radius: 10.0 //in terms of shortest axis
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

		me.setCurrentTransform();

		let oldX = (me.mouse.x - me.currentTransform[4]) / me.currentTransform[0];
		let oldY = (me.mouse.y - me.currentTransform[5]) / me.currentTransform[3];

		me.camera.radius *= Math.pow(0.5, -evt.deltaY / 300.0);

		me.setCurrentTransform();

		let newX = (me.mouse.x - me.currentTransform[4]) / me.currentTransform[0];
		let newY = (me.mouse.y - me.currentTransform[5]) / me.currentTransform[3];

		me.camera.x += (oldX - newX);
		me.camera.y += (oldY - newY);

		me.setCurrentTransform();

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
		/*if (evt.code === "Space") {
			evt.preventDefault();
			if (me.hovered) {
				console.log(me.hovered.tile.src);
			}
			me.requestDraw();
			return false;
		}*/
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
	canvas.addEventListener('mousedown', function(evt){
		evt.preventDefault();
		if (me.hovered && me.hovered.tile.source) {
			if (me.onClickSource) {
				me.onClickSource(me.hovered.tile.source);
			}
		}
		return false;
	});
}


ShowKnitout.prototype.clearDrawing = function ShowKnitout_clearDrawing() {
	this.columns = 0;
	this.rows = 0;
	this.grids = { b:[], f:[] };
	this.columnX = [];
	this.min = { x:0, y:0 };
	this.max = { x:0, y:0 };

	this.drawing = TileSet.makeDrawing();
	this.highlightFn = function(){ return false; }
};

ShowKnitout.prototype.setHighlightFn = function ShowKnitout_setHighlightFn(highlightFn) {
	this.highlightFn = highlightFn;
	this.requestDraw();
};

ShowKnitout.prototype.setCurrentTransform = function ShowKnitout_setCurrentTransform() {
	let rect = this.canvas.getBoundingClientRect();
	const w = Math.round(rect.width * window.devicePixelRatio);
	const h = Math.round(rect.height * window.devicePixelRatio);

	const scale = Math.min(w,h) / (2.0 * this.camera.radius);

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

	//DEBUG: show min/max rectangle [used for camera handling]
	//ctx.fillStyle = "#f0f";
	//ctx.fillRect(this.min.x,this.min.y, this.max.x-this.min.x,this.max.y-this.min.y);

	const gridOfs = {
		f:{x:0.0, y:0.0},
		b:{x:-0.15 * TileSet.LoopWidth, y:0.2 * TileSet.TileHeight},
	};
	gridOfs.fs = {x: 0.75 * gridOfs.f.x + 0.25 * gridOfs.b.x, y: 0.75 * gridOfs.f.y + 0.25 * gridOfs.b.y};
	gridOfs.bs = {x: 0.25 * gridOfs.f.x + 0.75 * gridOfs.b.x, y: 0.25 * gridOfs.f.y + 0.75 * gridOfs.b.y};

	TileSet.draw(ctx, this.drawing, {
		frontOfs:gridOfs.f,
		frontSlidersOfs:gridOfs.fs,
		backOfs:gridOfs.b,
		backSlidersOfs:gridOfs.bs,
		backTintRGBA:[0.53, 0.53, 0.53, 0.6],
		middleTintRGBA:[0.53, 0.53, 0.53, 0.3],
		frontTintRGBA:[1.0, 1.0, 1.0, 0.0]
	});

	//draw highlights:
	["b","bs","fs","f"].forEach(function(gridName) {
		let grid = this.grids[gridName];
		let ofs = gridOfs[gridName];
		for (let row = 0; row < this.rows; ++row) {
			for (let col = 0; col < this.columns; ++col) {

				const x = this.columnX[col];
				const width = (col + 1 < this.columnX.length ? this.columnX[col+1] : this.width) - x;
				const y = TileSet.TileHeight * row;

				let tile = grid[row * this.columns + col];
				if (tile && tile.source && this.highlightFn(tile.source)) {
					ctx.globalAlpha = 0.5;
					ctx.fillStyle = '#fff';
					ctx.fillRect(ofs.x+x,ofs.y+y, width,TileSet.TileHeight);
					ctx.globalAlpha = 1.0;
				}
			}
		}
	}, this);


	//update selection:
	let mx = (this.mouse.x - this.currentTransform[4]) / this.currentTransform[0];
	let my = (this.mouse.y - this.currentTransform[5]) / this.currentTransform[3];
	let oldHovered = this.hovered;
	this.hovered = null;
	let row = Math.floor((my - this.min.y) / TileSet.TileHeight);
	if (row >= 0 && row < this.rows && this.min.x <= mx && mx <= this.max.x) {
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

	if (this.hovered) {
		let x = this.columnX[this.hovered.col];
		let w = (this.hovered.col+1 < this.columnX.length ? this.columnX[this.hovered.col+1] : this.width) - x;
		ctx.globalAlpha = 0.1;
		ctx.fillStyle = '#fff';
		ctx.fillRect(x,0, w,this.height);
		ctx.globalAlpha = 1.0;
	}

	if (oldHovered !== this.hovered && this.hovered && this.hovered.tile.source) {
		if (this.onHoverSource) {
			this.onHoverSource(this.hovered.tile.source);
		}
	}


	//draw selection:
	if (this.hovered) {
		let x = this.columnX[this.hovered.col];
		const width = (this.hovered.col + 1 < this.columnX.length ? this.columnX[this.hovered.col+1] : this.width) - x;
		let y = TileSet.TileHeight * this.hovered.row;
		if (this.hovered.bed === 'b') {
			x += -0.15 * TileSet.LoopWidth;
			y += 0.2 * TileSet.TileHeight;
		}
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

	if (this.hovered !== this.oldHovered) {
		if (this.highlightLine) {
			this.highlightLine(this.hovered ? this.hovered.tile.source : "");
		}
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
	this.clearDrawing();

	this.rows = 3 * 5;
	this.columns = 3 * 4;

	this.grids.b = new Array(this.rows * this.columns);
	this.grids.f = new Array(this.rows * this.columns);
	for (let col = 0; col < this.columns; ++col) {
		this.columnX.push(col * TileSet.LoopWidth);
	}
	this.min = TileSet.tileLowerLeft(0,0);
	this.max = TileSet.tileLowerLeft(this.columns, this.rows);

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
			this.grids.f[row * this.columns + col] = {};
			TileSet.addLoopTile(this.drawing, {},
				{i:col, y:row, type:type, bed:bed, loops:loops, yarms:yarns, across:across});
		}
	}
};

ShowKnitout.prototype.parse = function ShowKnitout_parse(codeText, useKnitoutAsSource=false) {

	let oldMin = this.min;
	let oldMax = this.max;

	const machine = new CellMachine();
	try {
		  parseKnitout(codeText, machine, useKnitoutAsSource);
	} catch (e) {
		console.log("parse error:",e);
	}

        let code = document.getElementById('code1');
        if (code) {
            code.innerHTML = "";
            let lines = codeText.split("\n");
            let annotatedLines = ""
            for (let i = 0; i < lines.length; i++) {
                annotatedLines += "<span class='line' id='LineNo" + i + "'><span class='lineNumber'>" + i + "</span>" + lines[i] + "</span>\n";
            }
            code.innerHTML = annotatedLines;
        }

	this.requestDraw();

	//clear grids:
	this.clearDrawing();

	let minIndex = Infinity;
	let maxIndex = -Infinity;
	for (let bn in machine.beds) {
		minIndex = Math.min(minIndex, machine.beds[bn].minIndex);
		maxIndex = Math.max(maxIndex, machine.beds[bn].maxIndex);
	}
	if (minIndex > maxIndex) return;


	this.min = TileSet.tileLowerLeft(minIndex, 0);
	this.max = TileSet.tileLowerLeft(maxIndex + 1, machine.topRow + 1);

	const Margin = 0.5 * TileSet.TileHeight;

	//update camera based on old/new min/max:
	if (oldMin.x >= oldMax.x || oldMin.y >= oldMax.y) {
		//old min/max invalid, frame whole piece:
		this.camera.x = 0.5 * (this.max.x + this.min.x);
		this.camera.y = 0.5 * (this.max.y + this.min.y);
		this.camera.radius = 0.5 * Math.max(this.max.x - this.min.x + 2.0 * Margin, this.max.y - this.min.y + 2.0 * Margin);
	} else {
		/*
		//if the piece got larger, zoom out:
		let stretch = Math.max(
			(this.max.x - this.min.x) / (oldMax.x - oldMin.x),
			(this.max.y - this.min.y) / (oldMax.y - oldMin.y)
		);
		if (stretch > 1.0) {
			this.camera.radius *= stretch;
		}
		*/
		//if the piece got smaller so that it can't be seen any longer, zoom out:
		this.camera.radius = Math.max(
			this.camera.radius,
			this.camera.x-this.max.x + Margin,
			this.min.x-this.camera.x + Margin,
			this.camera.y-this.max.y + Margin,
			this.min.y-this.camera.y + Margin
		);
	}

	//fill grids from machine's columns:
	this.columns = maxIndex - minIndex + 1;
	this.rows = machine.topRow + 1;
	this.grids.b = new Array(this.columns * this.rows);
	this.grids.f = new Array(this.columns * this.rows);
    this.grids.bs = new Array(this.columns * this.rows);
	this.grids.fs = new Array(this.columns * this.rows);

	for (let i = minIndex; i <= maxIndex; ++i) {
		let bColumn = machine.beds.b.getColumn(i);
		let fColumn = machine.beds.f.getColumn(i);
        let bsColumn = machine.beds.bs.getColumn(i);
		let fsColumn = machine.beds.fs.getColumn(i);
		let bi = 0;
		let fi = 0;
        let bsi = 0;
		let fsi = 0;
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
            let bs = null;
			if (bsi < bsColumn.length && bsColumn[bsi].y === y) {
				bs = bsColumn[bsi];
				++bsi;
			}
			let fs = null;
			if (fsi < fsColumn.length && fsColumn[fsi].y === y) {
				fs = fsColumn[fsi];
				++fsi;
			}

			if (i % 2 === 0) {
				//stitches:
				if (f) {
					const loops = f.ports['v'];
					const yarns = f.ports['+'];
					const incoming = f.ports['x'];
					this.grids.f[y * this.columns + (i - minIndex)] = f;
					TileSet.addLoopTile(this.drawing, f.styles,
						{i:i, y:y, type:f.type, bed:'f', loops:loops, yarns:yarns, across:incoming});
				}
				if (b) {
					const loops = b.ports['v'];
					const yarns = b.ports['+'];
					const incoming = b.ports['o'];
					this.grids.b[y * this.columns + (i - minIndex)] = b;
					TileSet.addLoopTile(this.drawing, b.styles,
						{i:i, y:y, type:b.type, bed:'b', loops:loops, yarns:yarns, across:incoming});
				}
                if (fs) {
					const loops = fs.ports['v'];
					const yarns = fs.ports['+'];
					const incoming = fs.ports['x'];
					this.grids.fs[y * this.columns + (i - minIndex)] = fs;
					TileSet.addLoopTile(this.drawing, fs.styles,
						{i:i, y:y, type:fs.type, bed:'fs', loops:loops, yarns:yarns, across:incoming});
				}
				if (bs) {
					const loops = bs.ports['v'];
					const yarns = bs.ports['+'];
					const incoming = bs.ports['o'];
					this.grids.bs[y * this.columns + (i - minIndex)] = bs;
					TileSet.addLoopTile(this.drawing, bs.styles,
						{i:i, y:y, type:bs.type, bed:'bs', loops:loops, yarns:yarns, across:incoming});
				}
			} else {
				//yarns:
				if (f) {
					this.grids.f[y * this.columns + (i - minIndex)] = f;
					TileSet.addYarnTile(this.drawing, f.styles, {i:i, y:y, bed:'f', ports:f.ports, segs:f.segs}, machine.carriers);
				}
				if (b) {
					this.grids.b[y * this.columns + (i - minIndex)] = b;
					TileSet.addYarnTile(this.drawing, b.styles, {i:i, y:y, bed:'b', ports:b.ports, segs:b.segs}, machine.carriers);
				}
                if (fs) {
					this.grids.fs[y * this.columns + (i - minIndex)] = fs;
					TileSet.addYarnTile(this.drawing, fs.styles, {i:i, y:y, bed:'fs', ports:fs.ports, segs:fs.segs}, machine.carriers);
				}
				if (bs) {
					this.grids.bs[y * this.columns + (i - minIndex)] = bs;
					TileSet.addYarnTile(this.drawing, bs.styles, {i:i, y:y, bed:'bs', ports:bs.ports, segs:bs.segs}, machine.carriers);
				}
			}
		}
	}

	//fill in columnX for ... hm... I guess highlighting code uses it?
	for (let i = minIndex; i <= maxIndex+1; ++i) {
		this.columnX.push(TileSet.tileLowerLeft(i,0).x);
	}

	//fill crosses from machine's crosses:
	machine.crosses.forEach(function(cross){
		TileSet.addCross(this.drawing, cross);
		//this.crosses.push(TileSet.makeCross(cross.type, this.columnX[cross.i-minIndex], this.columnX[cross.i2-minIndex], TileSet.TileHeight * cross.y, cross.yarns, cross.colors));
	}, this);



};

//Find all "ShowKnitout" canvases, and attach a ShowKnitout object:
let elts = document.getElementsByClassName("ShowKnitout");
for (let i = 0; i < elts.length; ++i) {
	let elt = elts[i];
	console.assert(elt.tagName === "CANVAS", "ShowKnitouts should be canvases.");
	window.SK = new ShowKnitout(elt);
}
