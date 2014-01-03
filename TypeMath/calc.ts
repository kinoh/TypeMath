/// <reference path="formula.ts" />

class MathEx
{
	public static Log10Inv = 1 / Math.log(10);

	public static cosh(x: number): number
	{
		var y = Math.exp(x);
		return (y + 1 / y) / 2;
	}
	public static sinh(x: number): number
	{
		var y = Math.exp(x);
		return (y - 1 / y) / 2;
	}
	public static tanh(x: number): number
	{
		var y = Math.exp(2 * x);
		return (y - 1) / (y + 1);
	}
	public static coth(x: number): number
	{
		var y = Math.exp(2 * x);
		return (y + 1) / (y - 1);
	}
	public static csc(x: number): number
	{
		return 1 / Math.cos(x);
	}
	public static sec(x: number): number
	{
		return 1 / Math.sin(x);
	}
	public static cot(x: number): number
	{
		return 1 / Math.tan(x);
	}
	public static lg(x: number): number
	{
		return Math.log(x) * MathEx.Log10Inv;
	}
}

enum OperatorType
{
    Prefix,
    Suffix,
    Infix
}

interface Operator
{
	symbol: string;
	type: OperatorType;
	priority: number;
	func?: (x: number) => number;
}

class Numeric extends Token
{
	num: number;
	den: number;
	approx: boolean = false;

	public static Zero = new Numeric(0, 1, false);
	public static One = new Numeric(1, 1, false);

	get value()
	{
		return this.num / this.den;
	}

	public constructor(n: number, d: number, approx?: boolean)
	{
		super();
		this.num = d < 0 ? -n : n;
		this.den = Math.abs(d);
		if (approx !== undefined)
			this.approx = approx;
	}

	public static fromReal(n: number)
	{
		var s = n.toString();
		var i: number;

		if ((i = s.indexOf(".")) >= 0)
		{
			var x = parseFloat(s);
			var d = Math.pow(10, s.length - i);
			return new Numeric(n * d, d, true);
		}
		else
			return new Numeric(n, 1, true);
	}

	public toString(): string
	{
		return this.approx
			? (this.num / this.den).toString()
			: this.num.toString() + "/" + this.den.toString();
	}
}

class Calc
{
	public static eval(t: Token[]): Token
	{
		console.debug("eval start : " + t.toString());

		var r = Calc.evalSeq(t);

		console.debug("eval result : " + (r ? r.toString() : "no value"));

		if (r)
			return Calc.fromNumeric(r);
		else
			return null;
	}

	private static fromNumeric(t: Token): Token
	{
		if (t instanceof Numeric)
		{
			var n = <Numeric> t;
			if (!n.approx)
			{
				if (n.den == 1)
					return new Num(n.num.toString());

				var s = new Structure(null, StructType.Frac);
				s.elems[0] = new Formula(s);
				s.elems[0].tokens.push(new Num(n.num.toString()));
				s.elems[1] = new Formula(s);
				s.elems[1].tokens.push(new Num(n.den.toString()));
				return s;
			}
			else
			{
				return new Num(n.toString());
			}
		}
		else if (t instanceof Matrix)
		{
			var m = <Matrix> t;

			for (var i = 0; i < m.elems.length; i++)
			{
				m.elems[i].tokens = m.elems[i].tokens.map(Calc.fromNumeric);
			}

			return m;
		}

		return null;
	}

