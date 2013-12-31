/// <reference path="formula.ts" />

class LaTeX
{
	private static proofMode = false;

	private static amsBracket = {
		"()": "p",
		"[]": "b",
		"{}": "B",
		"||": "v",
		"‖‖": "V",
		"": ""
	};

	private static styleTable: { [key: string]: { [key: string]: string } } = null;

	public static symbols: { [key: string]: string };

    public static macro(n: string, ...args: Token[]): string
    {
		return "\\" + n + "{ " + args.map(t => LaTeX.trans(t)).join(" }{ ") + " }";
    }

	public static macroBreaked(n: string, indent: string, ...args: Token[]): string
	{
		var inner = indent + "  ";
		return "\\" + n + " {\n"
			+ inner + args.map(t => LaTeX.trans(t, inner)).join("\n" + indent + "}{\n" + inner) + "\n"
			+ indent + "}";
	}

    public static trans(t: Token, indent?: string, proof?: boolean): string
	{
		if (proof != undefined)
			this.proofMode = proof;
		if (indent == undefined)
			indent = "";

		if (t instanceof Symbol)
		{
			return this.transSymbol((<Symbol> t).str, indent);
		}
		else if (t instanceof Num)
		{
			return (<Num>t).value.toString();
		}
		else if (t instanceof Matrix)
		{
			var m = <Matrix> t;

			var opt = "";
			for (var i = 0; i < m.cols; i++)
				opt += "c";

			return "\\begin{array}{" + opt + "}"
				+ this.transMatrix(m, indent)
				+ "\\end{array}";
		}
		else if (t instanceof Structure)
		{
			return this.transStructure(<Structure> t, indent);
		}
		else if (t instanceof Formula)
		{
			return this.transFormula(<Formula> t, indent);
		}
		else
			return "?";
	}
	public static transSymbol(str: string, indent: string): string
	{
		if (this.proofMode)
		{
			switch (str)
			{
				case "&":
					return "&\n" + indent.slice(0, -1);
				case "∧":
					return "\\land";
				case "∨":
					return "\\lor";
				case "¬":
				case "￢":
					return "\\lnot";
			}
		}

		if (str in LaTeX.symbols)
			return "\\" + LaTeX.symbols[str];
		else
			return str;
	}
	public static transMatrix(m: Matrix, indent: string): string
	{
		var ln = (m.rows >= 2 && m.cols >= 2 && !(m.rows == 2 && m.cols == 2))
			? "\n" : " ";
		var str = "";

		str += ln;
		for (var i = 0; i < m.rows; i++)
		{
			str += m.elems.slice(m.cols * i, m.cols * (i + 1))
				.map(f => LaTeX.trans(f)).join(" & ")
			+ " \\\\" + ln;
		}

		return str;
	}
	public static transStructure(s: Structure, indent: string): string
	{
		var str: string;

		switch (s.type)
		{
			case StructType.Frac:
				return LaTeX.macro("frac", s.token(0), s.token(1));
			case StructType.Infer:
				var opt = LaTeX.trans(s.token(2));
				return LaTeX.macroBreaked("infer" + (opt != "" ? "[" + opt + "]" : ""),
					indent, s.token(0), s.token(1));
			case StructType.Power:
				str = LaTeX.trans(s.token(0));
				return str.length == 1
					? "^" + str
					: "^{ " + str + " }";
			case StructType.Index:
				str = LaTeX.trans(s.token(0));
				return str.length == 1
					? "_" + str
					: "_{ " + str + " }";
			default:
				return "?struct?";
		}
	}
	public static transFormula(f: Formula, indent: string): string
	{
		if (f.tokens.length == 1 && f.tokens[0] instanceof Matrix)
		{
			var br = f.prefix + f.suffix;

			if (br in this.amsBracket)
			{
				var n = this.amsBracket[br];
				return "\\begin{" + n + "matrix}"
					+ this.transMatrix(<Matrix> f.tokens[0], indent)
					+ "\\end{" + n + "matrix}";
			}
		}

		var pre = this.transSymbol(f.prefix, indent);
		var suf = this.transSymbol(f.suffix, indent);

		if (pre != "")
			pre = "\\left" + pre + " ";
		else if (suf != "")
			pre = "\\left. ";
		if (suf != "")
			suf = " \\right" + suf;
		else if (pre != "")
			suf = " \\right.";

		var str: string[] = [];

	main:
		for (var i = 0; i < f.tokens.length; i++)
		{
			var t = f.tokens[i];

			if (t instanceof Symbol)
			{
				if (LaTeX.styleTable == null)
					LaTeX.generateStyleTable();

				var s = <Symbol> t;
				for (var command in LaTeX.styleTable)
				{
					var table = LaTeX.styleTable[command];
					if (s.str in table)
					{
						var u = table[s.str];

						while (i < f.tokens.length
							&& f.tokens[i + 1] instanceof Symbol
							&& (s = <Symbol> f.tokens[i + 1]).str in table)
						{
							u += table[s.str];
							i++;
						}

						str.push("\\" + command + "{" + u + "}");

						continue main;
					}
				}
			}

			str.push(LaTeX.trans(t, indent));
		}

		return pre + str.join(" ") + suf;
	}
	private static generateStyleTable(): void
	{
		var cor = {
			"mathbf": Unicode.Bold,
			"mathbb": Unicode.DoubleStruck,
			"mathtt": Unicode.Monospace,
			"mathscr": Unicode.Script,
			"mathfrak": Unicode.Fraktur
			// mathrm
		};

		LaTeX.styleTable = {};

		for (var command in cor)
		{
			var t = cor[command];
			var r: { [key: string]: string } = {};
			for (var c in t)
				r[t[c]] = c;
			LaTeX.styleTable[command] = r;
		}
	}
}