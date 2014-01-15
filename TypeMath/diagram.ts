﻿/// <reference path="formula.ts" />

enum StrokeStyle
{
	Plain,
	Dotted,
	Dashed,
	Wavy
}
enum LabelPosotion
{
	Left,
	Middle,
	Right
}

interface Arrow
{
	from: { row: number; col: number };
	to: { row: number; col: number };
	num: number;
	style: StrokeStyle;
	head: string;
	label: Formula;
	labelPos: LabelPosotion;
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
	decorations: Decoration[][];

	private static wavy: { [color: string]: HTMLCanvasElement } = {};
	private static interShaft = 3;

	constructor(parent: TokenSeq, rows: number, cols: number)
	{
		super(parent, rows, cols);

		this.type = StructType.Diagram;
		this.arrows = [];
		this.decorations = [];

		for (var i = 0; i < rows; i++)
			this.decorations.push([]);
	}

	public toggleFrame(index: number): void
	{
		var p = this.pos(index);

		if (this.decorations[p.row][p.col])
			this.decorations[p.row][p.col] = null;
		else
			this.decorations[p.row][p.col] = {
				size: 0, circle: false, double: false, style: StrokeStyle.Plain
			};
	}
	public alterFrameStyle(index: number, toggleCircle?: boolean, toggleDouble?: boolean, style?: StrokeStyle): void
	{
		var p = this.pos(index);

		if (!this.decorations[p.row][p.col])
			this.toggleFrame(index);

		if (toggleCircle)
			this.decorations[p.row][p.col].circle = !this.decorations[p.row][p.col].circle;
		if (toggleDouble)
			this.decorations[p.row][p.col].double = !this.decorations[p.row][p.col].double;
		if (style !== undefined)
			this.decorations[p.row][p.col].style = style;
	}
	public changeFrameSize(index: number, increase: boolean): void
	{
		var p = this.pos(index);

		if (!this.decorations[p.row][p.col])
			return;

		this.decorations[p.row][p.col].size += (increase ? 1 : -1);
	}

