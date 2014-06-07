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
	public static negate(n: Numeric): Numeric
	{
		return new Numeric(-n.num, n.den, n.approx);
	}
	public static add(m: Numeric, n: Numeric): Numeric
	{
		return new Numeric(
			m.num * n.den + n.num * m.den, m.den * n.den,
			m.approx || n.approx);
	}
	public static sub(m: Numeric, n: Numeric): Numeric
	{
		return new Numeric(
			m.num * n.den + -n.num * m.den, m.den * n.den,
			m.approx || n.approx);
	}
	public static mul(m: Numeric, n: Numeric): Numeric
	{
		return new Numeric(m.num * n.num, m.den * n.den, m.approx || n.approx);
	}
	public static div(m: Numeric, n: Numeric): Numeric
	{
		return new Numeric(m.num * n.den, m.den * n.num, m.approx || n.approx);
	}
	public static fromReal(n: number): Numeric
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
class Term
{
	coeff: Numeric;
	exponent: { [key: string]: number };
	n: number;

	public constructor(coeff: Numeric, exponent: { [key: string]: number })
	{
		this.coeff = coeff;
		this.exponent = exponent;
		this.n = Object.keys(exponent).length;
	}
	public porpotionalTo(t: Term): boolean
	{
		if (t.n != this.n)
			return false;

		for (var x in this.exponent)
			if (!(x in t.exponent && t.exponent[x] == this.exponent[x]))
				return false;

		return true;
	}

	public toString(): string
	{
		var str = this.coeff.toString();

		for (var x in this.exponent)
			str += x + "^" + this.exponent[x];

		return str;
	}
}
class Polynomial extends Token
{
	term: Term[] = [];

	public constructor(term: Term[])
	{
		super();

		var f: { [key: string]: number } = {};

		this.term = term;
	}
	public static fromSymbol(s: Symbol): Polynomial
	{
		var f: { [key: string]: number } = {};
		f[s.str] = 1;
		var t = new Term(Numeric.One, f);
		return new Polynomial([t]);
	}
	public static fromNumeric(n: Numeric): Polynomial
	{
		var t = new Term(n, {});
		return new Polynomial([t]);
	}
	public static negate(p: Polynomial): Polynomial
	{
		return new Polynomial(p.term.map(t => new Term(Numeric.negate(t.coeff), t.exponent)));
	}
	private static additionImpl(p: Polynomial, q: Polynomial, sub: boolean): Polynomial
	{
		var t: Term[] = [];

		for (var i = 0; i < p.term.length; i++)
			t.push(p.term[i]);

		for (var j = 0; j < q.term.length; j++)
		{
			var a = q.term[j];
			var found = false;
			for (var i = 0; i < t.length; i++)
			{
				if (a.porpotionalTo(t[i]))
				{
					t[i].coeff = sub
						? Numeric.sub(t[i].coeff, a.coeff)
						: Numeric.add(t[i].coeff, a.coeff);
					found = true;
					break;
				}
			}
			if (!found)
				t.push(a);
		}

		for (var i = 0; i < t.length; i++)
			if (!t[i].coeff.approx && t[i].coeff.value == 0)
				t.splice(i--, 1);

		return new Polynomial(t);
	}
	public static add(p: Polynomial, q: Polynomial): Polynomial
	{
		return Polynomial.additionImpl(p, q, false);
	}
	public static sub(p: Polynomial, q: Polynomial): Polynomial
	{
		return Polynomial.additionImpl(p, q, true);
	}
	private static multiplyImpl(p: Polynomial, q: Polynomial, div: boolean): Polynomial
	{
		var t: Term[] = [];

		for (var i = 0; i < p.term.length; i++)
		{
			for (var j = 0; j < q.term.length; j++)
			{
				var c = Numeric.mul(p.term[i].coeff, q.term[j].coeff);
				var f: { [key: string]: number } = {};
				for (var x in p.term[i].exponent)
					f[x] = p.term[i].exponent[x];
				for (var x in q.term[j].exponent)
				{
					if (x in f)
						f[x] += q.term[j].exponent[x];
					else
						f[x] = q.term[j].exponent[x];
				}
				for (var x in f)
				{
					if (f[x] == 0)
						delete f[x];
				}
				t.push(new Term(c, f));
			}
		}

		return new Polynomial(t);
	}
	public static mul(p: Polynomial, q: Polynomial): Polynomial
	{
		return Polynomial.multiplyImpl(p, q, false);
	}
	public static div(p: Polynomial, q: Polynomial): Polynomial
	{
		return Polynomial.multiplyImpl(p, q, true);
	}

	public toString(): string
	{
		return this.term.map(t => t.toString()).join(" + ").replace("+ -", "- ");
	}
}

class Calc
{
	public static eval(t: Token[]): Token[]
	{
		console.debug("eval start : " + t.toString());

		var r = Calc.evalSeq(t);

		console.debug("eval result : " + (r ? r.toString() : "no value"));

		if (r)
			return Calc.interpret(r);
		else
			return null;
	}