    private static operator: Operator[] = [
		{ symbol: "mod", type: OperatorType.Infix, priority: 0 },
		{ symbol: "+", type: OperatorType.Infix, priority: 1 },
		{ symbol: "-", type: OperatorType.Infix, priority: 1 },
		{ symbol: "*", type: OperatorType.Infix, priority: 2 },
		{ symbol: "/", type: OperatorType.Infix, priority: 2 },
		{ symbol: "+", type: OperatorType.Prefix, priority: 3 },
		{ symbol: "-", type: OperatorType.Prefix, priority: 3 },
		{ symbol: "arccos", type: OperatorType.Prefix, priority: 3, func: Math.acos },
		{ symbol: "arcsin", type: OperatorType.Prefix, priority: 3, func: Math.asin},
		{ symbol: "arctan", type: OperatorType.Prefix, priority: 3, func: Math.atan },
		//{ symbol: "arg", type: OperatorType.Prefix, priority: 3 },
		{ symbol: "cos", type: OperatorType.Prefix, priority: 3, func: Math.cos },
		{ symbol: "cosh", type: OperatorType.Prefix, priority: 3, func: MathEx.cosh },
		{ symbol: "cot", type: OperatorType.Prefix, priority: 3, func: MathEx.cot },
		{ symbol: "coth", type: OperatorType.Prefix, priority: 3, func: MathEx.coth },
		{ symbol: "csc", type: OperatorType.Prefix, priority: 3, func: MathEx.csc },
		//{ symbol: "det", type: OperatorType.Prefix, priority: 3 },
		{ symbol: "exp", type: OperatorType.Prefix, priority: 3, func: Math.exp },
		//{ symbol: "gcd", type: OperatorType.Prefix, priority: 3 },
		{ symbol: "lg", type: OperatorType.Prefix, priority: 3, func: MathEx.lg },
		{ symbol: "ln", type: OperatorType.Prefix, priority: 3, func: Math.log },
		{ symbol: "log", type: OperatorType.Prefix, priority: 3, func: Math.log },
		//{ symbol: "max", type: OperatorType.Prefix, priority: 3 },
		//{ symbol: "min", type: OperatorType.Prefix, priority: 3 },
		{ symbol: "sec", type: OperatorType.Prefix, priority: 3, func: MathEx.sec },
		{ symbol: "sin", type: OperatorType.Prefix, priority: 3, func: Math.sin },
		{ symbol: "sinh", type: OperatorType.Prefix, priority: 3, func: MathEx.sinh },
		{ symbol: "tan", type: OperatorType.Prefix, priority: 3, func: Math.tan },
		{ symbol: "tanh", type: OperatorType.Prefix, priority: 3, func: MathEx.tanh },
		{ symbol: "^", type: OperatorType.Infix, priority: 4 },
		{ symbol: "!", type: OperatorType.Suffix, priority: 5 },
		{ symbol: "(", type: OperatorType.Prefix, priority: Number.POSITIVE_INFINITY },
		{ symbol: "]", type: OperatorType.Prefix, priority: Number.POSITIVE_INFINITY },
		{ symbol: "}", type: OperatorType.Prefix, priority: Number.POSITIVE_INFINITY },
		{ symbol: ")", type: OperatorType.Suffix, priority: Number.POSITIVE_INFINITY },
		{ symbol: "]", type: OperatorType.Suffix, priority: Number.POSITIVE_INFINITY },
		{ symbol: "}", type: OperatorType.Suffix, priority: Number.POSITIVE_INFINITY }
	];
	private static checkType(symbol: string, type: OperatorType): boolean
	{
		return Calc.operator.some(o => o.symbol == symbol && o.type == type);
	}
	private static getOperator(symbol: string, type: OperatorType): Operator
	{
		for (var i = 0; i < Calc.operator.length; i++)
		{
			var o = Calc.operator[i];
			if (o.symbol == symbol && o.type == type)
				return o;
		}

		return null;
	}
	private static getPriority(symbol: string, type: OperatorType): number
	{
		var o = Calc.getOperator(symbol, type);
		return o !== null ? o.priority : -1;
	}