	public addArrow(from: number, to: number, num: number, style: StrokeStyle, head: string): number
	{
		var a: Arrow = {
			from: this.pos(from),
			to: this.pos(to),
			num: num,
			style: style,
			head: head,
			label: new Formula(this),
			labelPos: LabelPosotion.Left
		};
		var i = this.arrows.push(a);

		return i - 1;
	}
	public removeArrow(from: number, to: number, n: number): Arrow
	{
		var i = this.findArrow(from, to, n);

		return i >= 0 ? this.arrows.splice(i, 1)[0] : null;
	}
	public labelArrow(from: number, to: number, n: number, pos: LabelPosotion): Arrow
	{
		var i = this.findArrow(from, to, n);

		if (i < 0)
			return null;

		this.arrows[i].labelPos = pos;

		return this.arrows[i];
	}
	public findArrow(from: number, to: number, n: number): number
	{
		for (var i = 0; i < this.arrows.length; i++)
		{
			var a = this.arrows[i];
			if (a.from.row * this.cols + a.from.col == from
				&& a.to.row * this.cols + a.to.col == to
				&& n-- == 0)
				return i;
		}

		return -1;
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

				if (this.decorations[i1 + i][j1 + j])
				{
					d.decorations[i][j] = this.decorations[i1 + i][j1 + j];
					if (erase)
						this.decorations[i1 + i][j1 + j] = null;
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
					num: a.num, style: a.style, head: a.head, label: a.label.clone(d), labelPos: a.labelPos
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
			var x = rect.left - 3 * deco.size;
			var y = rect.top - 3 * deco.size;
			var w = rect.width + 6 * deco.size;
			var h = rect.height + 6 * deco.size;
			ctx.strokeRect(x, y, w, h);
			if (deco.double)
				ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
		}

		ctx.restore();
	}
	public drawArrow(ctx: CanvasRenderingContext2D, label: JQuery, arrow: Arrow, color?: string): void
	{
		var len = (x, y) => Math.sqrt(x * x + y * y);

		var a = this.tokenAt(arrow.from.row, arrow.from.col).renderedElem[0];
		var b = this.tokenAt(arrow.to.row, arrow.to.col).renderedElem[0];
		var rec1 = a.getBoundingClientRect();
		var rec2 = b.getBoundingClientRect();
		var scrollx = document.documentElement.scrollLeft || document.body.scrollLeft;
		var scrolly = document.documentElement.scrollTop || document.body.scrollTop;
		var acx = (rec1.left + rec1.right) / 2;
		var acy = (rec1.top + rec1.bottom) / 2;
		var bcx = (rec2.left + rec2.right) / 2;
		var bcy = (rec2.top + rec2.bottom) / 2;
		var dx = bcx - acx;
		var dy = bcy - acy;
		var rc = len(dx, dy);

		var dec1 = this.decorations[arrow.from.row][arrow.from.col];
		var dec2 = this.decorations[arrow.to.row][arrow.to.col];

		var ax, ay: number;
		var bx, by: number;
		if (dec1 && dec1.circle)
		{
			var r1 = Math.max(rec1.width, rec1.height) / 2 + 3 * (dec1.size - 2);
			ax = acx + r1 * dx / rc;
			ay = acy + r1 * dy / rc;
		}
		else if (dy / dx < rec1.height / rec1.width && dy / dx > -rec1.height / rec1.width)
		{
			var sgn = (dx > 0 ? 1 : -1);
			var w = rec1.width / 2 + 3 * (dec1 ? dec1.size : 0);
			ax = acx + sgn * w;
			ay = acy + sgn * dy / dx * w;
		}
		else
		{
			var sgn = (dy > 0 ? 1 : -1);
			var h = rec1.height / 2 + 3 * (dec1 ? dec1.size : 0);
			ax = acx + sgn * dx / dy * h;
			ay = acy + sgn * h;
		}
		var r = len(bcx - ax, bcy - ay);
		if (dec2 && dec2.circle)
			r -= Math.max(rec2.width, rec2.height) / 2 + 3 * (dec2.size - 2);
		else if (dy / dx < rec2.height / rec2.width && dy / dx > -rec2.height / rec2.width)
			r -= (rec2.width / 2 + 3 * (dec2 ? dec2.size : 0)) * Math.sqrt(1 + dy * dy / (dx * dx));
		else
			r -= (rec2.height / 2 + 3 * (dec2 ? dec2.size : 0)) * Math.sqrt(1 + dx * dx / (dy * dy));

		ctx.save();
		if (color)
			ctx.strokeStyle = color;
		ctx.beginPath();

		ctx.translate(ax + scrollx, ay + scrolly);
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

		if (arrow.label !== null && label !== null)
		{
			var frec = $("#field")[0].getBoundingClientRect();
			var lrec = arrow.label.renderedElem[0].getBoundingClientRect();
			var ldiag = Math.sqrt(lrec.width * lrec.width + lrec.height * lrec.height) / 2;
			var x = (acx + bcx) / 2 - lrec.width / 2;
			var y = (acy + bcy) / 2 - lrec.height / 2;

			if (arrow.labelPos != LabelPosotion.Middle)
			{
				var t = Math.atan2(-dy, dx)
					+ (arrow.labelPos == LabelPosotion.Left ? 1 : -1) * Math.PI / 2;
				x += (lrec.width + 2) / 2 * Math.cos(t);
				y -= lrec.height / 2 * Math.sin(t);
			}
			else
			{
				ctx.fillStyle = "#fff";
				ctx.fillRect(x - scrollx, y - scrolly, lrec.width + 2, lrec.height);
			}

			label.css({
				"left": x - frec.left,
				"top": y - frec.top
			});
		}
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

	public extend(horizontal: boolean): void
	{
		if (!horizontal)
			this.decorations.push([]);

		super.extend(horizontal);
	}
	public shrink(horizontal: boolean): void
	{
		if (horizontal)
			this.decorations.forEach(r => r.splice(this.cols - 1, 1));
		if (!horizontal)
			this.decorations.pop();

		super.shrink(horizontal);
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
				this.decorations[p.row + i][p.col + j] = d.decorations[i][j];
		d.arrows.forEach(a =>
		{
			var b: Arrow = {
				from: { row: a.from.row + p.row, col: a.from.col + p.col },
				to: { row: a.to.row + p.row, col: a.to.col + p.col },
				num: a.num, style: a.style, head: a.head, label: a.label.clone(this), labelPos: a.labelPos
			};
			this.arrows.push(b);
		});

		return n;
	}
	public clone(parent: TokenSeq): Diagram
	{
		return this.cloneRect(0, 0, this.rows - 1, this.cols - 1, false);
	}
	public nonEmpty(i0: number, j0: number, rows: number, cols: number): boolean
	{
		return super.nonEmpty(i0, j0, rows, cols)
			|| this.decorations.some((r, i) =>
				r.some((d, j) =>
					i >= i0 && i - i0 < rows && j >= j0 && j - j0 < cols
				))
			|| this.arrows.some(a =>
				a.from.row >= i0 && a.from.row - i0 < rows && a.from.col >= j0 && a.from.col - j0 < cols
				|| a.to.row >= i0 && a.to.row - i0 < rows && a.to.col >= j0 && a.to.col - j0 < cols);
	}
	public toString(): string
	{
		return "Diagram" + this.rows + "," + this.cols
			+ "(a:" + this.arrows.length + ",d:" + this.decorations.reduce<number>((s, r) => s + r.filter(d => d ? true : false).length, 0)
			+ ")[" + this.elems.map(f => f.toString()).join(", ") + "]";
	}
}