	private static interpret(t: Token): Token[]
	{
		if (t instanceof Polynomial)
		{
			return Calc.fromPolynomial(<Polynomial> t);
		}
		else if (t instanceof Numeric)
		{
			return [Calc.fromNumeric(<Numeric> t)];
		}
		else if (t instanceof Matrix)
		{
			var f = new Formula(null, "(", ")");
			var m = <Matrix> t;

			for (var i = 0; i < m.elems.length; i++)
			{
				m.elems[i].tokens = m.elems[i].tokens.reduce(
					(prev: Token[], curr) => prev.concat(Calc.interpret(curr)), []);
			}
			f.tokens.push(m);
			
			return [f];
		}

		return null;
	}
	private static fromPolynomial(p: Polynomial): Token[]
	{
		var t: Token[] = [];
		
		for (var i = 0; i < p.term.length; i++)
		{
			var a = p.term[i];

			if (i > 0 && a.coeff.value > 0)
				t.push(new Symbol("+", false));

			if (a.coeff.approx || a.coeff.value != 1 || Object.keys(a.exponent).length == 0)
				t.push(Calc.fromNumeric(a.coeff));

			for (var x in a.exponent)
			{
				t.push(new Symbol(x, true));
				if (a.exponent[x] != 1)
				{
					var ex = new Structure(null, StructType.Power);
					ex.elems[0].tokens.push(new Num(a.exponent[x].toString()));
					t.push(ex);
				}
			}
		}

		if (t.length == 0)
			t.push(Calc.fromNumeric(Numeric.Zero));

		return t;
	}
	private static fromNumeric(n: Numeric): Token
	{
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

    private static operator: Operator[] = [
		{ symbol: "mod", type: OperatorType.Infix, priority: 0 },
		{ symbol: "+", type: OperatorType.Infix, priority: 1 },
		{ symbol: "-", type: OperatorType.Infix, priority: 1 },
		{ symbol: "+", type: OperatorType.Prefix, priority: 1 },
		{ symbol: "-", type: OperatorType.Prefix, priority: 1 },
		{ symbol: "*", type: OperatorType.Infix, priority: 2 },
		{ symbol: "/", type: OperatorType.Infix, priority: 2 },
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
		{ symbol: "[", type: OperatorType.Prefix, priority: Number.POSITIVE_INFINITY },
		{ symbol: "{", type: OperatorType.Prefix, priority: Number.POSITIVE_INFINITY },
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
		var opr: string[] = Calc.operator.map(o => o.symbol);
		var q: Token[] = [];

		for (var i = 0; i < t.length; i++)
		{
			var r: Token = null;

			if (t[i] instanceof Symbol)
			{
				var v = <Symbol> t[i];

				if (opr.indexOf(v.str) < 0)
					r = Polynomial.fromSymbol(v);
			}
			else if (t[i] instanceof Num)
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
			console.debug("eval 0 symbol");
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
			console.debug("eval 1 symbol");
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
				argc = 2;
				Calc.evalSeqMain(t, index + 1, 0);
				res = Calc.mul(t[index], t[index + 1], false);
			}
		}
		else if (t[index + 1] instanceof Structure
			&& (<Structure> t[index + 1]).type == StructType.Power)
		{
			console.debug("eval 1 pow");
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
			console.debug("eval 0 mul");
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
			return sub ? Numeric.sub(m, n) : Numeric.add(m, n);
		}
		else if (x instanceof Polynomial || y instanceof Polynomial)
		{
			var p: Polynomial, q: Polynomial;
			if (x instanceof Polynomial)
				p = <Polynomial> x;
			else if (x instanceof Numeric)
				p = Polynomial.fromNumeric(<Numeric> x);
			if (y instanceof Polynomial)
				q = <Polynomial> y;
			else if (y instanceof Numeric)
				q = Polynomial.fromNumeric(<Numeric> y);
			return sub ? Polynomial.sub(p, q) : Polynomial.add(p, q);
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
			return div ? Numeric.div(m, n) : Numeric.mul(m, n);
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
		else if (x instanceof Polynomial || y instanceof Polynomial)
		{
			var p: Polynomial, q: Polynomial;
			if (x instanceof Polynomial)
				p = <Polynomial> x;
			else if (x instanceof Numeric)
				p = Polynomial.fromNumeric(<Numeric> x);
			if (y instanceof Polynomial)
				q = <Polynomial> y;
			else if (y instanceof Numeric)
				q = Polynomial.fromNumeric(<Numeric> y);
			return div ? Polynomial.div(p, q) : Polynomial.mul(p, q);
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
			return Numeric.negate(<Numeric> x);
		}
		else if (x instanceof Polynomial)
		{
			return Polynomial.negate(<Polynomial> x);
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
		else if (x instanceof Polynomial && y instanceof Numeric)
		{
			var f = <Polynomial> x;
			var b = <Numeric> y;

			if (!b.approx && b.num > 0 && b.den == 1)
			{
				var ex = Math.abs(b.num);
				var g: Polynomial = f;
				for (var i = 1; i < ex; i++)
					g = Polynomial.mul(f, g);
				return g;
			}
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