/// <reference path="formula.ts" />

class LaTeX
{
    static symbols = {
		"\u2227": "land",
		"\u2228": "lor",
		"\uFFE2": "lnot",
		"\u2192": "to",
		"\u22A5": "bot",
		"\u2200": "forall",
		"\u2203": "exists",
		"{": "{",
		"}": "}"
    };

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

    public static trans(t: Token, indent?: string): string
	{
		if (indent == undefined)
			indent = "";

		if (t instanceof Symbol)
		{
			var c = (<Symbol>t).ident;
			if (c == "&")
				return "&\n" + indent.slice(0, -1);
            else if (c in LaTeX.symbols)
                return "\\" + LaTeX.symbols[c];
            else
    			return c;
		}
		else if (t instanceof Num)
		{
			return (<Num>t).value.toString();
		}
		else if (t instanceof Structure)
		{
            var s = <Structure>t;
            switch (s.type)
            {
                case StructType.Frac:
                    return LaTeX.macro("frac", s.tokens[0], s.tokens[1]);
				case StructType.Infer:
					var opt = LaTeX.trans(s.tokens[2]);
					return LaTeX.macroBreaked("infer" + (opt != "" ? "[" + opt + "]" : ""),
						indent, s.tokens[1], s.tokens[0]);
                case StructType.Power:
                    return "^{ " + LaTeX.trans(s.tokens[0]) + " }";
            }
		}
		else if (t instanceof Formula)
		{
			var f = <Formula>t;
            return f.prefix + f.tokens.map(s => LaTeX.trans(s, indent)).join(" ") + f.suffix;
		}
		else
			return "?";
	}
}