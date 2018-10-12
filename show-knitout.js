"use strict";

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

	this.reparse();
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
				g.lines.forEach(function(l){
					let pts = l.pts;
					ctx.beginPath();
					for (let i = 0; i < pts.length; i += 2) {
						ctx.lineTo(pts[i] + x, pts[i+1] + y);
					}
					ctx.strokeWidth = 1.0;
					ctx.strokeStyle = "#f00";
					ctx.stroke();
				});
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
			x += 13.0;
		} else {
			x += 4.0;
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
					let g = {lines:[]};
					this.grids.f[y * this.columns + (i - minIndex)] = g;
					//                       1 1 1
					//   0 1 2 3 4 5 6 7 8 9 0 1 2
					// 8 . . . . a b . b a . . . .
					// 7 . A A A A A A A A A A A .
					// 6 . A B B B B B B B B B A .
					// 5 . A B . a b . b a . B A .
					// 4 a a a a a b . b a a a a a
					// 3 b b b b b b . b b b b b b
					// 2 . A B . . . . . . . B A .
					// 1 . A A A A . . . A A A A .
					// 0 . . B B A B . B A B B . .
					//
					if (f.type === "k") {
						if (yarns.length === 0) {
							//knit with no yarns === drop:
							if (loops.length >= 1) {
								let y = loops[0];
								g.lines.push({y:y, pts:[
									4.5, 0.0,
									4.5, 1.5,
									1.5, 1.5,
									1.5, 7.5,
									11.5, 7.5,
									11.5, 1.5,
									8.5, 1.5,
									8.5, 0.0
								]});
							}
							if (loops.length >= 2) {
								let y = loops.slice(1).join(' ');
								g.lines.push({y:y, pts:[
									5.5, 0.0,
									5.5, 0.5
								]});
								g.lines.push({y:y, pts:[
									3.5, 0.5,
									2.5, 0.5
								]});
								g.lines.push({y:y, pts:[
									2.5, 2.5,
									2.5, 6.5,
									10.5, 6.5,
									10.5, 2.5
								]});
								g.lines.push({y:y, pts:[
									10.5, 0.5,
									9.5, 0.5
								]});
								g.lines.push({y:y, pts:[
									7.5, 0.5,
									7.5, 0.0
								]});
							}
						} else {
							//knit with some yarns:
							let h = (yarns.length === 1 ? 3.5 : 2.5);
							//draw loops:
							if (loops.length >= 1) {
								let y = loops[0];
								g.lines.push({y:y, pts:[
									4.5, 0.0,
									4.5, 1.5,
									1.5, 1.5,
									1.5, h
								]});
								g.lines.push({y:y, pts:[
									1.5, 5.5,
									1.5, 7.5,
									11.5, 7.5,
									11.5, 5.5,
								]});
								g.lines.push({y:y, pts:[
									11.5, h,
									11.5, 1.5,
									8.5, 1.5,
									8.5, 0.0
								]});
							}
							if (loops.length >= 2) {
								let y = loops.slice(1).join(' ');
								g.lines.push({y:y, pts:[ 5.5, 0.0, 5.5, 0.5 ]});
								g.lines.push({y:y, pts:[ 3.5, 0.5, 2.5, 0.5 ]});
								g.lines.push({y:y, pts:[ 2.5, 2.5, 2.5, h ]});
								g.lines.push({y:y, pts:[
									2.5, 5.5,
									2.5, 6.5,
									10.5, 6.5,
									10.5, 5.5,
								]});
								g.lines.push({y:y, pts:[ 10.5, h, 10.5, 2.5 ]});
								g.lines.push({y:y, pts:[ 10.5, 0.5, 9.5, 0.5 ]});
								g.lines.push({y:y, pts:[ 7.5, 0.5, 7.5, 0.0 ]});
							}
							//draw yarns:
							if (loops.length === 0) {
								let y = yarns[0];
								g.lines.push({y:y, pts:[ 0.0, 4.5, 4.5, 4.5, 4.5, 9.0 ]});
								g.lines.push({y:y, pts:[ 8.5, 9.0, 8.5, 4.5, 13.0, 4.5 ]});
								//TODO: yarns.length >= 2
							} else {
								let h = (yarns.length >= 2 ? 5.5 : 6.5);
								g.lines.push({y:y, pts:[
									0.0, 4.5,
									4.5, 4.5,
									4.5, h
								]});
								g.lines.push({y:y, pts:[
									4.5, 8.5,
									4.5, 9.0
								]});
								g.lines.push({y:y, pts:[
									8.5, 9.0,
									8.5, 8.5
								]});
								g.lines.push({y:y, pts:[
									8.5, h,
									8.5, 4.5,
									13.0, 4.5,
								]});
							}
						}
						//console.log(f,g); //DEBUG
					} else if (f.type === "t") {
					} else if (f.type === "m") {
					} else if (f.type === "s") {
					} else if (f.type === "S") {
					} else if (f.type === "x") {
					} else if (f.type === "X") {
					} else {
						console.warn("Unknown front cell type: ", f);
					}
				}
				if (b) {
					if (b.type === "k") {
					} else if (b.type === "t") {
					} else if (b.type === "m") {
					} else if (b.type === "s") {
					} else if (b.type === "S") {
					} else if (b.type === "x") {
					} else if (b.type === "X") {
					} else {
						console.warn("Unknown back cell type: ", b);
					}
				}
			} else {
				//yarns:
				//TODO!
			}
		}
	}
	this.width = x;
	this.height = this.rows * 9.0;
};

//Find all "ShowKnitout" canvases, and attach a ShowKnitout object:
let elts = document.getElementsByClassName("ShowKnitout");
for (let i = 0; i < elts.length; ++i) {
	let elt = elts[i];
	console.assert(elt.tagName === "CANVAS", "ShowKnitouts should be canvases.");
	new ShowKnitout(elt);
}

