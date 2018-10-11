"use strict";

//make a canvas into a knitout visualizer:
function ShowKnitout(canvas) {
	this.canvas = canvas;
	this.code = document.getElementById(canvas.dataset.code);

	this.reparse();
}

ShowKnitout.prototype.draw = function ShowKnitout_draw() {
	console.log("should draw");
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
	console.log("should parse");

	this.requestDraw();
};

//Find all "ShowKnitout" canvases, and attach a ShowKnitout object:
let elts = document.getElementsByClassName("ShowKnitout");
for (let i = 0; i < elts.length; ++i) {
	let elt = elts[i];
	console.assert(elt.tagName === "CANVAS", "ShowKnitouts should be canvases.");
	new ShowKnitout(elt);
}