	private static evalSeq(t: Token[]): Token
	{
		var q: Token[] = [];

		for (var i = 0; i < t.length; i++)
		{
			var r: Token = null;

			if (t[i] instanceof Num)
			{
				var n = <Num> t[i];
				if (n.value.indexOf(".") >= 0)
				{
					r = Numeric.fromReal(parseFloat(n.value));
				}
				else
					r = new Numeric(parseInt(n.value), 1);
			}
			else if (t[i] instanceof Matrix)
			{
				var m = <Matrix> t[i];
				var x = new Matrix(null, m.rows, m.cols);
				for (var j = 0; j < m.elems.length; j++)
				{
					var f = new Formula(x);
					f.tokens[0] = Calc.evalSeq(m.elems[j].tokens);
					if (f.tokens[0] == null)
					{
						x = null;
						break;
					}
					x.elems[j] = f;
				}
				r = x;
			}
			else if (t[i] instanceof Structure)
			{
				var s = <Structure> t[i];

				switch (s.type)
				{
					case StructType.Frac:
						var num = Calc.evalSeq(s.elems[0].tokens);
						var den = Calc.evalSeq(s.elems[1].tokens);
						r = Calc.mul(num, den, true);
						break;
				}
			}
			else if (t[i] instanceof Formula)
			{
				var f = <Formula> t[i];

				r = Calc.evalSeq(f.tokens);

				if (f.prefix == "√" && f.suffix == "")
					r = Calc.realFunc(r, Math.sqrt);
				else if (f.prefix == "|" && f.suffix == "|"
					|| f.prefix == "‖" && f.suffix == "‖")
					r = Calc.norm(r);
				else if (f.prefix == "⌊" && f.suffix == "⌋")
					r = Calc.floor(r);
				else if (f.prefix == "⌈" && f.suffix == "⌉")
					r = Calc.ceil(r);
			}

			q[i] = (r !== null ? r : t[i]);
		}

		return Calc.evalSeqMain(q, 0, 0);
	}
	private static evalSeqMain(t: Token[], index: number, border: number): Token
	{
		var res: Token = null;
		var argc = 0;

		console.debug("evalSeqMain " + t.toString() + " " + index + " " + border);

		if (t.length == 0 || t.length <= index)
			return null;
		else if (t.length == 1)
			return t[0];

		if (t[index] instanceof Symbol)
		{
			var opr = Calc.getOperator((<Symbol> t[index]).str, OperatorType.Prefix);

			if (opr != null && opr.priority >= border)
			{
				if (opr.symbol == "(" || opr.symbol == "[" || opr.symbol == "{")
				{
					argc = 3;
					Calc.evalSeqMain(t, index + 1, 0);
					console.debug("eval br " + t.toString());
					res = t[index + 1];
				}
				else
				{
					argc = 2;
					Calc.evalSeqMain(t, index + 1, opr.priority + 1);
					if (opr.symbol == "-")
						res = Calc.negate(t[index + 1]);
					else if (opr.symbol == "+")
						res = t[index + 1];
					else if (opr.func)
						res = Calc.realFunc(t[index + 1], opr.func);
				}
			}
		}
		else if (t[index + 1] instanceof Symbol)
		{
			var o = <Symbol> t[index + 1];
			var p: number;

			if ((p = Calc.getPriority(o.str, OperatorType.Infix)) >= border)
			{
				argc = 3;
				Calc.evalSeqMain(t, index + 2, p + 1);
				if (o.str == "+")
					res = Calc.add(t[index], t[index + 2], false);
				else if (o.str == "-")
					res = Calc.add(t[index], t[index + 2], true);
				else if (o.str == "*" || o.str == "·" || o.str == "∙")
					res = Calc.mul(t[index], t[index + 2], false);
				else if (o.str == "/" || o.str == "÷")
					res = Calc.mul(t[index], t[index + 2], true);
				else if (o.str == "mod")
					res = Calc.mod(t[index], t[index + 2]);
			}
			else if ((p = Calc.getPriority(o.str, OperatorType.Suffix)) >= border)
			{
				argc = 2;
				Calc.evalSeqMain(t, index + 2, p + 1);
				if (o.str == "!")
					res = Calc.factorial(t[index]);
			}
			else if ((p = Calc.getPriority(o.str, OperatorType.Prefix)) >= border)
			{
				argc = 4;
				Calc.evalSeqMain(t, index + 2, 0);
				res = Calc.mul(t[index], t[index + 2], false);
			}
		}
		else if (t[index + 1] instanceof Structure
			&& (<Structure> t[index + 1]).type == StructType.Power)
		{
			var res: Token = null;
			var s = <Structure> t[index + 1];
			var p = Calc.getPriority("^", OperatorType.Infix);

			if (p >= border)
			{
				argc = 2;
				res = Calc.power(t[index], Calc.evalSeq(s.elems[0].tokens.slice(0)));
			}
		}
		else if (t.length - index >= 2)
		{
			var p = Calc.getPriority("*", OperatorType.Infix);
			if (p >= border)
			{
				argc = 2;
				Calc.evalSeqMain(t, index + 1, p + 1);
				res = Calc.mul(t[index], t[index + 1], false);
			}			
		}

		if (res !== null)
		{
			t.splice(index, argc, res);
			console.debug("eval res " + t.toString() + " " + index + " " + border);

			if (t.length - index > 1)
				Calc.evalSeqMain(t, index, 0);
		}
		else
		{
			console.debug("eval none");
		}
		return t.length == 1 ? t[0] : null;
	}

