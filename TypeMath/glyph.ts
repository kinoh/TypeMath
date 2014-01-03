interface Point
{
    x: number;
    y: number;
}

class Segment
{
    p0: Point;
    p1: Point;
    weight: number;

	constructor(p0x: number, p0y: number, p1x: number, p1y: number, w: number)
    {
		this.p0 = { x: p0x, y: p0y };
		this.p1 = { x: p1x, y: p1y };
        this.weight = w;
	}

	public draw(ctx: CanvasRenderingContext2D): void
	{
		console.error("[Segment.draw] draw method not implemented");
	}
}
class Line extends Segment
{
    public toString(): string
    {
        return "line " + this.p0.toString() + " " + this.p1.toString();
	}

	public draw(ctx: CanvasRenderingContext2D): void
	{
		var w = this.weight / 2.0;
		var d0, d1: Point;
		
		var t = Math.atan2(this.p1.y - this.p0.y, this.p1.x - this.p0.x) + Math.PI / 2.0;
		d0 = d1 = { x: w * Math.cos(t), y: w * Math.sin(t) };

		ctx.moveTo(this.p0.x + d0.x, this.p0.y + d0.y);
		ctx.lineTo(this.p1.x + d1.x, this.p1.y + d1.y);
		ctx.lineTo(this.p1.x - d1.x, this.p1.y - d1.y);
		ctx.lineTo(this.p0.x - d0.x, this.p0.y - d0.y);
		ctx.closePath();
	}
}
class Bezier extends Segment
{
    c1: Point;
    c2: Point;
    w0: number;
    w1: number;

    constructor(p0x: number, p0y: number, p1x: number, p1y: number,
        c1x: number, c1y: number, c2x: number, c2y: number,
        w0: number, w1: number, w: number)
    {
        super(p0x, p0y, p1x, p1y, w);
		this.c1 = { x: c1x, y: c1y };
		this.c2 = { x: c2x, y: c2y };
        this.w0 = w0;
        this.w1 = w1;
    }

	public draw(ctx: CanvasRenderingContext2D): void
	{
		var w = this.weight / 2.0;
		var w0, w1: number;
		var d0, d1, dc: Point;

		var t0 = Math.atan2(this.c1.y - this.p0.y, this.c1.x - this.p0.x) + Math.PI / 2.0;
		var t1 = Math.atan2(this.p0.y - this.c2.y, this.p0.x - this.c2.x) + Math.PI / 2.0;
		var tc = Math.atan2(this.c2.y - this.c1.y, this.c2.x - this.c1.x) + Math.PI / 2.0;
		w0 = this.w0 / 2.0;
		w1 = this.w1 / 2.0;
		d0 = { x: w0 * Math.cos(t0), y: w0 * Math.sin(t0) };
		d1 = { x: w1 * Math.cos(t1), y: w1 * Math.sin(t1) };
		dc = { x: w * Math.cos(tc), y: w * Math.sin(tc) };
		
		ctx.moveTo(this.p0.x + d0.x, this.p0.y + d0.y);
		ctx.bezierCurveTo(this.c1.x + dc.x, this.c1.y + dc.y, this.c2.x + dc.x, this.c2.y + dc.y,
			this.p1.x + d1.x, this.p1.y + d1.y);
		ctx.lineTo(this.p1.x - d1.x, this.p1.y - d1.y);
		ctx.bezierCurveTo(this.c2.x - dc.x, this.c2.y - dc.y, this.c1.x - dc.x, this.c1.y - dc.y,
			this.p0.x - d0.x, this.p0.y - d0.y);
		ctx.closePath();
	}

    public toString(): string
    {
        return "bezier " + this.p0.toString() + " " + this.p1.toString() + " ("
             + this.c1.toString() + " " + this.c2.toString() + ")";
    }
}

class Glyph
{
    seg: Segment[];
    width: number;
    height: number;

    constructor(w: number, h: number, ...s: Segment[])
    {
        this.width = w;
        this.height = h;
        this.seg = s;
    }
    public toString(): string
    {
        return this.seg.map(s => s.toString()).join("\n");
    }

    public reflect(): Glyph
    {
        var r = new Glyph(this.width, this.height);
        var w = r.width;

        for (var i = 0; i < this.seg.length; i++)
        {
            var s = this.seg[i];

            if (s instanceof Bezier)
            {
                var b = <Bezier> s;
                r.seg.push(new Bezier(w - b.p0.x, b.p0.y, w - b.p1.x, b.p1.y, w - b.c1.x, b.c1.y, w - b.c2.x, b.c2.y, b.w0, b.w1, b.weight));
            }
            else if (s instanceof Line)
                r.seg.push(new Line(w - s.p0.x, s.p0.y, w - s.p1.x, s.p1.y, s.weight));
        }

        return r;
    }
}

class GlyphFactory
{
    private canvas: HTMLCanvasElement;
    
    private data: { [key: string]: Glyph } = {};
    private cache: { [key: string]: string } = {};

    constructor(canvas: HTMLCanvasElement)
    {
        this.canvas = canvas;

        this.data["("] = new Glyph(24, 64,
            new Bezier(20, 4, 20, 60, 4, 2, 4, 62, 0, 0, 4));
        this.data["{"] = new Glyph(24, 64,
            new Bezier(20, 4, 4, 32, 2, 0, 16, 32, 0, 0, 5),
            new Bezier(4, 32, 20, 60, 16, 32, 2, 64, 0, 0, 5));
        this.data["["] = new Glyph(24, 64,
            new Line(16, 4, 8, 4, 1),
            new Line(8, 4, 8, 60, 2.5),
            new Line(8, 60, 16, 60, 1));
        this.data["|"] = new Glyph(24, 64,
            new Line(12, 4, 12, 60, 2));
        this.data["‖"] = new Glyph(24, 64,
            new Line(9, 4, 9, 60, 2),
            new Line(16, 4, 16, 60, 2));
		this.data["⌊"] = new Glyph(24, 64,
			new Line(8, 4, 8, 60, 3),
			new Line(8, 60, 16, 60, 1));
		this.data["⌈"] = new Glyph(24, 64,
			new Line(16, 4, 8, 4, 1),
			new Line(8, 4, 8, 60, 3));
		this.data["〈"] = new Glyph(24, 64,
			new Line(16, 4, 8, 32, 2),
			new Line(8, 32, 16, 60, 2));
		this.data["√"] = new Glyph(32, 64,
			new Line(7, 48, 9, 40, 2),
			new Line(9, 40, 15, 56, 3),
			new Line(15, 56, 31, 0, 2));

		this.data[")"] = this.data["("].reflect();
        this.data["}"] = this.data["{"].reflect();
		this.data["]"] = this.data["["].reflect();
		this.data["⌋"] = this.data["⌊"].reflect();
		this.data["⌉"] = this.data["⌈"].reflect();
		this.data["〉"] = this.data["〈"].reflect();
    }

    public generate(char: string): string
    {
        if (char in this.cache)
            return this.cache[char];
        else if (!(char in this.data))
            return "";

        var glyph = this.data[char];

		this.canvas.width = glyph.width;
		this.canvas.height = glyph.height;
		var context = this.canvas.getContext("2d");
        context.fillStyle = "#000";

		for (var i = 0; i < glyph.seg.length; i++)
		{
			context.beginPath();
			glyph.seg[i].draw(context);
			context.fill();
		}

        var dat = this.canvas.toDataURL("image/png");

        this.cache[char] = dat;

        return dat;
    }
}
