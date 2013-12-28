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
	private io = new IO();
	private _log: JQuery;
	private _enableLog = false;

	public formula = new Formula(null);
	public activeFormula = this.formula;
	public activeIndex = 0;
	public markedIndex = -1;
	public currentInput = "";
	public type = InputType.Empty;
	public clipboard: Token[] = null;

	digits: string[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
	symbols: string[] = [
		"+", "-", "*", "/", "^", "<=", ">=", "(", ")", "[", "]", "{", "}"
	];

	keywords: { [key: string]: string } = {
		"and": "∧",
		"or": "∨",
		"not": "￢",
		"imp": "→",
		"<=": "≤",
		">=": "≥",
		"infer": "",
		"frac": ""
	};

	public constructor(field: JQuery, latex: JQuery, proof: JQuery)
	{
		this.field = field;
		this.latex = latex;
		document.onkeydown = (e) => { this.processInput(e) };
		proof.change(e =>
		{
			if (proof.prop("checked"))
			{
				this.field.removeClass("math");
				this.field.addClass("formula");
			}
			else
			{
				this.field.removeClass("formula");
				this.field.addClass("math");
			}
		});

		this.enrichKeywords();

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
		this.field.empty();
		this.outputToken(this.field, this.formula);
		this.active.text(this.currentInput);
		//this.active.append($("<span/>").text("_").addClass("curret"));
		this.latex.text(LaTeX.trans(this.formula));
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

		if (key)

		if (this.type == InputType.Empty)
		{
			if (t == InputType.Number)
				this.receiveNumber(key);
			else
				this.receiveSymbol(key);
		}
		else if (this.type == InputType.Number)
		{
			if (t == this.type || key == ".")
				this.receiveNumber(key);
			else
			{
				this.receiveSymbol(" ");
				this.receiveSymbol(key);
			}
		}
		else
		{
			if (t == this.type)
				this.receiveSymbol(key);
			else
			{
				this.receiveSymbol(" ");
				this.receiveNumber(key);
			}
		}

		this.render();
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

		switch (this.io.knowControlKey(e))
		{
			case ControlKey.Left:
				this.moveHorizontal(true);
				break;
			case ControlKey.Right:
				this.moveHorizontal(false);
				break;
			case ControlKey.Up:
				this.moveVertical(true);
				break;
			case ControlKey.Down:
				this.moveVertical(false);
				break;
			case ControlKey.Backspace:
				if (this.currentInput != "")
				{
					this.currentInput = this.currentInput.slice(0, -1);
				}
				else if (this.activeFormula.count > 0)
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
				this.receiveSymbol(" ");
		}

		var dif = toLeft ? -1 : 1;

		if (this.activeIndex + dif >= 0
			&& this.activeIndex + dif <= this.activeFormula.count)
		{
			var dest = this.activeFormula.tokens[this.activeIndex + (toLeft ? -1 : 0)];
			if (this.markedIndex < 0 && dest instanceof TokenSeq)
			{
				if (dest instanceof Structure)
					this.activeFormula = <Formula>(<Structure>dest).tokens[0];
				else
					this.activeFormula = <Formula>(<TokenSeq>dest);

				this.activeIndex = toLeft ? this.activeFormula.count : 0;
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
				&& s.tokens.indexOf(this.activeFormula) < 2)
			{
				this.activeFormula = <Formula>s.tokens[2];
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
		if (this.currentInput != "")
		{
			this.receiveSymbol(" ");
		}
		else if (this.markedIndex >= 0)
			return;

		var ac: TokenSeq = this.activeFormula;
		var p = ac.parent;
		while (p != null)
		{
			if (p instanceof Structure)
			{
				var s = <Structure>p;
				var neig = (toUpper ? s.prev : s.next)(ac);

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
	public receiveNumber(key: string): void
	{
		this.type = InputType.Number;
		this.currentInput += key;
	}
	public receiveSymbol(key: string): void
	{
		if (key == " ")
		{
			var t: Token;
			var input = this.currentInput + (key == " " ? "" : key);

			if (this.currentInput == "")
			{
				if (this.activeFormula.parent instanceof Structure)
				{
					var s = <Structure>this.activeFormula.parent;
					if (s.type == StructType.Infer)
					{
						t = new Symbol("&");	// should be a new kind of Token?
					}
				}
			}
			else
				t = this.tryParse(input);

			if (t != null)	// should be unified to tryParse?
			{
				if (t instanceof Formula)
				{
					var ac = this.activeFormula;
					this.activeFormula = <Formula>t;
					ac.insert(this.activeIndex, t);
					this.activeIndex = 0;
				}
				else if (t instanceof Structure)
				{
					var ac = this.activeFormula;
					var s = <Structure>t;
					if (s.type == StructType.Frac)
					{
						if (this.activeIndex > 0 && input == "/")
						{
							(<Formula>s.tokens[0]).insert(0,
								this.activeFormula.tokens[this.activeIndex - 1]);
							this.activeFormula.remove(this.activeIndex - 1);
							this.activeFormula = <Formula>s.tokens[1];
						}
						else
							this.activeFormula = <Formula>s.tokens[0];
					}
					else if (s.type == StructType.Infer)
					{
						this.activeFormula = <Formula>s.tokens[1];
					}
					else if (s.type == StructType.Power)
					{
						this.activeFormula = <Formula>s.tokens[0];
					}
					ac.insert(this.activeIndex, t);
					this.activeIndex = 0;
				}
				else
				{
					this.activeFormula.insert(this.activeIndex, t);
					this.activeIndex++;
				}

				this.currentInput = "";
				this.type = InputType.Empty;
			}
			else
				this.pushSymbols();
		}
		else
		{
			this.currentInput += key;
			this.type = InputType.String;
		}
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
		this.type = InputType.Empty;
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
		this.type = InputType.Empty;
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
	private tryParse(s: string): Token
	{
		var t: Token = null;

		if (!(this.symbols.some(word => word == s) || s in this.keywords))
			return null;

		var struct: Structure;
		switch (s)
		{
			case "infer":
			case "/":
			case "frac":
				struct = new Structure(this.activeFormula, s == "infer" ? StructType.Infer : StructType.Frac);
				struct.tokens[0] = new Formula(struct);
				struct.tokens[1] = new Formula(struct);
				if (struct.type == StructType.Infer)
					struct.tokens[2] = new Formula(struct);
				t = struct;
				break;
			case "^":
				struct = new Structure(this.activeFormula, StructType.Power);
				struct.tokens[0] = new Formula(struct);
				t = struct;
				break;
			case "(":
				t = new Formula(this.activeFormula, "(", ")");
				break;
			case "[":
				t = new Formula(this.activeFormula, "[", "]");
				break;
			default:
				t = new Symbol(s in this.keywords ? this.keywords[s] : s);
				break;
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
			this._elog("output Symbol: " + (<Symbol>t).ident);
			q.append($("<div/>")
				.addClass("symbol")
				.text(str));
		}
		else if (t instanceof Num)
		{
			this._elog("output Num: " + (<Num>t).value.toString());
			q.append($("<div/>")
				.addClass("symbol")
				.text((<Num>t).value.toString()));
		}
		else if (t instanceof Structure)
		{
			this._elog("output Structure");
			this.outputStruct(q, <Structure>t);
		}
		else if (t instanceof Formula)
		{
			this._elog("output Formula");
			var f = <Formula>t;

			if (f.prefix != "")
				q.append($("<div/>").addClass("brace").text(f.prefix));

			if (f == this.activeFormula)
			{
				var r: JQuery;
				var markedFrom = Math.min(this.markedIndex, this.activeIndex);
				var markedTo = Math.max(this.markedIndex, this.activeIndex);
				var marked = false;
				for (var i = 0, j = 0; i <= f.count; i++)
				{
					if (i == this.activeIndex)
					{
						this.active = $("<div/>").addClass("active");
						q.append(this.active);
						this._elog("curret rendered");
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
					if (j == f.count)
						break;
					this._elog("output formulaA" + (j + 1) + "/" + f.tokens.length);

					this.outputToken(marked ? r : q, f.tokens[j++]);
				}
			}
			else if (f.tokens.length > 0)
				f.tokens.map((s, i) =>
				{
					this._elog("output formula " + i);
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

				this.outputToken(a1, s.tokens[0]);
				this.outputToken(a2, s.tokens[1]);

				q.append(tag);

				if (s.type == StructType.Infer)
				{
					var a3 = $("<div/>").addClass("math label");
					q.append(a3);
					this.outputToken(a3, s.tokens[2]);
				}
				break;

			case StructType.Power:
				tag = $("<div/>").addClass("power");
				var p = $("<div/>").addClass("math");
				tag.append(p);

				this.outputToken(p, s.tokens[0]);

				q.append(tag);
				break;
		}
	}
	private _elog(msg: string): void
	{
		if (this._enableLog)
		{
			this._log.append(msg + "\n");
			window.scrollTo(0, 0);
		}
	}
}

var greeter;

window.onload = () =>
{
	greeter = new Greeter($("#field"), $("#latex"), $("#proofMode"));
};
