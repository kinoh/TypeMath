/// <reference path="formula.ts" />

enum StrokeStyle
{
	Plain,
	Dotted,
	Dashed,
	Wavy
}

interface Arrow
{
	from: { row: number; col: number };
	to: { row: number; col: number };
	num: number;
	style: StrokeStyle;
	head: string;
}

interface Decoration
{
	size: number;
	circle: boolean;
	double: boolean;
	style: StrokeStyle;
}

class Diagram extends Matrix
{
	arrows: Arrow[];
	decolations: Decoration[];

	private static wavy: { [color: string]: HTMLCanvasElement } = {};
	private static interShaft = 3;

	constructor(parent: TokenSeq, rows: number, cols: number)
	{
		super(parent, rows, cols);

		this.type = StructType.Diagram;
		this.arrows = [];
		this.decolations = [];
	}

	public decorationAt(r: number, c: number, value?: Decoration): Decoration
	{
		var i = r * this.cols + c;

		if (r < 0 || r >= this.rows || c < 0 || c >= this.cols)
		{
			console.error("[Diagram.decorationAt] out of range : " + r + "," + c);
			return null;
		}
		else if (value)
			return this.decolations[i] = value;
		else if (i in this.decolations)
			return this.decolations[i];
		else
			return null;
	}

	public toggleFrame(index: number): void
	{
		if (index in this.decolations)
			this.decolations.splice(index, 1);
		else
			this.decolations[index] = {
				size: 0, circle: false, double: false, style: StrokeStyle.Plain
			};
	}
	public alterFrameStyle(index: number, toggleCircle?: boolean, toggleDouble?: boolean, style?: StrokeStyle): void
	{
		if (!(index in this.decolations))
			this.toggleFrame(index);

		if (toggleCircle)
			this.decolations[index].circle = !this.decolations[index].circle;
		if (toggleDouble)
			this.decolations[index].double = !this.decolations[index].double;
		if (style !== undefined)
			this.decolations[index].style = style;
	}
	public changeFrameSize(index: number, increase: boolean): void
	{
		if (!(index in this.decolations))
			return;

		this.decolations[index].size += (increase ? 1 : -1);
	}

	public addArrow(from: number, to: number, num: number, style: StrokeStyle, head: string): void
	{
		var a: Arrow = {
			from: this.pos(from),
			to: this.pos(to),
			num: num,
			style: style,
			head: head
		};
		this.arrows.push(a);
	}
	public removeArrow(from: number, to: number): Arrow
	{
		for (var i = 0; i < this.arrows.length; i++)
		{
			var a = this.arrows[i];
			if (a.from.row * this.cols + a.from.col == from
				&& a.to.row * this.cols + a.to.col == to)
			{
				this.arrows.splice(i, 1);
				return a;
			}
		}

		return null;
	}
	public cloneArea(from: number, to: number, erase: boolean): Diagram
	{
		return <Diagram> super.cloneArea(from, to, erase);
	}
	public cloneRect(i1: number, j1: number, i2: number, j2: number, erase: boolean): Diagram
	{
		var d = new Diagram(null, i2 - i1 + 1, j2 - j1 + 1);

		for (var i = 0; i < d.rows; i++)
			for (var j = 0; j < d.cols; j++)
			{
				d.tokenAt(i, j, this.tokenAt(i + i1, j + j1).clone(d));
				if (erase)
					this.tokenAt(i + i1, j + j1, new Formula(this));

				var k = (i1 + i) * this.cols + (j1 + j);
				if (k in this.decolations)
				{
					d.decorationAt(i, j, erase
						? this.decolations.splice(k, 1)[0] : this.decolations[k]);
				}
			}

		for (var i = 0; i < this.arrows.length; i++)
		{
			var a = this.arrows[i];
			var start = a.from.row >= i1 && a.from.row <= i2 && a.from.col >= j1 && a.from.col <= j2;
			var end = a.to.row >= i1 && a.to.row <= i2 && a.to.col >= j1 && a.to.col <= j2;

			if (!erase && start && end)
			{
				var b: Arrow = {
					from: { row: a.from.row - i1, col: a.from.col - i1 },
					to: { row: a.to.row - i1, col: a.to.col - i1 },
					num: a.num, style: a.style, head: a.head
				};
				d.arrows.push(b);
			}
			else if (erase && (start || end))
			{
				a.from.row -= i1;
				a.from.col -= j1;
				a.to.row -= i1;
				a.to.col -= j1;
				d.arrows.push(a);
				this.arrows.splice(i, 1)[0];
				i--;
			}
		}

		return d;
	}

