/// <reference path="formula.ts" />

enum ArrowStyle
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
	style: ArrowStyle;
	head: string;
}

class Diagram extends Matrix
{
	arrows: Arrow[];

	private static wavy: { [color: string]: HTMLCanvasElement } = {};
	private static interShaft = 3;

	constructor(parent: TokenSeq, rows: number, cols: number)
	{
		super(parent, rows, cols);

		this.type = StructType.Diagram;
		this.arrows = [];
	}

	public addArrow(from: number, to: number, num: number, style: ArrowStyle, head: string): void
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
	public removeArrow(from: number, to: number): void
	{
		for (var i = 0; i < this.arrows.length; i++)
		{
			var a = this.arrows[i];
			if (a.from.row * this.cols + a.from.col == from
				&& a.to.row * this.cols + a.to.col == to)
			{
				this.arrows.splice(i, 1);
				break;
			}
		}
	}
	public drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, color?: string): void
	{
		var a = this.tokenAt(arrow.from.row, arrow.from.col).renderedElem[0];
		var b = this.tokenAt(arrow.to.row, arrow.to.col).renderedElem[0];
		var rec1 = a.getBoundingClientRect();
		var rec2 = b.getBoundingClientRect();
		var ax = (rec1.left + rec1.right) / 2;
		var ay = (rec1.top + rec1.bottom) / 2;
		var bx = (rec2.left + rec2.right) / 2;
		var by = (rec2.top + rec2.bottom) / 2;

		ctx.save();
		ctx.beginPath();
		if (color)
			ctx.strokeStyle = color;

		ctx.translate(ax, ay);
		var dx = bx - ax;
		var dy = by - ay;
		var r = Math.sqrt(dx * dx + dy * dy);
		var adj = 3;	// for wavy arrow (pattern adjustment)
		ctx.rotate(Math.atan2(dy, dx));
		ctx.translate(0, -adj);

		ctx.save();

		switch (arrow.style)
		{
			case ArrowStyle.Dashed:
				Diagram.setLineDash(ctx, [5, 5]);
				break;
			case ArrowStyle.Dotted:
				Diagram.setLineDash(ctx, [1, 2]);
				break;
			case ArrowStyle.Wavy:
				ctx.strokeStyle = Diagram.wavyPattern(ctx, color);
				ctx.lineWidth = 6;
				break;
		}

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

	public clone(parent: TokenSeq): Matrix
	{
		var m = new Matrix(parent, this.rows, this.cols);
		this.elems.forEach((f, i) =>
		{
			m.elems[i] = f.clone(m);
		});
		return m;
	}
}