interface Token
{
	//parent: Token;

	clone(parent: TokenSeq): Token;
}

class Symbol
{
	ident: string;

	public constructor(s: string)
	{
		this.ident = s;
	}

	public clone(parent: TokenSeq): Symbol
	{
		return new Symbol(this.ident);
	}

	public toString(): string
	{
		return this.ident;
	}
}

class Num
{
	value: number;

	public constructor(n: number)
	{
		this.value = n;
	}

	public clone(parent: TokenSeq): Num
	{
		return new Num(this.value);
	}

	public toString(): string
	{
		return this.value.toString();
	}
}

interface TokenSeq
{
	parent: any;
	count(): number;
	token(i: number): Token;
}

enum StructType
{
	Infer,
	Frac,
	Power,
	Index,
	BigOpr
}

class Structure /* TokenSeq */
{
	parent: TokenSeq;
	type: StructType;
	elemCount: number;
	elems: Formula[];

	public constructor(parent: TokenSeq, type: StructType)
	{
		this.parent = parent;
		this.type = type;

		switch (type)
		{
			case StructType.Infer:
				this.elemCount = 3;
				break;
			case StructType.Frac:
			case StructType.BigOpr:
				this.elemCount = 2;
				break;
			case StructType.Power:
			case StructType.Index:
				this.elemCount = 1;
				break;
		}

		this.elems = new Array(this.elemCount);
		for (var i = 0; i < this.elemCount; i++)
			this.elems[i] = new Formula(<TokenSeq> this);
	}
	public count(): number
	{
		return this.elemCount;
	}
	public token(i: number): Token
	{
		if (i < 0 || i >= this.elemCount)
			alert("Structure.token : out of range " + i);
		return this.elems[i];
	}
	public prev = (f: Formula) =>
	{
		var i = this.elems.indexOf(f);
		if (i < 0 || i == 0)
			return null;
		return this.elems[i - 1];
	}
	public next = (f: Formula) => /* override */
	{
		var i = this.elems.indexOf(f);
		if (i < 0 || i == this.elemCount - 1)
			return null;
		return this.elems[i + 1];
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
		}

		return type + "[" + this.elems.map(f => f.toString()).join(", ") + "]";
	}
}

class Formula /* TokenSeq */
{
	parent: TokenSeq;
	tokens: Token[] = [];
	prefix = "";
	suffix = "";

	public constructor(parent: TokenSeq, prefix?: string, suffix?: string)
	{
		this.parent = parent;
		if (prefix !== undefined)
			this.prefix = prefix;
		if (suffix !== undefined)
			this.suffix = suffix;
	}
	public token(i: number): Token
	{
		if (i < 0 || i >= this.tokens.length)
			alert("Formula.token : out of range " + i);
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

	public insert(i: number, t: Token): void
	{
		this.tokens.splice(i, 0, t);
	}

	public remove(i: number): void
	{
		this.tokens.splice(i, 1);
	}

	public copy(a: number, b: number): Token[]
	{
		var from = Math.min(a, b);
		var to = Math.max(a, b);

		return this.tokens.slice(from, to).map(s => s.clone(null));
	}
	public cut(a: number, b: number): Token[]
	{
		var from = Math.min(a, b);
		var len = Math.abs(a - b);

		return this.tokens.splice(from, len).map(s => s.clone(null));
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
		this.tokens.forEach((t, i) =>
		{
			s.tokens[i] = t.clone(s);
		});
		return s;
	}
	public toString(): string
	{
		return "Formula( " + this.prefix + this.tokens.map(t => t.toString()).join(" ") + this.suffix + " )";
	}
}
