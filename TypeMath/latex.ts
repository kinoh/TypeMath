﻿/// <reference path="formula.ts" />

class LaTeX
{
	private static proofMode = false;

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
			var c = (<Symbol>t).ident;
			if (this.proofMode)
			{
				switch (c)
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
            if (c in LaTeX.symbols)
                return "\\" + LaTeX.symbols[c];
            else
    			return c;
		}
		else if (t instanceof Num)
		{
			return (<Num>t).value.toString();
		}
		else if (t instanceof Matrix)
		{
			var m = <Matrix> t;
			var ln = (m.rows >= 2 && m.cols >= 2 && !(m.rows == 2 && m.cols == 2))
				? "\n" : " ";
			var str = "";

			for (var i = 0; i < m.rows; i++)
			{
				str += m.elems.slice(m.cols * i, m.cols * (i + 1))
						.map(f => LaTeX.trans(f)).join(" & ")
					+ " \\\\" + ln;
			}

			var opt = "";
			for (var i = 0; i < m.cols; i++)
				opt += "c";

			return "\\begin{array}{" + opt + "}" + ln
				+ str
				+ "\\end{array}";
		}
		else if (t instanceof Structure)
		{
			var s = <Structure>t;
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
		else if (t instanceof Formula)
		{
			var f = <Formula>t;
            return f.prefix + f.tokens.map(s => LaTeX.trans(s, indent)).join(" ") + f.suffix;
		}
		else
			return "?";
	}

