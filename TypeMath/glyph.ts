class Point
{
    x: number;
    y: number;
    
    constructor(x: number, y: number)
    {
        this.x = x;
        this.y = y;
    }

    static add(p: Point, q: Point): Point
    {
        return new Point(p.x + q.x, p.y + q.y);
    }
    static mul(a: number, p: Point): Point
    {
        return new Point(a * p.x, a * p.y);
    }
    static eq(p: Point, q: Point): boolean
    {
        return p.x == q.x && p.y == q.y;
    }

    public toString(): string
    {
        return "(" + this.x + "," + this.y + ")";
    }
}

class Segment
{
    p0: Point;
    p1: Point;
    weight: number;
    
    constructor(p0x: number, p0y: number, p1x: number, p1y: number, w: number)
    {
        this.p0 = new Point(p0x, p0y);
        this.p1 = new Point(p1x, p1y);
        this.weight = w;
    }
}
class Line extends Segment
{
    public toString(): string
    {
        return "line " + this.p0.toString() + " " + this.p1.toString();
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
        this.c1 = new Point(c1x, c1y);
        this.c2 = new Point(c2x, c2y);
        this.w0 = w0;
        this.w1 = w1;
    }

    public toString(): string
    {
        return "bezier " + this.p0.toString() + " " + this.p1.toString() + " ("
             + this.c1.toString() + " " + this.c2.toString() + ")";
    }
}

class Path
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

    public inverse(): Path
    {
        var r = new Path(this.width, this.height);

        for (var i = this.seg.length - 1; i >= 0; i--)
        {
            var s = this.seg[i];

            if (s instanceof Bezier)
            {
                var b = <Bezier> s;
                r.seg.push(new Bezier(b.p1.x, b.p1.y, b.p0.x, b.p0.y, b.c2.x, b.c2.y, b.c1.x, b.c1.y, b.w1, b.w0, b.weight));
            }
            else if (s instanceof Line)
                r.seg.push(new Line(s.p1.x, s.p1.y, s.p0.x, s.p0.y, s.weight));
        }

        return r;
    }
    public reflect(): Path
    {
        var r = new Path(this.width, this.height);
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

class Glyph
{
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    
    private data: { [key: string]: Path } = {};
    private cache: { [key: string]: string } = {};

    constructor(canvas: HTMLCanvasElement)
    {
        this.canvas = canvas;
        this.context = this.canvas.getContext("2d");

        this.data["("] = new Path(24, 64,
            new Bezier(20, 4, 20, 60, 4, 2, 4, 62, 0, 0, 4));
        this.data["{"] = new Path(24, 64,
            new Bezier(20, 4, 4, 32, 2, 2, 16, 32, 0, 0, 4),
            new Bezier(4, 32, 20, 60, 16, 32, 2, 62, 0, 0, 4));
        this.data["["] = new Path(24, 64,
            new Line(16, 4, 8, 4, 1),
            new Line(8, 4, 8, 60, 3),
            new Line(8, 60, 16, 60, 1));

        this.data[")"] = this.data["("].reflect();
        this.data["}"] = this.data["{"].reflect();
        this.data["]"] = this.data["["].reflect();
    }

    public generate(char: string): string
    {
        if (char in this.cache)
            return this.cache[char];
        else if (!(char in this.data))
            return "";

        var path = this.data[char];

        this.context.clearRect(0, 0, path.width, path.height);

        this.context.beginPath();
        this.context.fillStyle = "#000";

        var q = this.drawPath(path, null, false);
        this.drawPath(path, q, true);

        this.context.closePath();
        this.context.fill();

        var dat = this.canvas.toDataURL("image/png");

        this.cache[char] = dat;

        return dat;
    }
    private drawPath(p: Path, p0: Point, inv: boolean): Point
    {
        if (inv)
            p = p.inverse();

        var ctx = this.context;

	    for (var i = 0; i < p.seg.length; i++)
	    {
		    var s = p.seg[i];
		    var w = s.weight / 2.0;
            var w0, w1: number;
		    var d0, d1, dc: Point;
            var b: Bezier;

		    if (s instanceof Bezier)
		    {
                b = <Bezier> s;
			    var t0 = Math.atan2(b.c1.y - b.p0.y, b.c1.x - b.p0.x) + Math.PI / 2.0;
			    var t1 = Math.atan2(b.p0.y - b.c2.y, b.p0.x - b.c2.x) + Math.PI / 2.0;
			    var tc = Math.atan2(b.c2.y - b.c1.y, b.c2.x - b.c1.x) + Math.PI / 2.0;
	    	    w0 = b.w0 / 2.0;
    		    w1 = b.w1 / 2.0;
			    d0 = { x: w0 * Math.cos(t0), y: w0 * Math.sin(t0) };
			    d1 = { x: w1 * Math.cos(t1), y: w1 * Math.sin(t1) };
			    dc = { x: w * Math.cos(tc), y: w * Math.sin(tc) };
		    }
		    else if (s instanceof Line)
		    {
			    var t = Math.atan2(s.p1.y - s.p0.y, s.p1.x - s.p0.x) + Math.PI / 2.0;
	    	    w0 = w1 = s.weight / 2.0;
			    d0 = d1 = { x: w * Math.cos(t), y: w * Math.sin(t) };
		    }

		    var q0 = { x: s.p0.x + d0.x, y: s.p0.y + d0.y };
		    var q1 = { x: s.p1.x + d1.x, y: s.p1.y + d1.y };

		    if (p0 == null)
		    {
			    p0 = q0;
			    ctx.moveTo(q0.x, q0.y);
		    }
		    else if (!Point.eq(p0, q0))
		    {
			    p0 = q0;
			    ctx.lineTo(q0.x, q0.y);
		    }

		    if (s instanceof Bezier)
			    ctx.bezierCurveTo(b.c1.x + dc.x, b.c1.y + dc.y, b.c2.x + dc.x, b.c2.y + dc.y, q1.x, q1.y);
		    else if (s instanceof Line)
			    ctx.lineTo(q1.x, q1.y);

		    p0 = q1;
	    }

        return p0;
    }
}