	private static add(x: Token, y: Token, sub: boolean): Token
	{
		if (x instanceof Formula && (<Formula> x).tokens.length == 1)
			x = (<Formula> x).tokens[0];
		if (y instanceof Formula && (<Formula> y).tokens.length == 1)
			y = (<Formula> y).tokens[0];

		console.debug((sub ? "sub" : "add") + " " + (x ? x.toString() : "?") + " " + (y ? y.toString() : "?"));

		if (x instanceof Numeric && y instanceof Numeric)
		{
			var m = <Numeric> x;
			var n = <Numeric> y;
			return new Numeric(m.num * n.den + (sub ? -n.num : n.num) * m.den, m.den * n.den, m.approx || n.approx);
		}
		else if (x instanceof Matrix && y instanceof Matrix)
		{
			var a = <Matrix> x;
			var b = <Matrix> y;
			if (a.rows == b.rows && a.cols == b.cols)
			{
				var r = new Matrix(null, a.rows, a.cols);
				for (var i = 0; i < a.count(); i++)
				{
					var s = Calc.add(a.elems[i], b.elems[i], sub);
					if (s === null)
						return null;

					r.elems[i] = new Formula(r);
					r.elems[i].tokens.push(s);
				}
			}
			return r;
		}

		return null;
	}
	private static mul(x: Token, y: Token, div: boolean): Token
	{
		if (x instanceof Formula && (<Formula> x).tokens.length == 1)
			x = (<Formula> x).tokens[0];
		if (y instanceof Formula && (<Formula> y).tokens.length == 1)
			y = (<Formula> y).tokens[0];

		console.debug((div ? "div" : "mul") + " " + (x ? x.toString() : "?") + " " + (y ? y.toString() : "?"));

		if (x instanceof Numeric && y instanceof Numeric)
		{
			var m = <Numeric> x;
			var n = <Numeric> y;
			return new Numeric(m.num * (div ? n.den : n.num), m.den * (div ? n.num : n.den), m.approx || n.approx);
		}
		else if (x instanceof Numeric && y instanceof Matrix && !div)
		{
			var b = <Matrix> y;
			var r = new Matrix(null, b.rows, b.cols);
			for (var i = 0; i < b.rows; i++)
			{
				for (var j = 0; j < b.cols; j++)
				{
					r.elems[i * b.cols + j] = new Formula(r);
					var s = Calc.mul(x, b.tokenAt(i, j), false);
					if (s === null)
						return null;
					r.elems[i * b.cols + j].tokens.push(s);
				}
			}
			return r;
		}
		else if (x instanceof Matrix && y instanceof Matrix)
		{
			var a = <Matrix> x;
			var b = <Matrix> y;
			if (a.cols == b.rows)
			{
				var r = new Matrix(null, a.rows, b.cols);
				for (var i = 0; i < a.rows; i++)
				{
					for (var j = 0; j < b.cols; j++)
					{
						r.elems[i * a.cols + j] = new Formula(r);
						var s = Calc.mul(a.tokenAt(i, 0), b.tokenAt(0, j), false);
						for (var k = 1; k < a.cols; k++)
						{
							s = Calc.add(s, Calc.mul(a.tokenAt(i, k), b.tokenAt(k, j), false), false);
							if (s == null)
								return null;
						}
						r.elems[i * b.cols + j].tokens.push(s);
					}
				}
			}
			return r;
		}

		return null;
	}
	private static mod(x: Token, y: Token): Token
	{
		if (x instanceof Formula && (<Formula> x).tokens.length == 1)
			x = (<Formula> x).tokens[0];
		if (y instanceof Formula && (<Formula> y).tokens.length == 1)
			y = (<Formula> y).tokens[0];

		if (x instanceof Numeric && y instanceof Numeric)
		{
			var m = <Numeric> x;
			var n = <Numeric> y;

			if (m.den == 1 && n.den == 1)
			{
				var r = m.num % n.num;
				if (r < 0)
					r += n.num;
				return new Numeric(r, 1, m.approx || n.approx);
			}
		}

		return null;
	}
	private static negate(x: Token): Token
	{
		if (x instanceof Numeric)
		{
			var n = <Numeric> x;
			return new Numeric(-n.num, n.den, n.approx);
		}
		else if (x instanceof Matrix)
		{
			var a = <Matrix> x;
			var r = new Matrix(null, a.rows, a.cols);
			for (var i = 0; i < a.rows; i++)
			{
				for (var j = 0; j < a.cols; j++)
				{
					r.elems[i * a.cols + j] = new Formula(r);
					var s = Calc.add(Numeric.Zero, a.tokenAt(i, j), true);
					if (s === null)
						return null;
					r.elems[i * a.cols + j].tokens.push(s);
				}
			}
			return r;
		}

		return null;
	}
	private static power(x: Token, y: Token): Token
	{
		if (x instanceof Numeric && y instanceof Numeric)
		{
			var a = <Numeric> x;
			var b = <Numeric> y;

			if (!a.approx && !b.approx && b.den == 1)
			{
				var ex = Math.abs(b.num);
				var p = Math.pow(a.num, ex);
				var q = Math.pow(a.den, ex);
				return b.num >= 0 ? new Numeric(p, q) : new Numeric(q, p);
			}

			return Numeric.fromReal(Math.pow(a.value, b.value));
		}
		else if (x instanceof Matrix && y instanceof Numeric)
		{
			var m = <Matrix> x;
			var b = <Numeric> y;

			if (!b.approx && b.num > 0 && b.den == 1)
			{
				var ex = Math.abs(b.num);
				var r: Token = m;
				for (var i = 1; i < ex; i++)
					r = Calc.mul(r, m, false);
				return r;
			}
		}

		return null;
	}
	private static realFunc(x: Token, f: (x: number) => number): Token
	{
		if (x instanceof Numeric)
		{
			var m = <Numeric> x;
			return Numeric.fromReal(f(m.value));
		}

		return null;
	}
	private static factorial(x: Token): Token
	{
		if (x instanceof Numeric)
		{
			var m = <Numeric> x;

			if (!m.approx && m.num >= 0 && m.den == 1)
			{
				var r = 1;
				for (var i = 2; i <= m.num; i++)
					r *= i;
				return new Numeric(r, 1, false);
			}
		}

		return null;
	}
	private static norm(x: Token): Token
	{
		if (x instanceof Numeric)
		{
			var m = <Numeric> x;
			return new Numeric(Math.abs(m.num), m.den, m.approx);
		}

		return null;
	}
	private static floor(x: Token): Token
	{
		if (x instanceof Numeric)
		{
			var m = <Numeric> x;
			return new Numeric(Math.floor(m.value), 1, m.approx);
		}

		return null;
	}
	private static ceil(x: Token): Token
	{
		if (x instanceof Numeric)
		{
			var m = <Numeric> x;
			return new Numeric(Math.ceil(m.value), 1, m.approx);
		}

		return null;
	}
	private static inverseMatrix(m: Matrix): Matrix
	{
		if (m.rows != m.cols)
			return null;

		var r = new Matrix(null, m.rows, m.rows);

	}
}