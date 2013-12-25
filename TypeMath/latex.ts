/// <reference path="formula.ts" />

class LaTeX
{
    static symbols = {
		"\u2227": "land",
		"\u2228": "lor",
		"\uFFE2": "lnot",
		"\u2192": "to"
    };

    public static macro(n: string, ...args: string[]): string
    {
        return "\\" + n + "{ " + args.join(" }{ ") + " }";
    }

    public static trans(t: Token): string
	{
		if (t instanceof Symbol)
		{
            var c = (<Symbol>t).ident;
            if (c in LaTeX.symbols)
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
                    return LaTeX.macro("frac",
                        LaTeX.trans(s.tokens[0]),
                        LaTeX.trans(s.tokens[1]));
                case StructType.Infer:
                    return LaTeX.macro("infer",
                        LaTeX.trans(s.tokens[0]),
                        LaTeX.trans(s.tokens[1]));
                case StructType.Power:
                    return "^{ " + LaTeX.trans(s.tokens[0]) + " }";
            }
		}
		else if (t instanceof Formula)
		{
			var f = <Formula>t;
            return f.prefix + f.tokens.map(LaTeX.trans).join(" ") + f.suffix;
		}
		else
			return "?";
	}
}