	public static symbols = {
		"§": "S",
		"¶": "P",
		"©": "copyright",
		"£": "pounds",
		"±": "pm",
		"∓": "mp",
		"×": "times",
		"÷": "div",
		"∗": "ast",
		"⋆": "star",
		"◦": "circ",
		"∙": "bullet",
		"∩": "cap",
		"∪": "cup",
		"⊓": "sqcap",
		"⊔": "sqcup",
		"∨": "vee",
		"∧": "wedge",
		"∖": "setminus",
		"≀": "wr",
		"⋄": "diamond",
		"†": "dagger",
		"‡": "ddagger",
		"⨿": "amalg",
		//"△": "bigtriangleup",
		"▽": "bigtriangledown",
		"◁": "triangleleft",
		"▷": "triangleright",
		"⊲": "lhd",
		"⊳": "rhd",
		"⊴": "unlhd",
		"⊵": "unrhd",
		"⊎": "uplus",
		"⊕": "oplus",
		"⊖": "ominus",
		"⊗": "otimes",
		"⊘": "oslash",
		"⊙": "odot",
		"○": "bigcirc",
		"·": "cdot",
		"≤": "leq",
		"≥": "geq",
		"≺": "prec",
		"≻": "succ",
		"⪯": "preceq",
		"⪰": "succeq",
		"≪": "ll",
		"≫": "gg",
		"⊂": "subset",
		"⊃": "supset",
		"⊆": "subseteq",
		"⊇": "supseteq",
		"⊑": "sqsubseteq",
		"⊒": "sqsupseteq",
		"∈": "in",
		"∋": "ni",
		"⊢": "vdash",
		"⊣": "dashv",
		"≡": "equiv",
		"⊧": "models",
		"∼": "sim",
		"⟂": "perp",
		"≃": "simeq",
		"∣": "mid",
		"≍": "asymp",
		"∥": "parallel",
		"≈": "approx",
		"⋈": "bowtie",
		"≅": "cong",
		"⨝": "Join",
		"∉": "notin",
		"≠": "neq",
		"⌣": "smile",
		"≐": "doteq",
		"⌢": "frown",
		"←": "leftarrow",
		"⟵": "longleftarrow",
		"⇐": "Leftarrow",
		"⟸": "Longleftarrow",
		"→": "rightarrow",
		"⟶": "longrightarrow",
		"⇒": "Rightarrow",
		"⟹": "Longrightarrow",
		"↔": "leftrightarrow",
		"⟷": "longleftrightarrow",
		"⇔": "Leftrightarrow",
		"⟺": "Longleftrightarrow",
		"↦": "mapsto",
		"⟼": "longmapsto",
		"↩": "hookleftarrow",
		"↪": "hookrightarrow",
		"↼": "leftharpoonup",
		"⇀": "rightharpoonup",
		"↽": "leftharpoondown",
		"⇁": "rightharpoondown",
		"↝": "leadsto",
		"↑": "uparrow",
		"⇑": "Uparrow",
		"↓": "downarrow",
		"⇓": "Downarrow",
		"↕": "updownarrow",
		"⇕": "Updownarrow",
		"↗": "nearrow",
		"↘": "searrow",
		"↙": "swarrow",
		"↖": "nwarrow",
		"ℵ": "aleph",
		"′": "prime",
		"∀": "forall",
		"∞": "infty",
		"ℏ": "hbar",
		"∅": "emptyset",
		"∃": "exists",
		"□": "Box",
		"𝚤": "imath",
		"∇": "nabla",
		"¬": "neg",
		"◇": "Diamond",
		"𝚥": "jmath",
		"√": "surd",
		"♭": "flat",
		"△": "triangle",
		"ℓ": "ell",
		"⟙": "top",
		"♮": "natural",
		"☘": "clubsuit",
		"℘": "wp",
		"⟘": "bot",
		"♯": "sharp",
		"♢": "diamondsuit",
		"ℜ": "Re",
		"‖": "|",
		"\\": "backslash",
		"♡": "heartsuit",
		"ℑ": "Im",
		"∠": "angle",
		"∂": "partial",
		"♠": "spadesuit",
		"℧": "mho",
		"∝": "propto",
		"∑": "sum",
		"⋂": "bigcap",
		"⨀": "bigodot",
		"∏": "prod",
		"⋃": "bigcup",
		"⨂": "bigotimes",
		"∐": "coprod",
		"⨆": "bigsqcup",
		"⨁": "bigoplus",
		"∫": "int",
		"⋁": "bigvee",
		"⨄": "biguplus",
		"∮": "oint",
		"⋀": "bigwedge",
		"⌊": "lfloor",
		"⌋": "rfloor",
		"⌈": "lceil",
		"⌉": "rceil",
		"〈": "langle",
		"〉": "rangle",
		"α": "alpha",
		"β": "beta",
		"γ": "gamma",
		"δ": "delta",
		"ϵ": "epsilon",
		"ζ": "zeta",
		"η": "eta",
		"θ": "theta",
		"ι": "iota",
		"κ": "kappa",
		"λ": "lambda",
		"μ": "mu",
		"ν": "nu",
		"ξ": "xi",
		"π": "pi",
		"ρ": "rho",
		"σ": "sigma",
		"τ": "tau",
		"υ": "upsilon",
		"ϕ": "phi",
		"χ": "chi",
		"ψ": "psi",
		"ω": "omega",
		"Γ": "Gamma",
		"Δ": "Delta",
		"Θ": "Theta",
		"Λ": "Lambda",
		"Ξ": "Xi",
		"Π": "Pi",
		"Σ": "Sigma",
		"Υ": "Upsilon",
		"Φ": "Phi",
		"Ψ": "Psi",
		"Ω": "Omega",
		"ε": "varepsilon",
		"ϑ": "vartheta",
		"ϖ": "varpi",
		"ϱ": "varrho",
		"ς": "varsigma",
		"φ": "varphi",
		"æ": "ae",
		"Æ": "AE",
		"œ": "oe",
		"Œ": "OE",
		"å": "aa",
		"Å": "AA",
		"ł": "l",
		"Ł": "L",
		"ø": "o",
		"Ø": "O",
		"ß": "ss",
		"ı": "i",
		"ȷ": "j",
		"≑": "doteqdot",
		"≓": "risingdotseq",
		"≒": "fallingdotseq",
		"≖": "eqcirc",
		"≗": "circeq",
		"≏": "bumpeq",
		"≎": "Bumpeq",
		"⋖": "lessdot",
		"⋗": "gtrdot",
		"⩽": "leqslang",
		"⩾": "geqslant",
		"⪕": "eqslantless",
		"⪖": "eqslantgtr",
		"≦": "leqq",
		"≧": "geqq",
		"⋘": "lll",
		"⋙": "ggg",
		"≲": "lesssim",
		"≳": "gtrsim",
		"⪅": "lessapprox",
		"⪆": "gtrapprox",
		"≶": "lessgtr",
		"≷": "gtrless",
		"⋚": "lesseqgtr",
		"⋛": "gtreqless",
		"⪋": "lesseqqgtr",
		"⪌": "gtreqqless",
		"∽": "backsim",
		"⋍": "backsimeq",
		"≼": "preccurlyeq",
		"≽": "succcurlyeq",
		"≊": "approxeq",
		"⋞": "curlyeqprec",
		"⋟": "curlyeqsucc",
		"≾": "precsim",
		"≿": "succsim",
		"⪷": "precapprox",
		"⪸": "succapprox",
		"⫅": "subseteqq",
		"⫆": "supseteqq",
		"⋐": "Subset",
		"⋑": "Supset",
		"⊏": "sqsubset",
		"⊐": "sqsupset",
		"⊨": "vDash",
		"⊩": "Vdash",
		"⊪": "Vvdash",
		"϶": "backepsilon",
		"∴": "therefore",
		"∵": "because",
		"≬": "between",
		"⋔": "pitchfork",
		//"⊲": "vartriangleleft",
		//"⊳": "vartriangleright",
		"◀": "blacktriangleleft",
		"▶": "blacktriangleright",
		//"⊴": "trianglelefteq",
		//"⊵": "trianglerighteq",
		"∔": "dotplus",
		"⋉": "ltimes",
		"⋊": "rtimes",
		"⋋": "leftthreetimes",
		"⋌": "rightthreetimes",
		"⊝": "circleddash",
		"⌅": "barwedge",
		"⌆": "doubebarwedge",
		"⋏": "curlywedge",
		"⋎": "curlyvee",
		"⊻": "veebar",
		"⊺": "intercal",
		"⋒": "Cap",
		"⋓": "Cup",
		"⊛": "circledast",
		"⊚": "circledcirc",
		"⊟": "boxminus",
		"⊠": "boxtimes",
		"⊡": "boxdot",
		"⊞": "boxplus",
		"⋇": "divideontimes",
		"&": "And",
		"∬": "iint",
		"∭": "iiint",
		"⨌": "iiiint",
		"⤎": "dashleftarrow",
		"⤏": "dashrightarrow",
		"⇇": "leftleftarrows",
		"⇉": "rightrightarrows",
		"⇈": "upuparrows",
		"⇊": "downdownarrows",
		"⇆": "leftrightarrows",
		"⇄": "rightleftarrows",
		"⇚": "Lleftarrow",
		"⇛": "Rrightarrow",
		"↿": "upharpoonleft",
		"↾": "upharpoonright",
		"↞": "twoheadleftarrow",
		"↠": "twoheadrightarrow",
		"↢": "leftarrowtail",
		"↣": "rightarrowtail",
		"⇃": "downharpoonleft",
		"⇂": "downharpoonright",
		"⇋": "leftrightharpoons",
		"⇌": "rightleftharpoons",
		"↰": "Lsh",
		"↱": "Rsh",
		"⇝": "rightsquigarrow",
		"↫": "looparrowleft",
		"↬": "looparrowright",
		"↭": "leftrightsquigarrow",
		"⊸": "multimap",
		"↶": "curvearrowleft",
		"↷": "curvearrowright",
		"↺": "circlearrowleft",
		"↻": "circlearrowright",
		"≮": "nless",
		"≯": "ngtr",
		"⪇": "lneq",
		"⪈": "gneq",
		"≰": "nleq",
		"≱": "ngeq",
		"≨": "lneqq",
		"≩": "gneqq",
		"∤": "nmid",
		"∦": "nparallel",
		"⋦": "lnsim",
		"⋧": "gnsim",
		"≁": "nsim",
		"≇": "ncong",
		"⊀": "nprec",
		"⊁": "nsucc",
		"⪵": "precneqq",
		"⪶": "succneqq",
		"⋨": "precnsim",
		"⋩": "succnsim",
		"⪉": "precnapprox",
		"⪊": "succnapprox",
		"⊊": "subsetneq",
		"⊋": "supsetneq",
		"⋪": "ntriangleleft",
		"⋫": "ntriangleright",
		"⋬": "ntrianglelefteq",
		"⋭": "ntrianglerighteq",
		"⊈": "nsubseteq",
		"⊉": "nsupseteq",
		"⫋": "subsetneqq",
		"⫌": "supsetneqq",
		"⊬": "nvdash",
		"⊭": "nvDash",
		"⊮": "nVdash",
		"⊯": "nVDash",
		"↚": "nleftarrow",
		"↛": "nrightarrow",
		"↮": "nleftrightarrow",
		"⇎": "nLeftrightarrow",
		"⇍": "nLeftarrow",
		"⇏": "nRightarrow",
		"{": "{",
		"}": "}"
	};
}