class Util
{
	public static groupBy<T1, T2>(a: T1[], f: (x: T1) => T2): T1[][]
	{
		var r: T1[][] = [];
		var b = a.map(x => ({ key: x, value: f(x) }));

		while (b.length > 0)
		{
			var p = b.shift();
			var s: T1[] = [p.key];
			for (var j = 0; j < b.length; j++)
				if (b[j].value == p.value)
					s.push(b.splice(j--, 1)[0].key);
			r.push(s);
		}

		return r;
	}
	public static concat<T>(a: T[][]): T[]
	{
		return a.reduce((ac, x) => ac.concat(x), []);
	}
	public static repeat<T>(elem: T, count: number): T[]
	{
		return Util.num(count).map(() => elem);
	}
	public static num(count: number): number[]
	{
		return Util.range(0, count);
	}
	public static range(from: number, count: number, step?: number): number[]
	{
		var r: number[] = [];

		if (step === undefined)
			step = 1;

		for (var i = 0; i < count; i++)
			r.push(from + i * step);

		return r;
	}
	public static normSquared(x: number, y: number): number
	{
		return x * x + y * y;
	}
}
