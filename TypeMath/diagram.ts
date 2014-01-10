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
	from: number;
	to: number;
	num: number;
	style: ArrowStyle;
	head: string;
}

class Diagram extends Matrix
{
	arrows: Arrow[];

	private static wavy: HTMLCanvasElement;
	private static interShaft = 3;

	constructor(parent: TokenSeq, rows: number, cols: number)
	{
		super(parent, rows, cols);

		this.type = StructType.Diagram;
		this.arrows = [];

 	}

	public addArrow(a: Arrow): void
	{
		this.arrows.push(a);
	}
	public drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, color?: string): void
	{
		var a = this.elems[arrow.from].renderedElem[0];
		var b = this.elems[arrow.to].renderedElem[0];
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
				this.setLineDash(ctx, [5, 5]);
				break;
			case ArrowStyle.Dotted:
				this.setLineDash(ctx, [1, 2]);
				break;
			case ArrowStyle.Wavy:
				ctx.strokeStyle = ctx.createPattern(Diagram.wavy, "repeat-x");
				ctx.lineWidth = 6;
				break;
		}

		var y = adj - Diagram.interShaft * (arrow.num - 1) / 2;
		for (var i = 0; i < arrow.num; i++)
		{
			ctx.moveTo(0, y);
			ctx.lineTo(r, y);
			y += Diagram.interShaft;
		}

		ctx.stroke();
		ctx.restore();
		var headOpen = 3 * arrow.num;

		switch (arrow.head)
		{
			case ">":
				ctx.beginPath();
				ctx.moveTo(r, adj);
				ctx.lineTo(r - 10, adj - headOpen);
				ctx.moveTo(r, adj);
				ctx.lineTo(r - 10, adj + headOpen);
				ctx.stroke();
				break;
		}

		ctx.restore();
	}

	private setLineDash(ctx: CanvasRenderingContext2D, a: number[]): void
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