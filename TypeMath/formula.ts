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
	parent: TokenSeq;
	count(): number;
	token(i: number): Token;
	next(t: Token): Token;
	prev(t: Token): Token;
	indexOf(t: Token): number;
	remove(from: number, to: number): Token[];
	copy(from: number, to: number): Token[];
	paste(index: number, tokens: Token[]): number;

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
	Diagram,
	BigOpr,
	Accent
}

class Structure extends Token /* TokenSeq */
{
	parent: TokenSeq;
	type: StructType;
	elems: Formula[];

	public constructor(parent: TokenSeq, type: StructType, count?: number)
	{
		super();
		this.parent = parent;
		this.type = type;

		var n = 0;

		if (count)
			n = count;
		else
		{
			switch (type)
			{
				case StructType.Infer:
					n = 3;
					break;
				case StructType.Frac:
				case StructType.BigOpr:
					n = 2;
					break;
				case StructType.Power:
				case StructType.Index:
				case StructType.Accent:
					n = 1;
					break;
			}
		}

		this.elems = new Array(n);
		for (var i = 0; i < n; i++)
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
	public remove(from: number, to: number): Token[]
	{
		var i = Math.min(from);
		var j = Math.max(to);
		var r = this.elems.slice(i, j + 1);

		for (var k = i; k <= j; k++)
			this.elems[k] = new Formula(this);

		return r;
	}
	public copy(from: number, to: number): Token[]
	{
		return this.elems.slice(from, to).map(s => s.clone(null));
	}
	public paste(index: number, tokens: Token[]): number
	{
		if (tokens.every(t => t instanceof Formula))
		{
			for (var i = 0; i < tokens.length; i++)
				this.elems[index + i] = <Formula> tokens[i].clone(this);
			return index + tokens.length;
		}
		else
		{
			this.elems[index].paste(this.elems[index].count(), tokens);
			return index;
		}
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
		super(parent, StructType.Matrix, rows * cols);

		this.rows = rows;
		this.cols = cols;
	}
	public pos(index: number)
	{
		return { row: Math.floor(index / this.cols), col: index % this.cols };
	}

	public tokenAt(r: number, c: number, value?: Formula): Formula
	{
		if (r < 0 || r >= this.rows || c < 0 || c >= this.cols)
		{
			console.error("[Matrix.tokenAt] out of range : " + r + "," + c);
			return null;
		}
		else if (value !== undefined)
			return this.elems[r * this.cols + c] = value;
		else
			return this.elems[r * this.cols + c];
	}

	public remove(from: number, to: number): Token[]
	{
		return [this.cloneArea(from, to, true)];
	}
	public copy(from: number, to: number): Token[]
	{
		return [this.cloneArea(from, to, false)];
	}
	public cloneArea(from: number, to: number, erase: boolean): Matrix
	{
		var a = this.pos(from);
		var b = this.pos(to);
		var i1 = Math.min(a.row, b.row);
		var j1 = Math.min(a.col, b.col);
		var i2 = Math.max(a.row, b.row);
		var j2 = Math.max(a.col, b.col);

		return this.cloneRect(i1, j1, i2, j2, erase);
	}
	public cloneRect(i1: number, j1: number, i2: number, j2: number, erase: boolean): Matrix
	{
		var m = new Matrix(null, i2 - i1 + 1, j2 - j1 + 1);

		for (var i = 0; i < m.rows; i++)
			for (var j = 0; j < m.cols; j++)
			{
				m.tokenAt(i, j, this.tokenAt(i + i1, j + j1).clone(m));
				if (erase)
					this.tokenAt(i + i1, j + j1, new Formula(this));
			}

		return m;
	}
	public paste(index: number, tokens: Token[]): number
	{
		if (tokens.length != 1 || !(tokens[0] instanceof Matrix))
			return super.paste(index, tokens);

		var m = <Matrix> tokens[0];
		var p = this.pos(index);
		var r = Math.min(m.rows, this.rows - p.row);
		var c = Math.min(m.cols, this.cols - p.col);
		for (var i = 0; i < r; i++)
			for (var j = 0; j < c; j++)
				this.tokenAt(p.row + i, p.col + j, m.tokenAt(i, j).clone(this));

		return index + (r - 1) * this.cols + (c - 1);
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

	public extend(horizontal: boolean): void
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
	public shrink(horizontal: boolean): void
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

	public around(f: Formula, horizontal: boolean, forward: boolean): Formula
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

	public nonEmpty(i0: number, j0: number, rows: number, cols: number): boolean
	{
		for (var i = 0; i < rows; i++)
			for (var j = 0; j < cols; j++)
			{
				if (this.tokenAt(i0 + i, j0 + j).tokens.length > 0)
					return true;
			}


		return false;
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

	public clone(parent: TokenSeq): Structure
	{
		var s = new BigOpr(parent, this.operator);
		this.elems.forEach((f, i) =>
		{
			s.elems[i] = f.clone(s);
		});
		return s;
	}
}
class Accent extends Structure
{
	symbol: string;
	above: boolean;
	
	constructor(parent: TokenSeq, symbol: string, above: boolean)
	{
		super(parent, StructType.Accent);
		this.symbol = symbol;
		this.above = above;
	}

	public clone(parent: TokenSeq): Structure
	{
		var s = new Accent(parent, this.symbol, this.above);
		this.elems.forEach((f, i) =>
		{
			s.elems[i] = f.clone(s);
		});
		return s;
	}
	public toString(): string
	{
		return "Accent" + this.symbol + "[" + this.elems.map(f => f.toString()).join(", ") + "]";
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
	public empty = () =>
	{
		return this.tokens.length == 0;
	}

	public insert(i: number, t: Token): void
	{
		this.tokens.splice(i, 0, t);
	}

	public remove(from: number, to?: number): Token[]
	{
		var i, c: number;
		if (to === undefined)
			i = from, c = 1;
		else
		{
			i = Math.min(from, to);
			c = Math.abs(to - from);
		}
		return this.tokens.splice(i, c);
	}
	public copy(from: number, to: number): Token[]
	{
		return this.tokens.slice(Math.min(from, to), Math.max(from, to)).map(s => s.clone(null));
	}
	public paste(index: number, tokens: Token[]): number
	{
		this.tokens = this.tokens.slice(0, index).concat(
			tokens.map(s => s.clone(this)).concat(
				this.tokens.slice(index)));

		return index + tokens.length;
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
