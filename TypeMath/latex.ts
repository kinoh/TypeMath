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

	public static styles = {
		"mathbf": FontStyle.Bold,
		"mathrm": FontStyle.Roman,
		"mathscr": FontStyle.Script,
		"mathfrak": FontStyle.Fraktur,
		"mathbb": FontStyle.BlackBoard,
		"mathtt": FontStyle.Typewriter
	};

	public static symbols: { [key: string]: string };

	private static macro(n: string, ...args: Token[]): string
    {
		return "\\" + n + "{ " + args.map(t => LaTeX.trans(t)).join(" }{ ") + " }";
    }

	private static macroBreaked(n: string, indent: string, ...args: Token[]): string
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
	private static transSymbol(str: string, indent: string): string
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
	private static transMatrix(m: Matrix, indent: string): string
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
	private static transStructure(s: Structure, indent: string): string
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
			case StructType.BigOpr:
				return LaTeX.transSymbol((<BigOpr> s).operator, indent)
					+ "_{" + LaTeX.trans(s.elems[0])
					+ "}^{" + LaTeX.trans(s.elems[1]) + "}";
				break;
			default:
				return "?struct?";
		}
	}
	private static transFormula(f: Formula, indent: string): string
	{
		if (f.tokens.length == 1 && f.tokens[0] instanceof Matrix)
		{
			var br = f.prefix + f.suffix;

			if (br in this.amsBracket)	// incomplete condition
			{
				var n = this.amsBracket[br];
				return "\\begin{" + n + "matrix}"
					+ this.transMatrix(<Matrix> f.tokens[0], indent)
					+ "\\end{" + n + "matrix}";
			}
		}

		var separator = " ";
		var pre, suf: string;

		if (f.style != FontStyle.Normal)
		{
			var cmd: string;

			for (cmd in this.styles)
				if (this.styles[cmd] == f.style)
				{
					pre = "\\" + cmd + "{";
					suf = "}";
					break;
				}

			if (f.tokens.every(t => t instanceof Symbol || t instanceof Num))
				separator = "";
		}
		else if (f.prefix == "√")
		{
			pre = "\\sqrt{ ";
			suf = " }";
		}
		else
		{
			pre = this.transSymbol(f.prefix, indent);
			suf = this.transSymbol(f.suffix, indent);

			if (pre != "")
				pre = "\\left" + pre + " ";
			else if (suf != "")
				pre = "\\left. ";
			if (suf != "")
				suf = " \\right" + suf;
			else if (pre != "")
				suf = " \\right.";
		}

		return pre + f.tokens.map(t => LaTeX.trans(t, indent)).join(separator) + suf;
	}
}