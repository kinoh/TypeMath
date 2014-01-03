/// <reference path="jquery.d.ts" />
/// <reference path="keyboard.ts" />
/// <reference path="formula.ts" />
/// <reference path="latex.ts" />
/// <reference path="unicode.ts" />
/// <reference path="glyph.ts" />
/// <reference path="calc.ts" />

enum InputType
{
	Empty,
	Number,
	Symbol,
	String
}

class Greeter
{
	private field: JQuery;
	private active: JQuery;
	private latex: JQuery;
	private candy: JQuery;
	private glyph;
	private _log: JQuery;
	private _status: JQuery;
	private _logText = "";
	private _enableLog = false;
	private _enableStatus = false;

	private formula = new Formula(null);
	private activeFormula = this.formula;
	private activeIndex = 0;
	private markedIndex = -1;
	private candIndex = -1;
	private candCount = 0;
	private candSelected = "";
	private currentInput = "";
	private inputType = InputType.Empty;
	private proofMode: boolean;
	private clipboard: Token[] = [];
	private outputCurrentStyle: FontStyle[];

	public candMax = 16;

	private digits: string[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
	private symbols: string[] = [
		"+", "-", "*", "/", "^", "_", "!", ":", ",", "<=", ">=", "(", ")", "[", "]", "{", "}", "|"
	];
	private operators: string[] = [
		"∑", "∏", "∐", "⋂", "⋃", "⨄", "⨆", "⋁", "⋀", "⨁", "⨂", "⨀",
		"∫", "∮", "∬", "∭", "⨌"
	];

	private keywords: { [key: string]: string } = {
		"and": "∧",
		"or": "∨",
		"not": "¬",
		"imp": "→",
		"<=": "≤",
		">=": "≥",
		"infer": "",
		"frac": "",
		"matrix": "",
		"pmatrix": "(",
		"bmatrix": "[",
		"Bmatrix": "{",
		"vmatrix": "|",
		"Vmatrix": "‖",
		"(": "(",
		"[": "[",
		"|": "|",
		"floor": "⌊",
		"ceil": "⌈",
		"angle": "〈",
		"sqrt": "√",
		"mathbf": "",
		"mathbb": "",
		"mathrm": "",
		"mathtt": "",
		"mathscr": "",
		"mathfrak": ""
	};

	private bracketCor = {
		"(": ")", "{": "}", "[": "]", "|": "|", "‖": "‖", "⌊": "⌋", "⌈": "⌉", "〈": "〉", "√": ""
	};

	constructor(field: JQuery, latex: JQuery, candy: JQuery, proof: JQuery)
	{
		this.field = field;
		this.latex = latex;
		this.candy = candy;

		this.enrichKeywords();

		document.onkeydown = (e) => { this.processInput(e) };
		proof.change(e =>
		{
			this.proofMode = proof.prop("checked");
		});
		proof.change();

		$(document.body).append(this._status = $("<pre/>").css("font-size", "9pt"));
		$(document.body).append(this._log = $("<pre/>").css("font-size", "9pt"));

		this.render();

		var canvas = $("<canvas/>").addClass("hiddenWorks");
		$(document.body).append(canvas);
		this.glyph = new GlyphFactory(<HTMLCanvasElement> canvas[0]);
	}
	private enrichKeywords(): void
	{
		for (var c in LaTeX.symbols)
		{
			var key = LaTeX.symbols[c];
			if (!(key in this.keywords))
				this.keywords[key] = c;
		}
	}
	private render(): void
	{
		this.field.empty();
		this.outputCurrentStyle = [FontStyle.Normal];
		this.outputToken(this.field, this.formula);

		this.active.text(this.currentInput != "" ? this.currentInput : Unicode.SixPerEmSpace);
		this.showCandidate();

		this.latex.text(LaTeX.trans(this.formula, "", this.proofMode));

		if (this._enableStatus)
			this._status.text([
				"formula       = " + this.formula.toString(),
				"activeFormula = " + this.activeFormula.toString(),
				"activeIndex   = " + this.activeIndex.toString(),
				"markedIndex   = " + this.markedIndex.toString(),
				"candIndex     = " + this.candIndex.toString(),
				"candCount     = " + this.candCount.toString(),
				"candSelected  = " + this.candSelected.toString(),
				"currentInput  = " + this.currentInput.toString(),
				"inputType     = " + (this.inputType == InputType.Empty ? "Empty" :
				this.inputType == InputType.Number ? "Number" :
				this.inputType == InputType.String ? "String" : "Symbol"),
				"clipboard     = " + this.clipboard.toString()].join("\n"));
	}
	private processInput(e: KeyboardEvent): void
	{
		var key = Keyboard.knowKey(e);

		if (key == "")
		{
			this.processControlInput(e);
			return;
		}
		else if (e.ctrlKey)
		{
			this.processModifiedInput(key);
			return;
		}

		this.markedIndex = -1;
		var t = this.getInputType(key);

		if (this.inputType == InputType.Empty)
		{
			this.currentInput += key;
			this.inputType = t;
		}
		else if (this.inputType == InputType.Number)
		{
			if (t == this.inputType || key == ".")
				this.currentInput += key;
			else
			{
				this.pushNumber();
				this.inputType = t;
				this.currentInput += key;
			}
		}
		else
		{
			if (t == this.inputType)
				this.currentInput += key;
			else
			{
				this.interpretInput();
				this.inputType = t;
				this.currentInput += key;
			}
		}

		this.render();
		e.preventDefault();
	}
	private getInputType(s: string): InputType
	{
		if (this.digits.indexOf(s) >= 0)
			return InputType.Number;
		else if (this.symbols.indexOf(s) >= 0)
			return InputType.Symbol;
		else
			return InputType.String;
	}
	private processControlInput(e: KeyboardEvent): void
	{
		var suppress = true;
		var key = Keyboard.knowControlKey(e);

		switch (key)
		{
			case ControlKey.Tab:
				if (this.candIndex >= 0)
					this.currentInput = this.candSelected;
				break;
			case ControlKey.Enter:
				if (this.candIndex >= 0)
					this.decideCandidate();
				else if (this.activeIndex > 0
					&& this.activeFormula.tokens[this.activeIndex - 1] instanceof Symbol
					&& (<Symbol> this.activeFormula.tokens[this.activeIndex - 1]).str == "=")
				{
					var res = Calc.eval(this.activeFormula.tokens.slice(0, this.activeIndex - 1));
					this.activeFormula.paste(this.activeIndex, [res !== null ? res : new Symbol("?", false)]);
					this.activeIndex++;
				}
				break;
			case ControlKey.Space:
				if (this.currentInput == "")
				{
					if (e.shiftKey)
					{
						this.markedIndex = -1;
						this.movePrev();
					}
					else
						this.moveNext();
				}
				else
					this.interpretInput();
				break;
			case ControlKey.Left:
			case ControlKey.Right:
				if (e.ctrlKey
					&& this.activeFormula.parent != null
					&& this.activeFormula.parent instanceof Matrix)
				{
					var m = <Matrix> this.activeFormula.parent;
					(key == ControlKey.Right ? m.extend : m.shrink)(true);
				}
				else
					this.moveHorizontal(key == ControlKey.Right);
				break;
			case ControlKey.Up:
			case ControlKey.Down:
				if (e.ctrlKey
					&& this.activeFormula.parent != null
					&& this.activeFormula.parent instanceof Matrix)
				{
					var m = <Matrix> this.activeFormula.parent;
					(key == ControlKey.Down ? m.extend : m.shrink)(false);
				}
				else if (this.currentInput != "")
					this.changeCandidate(key == ControlKey.Down);
				else
					this.moveVertical(key == ControlKey.Up);
				break;
			case ControlKey.Backspace:
				if (this.currentInput != "")
				{
					this.currentInput = this.currentInput.slice(0, -1);
					if (this.currentInput == "")
						this.inputType = InputType.Empty;
				}
				else if (this.markedIndex >= 0)
				{
					var i = Math.min(this.markedIndex, this.activeIndex);
					this.activeFormula.remove(i, Math.abs(this.markedIndex - this.activeIndex));
					this.markedIndex = -1;
					this.activeIndex = i;
				}
				else if (this.activeIndex > 0)
				{
					this.activeFormula.remove(this.activeIndex - 1);
					this.activeIndex--;
				}
				break;
			case ControlKey.Shift:
				if (this.activeFormula.count() == 0)
					break;
				if (this.markedIndex < 0)
					this.markedIndex = this.activeIndex;
				else
					this.markedIndex = -1;
				break;
			default:
				suppress = false;
		}

		if (suppress)
			e.preventDefault();
		this.render();
	}
	private processModifiedInput(key: string): void
	{
		switch (key)
		{
			case "c":
				if (this.markedIndex >= 0)
				{
					this.clipboard = this.activeFormula.copy(this.markedIndex, this.activeIndex);
					this.markedIndex = -1;
				}
				break;
			case "x":
				if (this.markedIndex >= 0)
				{
					this.clipboard = this.activeFormula.cut(this.markedIndex, this.activeIndex);
					this.activeIndex = Math.min(this.activeIndex, this.markedIndex);
					this.markedIndex = -1;
				}
				break;
			case "v":
				if (this.clipboard != null)
				{
					this.activeFormula.paste(this.activeIndex, this.clipboard);
					this.activeIndex += this.clipboard.length;
				}
				break;
		}

		this.render();
	}
	private movePrev(): void
	{
		if (this.activeFormula.parent instanceof Structure)
		{
			var p = <Structure> this.activeFormula.parent;
			var prev: Formula;

			if (this.activeIndex == 0
				&& (prev = p.prev(this.activeFormula)) != null)
			{
				this.activeFormula = prev;
				this.activeIndex = prev.count();
			}
			else
				this.moveHorizontal(false);
		}
		else
			this.moveHorizontal(false);
	}
	private moveNext(): void
	{
		if (this.activeFormula.parent instanceof Structure)
		{
			var p = <Structure> this.activeFormula.parent;
			if (p.type == StructType.Infer
				&& p.elems[1] == this.activeFormula)
			{
				this.inputType = InputType.String;
				this.currentInput = "&";
				this.interpretInput();
			}
			else
			{
				var next: Formula;
				if (this.activeIndex == this.activeFormula.count()
					&& (next = p.next(this.activeFormula)) != null)
				{
					this.activeFormula = next;
					this.activeIndex = 0;
				}
				else
					this.moveHorizontal(true);
			}
		}
		else
			this.moveHorizontal(true);
	}
	private moveHorizontal(toRight: boolean): void
	{
		if (this.currentInput != "")
		{
			if (!toRight)
			{
				this.currentInput = this.currentInput.slice(0, -1);
				return;
			}
			else
				this.interpretInput();
		}

		var dif = toRight ? 1 : -1;

		if (this.activeIndex + dif >= 0
			&& this.activeIndex + dif <= this.activeFormula.count())
		{
			var dest = this.activeFormula.tokens[this.activeIndex + (toRight ? 0 : -1)];
			if (this.markedIndex < 0 && (dest instanceof Structure || dest instanceof Formula))
			{
				if (dest instanceof Structure)
				{
					var s = <Structure> dest;
					this.activeFormula = <Formula> s.token(toRight ? 0 : s.elems.length - 1);
				}
				else
					this.activeFormula = <Formula> dest;

				this.activeIndex = toRight ? 0 : this.activeFormula.count();
			}
			else
				this.activeIndex += dif;

			return;
		}

		var p = this.activeFormula.parent;

		if (p == null)
			return;
		else if (p instanceof Formula)
		{
			var f = <Formula>p;
			this.activeIndex = f.tokens.indexOf(this.activeFormula) + (toRight ? 1 : 0);
			if (this.markedIndex >= 0)
				this.markedIndex = this.activeIndex + dif;
			this.activeFormula = f;
		}
		else if (p instanceof Structure)
		{
			var s = <Structure> p;

			if (s.type == StructType.Matrix)
			{
				var m = <Matrix> s;
				var a = m.around(this.activeFormula, true, toRight);
				if (a != null)
				{
					this.activeFormula = a;
					this.activeIndex = toRight ? 0 : this.activeFormula.count();
					return;
				}
			}

			if (this.markedIndex < 0
				&& s.type == StructType.Infer && toRight
				&& s.elems.indexOf(this.activeFormula) < 2)	// label of infer
			{
				this.activeFormula = <Formula>s.token(2);
				this.activeIndex = 0;
			}
			else
			{
				var f = <Formula>(s.parent);
				this.activeIndex = f.tokens.indexOf(s) + (toRight ? 1 : 0);
				if (this.markedIndex >= 0)
					this.markedIndex = this.activeIndex + dif;
				this.activeFormula = f;
			}
		}
	}
	private moveVertical(toUpper: boolean): void
	{
		if (this.markedIndex >= 0)
			return;

		var ac: TokenSeq = this.activeFormula;
		var p = ac.parent;
		while (p != null)
		{
			if (p instanceof Structure)
			{
				var s = <Structure>p;
				var neig: Formula;
				if (s.type == StructType.Infer)
					neig = (toUpper ? s.next : s.prev)(<Formula> ac);
				else if (s.type == StructType.Matrix)
					neig = (<Matrix> s).around(<Formula> ac, false, !toUpper);
				else
					neig = (toUpper ? s.prev : s.next)(<Formula> ac);

				if (neig != null)
				{
					this.activeFormula = <Formula>neig;

					var rect = this.active[0].getBoundingClientRect();
					var x0 = (rect.left + rect.right) / 2;
					var a : number[] = [];
					for (var i = 0; i < neig.tokens.length; i++)
					{
						var r = neig.tokens[i].renderedElem[0].getBoundingClientRect();
						if (i == 0)
							a.push(r.left);
						a.push(r.right);
					}
					this.activeIndex = (a.length == 0) ? 0
						: a.map((x, i) => ({ d: Math.abs(x - x0), index: i }))
							.reduce((prev, curr) => (curr.d < prev.d) ? curr : prev).index;

					return;
				}
			}
			ac = p;
			p = p.parent;
		}
	}
	private interpretInput(forceTrans?: boolean): void
	{
		var t: Token = null;
		var input = this.currentInput;

		if (this.inputType == InputType.Number)
			this.pushNumber();
		// single character will not interpreted (unless, you cannot input "P"!)
		// "Vert" shuld be treated as single char in order to enable to input |, \left|, \| and \left\| efficiently.
		else if ((forceTrans != undefined && forceTrans
				|| input.length > 1 && input != "Vert"
				|| input.length == 1 && !(this.inputType == InputType.String || input in this.bracketCor))
			&& (this.symbols.indexOf(input) >= 0 || input in this.keywords))
			this.pushCommand();
		else
			this.pushSymbols();
	}
	private changeCandidate(next: boolean): void
	{
		if (this.candIndex < 0)
			return;

		if (next && ++this.candIndex >= this.candCount)
			this.candIndex = 0;
		if (!next && --this.candIndex < 0)
			this.candIndex = this.candCount - 1;
	}
	private decideCandidate(): void
	{
		if (this.candIndex < 0)
		{
			this.pushSymbols();
			return;
		}

		this.currentInput = this.candSelected;
		this.interpretInput(true);
	}
	private showCandidate(): void
	{
		var key = this.currentInput;

		var keys = Object.keys(this.keywords);
		var cand = keys.filter(w => w.indexOf(key) == 0)
			.concat(keys.filter(w => w.indexOf(key) > 0));

		if (key == "|")	// for poor key map (such as Firefox's one)
			cand.splice(1, 0, "_");

		if (key.length == 0 || cand.length == 0)
		{
			this.candy.css("visibility", "hidden");
			this.candIndex = -1;
			return;
		}

		if (this.candIndex < 0)	// not shown now
		{
			var ofs = this.active.offset();

			this.candIndex = 0;
			this.candy.css({
				"visibility": "visible",
				"left": ofs.left,
				"top": ofs.top + this.active.height()
			});
		}

		this.candCount = cand.length;

		var i0 = 0;

		if (cand.length > this.candMax)
		{
			i0 = this.candIndex - this.candMax / 2;

			if (i0 < 0)
				i0 = 0;
			else if (i0 > this.candCount - this.candMax)
				i0 = this.candCount - this.candMax;

			cand = cand.slice(i0, i0 + this.candMax);
		}

		this.candy.empty();
		cand.forEach((c, i) =>
		{
			var glyph = (c in this.keywords ? this.keywords[c] : c);
			var e = $("<div/>").addClass("candidate").text(c + " " + glyph);
			if (i0 + i == this.candIndex)
			{
				e.addClass("candidateSelected");
				this.candSelected = c;
			}
			this.candy.append(e);
		});
	}
	private pushNumber(): void
	{
		var t = this.tryParseNumber(this.currentInput);

		if (t != null)
		{
			this.activeFormula.insert(this.activeIndex, t);
			this.activeIndex++;
		}

		this.currentInput = "";
		this.inputType = InputType.Empty;
	}
	private pushCommand(): void
	{
		var input = this.currentInput;
		var struct: Structure;
		var ac = this.activeFormula;
		var style = FontStyle.Normal;

		switch (input)
		{
			case "infer":
			case "/":
			case "frac":
				struct = new Structure(this.activeFormula,
					input == "infer" ? StructType.Infer : StructType.Frac);
				struct.elems[0] = new Formula(struct);
				struct.elems[1] = new Formula(struct);
				if (struct.type == StructType.Infer)
					struct.elems[2] = new Formula(struct);

				var last = this.activeFormula.tokens[this.activeIndex - 1];
				if (this.activeIndex > 0 && input != "frac"
					&& !(last instanceof Symbol && (<Symbol> last).str == "&"))
				{
					struct.elems[0].insert(0, last);
					this.activeFormula.remove(this.activeIndex - 1);
					this.activeFormula = struct.elems[1];
					this.activeIndex--;
				}
				else
					this.activeFormula = struct.elems[0];

				ac.insert(this.activeIndex, struct);
				this.activeIndex = 0;
				break;
			case "^":
			case "_":
				struct = new Structure(this.activeFormula,
					input == "^" ? StructType.Power : StructType.Index);
				struct.elems[0] = new Formula(struct);
				this.activeFormula = struct.elems[0];

				ac.insert(this.activeIndex, struct);
				this.activeIndex = 0;
				break;
			case "matrix":
			case "pmatrix":
			case "bmatrix":
			case "Bmatrix":
			case "vmatrix":
			case "Vmatrix":
				struct = new Matrix(this.activeFormula, 1, 1);
				struct.elems[0] = new Formula(struct);

				var br = this.keywords[input];
				if (br == "")
					ac.insert(this.activeIndex, struct);
				else
				{
					var f = new Formula(this.activeFormula, br, this.bracketCor[br]);
					ac.insert(this.activeIndex, f);
					struct.parent = f;
					f.insert(0, struct);
				}
				this.activeFormula = struct.elems[0];
				this.activeIndex = 0;
				break;
			case "(":
			case "[":
			case "{":
			case "|":
			case "Vert":
			case "floor":
			case "ceil":
			case "angle":
			case "sqrt":
				var br = this.keywords[input];
				var f = new Formula(this.activeFormula, br, this.bracketCor[br]);
				this.activeFormula = f;
				ac.insert(this.activeIndex, f);
				this.activeIndex = 0;
				break;
			case "mathbf":
			case "mathrm":
			case "mathscr":
			case "mathfrak":
			case "mathbb":
			case "mathtt":
				var f = new Formula(this.activeFormula, "", "", LaTeX.styles[input]);
				this.activeFormula = f;
				ac.insert(this.activeIndex, f);
				this.activeIndex = 0;				
				break;
			default:
				var s = (input in this.keywords)
					? new Symbol(this.keywords[input], false)
					: new Symbol(input, this.inputType == InputType.String);
				this.activeFormula.insert(this.activeIndex, s);
				this.activeIndex++;
				break;
		}

		this.currentInput = "";
		this.inputType = InputType.Empty;
	}
	private pushSymbols(): void
	{
		var t: Symbol;
		var input: string[];

		if (this.currentInput == "Vert")
			input = ["‖"];
		else
		{
			if (this.currentInput == "")
				return;
			input = this.currentInput.split("");
		}

		for (var i = 0; i < input.length; i++)
		{
			var c = input[i];

			t = new Symbol(c, this.inputType == InputType.String);
			this.activeFormula.insert(this.activeIndex, t);
			this.activeIndex++;
		}

		if (t.str in this.bracketCor)
			this.activeFormula.insert(this.activeIndex + 1, new Symbol(this.bracketCor[t.str], false));

		this.currentInput = "";
		this.inputType = InputType.Empty;
	}
	private tryParseNumber(s: string): Token
	{
		var t: Token = null;

		if (s.match("[0-9]+(\.[0-9]*)?"))
		{
			t = new Num(s);
		}

		return t;
	}
	private outputToken(q: JQuery, t: Token): JQuery
	{
		var e: JQuery;

		if (t instanceof Symbol)
		{
			var v = <Symbol> t;
			var str = v.str;
			var style = this.outputCurrentStyle[0];
			var cls;

			if (style != FontStyle.Normal)
				str = this.transStyle(str, style);
			if (str == "&")
				str = Unicode.EmSpace;

			e = $("<div/>").text(str);

			if (style != FontStyle.Normal)
				e.addClass("styledLetter");
			if (!this.proofMode && v.variable && (style == FontStyle.Normal || style == FontStyle.Bold))
				e.addClass("variable");
			else
				e.addClass("symbol");
			if (this.operators.indexOf(str) >= 0)
				e.addClass("operator");

			q.append(e);
		}
		else if (t instanceof Num)
		{
			e = $("<div/>")
				.addClass("number")
				.text((<Num>t).value.toString());
			q.append(e);
		}
		else if (t instanceof Structure)
		{
			var s = <Structure> t;
			e = this.outputStruct(s);
			q.append(e);
			if (s.type == StructType.Infer)
			{
				var a3 = $("<div/>").addClass("math label");
				this.outputToken(a3, s.token(2));
				q.append(a3);
			}
		}
		else if (t instanceof Formula)
		{
			var f = <Formula> t;
			e = this.outputFormula(f);
			q.append(e);
		}
		else
			console.error("[Greeter.outputToken] unexpected argument : " + t);

		t.renderedElem = e;

		return e;
	}
	private transStyle(str: string, style: FontStyle): string
	{
		var table: { [key: string]: string };

		switch (style)
		{
			case FontStyle.Bold:		table = Unicode.Bold; break;
			case FontStyle.Script:		table = Unicode.Script; break;
			case FontStyle.Fraktur:		table = Unicode.Fraktur; break;
			case FontStyle.BlackBoard:	table = Unicode.DoubleStruck; break;
			case FontStyle.Roman:		table = Unicode.SansSerif; break;
			case FontStyle.Typewriter:	table = Unicode.Monospace; break;
			default: console.error("[Greeter.transStyle] unexpected font style : " + style);
		}

		var r = "";

		for (var i = 0; i < str.length; i++)
		{
			var c = str.charAt(i);
			r += c in table ? table[c] : c;
		}

		return r;

	}
	private outputStruct(s: Structure): JQuery
	{
		var e: JQuery;

		switch (s.type)
		{
			case StructType.Frac:
			case StructType.Infer:
				var cls = s.type == StructType.Frac ? "math" : "formula";
				e = $("<div/>").addClass("frac");

				var upper = s.token(s.type != StructType.Infer ? 0 : 1);
				var lower = s.token(s.type != StructType.Infer ? 1 : 0);

				this.outputToken(e, upper);
				this.outputToken(e, lower).addClass("overline");

				break;

			case StructType.Power:
			case StructType.Index:
				e = $("<div/>").addClass(s.type == StructType.Power ? "power" : "index");
				this.outputToken(e, s.token(0));
				break;

			case StructType.Matrix:
				var m = <Matrix> s;
				e = $("<div/>").addClass("matrix");
				for (var i = 0; i < m.rows; i++)
				{
					var r = $("<div/>").addClass("row");
					for (var j = 0; j < m.cols; j++)
					{
						var c = $("<div/>").addClass("cell");
						this.outputToken(c, m.tokenAt(i, j));
						r.append(c);
					}
					e.append(r);
				}
				break;
		}

		return e;
	}
	private outputFormula(f: Formula): JQuery
	{
		var r: JQuery;
		var shift = false;

		if (f.style != this.outputCurrentStyle[0])
		{
			this.outputCurrentStyle.unshift(f.style);
			shift = true;
		}

		if (f.prefix != "" || f.suffix != "")
		{
			var braced = $("<div/>").addClass("embraced");

			if (f.prefix != "")
				braced.append(this.makeBracket(f.prefix));

			var inner = this.outputFormulaInner(f);
			if (f.prefix == "√")
				inner.addClass("overline");
			braced.append(inner);

			if (f.suffix != "")
				braced.append(this.makeBracket(f.suffix));

			r = braced;
		}
		else
			r = this.outputFormulaInner(f);

		if (shift)
		{
			r.addClass("formulaStyled");
			this.outputCurrentStyle.shift();
		}

		return r;
	}
	private makeBracket(char: string): JQuery
	{
		var q = $("<div/>").addClass("bracket");
		var dat = this.glyph.generate(char);

		if (dat != "")
			q = q.css("background-image", "url(" + dat + ")");
		else
			q = q.text(char);

		return q;
	}
	private outputFormulaInner(f: Formula): JQuery
	{
		var e = $("<div/>").addClass(this.proofMode ? "formula" : "math");

		if (f == this.activeFormula)
		{
			var r: JQuery;
			var markedFrom = Math.min(this.markedIndex, this.activeIndex);
			var markedTo = Math.max(this.markedIndex, this.activeIndex);
			var marked = false;
			for (var i = 0, j = 0; i <= f.count(); i++)
			{
				if (i == this.activeIndex && this.markedIndex < 0)
				{
					this.active = $("<div/>").addClass("active");
					e.append(this.active);
				}
				if (this.markedIndex >= 0)
				{
					if (j == markedFrom)
					{
						r = $("<div/>").addClass("math marked");
						e.append(r);
						marked = true;
					}
					if (j == markedTo)
						marked = false;
				}
				if (j == f.count())
					break;

				this.outputToken(marked ? r : e, f.tokens[j++]);
			}
		}
		else if (f.tokens.length > 0)
			f.tokens.forEach(s =>
			{
				this.outputToken(e, s);
			});
		else
			e.append($("<div/>").addClass("blank").text(Unicode.EnSpace));

		return e;
	}
}

var greeter;

window.onload = () =>
{
	greeter = new Greeter($("#field"), $("#latex"), $("#candy"), $("#proofMode"));
};
