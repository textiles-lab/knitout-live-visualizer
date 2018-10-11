
//make a canvas into a knitout visualizer:
function ShowKnitout(canvas) {
	this.canvas = canvas;

	this.requestRedraw();
}

ShowKnitout.prototype.requestRedraw = function ShowKnitout_requestRedraw() {
	//...
};

//Find all "ShowKnitout" canvases, and attach a ShowKnitout object:

