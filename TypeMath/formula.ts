/// <reference path="jquery.d.ts" />

class Token
{
	renderedElem: JQuery = null;

	constructor()
	{
	}

	clone(parent: TokenSeq): Token
	{
		console.error("[Token.clone] clone method not implemented");
		return null;
	}
}

class Symbol extends Token
{
	str: string;
	variable: boolean;	// italic

	public constructor(str: string, variable: boolean)
	{
		super();
		this.str = str;
		this.variable = variable;
	}

	public clone(parent: TokenSeq): Symbol
	{
		return new Symbol(this.str, this.variable);
	}

	public toString(): string
	{
		return this.str;
	}
}

class Num extends Token
{
	value: string;

	public constructor(n: string)
	{
		super();
		this.value = n;
	}

	public clone(parent: TokenSeq): Num
	{
		return new Num(this.value);
	}

	public toString(): string
	{
		return this.value;
	}
}

interface TokenSeq
{
	parent: any;
	count(): number;
	token(i: number): Token;
	next(t: Token): any;
	prev(t: Token): any;
	indexOf(t: Token): number;

	/* Token method */
	clone(parent: TokenSeq): Token;
	renderedElem: JQuery;
}

enum StructType
{
	Infer,
	Frac,
	Power,
	Index,
	Matrix,
	BigOpr
}

class Structure extends Token /* TokenSeq */
{
	parent: TokenSeq;
	type: StructType;
	elems: Formula[];

	public constructor(parent: TokenSeq, type: StructType)
	{
		super();
		this.parent = parent;
		this.type = type;

		var count: number;

		switch (type)
		{
			case StructType.Infer:
				count = 3;
				break;
			case StructType.Frac:
			case StructType.BigOpr:
				count = 2;
				break;
			case StructType.Power:
			case StructType.Index:
				count = 1;
				break;
			default:
				return;
		}

		this.elems = new Array(count);
		for (var i = 0; i < count; i++)
			this.elems[i] = new Formula(<TokenSeq> this);
	}
	public count(): number
	{
		return this.elems.length;
	}
	public token(i: number): Token
	{
		if (i < 0 || i >= this.elems.length)
			console.error("[Structure.token] out of range : " + i);
		return this.elems[i];
	}
	public prev = (f: Formula) =>
	{
		var i = this.elems.indexOf(f);
		if (i < 0 || i == 0)
			return null;
		return this.elems[i - 1];
	}
	public next = (f: Formula) =>
	{
		var i = this.elems.indexOf(f);
		if (i < 0 || i == this.elems.length - 1)
			return null;
		return this.elems[i + 1];
	}
	public indexOf = (t: Token) =>
	{
		if (t instanceof Formula)
			return this.elems.indexOf(<Formula> t);
		else
			return -1;
	}

	public clone(parent: TokenSeq): Structure
	{
		var s = new Structure(parent, this.type);
		this.elems.forEach((f, i) =>
		{
			s.elems[i] = f.clone(s);
		});
		return s;
	}

	public toString(): string
	{
		var type: string;

		switch (this.type)
		{
			case StructType.Frac: type = "Frac"; break;
			case StructType.Infer: type = "Infer"; break;
			case StructType.Power: type = "Power"; break;
			case StructType.Index: type = "Index"; break;
			case StructType.BigOpr: type = "BigOpr"; break;
		}

		return type + "[" + this.elems.map(f => f.toString()).join(", ") + "]";
	}
}

class Matrix extends Structure
{
	rows: number;
	cols: number;

	constructor(parent: TokenSeq, rows: number, cols: number)
	{
		super(parent, StructType.Matrix);

		this.rows = rows;
		this.cols = cols;
		this.elems = new Array(rows * cols);

		for (var i = 0; i < this.elems.length; i++)
			this.elems[i] = new Formula(this);
	}

	public tokenAt(r: number, c: number): Formula
	{
		if (r < 0 || r >= this.rows || c < 0 || c >= this.cols)
			console.error("[Matrix.token] out of range : " + r + "," + c);
		return this.elems[r * this.cols + c];
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

	public extend = (horizontal: boolean): void =>
	{
		if (horizontal)
		{
			for (var i = this.rows; i >= 1; i--)
				this.elems.splice(this.cols * i, 0, new Formula(this));
			this.cols++;
		}
		else
		{
			for (var i = 0; i < this.cols; i++)
				this.elems.push(new Formula(this));
			this.rows++;
		}
	}
	public shrink = (horizontal: boolean): void =>
	{
		if (horizontal)
		{
			if (this.cols == 1)
				return;
			for (var i = this.cols; i >= 1; i--)
				this.elems.splice(this.cols * i - 1, 1);
			this.cols--;
		}
		else
		{
			if (this.rows == 1)
				return;
			this.elems.splice((this.rows - 1) * this.cols, this.cols);
			this.rows--;
		}
	}

	public around = (f: Formula, horizontal: boolean, forward: boolean): Formula =>
	{
		var i = this.elems.indexOf(f);

		if (i < 0)
			return null;

		var r = Math.floor(i / this.cols);
		var c = i % this.cols;

		if (horizontal)
		{
			if (!forward && --c < 0) return null;
			if (forward && ++c >= this.cols) return null;
		}
		else
		{
			if (!forward && --r < 0) return null;
			if (forward && ++r >= this.rows) return null;
		}

		return this.tokenAt(r, c);
	}

	public toString(): string
	{
		return "Matrix" + this.rows + "," + this.cols + "[" + this.elems.map(f => f.toString()).join(", ") + "]";
	}
}
class BigOpr extends Structure
{
	operator: string;

	constructor(parent: TokenSeq, operator: string)
	{
		super(parent, StructType.BigOpr);
		this.operator = operator;
	}
}

enum FontStyle
{
	Normal,
	Bold,
	Roman,
	Script,
	Fraktur,
	BlackBoard,
	Typewriter
}

class Formula extends Token /* TokenSeq */
{
	parent: TokenSeq;
	tokens: Token[] = [];
	prefix = "";
	suffix = "";
	style: FontStyle = FontStyle.Normal;

	public constructor(parent: TokenSeq, prefix?: string, suffix?: string, style?: FontStyle)
	{
		super();
		this.parent = parent;
		if (prefix !== undefined)
			this.prefix = prefix;
		if (suffix !== undefined)
			this.suffix = suffix;
		if (style !== undefined)
			this.style = style;
	}
	public token(i: number): Token
	{
		if (i < 0 || i >= this.tokens.length)
			console.error("[Formula.token] out of range : " + i);
		return this.tokens[i];
	}
	public count(): number
	{
		return this.tokens.length;
	}
	public prev = (t: Token) =>
	{
		var i = this.tokens.indexOf(t);
		if (i < 0 || i == 0)
			return null;
		return this.tokens[i - 1];
	}
	public next = (t: Token) =>
	{
		var i = this.tokens.indexOf(t);
		if (i < 0 || i == this.tokens.length - 1)
			return null;
		return this.tokens[i + 1];
	}
	public indexOf = (t: Token) =>
	{
		return this.tokens.indexOf(t);
	}

	public insert(i: number, t: Token): void
	{
		this.tokens.splice(i, 0, t);
	}

	public remove(i: number, count?: number): Token[]
	{
		return this.tokens.splice(i, count != undefined ? count : 1);
	}

	public copy(a: number, b: number): Token[]
	{
		var from = Math.min(a, b);
		var to = Math.max(a, b);

		return this.tokens.slice(from, to).map(s => s.clone(null));
	}

	public paste(i: number, t: Token[]): void
	{
		this.tokens = this.tokens.slice(0, i).concat(
			t.map(s => s.clone(this)).concat(
				this.tokens.slice(i)));
	}
	public clone(parent: TokenSeq): Formula
	{
		var s = new Formula(parent);
		s.prefix = this.prefix;
		s.suffix = this.suffix;
		s.style = this.style;
		this.tokens.forEach((t, i) =>
		{
			s.tokens[i] = t.clone(s);
		});
		return s;
	}
	public toString(): string
	{
		return "Formula( " + this.prefix + this.tokens.map(t => t ? t.toString() : "??").join(" ") + this.suffix + " )";
	}
}