	public drawFrame(ctx: CanvasRenderingContext2D, index: number, deco: Decoration, color?: string): void
	{
		var a = this.elems[index].renderedElem[0];
		var rect = a.getBoundingClientRect();

		ctx.save();

		Diagram.setStyle(ctx, deco.style, color);
		if (color)
			ctx.strokeStyle = color;

		if (deco.circle)
		{
			ctx.beginPath();

			var x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
			var r = Math.max(rect.width, rect.height) / 2 + 3 * (deco.size - 2);
			ctx.arc(x, y, r, 0, 2 * Math.PI);
			if (deco.double)
				ctx.arc(x, y, r - 3, 0, 2 * Math.PI);

			ctx.stroke();
		}
		else
		{
			var w = rect.width + 6 * deco.size;
			var h = rect.height + 6 * deco.size;
			ctx.strokeRect(rect.left, rect.top, w, h);
			if (deco.double)
				ctx.strokeRect(rect.left + 3, rect.top + 3, w - 6, h - 6);
		}

		ctx.restore();
	}
	public drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, color?: string): void
	{
		var a = this.tokenAt(arrow.from.row, arrow.from.col).renderedElem[0];
		var b = this.tokenAt(arrow.to.row, arrow.to.col).renderedElem[0];
		var rec1 = a.getBoundingClientRect();
		var rec2 = b.getBoundingClientRect();
		var scrollx = document.documentElement.scrollLeft || document.body.scrollLeft;
		var scrolly = document.documentElement.scrollTop || document.body.scrollTop;
		var ax = (rec1.left + rec1.right) / 2;
		var ay = (rec1.top + rec1.bottom) / 2;
		var bx = (rec2.left + rec2.right) / 2;
		var by = (rec2.top + rec2.bottom) / 2;

		ctx.save();
		if (color)
			ctx.strokeStyle = color;
		ctx.beginPath();

		ctx.translate(ax + scrollx, ay + scrolly);
		var dx = bx - ax;
		var dy = by - ay;
		var r = Math.sqrt(dx * dx + dy * dy);
		var adj = 3;	// for wavy arrow (pattern adjustment)
		ctx.rotate(Math.atan2(dy, dx));
		ctx.translate(0, -adj);

		ctx.save();
		Diagram.setStyle(ctx, arrow.style, color);

		var headOpen = 1 + 3 * arrow.num;
		var y = adj - Diagram.interShaft * (arrow.num - 1) / 2;
		for (var i = 0; i < arrow.num; i++)
		{
			ctx.moveTo(0, y);
			ctx.lineTo(r - 14 / headOpen * Diagram.interShaft * Math.abs(i - (arrow.num - 1) / 2), y);
			y += Diagram.interShaft;
		}

		ctx.stroke();
		ctx.restore();

		switch (arrow.head)
		{
			case ">":
				ctx.beginPath();
				ctx.moveTo(r, adj);
				ctx.bezierCurveTo(r - 5, adj, r - 8, adj - headOpen / 2, r - 10, adj - headOpen);
				ctx.moveTo(r, adj);
				ctx.bezierCurveTo(r - 5, adj, r - 8, adj + headOpen / 2, r - 10, adj + headOpen);
				ctx.stroke();
				break;
		}

		ctx.restore();
	}
	private static setStyle(ctx: CanvasRenderingContext2D, style: StrokeStyle, color: string): void
	{
		switch (style)
		{
			case StrokeStyle.Dashed:
				Diagram.setLineDash(ctx, [5, 5]);
				break;
			case StrokeStyle.Dotted:
				Diagram.setLineDash(ctx, [2, 2]);
				break;
			case StrokeStyle.Wavy:
				ctx.strokeStyle = Diagram.wavyPattern(ctx, color);
				ctx.lineWidth = 6;
				break;
		}
	}
	private static wavyPattern(ctx: CanvasRenderingContext2D, color?: string): CanvasPattern
	{
		if (color === undefined)
			color = "#000";

		if (!(color in Diagram.wavy))
		{
			var canv = document.createElement("canvas");
			canv.width = 12;
			canv.height = 6;
			var c = canv.getContext("2d");
			c.strokeStyle = color;
			c.beginPath();
			c.moveTo(0, 3);
			c.bezierCurveTo(4, -2, 8, 8, 12, 3);
			c.stroke();

			Diagram.wavy[color] = canv;
		}

		return ctx.createPattern(Diagram.wavy[color], "repeat-x");
	}
	private static setLineDash(ctx: CanvasRenderingContext2D, a: number[]): void
	{
		if (ctx.setLineDash !== undefined)
			ctx.setLineDash(a);
		else if (ctx["mozDash"] !== undefined)
			ctx["mozDash"] = a;
	}

	public paste(index: number, tokens: Token[]): number
	{
		var n = super.paste(index, tokens);

		if (tokens.length != 1 || !(tokens[0] instanceof Diagram))
			return n;

		var d = <Diagram> tokens[0];
		var p = this.pos(index);
		var r = Math.min(d.rows, this.rows - p.row);
		var c = Math.min(d.cols, this.cols - p.col);
		for (var i = 0; i < r; i++)
			for (var j = 0; j < c; j++)
				this.decorationAt(p.row + i, p.col + j, d.decorationAt(i, j));
		d.arrows.forEach(a =>
		{
			var b: Arrow = {
				from: { row: a.from.row + p.row, col: a.from.col + p.col },
				to: { row: a.to.row + p.row, col: a.to.col + p.col },
				num: a.num, style: a.style, head: a.head
			};
			this.arrows.push(b);
		});

		return n;
	}
	public clone(parent: TokenSeq): Matrix
	{
		var m = new Matrix(parent, this.rows, this.cols);
		this.elems.forEach((f, i) =>
		{
			m.elems[i] = f.clone(m);
		});
		return m;
	}
	public toString(): string
	{
		return "Diagram" + this.rows + "," + this.cols + "(a:" + this.arrows.length + ",d:" + Object.keys(this.decolations).length + ")[" + this.elems.map(f => f.toString()).join(", ") + "]";
	}
}