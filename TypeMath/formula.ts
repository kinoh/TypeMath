﻿interface Token
{
	//parent: Token;
}

class Symbol
{
	ident: string;

	public constructor(s: string)
	{
		this.ident = s;
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

	public toString(): string
	{
		return this.value.toString();
	}
}

class TokenSeq
{
	parent: TokenSeq;
	public tokens: Token[] = [];

	public get count(): number
	{
		return this.tokens.length;
	}
	
	public constructor(parent: TokenSeq)
	{
		this.parent = parent;
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
}

enum StructType
{
	Infer,
	Frac,
	Power,
	Index,
	BigOpr
}

class Structure extends TokenSeq
{
	type: StructType;
	count: number;

	public constructor(parent: TokenSeq, type: StructType)
	{
		super(parent);
		this.type = type;

		switch (type)
		{
			case StructType.Infer:
			case StructType.Frac:
			case StructType.BigOpr:
				this.count = 2;
				break;
			case StructType.Power:
			case StructType.Index:
				this.count = 1;
				break;
		}

		this.tokens = new Array(this.count);
		for (var i = 0; i < this.count; i++)
			this.tokens[i] = new Formula(this);
	}

	public toString(): string
	{
		var type: string;

		switch (this.type)
		{
			case StructType.Frac: type = "Frac"; break;
			case StructType.Infer: type = "Infer"; break;
		}

		return type + "[" + this.tokens.map(f => f.toString()).join(", ") + "]";
	}
}

class Formula extends TokenSeq
{
	prefix = "";
	suffix = "";

	public constructor(parent: TokenSeq, prefix?: string, suffix?: string)
	{
		super(parent);
		if (prefix !== undefined)
			this.prefix = prefix;
		if (suffix !== undefined)
			this.suffix = suffix;
	}

	public insert(i: number, t: Token): void
	{
		this.tokens.splice(i, 0, t);
	}

	public remove(i: number): void
	{
		this.tokens.splice(i, 1);
	}

	public toString(): string
	{
		return this.prefix + this.tokens.map(t => t.toString()).join(" ") + this.suffix;
	}
}
