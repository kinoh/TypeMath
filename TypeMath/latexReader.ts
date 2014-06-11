/// <reference path="formula.ts" />

enum LaTeXASTType
{
	Sequence, Environment, Command, Symbol, Number
}

interface LaTeXAST
{
	type: LaTeXASTType;
	value: string;
	children: LaTeXAST[];
}

class LaTeXReader
{
	rest: string;

	constructor(src: string)
	{
		this.rest = src;
	}
	public static parse(source: string): LaTeXAST
	{
		var parser = new LaTeXReader(source);
		return parser.parseSeq();
	}
	private parseSeq(eof?: string): LaTeXAST
	{
		var tokens: LaTeXAST[] = [];

		console.debug("parseSeq " + this.rest.substr(0, 8) + " ...");

		while (this.rest.length > 0)
		{
			var t = this.parseToken(eof);
			if (!t)
				break;
			console.debug("parsed " + t.value + " -- " + this.rest.substr(0, 8) + " ...");
			tokens.push(t);
		}

		console.debug("exit seq");

		if (tokens.length == 1)
			return tokens[0];
		else
			return {
				type: LaTeXASTType.Sequence,
				value: "",
				children: tokens
			};
	}
	private parseToken(eof?: string): LaTeXAST
	{
		var c = this.rest.charAt(0);
		var m: string[];

		while (c == " " || c == "\n" || c == "\r")
		{
			this.next(1);
			c = this.rest.charAt(0);
		}

		if (eof && c == eof)
		{
			this.next(1);
			return;
		}

		console.debug("parseToken " + c);

		switch (c)
		{
			case "\\":
				if (this.rest.charAt(1) == "\\")
				{
					this.next(2);
					return {
						type: LaTeXASTType.Symbol,
						value: "\\\\",
						children: null
					};
				}
				m = this.rest.match(/^\\([a-zA-Z]+)/);
				if (!m)
					console.error("[LaTeXReader.parseToken] unexpected : "
						+ this.rest.substr(0, 8) + "...");
				this.next(m[0].length);
				if (m[1] == "begin")
				{
					m = this.rest.match(/\{([a-zA-Z0-9]+\*?)\}/);
					if (!m)
						console.error("[LaTeXReader.parseToken] begin command must have 1 arg.");
					this.next(m[0].length);
					var env = this.parseSeq();
					return {
						type: LaTeXASTType.Environment,
						value: m[1],
						children: [env]
					};
				}
				else if (m[1] == "end")
				{
					m = this.rest.match(/\{[a-zA-Z0-9]+\*?\}/);
					this.next(m[0].length);
					return null;
				}
				else
				{
					var n = this.getArgObligation(m[1]);
					var arg: LaTeXAST[] = [];
					for (var i = 0; i < n.length; i++)
					{
						if (n[i])
							arg.push(this.parseToken());
						else
						{
							if (this.rest.charAt(0) == "[")
							{
								this.next(1);
								arg.push(this.parseSeq("]"));
							}
							else
								arg.push(null);
						}
					}
					return {
						type: LaTeXASTType.Command,
						value: m[1],
						children: arg
					};
				}
			case "^":
			case "_":
				this.next(1);
				return {
					type: LaTeXASTType.Command,
					value: c,
					children: [this.parseToken()]
				};
			case "#":
				m = this.rest.match(/#[0-9]+/);
				this.next(m[0].length);
				return {
					type: LaTeXASTType.Symbol,
					value: m[0],
					children: null
				};
			case "{":
				this.next(1);
				return this.parseSeq();
			case "}":
				this.next(1);
				return null;
			case "0": case "1": case "2": case "3": case "4":
			case "5": case "6": case "7": case "8": case "9":
				m = this.rest.match(/[0-9]+(\.[0-9]*)?/);
				this.next(m[0].length);
				return {
					type: LaTeXASTType.Number,
					value: m[0],
					children: null
				};
			default:
				this.next(1);
				return {
					type: LaTeXASTType.Symbol,
					value: c,
					children: null
				};
		}
	}
	private getArgObligation(cmd: string): boolean[]
	{
		switch (cmd)
		{
			case "newcommand":
				return [true, false, true];
			case "infer":
				return [true, true, false];
			case "frac":
				return [true, true];
			case "sqrt":
				return [false, true];
			case "left":
			case "right":
			case "mathbf":
			case "mathrm":
			case "mathscr":
			case "mathfrak":
			case "mathbb":
			case "mathtt":
			case "grave":
			case "acute":
			case "hat":
			case "tilde":
			case "bar":
			case "breve":
			case "dot":
			case "ddot":
			case "mathring":
			case "check":
			case "widetilde":
			case "widehat":
			case "overleftarrow":
			case "overrightarrow":
			case "overline":
			case "underline":
			case "overbrace":
			case "underbrace":
				return [true];
			default:
				return [];
		}
	}
	private next(n: number): void
	{
		this.rest = this.rest.substr(n);
	}
}