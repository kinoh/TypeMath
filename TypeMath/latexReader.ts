/// <reference path="formula.ts" />
/// <reference path="util.ts" />

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
	parsed: string;
	macroArgNum: { [key: string]: number } = {};

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
	private parseMatrix(isXy: boolean): LaTeXAST[]
	{
		var mat: LaTeXAST[] = [];
		var row: LaTeXAST[] = [];
		var cell: LaTeXAST[] = [];
		var m: string[];

		while (this.rest)
		{
			this.white();

			if (this.str("\\\\"))
			{
				row.push({ type: LaTeXASTType.Sequence, value: "", children: cell });
				mat.push({ type: LaTeXASTType.Sequence, value: "", children: row });
				cell = [];
				row = [];
			}
			else if (this.str("&"))
			{
				row.push({ type: LaTeXASTType.Sequence, value: "", children: cell });
				cell = [];
			}
			else if (isXy && (m = this.pattern(/^\*\s*(\+*|-*)\s*(?:\[(o)\])?\s*(?:\[([^\]]*)\])?/)))
			{
				console.debug("*");

				var item = this.parseToken();
				cell.push({
					type: LaTeXASTType.Command,
					value: "*",
					children: [
						this.optionalSymbol(m[1]),
						this.optionalSymbol(m[2]),
						this.optionalSymbol(m[3]),
						item]
				});
			}
			else if (isXy && (m = this.pattern(/^\\ar(?:@([2-9])?(?:\{([^\}]*)\})?)?\[([^\]]*)\]\s*([\^\|_])?/)))
			{
				var args = [
					this.optionalSymbol(m[1]),
					this.optionalSymbol(m[2]),
					this.optionalSymbol(m[3]),
					this.optionalSymbol(m[4]),
				];
				if (m[4])
					args.push(this.parseToken());
				cell.push({
					type: LaTeXASTType.Command,
					value: "ar",
					children: args
				});
			}
			else
			{
				var t = this.parseToken();
				if (!t)
					break;
				cell.push(t);
			}
		}

		if (cell.length > 0)
			row.push({ type: LaTeXASTType.Sequence, value: "", children: cell });
		if (row.length > 0)
			mat.push({ type: LaTeXASTType.Sequence, value: "", children: row });

		return mat;
	}
	private optionalSymbol(s: string): LaTeXAST
	{
		return s || s === ""
			? { type: LaTeXASTType.Symbol, value: s, children: null }
			: null;
	}
	private parseToken(eof?: string): LaTeXAST
	{
		var m: string[];

		this.white();

		if (eof && this.str(eof))
			return;

		console.debug("parseToken " + this.rest.charAt(0));

		if (this.str("\\"))
		{
			if (this.str("\\"))
			{
				return {
					type: LaTeXASTType.Symbol,
					value: "\\\\",
					children: null
				};
			}
			else if (m = this.pattern(/^[a-zA-Z]+/))
			{
				return this.parseCommand(m[0]);
			}
		}
		else if (this.str("^") || this.str("_"))
		{
			return {
				type: LaTeXASTType.Command,
				value: this.parsed,
				children: [this.parseToken()]
			};
		}
		else if (this.str("#"))
		{
			m = this.pattern(/^[0-9]+/);
			return {
				type: LaTeXASTType.Symbol,
				value: "#" + this.parsed,
				children: null
			};
		}
		else if (this.str("{"))
		{
			return this.parseSeq();
		}
		else if (this.str("}"))
		{
			return null;
		}
		else if (this.pattern(/^[0-9]/))
		{
			return {
				type: LaTeXASTType.Number,
				value: this.parsed,
				children: null
			};
		}
		else
		{
			return {
				type: LaTeXASTType.Symbol,
				value: this.head(),
				children: null
			};
		}
	}
	private parseCommand(name: string): LaTeXAST
	{
		var m: string[];

		if (name == "begin")
		{
			m = this.pattern(/\{([a-zA-Z0-9]+\*?)\}/);
			if (!m)
				console.error("[LaTeXReader.parseToken] begin command must have 1 arg.");
			var env = (m[1].indexOf("matrix") >= 0
				? this.parseMatrix(false)
				: [this.parseSeq()]);
			return {
				type: LaTeXASTType.Environment,
				value: m[1],
				children: env
			};
		}
		else if (name == "end")
		{
			m = this.pattern(/\{[a-zA-Z0-9]+\*?\}/);
			return null;
		}
		else if (name == "xymatrix")
		{
			this.white();
			this.str("{");
			return {
				type: LaTeXASTType.Command,
				value: name,
				children: this.parseMatrix(true)
			};
		}
		else
		{
			var ob = this.getArgObligation(name);
			var arg: LaTeXAST[] = [];
			for (var i = 0; i < ob.length; i++)
			{
				if (ob[i])
					arg.push(this.parseToken());
				else
				{
					if (this.str("["))
						arg.push(this.parseSeq("]"));
					else
						arg.push(null);
				}
			}
			if (name == "newcommand" && arg[1])
				this.macroArgNum[arg[0].value] = parseInt(arg[1].value);

			return {
				type: LaTeXASTType.Command,
				value: name,
				children: arg
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
				return [false, true, true];
			case "frac":
				return [true, true];
			case "sqrt":
				return [false, true];
			case "xymatrix":
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
				if (cmd in this.macroArgNum)
					return Util.repeat(true, this.macroArgNum[cmd]);
				else
					return [];
		}
	}
	private white(): void
	{
		var i;
		for (i = 0; i < this.rest.length; i++)
		{
			var c = this.rest.charAt(i);

			if (!(c == " " || c == "\n" || c == "\r"))
				break;
		}
		this.rest = this.rest.substr(i);
	}
	private head(): string
	{
		var c = this.rest.charAt(0);
		this.rest = this.rest.substr(1);
		return c;
	}
	private str(s: string): boolean
	{
		if (this.rest.substr(0, s.length) == s)
		{
			this.parsed = s;
			this.rest = this.rest.substr(s.length);
			return true;
		}
		else
			return false;
	}
	private pattern(reg: RegExp): string[]
	{
		var m = this.rest.match(reg);
		if (m)
		{
			this.parsed = m[0];
			this.rest = this.rest.substr(m[0].length);
			return m;
		}
		else
			return null;
	}
}