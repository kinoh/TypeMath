var data = {};

data["("] = new Glyph(24, 64,
	new Bezier(20, 4, 20, 60, 4, 2, 4, 62, 0, 0, 3));
data["{"] = new Glyph(24, 64,
	new Bezier(20, 4, 4, 32, 2, 0, 16, 32, 0, 0, 4),
	new Bezier(4, 32, 20, 60, 16, 32, 2, 64, 0, 0, 4));
data["["] = new Glyph(24, 64,
	new Line(16, 4, 8, 4, 1),
	new Line(8, 4, 8, 60, 2.5),
	new Line(8, 60, 16, 60, 1));
data["widetilde"] = new Glyph(64, 24,
	new Bezier(8, 16, 56, 8, 28, -6, 36, 30, 1, 1, 4));
data["widehat"] = new Glyph(64, 24,
	new Line(8, 16, 32, 8, 1, 3),
	new Line(32, 8, 56, 16, 3, 1));
data["overrightarrow"] = new Glyph(64, 24,
	new Line(4, 12, 60, 12, 1, 1),
	new Bezier(60, 12, 54, 6, 56, 12, 54, 10, 0, 0, 5),
	new Bezier(60, 12, 54, 18, 56, 12, 54, 14, 0, 0, 5));
data["overbrace"] = data["{"].turnRight();

var glyph = data["("];

var points = {};
var index = "";
var unizon = "";
var hide = false;


window.onload = function ()
{
	for (var g in data)
	{
		var s = document.createElement("option");
		s.text = g;
		_("glyph").add(s, null);
	}

	render();

	_("c").onmousedown = function (e)
	{
		var r = { x: e.layerX, y: e.layerY };
		var near = Object.keys(points)
			.map(function (i) { return { i: i, d: pointLen(points[i], r) }; })
			.reduce(function (prev, curr) { return (curr.d < prev.d ? curr : prev); });

		if (near.d > 10)
			return;

		index = near.i;

		var u = Object.keys(points)
			.map(function (i) { return { p: points[i], i: i }; })
			.filter(function (q) { q.i != index && pointEq(points[index], q.p) });
		if (u.length == 1)
			unizon = u[0].i;
	}
	_("c").onmouseup = function (e)
	{
		index = unizon = "";
	}
	_("c").onmousemove = function (e)
	{
		if (index == "")
			return;

		var q = { x: e.layerX, y: e.layerY };

		var i = index.split("-");
		glyph.seg[i[0]][i[1]] = q;
		if (unizon != "")
		{
			var j = unizon.split("-");
			glyph.seg[j[0]][j[1]] = q;
		}

		render();
	}
	_("glyph").onchange = function () { glyph = data[_("glyph").options[_("glyph").selectedIndex].text]; render(); };
	_("output").onclick = output;
	_("hide").onclick = function () { hide = !hide; render(); };
}

function render()
{
	var canvas = _("c");
	canvas.width = glyph.width;
	canvas.height = glyph.height;
	var context = canvas.getContext("2d");
	context.fillStyle = "#000";
	context.strokeStyle = "#0c0";

	for (var i = 0; i < glyph.seg.length; i++)
	{
		context.beginPath();
		glyph.seg[i].draw(context);
		context.fill();
		if (!hide)
			context.stroke();
	}

	drawInfo(context, glyph);
}

function output()
{
	var dat = _("c").toDataURL("image/png");

	_("out").innerHTML = "<img src=\"" + dat + "\"/><br/>length: " + dat.length;
}


function drawInfo(ctx, p)
{
	points = {};
	_("s").innerHTML = "";

	for (var i = 0; i < p.seg.length; i++)
	{
		var s = p.seg[i];

		if (!hide)
		{
			fillCircle(ctx, s.p0, "#00f");
			fillCircle(ctx, s.p1, "#00f");
		}
		points[i + "-p0"] = s.p0;
		points[i + "-p1"] = s.p1;

		if (s instanceof Bezier)
		{
			if (!hide)
			{
				strokeLine(ctx, s.p0, s.c1, "#00f");
				strokeLine(ctx, s.p1, s.c2, "#00f");
				fillCircle(ctx, s.c1, "#f00");
				fillCircle(ctx, s.c2, "#f00");
			}
			points[i + "-c1"] = s.c1;
			points[i + "-c2"] = s.c2;
			_("s").innerHTML += "Bezier " + s.p0.x + "," + s.p0.y + " to " + s.p1.x + "," + s.p1.y + "(" + s.c1.x + "," + s.c1.y + " " + s.c2.x + "," + s.c2.y + ")<br/>";
		}
		else if (s instanceof Line)
		{
			_("s").innerHTML += "Line " + s.p0.x + "," + s.p0.y + " to " + s.p1.x + "," + s.p1.y + "<br/>";
		}
	}

}


function _(id) { return document.getElementById(id); }

function fillCircle(ctx, pos, color)
{
	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI, false);
	ctx.fill();
}
function strokeLine(ctx, from, to, color)
{
	ctx.beginPath();
	ctx.strokeStyle = color;
	ctx.moveTo(from.x, from.y);
	ctx.lineTo(to.x, to.y);
	ctx.stroke();
}

function pointLen(p1, p2)
{
	return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
function pointEq(p1, p2)
{
	return p1.x == p2.x && p1.y == p2.y;
}
