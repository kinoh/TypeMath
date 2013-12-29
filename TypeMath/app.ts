/// <reference path="jquery.d.ts" />
/// <reference path="io.ts" />
/// <reference path="formula.ts" />
/// <reference path="latex.ts" />
/// <reference path="unicode.ts" />

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
	public active: JQuery;
	public latex: JQuery;
	public candy: JQuery;
	private io = new IO();
	private _log: JQuery;
	private _status: JQuery;
	private _logText = "";
	private _enableLog = false;

	public formula = new Formula(null);
	public activeFormula = this.formula;
	public activeIndex = 0;
	public markedIndex = -1;
	public candIndex = -1;
	public candCount = 0;
	public candSelected: string = "";
	public currentInput = "";
	public inputType = InputType.Empty;
	public clipboard: Token[] = [];

	digits: string[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
	symbols: string[] = [
		"+", "-", "*", "/", "^", "_", "<=", ">=", "(", ")", "[", "]", "{", "}"
	];

	keywords: { [key: string]: string } = {
		"and": "∧",
		"or": "∨",
		"not": "¬",
		"imp": "→",
		"<=": "≤",
		">=": "≥",
		"infer": "",
		"frac": ""
	};

	public constructor(field: JQuery, latex: JQuery, candy: JQuery, proof: JQuery)
	{
		this.field = field;
		this.latex = latex;
		this.candy = candy;

		this.enrichKeywords();

		document.onkeydown = (e) => { this.processInput(e) };
		proof.change(e =>
		{
			if (proof.prop("checked"))
			{
				this.field.removeClass("math");
				this.field.addClass("formula");
				LaTeX.proofMode = true;
			}
			else
			{
				this.field.removeClass("formula");
				this.field.addClass("math");
				LaTeX.proofMode = false;
			}
		});
		proof.change();

		$(document.body).append(this._status = $("<pre/>").css("font-size", "9pt"));
		$(document.body).append(this._log = $("<pre/>").css("font-size", "9pt"));

		this.render();
	}
	public enrichKeywords(): void
	{
		for (var c in LaTeX.symbols)
		{
			var key = LaTeX.symbols[c];
			if (!(key in this.keywords))
				this.keywords[key] = c;
		}
	}
	public render(): void
	{
		this._elog("rendering begin;");

		this.field.empty();
		this.outputToken(this.field, this.formula);

		this._elog("outputToken finished");

		this.active.text(this.currentInput);
		this.showCandidate();

		this._elog("showCandidate finished");

		this.latex.text(LaTeX.trans(this.formula));

		this._elog("rendering end;");

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
	public processInput(e: KeyboardEvent): void
	{
		var key = this.io.knowKey(e);

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
				this.interpretSymbol();
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
	public processControlInput(e: KeyboardEvent): void
	{
		var suppress = true;
		var key = this.io.knowControlKey(e);

		switch (key)
		{
			case ControlKey.Tab:
				this.currentInput = this.candSelected;
				break;
			case ControlKey.Enter:
				this.decideCandidate();
				break;
			case ControlKey.Space:
				if (this.currentInput == "")
					this.moveNext();
				else
					this.interpretSymbol();
				break;
			case ControlKey.Left:
			case ControlKey.Right:
				this.moveHorizontal(key == ControlKey.Left);
				break;
			case ControlKey.Up:
				if (this.currentInput != "")
				{
					if (this.candIndex < 0)
						return;
					if (--this.candIndex < 0)
						this.candIndex = this.candCount - 1;
				}
				else
					this.moveVertical(true);
				break;
			case ControlKey.Down:
				if (this.currentInput != "")
				{
					if (this.candIndex < 0)
						return;
					if (++this.candIndex >= this.candCount)
						this.candIndex = 0;
				}
				else
					this.moveVertical(false);
				break;
			case ControlKey.Backspace:
				if (this.currentInput != "")
				{
					this.currentInput = this.currentInput.slice(0, -1);
					if (this.currentInput == "")
						this.inputType = InputType.Empty;
				}
				else if (this.activeFormula.count() > 0)
				{
					this.activeFormula.remove(this.activeIndex - 1);
					this.activeIndex--;
				}
				break;
			case ControlKey.Shift:
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
	public processModifiedInput(key: string): void
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
	public moveNext(): void
	{
		if (this.activeFormula.parent instanceof Structure)
		{
			var p = <Structure> this.activeFormula.parent;
			if (p.type == StructType.Infer
				&& p.elems[1] == this.activeFormula)
			{
				this.inputType = InputType.String;
				this.currentInput = "&";
				this.interpretSymbol();
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
					this.moveHorizontal(false);
			}
		}
		else
			this.moveHorizontal(false);
	}
	public moveHorizontal(toLeft: boolean): void
	{
		if (this.currentInput != "")
		{
			if (toLeft)
			{
				this.currentInput = this.currentInput.slice(0, -1);
				return;
			}
			else
				this.interpretSymbol();
		}

		var dif = toLeft ? -1 : 1;

		if (this.activeIndex + dif >= 0
			&& this.activeIndex + dif <= this.activeFormula.count())
		{
			var dest = this.activeFormula.tokens[this.activeIndex + (toLeft ? -1 : 0)];
			if (this.markedIndex < 0 && (dest instanceof Structure || dest instanceof Formula))
			{
				if (dest instanceof Structure)
					this.activeFormula = <Formula>(<Structure> dest).token(0);
				else
					this.activeFormula = <Formula> dest;

				this.activeIndex = toLeft ? this.activeFormula.count() : 0;
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
			this.activeIndex = f.tokens.indexOf(this.activeFormula) + (toLeft ? 0 : 1);
			if (this.markedIndex >= 0)
				this.markedIndex = this.activeIndex + (toLeft ? 1 : -1);
			this.activeFormula = f;
		}
		else if (p instanceof Structure)
		{
			var s = <Structure>p;
			if (this.markedIndex < 0
				&& s.type == StructType.Infer && !toLeft
				&& s.elems.indexOf(this.activeFormula) < 2)
			{
				this.activeFormula = <Formula>s.token(2);
				this.activeIndex = 0;
			}
			else
			{
				var f = <Formula>(s.parent);
				this.activeIndex = f.tokens.indexOf(s) + (toLeft ? 0 : 1);
				if (this.markedIndex >= 0)
					this.markedIndex = this.activeIndex + (toLeft ? 1 : -1);
				this.activeFormula = f;
			}
		}
	}
	public moveVertical(toUpper: boolean): void
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
				var neig = (toUpper ? s.prev : s.next)(<Formula> ac);

				if (neig != null)
				{
					this.activeFormula = <Formula>neig;
					this.activeIndex = 0;
					return;
				}
			}
			ac = p;
			p = p.parent;
		}
	}
	public interpretSymbol(): void
	{
		var t: Token = null;
		var input = this.currentInput;

		if (!(input.length == 1 && this.getInputType(input) == InputType.String)		// single character will not interpreted (unless, you cannot input "P"!)
			&& (this.symbols.some(word => word == input) || input in this.keywords))
			this.pushCommand();
		else
			this.pushSymbols();
	}
	private decideCandidate(): void
	{
		if (this.candIndex < 0)
		{
			this.pushSymbols();
			return;
		}

		this.currentInput = this.candSelected;
		this.interpretSymbol();
	}
	public showCandidate(): void
	{
		var key = this.currentInput;

		var cand = Object.keys(this.keywords).filter(w => w.indexOf(key) == 0);

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

		this.candy.empty();
		cand.forEach((c, i) =>
		{
			var glyph = (c in this.keywords ? this.keywords[c] : c);
			var e = $("<div/>").addClass("candidate").text(c + " " + glyph);
			if (i == this.candIndex)
			{
				e.addClass("candidateSelected");
				this.candSelected = c;
			}
			this.candy.append(e);
		});

		this.candCount = cand.length;
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
		var close = { "(": ")", "{": "}", "[": "]", "|": "|" };
		var input = this.currentInput;
		var struct: Structure;
		var ac = this.activeFormula;

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

				if (this.activeIndex > 0 && input == "/")
				{
					struct.elems[0].insert(0,
						this.activeFormula.tokens[this.activeIndex - 1]);
					this.activeFormula.remove(this.activeIndex - 1);
					this.activeFormula = struct.elems[1];
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
			case "(":
			case "[":
			case "{":
				var f = new Formula(this.activeFormula, input, close[input]);
				this.activeFormula = f;
				ac.insert(this.activeIndex, f);
				this.activeIndex = 0;
				break;
			default:
				this.activeFormula.insert(this.activeIndex,
					new Symbol(input in this.keywords ? this.keywords[input] : input));
				this.activeIndex++;
				break;
		}

		this.currentInput = "";
		this.inputType = InputType.Empty;
	}
	private pushSymbols(): void
	{
		var t: Token;

		for (var i = 0; i < this.currentInput.length; i++)
		{
			t = new Symbol(this.currentInput.charAt(i));
			this.activeFormula.insert(this.activeIndex, t);
			this.activeIndex++;
		}

		this.currentInput = "";
		this.inputType = InputType.Empty;
	}
	private tryParseNumber(s: string): Token
	{
		var t: Token = null;

		if (s.match("[0-9]+(\.[0-9]*)?"))
		{
			var n = RegExp.$1.length == 0 ? parseInt(s) : parseFloat(s);

			if (!isNaN(n))
				t = new Num(n);
		}

		return t;
	}
	public outputToken(q: JQuery, t: Token): void
	{
		if (t instanceof Symbol)
		{
			var str = (<Symbol>t).ident;
			if (str == "&")
				str = Unicode.EmSpace;
			q.append($("<div/>")
				.addClass("symbol")
				.text(str));
		}
		else if (t instanceof Num)
		{
			q.append($("<div/>")
				.addClass("symbol")
				.text((<Num>t).value.toString()));
		}
		else if (t instanceof Structure)
		{
			this.outputStruct(q, <Structure>t);
		}
		else if (t instanceof Formula)
		{
			var f = <Formula>t;

			if (f.prefix != "")
				q.append($("<div/>").addClass("brace").text(f.prefix));

			if (f == this.activeFormula)
			{
				var r: JQuery;
				var markedFrom = Math.min(this.markedIndex, this.activeIndex);
				var markedTo = Math.max(this.markedIndex, this.activeIndex);
				var marked = false;
				for (var i = 0, j = 0; i <= f.count(); i++)
				{
					if (i == this.activeIndex)
					{
						this.active = $("<div/>").addClass("active");
						q.append(this.active);
					}
					if (this.markedIndex >= 0)
					{
						if (j == markedFrom)
						{
							r = $("<div/>").addClass("math marked");
							q.append(r);
							marked = true;
						}
						if (j == markedTo)
							marked = false;
					}
					if (j == f.count())
						break;

					this.outputToken(marked ? r : q, f.tokens[j++]);
				}
			}
			else if (f.tokens.length > 0)
				f.tokens.forEach(s =>
				{
					this.outputToken(q, s);
				});
			else
				q.append($("<div/>").addClass("blank").text(Unicode.EnSpace));

			if (f.suffix != "")
				q.append($("<div/>").addClass("brace").text(f.suffix));
		}
		else
			alert("Unexpected Argument (outputToken)\n" + t);
	}
	public outputStruct(q: JQuery, s: Structure): void
	{
		var tag: JQuery;
		switch (s.type)
		{
			case StructType.Frac:
			case StructType.Infer:
				var cls = s.type == StructType.Frac ? "math" : "formula";
				tag = $("<div/>").addClass("frac");
				var a1 = $("<div/>").addClass(cls);
				var a2 = $("<div/>").addClass(cls + " infered");
				tag.append(a1);
				tag.append(a2);
				q.append(tag);

				if (s.type == StructType.Infer)
				{
					var a3 = $("<div/>").addClass("math label");
					this.outputToken(a1, s.token(1));
					this.outputToken(a2, s.token(0));
					this.outputToken(a3, s.token(2));
					q.append(a3);
				}
				else
				{
					this.outputToken(a1, s.token(0));
					this.outputToken(a2, s.token(1));
				}

				break;

			case StructType.Power:
			case StructType.Index:
				tag = $("<div/>").addClass(s.type == StructType.Power ? "power" : "index");
				var p = $("<div/>").addClass("math");
				tag.append(p);

				this.outputToken(p, s.token(0));

				q.append(tag);
				break;
		}
	}
	private _elog(msg: string): void
	{
		if (this._logText.length == 40000)
			alert("too long log text!");
		this._logText = msg + "\n" + this._logText;

		if (this._enableLog)
		{
			this._log.text(this._logText);
			window.scrollTo(0, 0);
		}
	}
}

var greeter;

window.onload = () =>
{
	greeter = new Greeter($("#field"), $("#latex"), $("#candy"), $("#proofMode"));
};
