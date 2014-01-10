﻿/// <reference path="jquery.d.ts" />
/// <reference path="keyboard.ts" />
/// <reference path="formula.ts" />
/// <reference path="diagram.ts" />
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

enum RecordType
{
	Transfer,
	CreAnn,
	EditMatrix
}
interface Record { type: RecordType; index: number; }
interface RecordTransfer { type: RecordType; index: number; deeper: boolean; }
interface RecordCreAnn { type: RecordType; index: number; insert: boolean; contents: Token[]; }
interface RecordEditMatrix { type: RecordType; index: number; horizontal: boolean; extend: boolean; }

class Application
{
	private field: JQuery;
	private active: JQuery;
	private latex: JQuery;
	private candy: JQuery;
	private ghost: JQuery;
	private glyph: GlyphFactory;
	private _log: JQuery;
	private _status: JQuery;
	private _logText = "";
	private _enableLog = false;
	private _enableStatus = !false;

	private formula = new Formula(null);
	private activeField: TokenSeq = this.formula;
	private activeIndex = 0;
	private markedIndex = -1;
	private candIndex = -1;
	private candCount = 0;
	private candSelected = "";
	private currentInput = "";
	private postInput = "";
	private inputType = InputType.Empty;
	private diagramOption = {
		from: -1,
		style: ArrowStyle.Plain,
		head: ">",
		num: 1,
		arrowIndex: -1
	};
	private proofMode: boolean;
	private clipboard: Token[] = [];
	private outputCurrentStyle: FontStyle[];
	private renderAfterLayout: Token[];
	private records: Record[] = [];

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
		"xymatrix": "",
	};

	private bracketCor = {
		"(": ")", "{": "}", "[": "]", "|": "|", "‖": "‖", "⌊": "⌋", "⌈": "⌉", "〈": "〉", "√": ""
	};

	constructor(field: JQuery, latex: JQuery, candy: JQuery, ghost: JQuery, proof: JQuery)
	{
		this.field = field;
		this.latex = latex;
		this.candy = candy;
		this.ghost = ghost;

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
		var dic: { [key: string]: any }[] = [LaTeX.symbols, LaTeX.accentSymbols];

		for (var i = 0; i < dic.length; i++)
		{
			for (var c in dic[i])
			{
				var key = dic[i][c];
				if (!(key in this.keywords))
					this.keywords[key] = c;
			}
		}

		for (var c in LaTeX.styles)
			this.keywords[c] = "";
	}
	private render(): void
	{
		this.renderAfterLayout = [];

		this.field.empty();
		this.outputCurrentStyle = [FontStyle.Normal];
		this.outputToken(this.field, this.formula);

		this.active.text((this.currentInput != "" ? this.currentInput : Unicode.SixPerEmSpace) + this.postInput);

		this.renderSub();

		this.showCandidate();

		this.latex.text(LaTeX.trans(this.formula, "", this.proofMode));

		if (this._enableStatus)
			this._status.text([
				"formula       = " + this.formula.toString(),
				"activeFormula = " + this.activeField.toString(),
				"activeIndex   = " + this.activeIndex.toString(),
				"markedIndex   = " + this.markedIndex.toString(),
				"candIndex     = " + this.candIndex.toString(),
				"candCount     = " + this.candCount.toString(),
				"candSelected  = " + this.candSelected.toString(),
				"currentInput  = " + this.currentInput.toString(),
				"inputType     = " + (this.inputType == InputType.Empty ? "Empty" :
				this.inputType == InputType.Number ? "Number" :
				this.inputType == InputType.String ? "String" : "Symbol"),
				"diag.from     = " + this.diagramOption.from,
				"diag.num      = " + this.diagramOption.num,
				"diag.style    = " + this.diagramOption.style,
				"diag.head     = " + this.diagramOption.head,
				"diag.arrowInd = " + this.diagramOption.arrowIndex,
				"clipboard     = " + this.clipboard.toString(),
				"records       = " + this.records.map(this.writeRecord).join("\n")
			].join("\n"));
	}
	private renderSub(): void
	{
		var activeArrowColor = "#f39";
		var intendedArrowColor = "#999";

		this.ghost.prop({
			"width": document.body.clientWidth,
			"height": document.body.clientHeight
		});
		var ctx = (<HTMLCanvasElement> this.ghost[0]).getContext("2d");

		for (var i = 0; i < this.renderAfterLayout.length; i++)
		{
			var m = <Diagram> this.renderAfterLayout[i];
			var selected = false;
			var from = m.pos(this.diagramOption.from);
			var to = m.pos(this.activeIndex);
			m.arrows.forEach((a, j) =>
			{
				if (a.from.row == from.row && a.from.col == from.col
					&& a.to.row == to.row && a.to.col == to.col)
				{
					m.drawArrow(ctx, a, activeArrowColor);
					selected = true;
					if (this.diagramOption.arrowIndex < 0)
						this.diagramOption.arrowIndex = j;
				}
				else
					m.drawArrow(ctx, a);
			});
			if (m == this.activeField && this.diagramOption.from >= 0 && !selected)
			{
				var a: Arrow = {
					from:	m.pos(this.diagramOption.from),
					to:		m.pos(this.activeIndex),
					style:	this.diagramOption.style,
					head:	this.diagramOption.head,
					num:	this.diagramOption.num
				};
				m.drawArrow(ctx, a, intendedArrowColor);
			}
			if (!selected)
				this.diagramOption.arrowIndex = -1;
		}
	}
	private writeRecord(r: Record)
	{
		return Object.keys(r).map(p => p + ":" + r[p]).join(", ");
	}

	//////////////////////////////////////
	/*  event handling					*/
	//////////////////////////////////////
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

		if (this.activeField instanceof Diagram
			&& this.processInputDiagram(key))
		{
			this.render();
			e.preventDefault();
			return;
		}
		if (!(this.activeField instanceof Formula))
			this.enterFormula(true);

		var t = this.getInputType(key);

		if (this.inputType == InputType.Empty)
		{
			this.currentInput += key;
			this.inputType = t;
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
		if (this.digits.indexOf(s) >= 0
			|| this.inputType == InputType.Number && s == ".")
			return InputType.Number;
		else if (this.symbols.indexOf(s) >= 0)
			return InputType.Symbol;
		else
			return InputType.String;
	}
	private processInputDiagram(key: string): boolean
	{
		var processed = true;

		switch (key)
		{
			case "=":
				this.diagramOption.num = 2;
			case "-":
				this.diagramOption.style =
				(this.diagramOption.style == ArrowStyle.Plain
				? ArrowStyle.Dashed : ArrowStyle.Plain);
				break;
			case ":":
				this.diagramOption.num = 2;
			case ".":
				this.diagramOption.style = ArrowStyle.Dotted;
				break;
			case ":":
				this.diagramOption.num = 2;
			case ".":
				this.diagramOption.style = ArrowStyle.Dotted;
				break;
			case "~":
				this.diagramOption.style = ArrowStyle.Wavy;
				break;
			case "1":
				this.diagramOption.num = 1;
				break;
			case "2":
				this.diagramOption.num = 2;
				break;
			case "3":
				this.diagramOption.num = 3;
				break;
			case "4":
				this.diagramOption.num = 4;
				break;
			default:
				processed = false;
		}

		return processed;
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
				{
					this.decideCandidate();
					break;
				}
				if (this.activeField instanceof Formula)
				{
					var f = <Formula> this.activeField;

					if (this.activeIndex > 0
						&& f.tokens[this.activeIndex - 1] instanceof Symbol
						&& (<Symbol> f.tokens[this.activeIndex - 1]).str == "=")
					{
						var res = Calc.eval(f.tokens.slice(0, this.activeIndex - 1));
						this.pasteToken([res !== null ? res : new Symbol("?", false)]);
						break;
					}
				}
				if (this.activeField.parent instanceof Diagram)
					this.leaveFormula(true);
				else if (this.activeField instanceof Diagram)
				{
					if (this.diagramOption.from >= 0)
					{
						var d = <Diagram> this.activeField;
						d.addArrow(this.diagramOption.from, this.activeIndex,
							this.diagramOption.num, this.diagramOption.style, this.diagramOption.head);
						this.diagramOption.from = -1;
					}
					else
						this.enterFormula(true);
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
					{
						if (this.activeField.parent instanceof Structure)
						{
							var p = <Structure> this.activeField.parent;
							if (p.type == StructType.Infer
								&& p.elems[1] == this.activeField)
							{
								this.inputType = InputType.String;
								this.currentInput = "&";
								this.interpretInput();
								break;
							}
						}
						else if (this.activeField instanceof Diagram)
						{
							this.diagramOption.from = (this.diagramOption.from < 0 ? this.activeIndex : -1);
							break;
						}
						this.moveNext();
					}
				}
				else
					this.interpretInput();
				break;
			case ControlKey.Left:
			case ControlKey.Right:
				if (e.ctrlKey)
				{
					var m: Matrix;
					if (this.activeField instanceof Matrix)
						m = <Matrix> this.activeField;
					else if (this.activeField.parent instanceof Matrix)
						m = <Matrix> this.activeField.parent;
					else
						break;

					(key == ControlKey.Right ? m.extend : m.shrink)(true);

					var rec: RecordEditMatrix = {
						type: RecordType.EditMatrix,
						index: this.activeIndex,
						extend: key == ControlKey.Right,
						horizontal: true
					};
					this.records.push(rec);
				}
				else
					this.moveHorizontal(key == ControlKey.Right);
				break;
			case ControlKey.Up:
			case ControlKey.Down:
				if (e.ctrlKey)
				{
					var m: Matrix;
					if (this.activeField instanceof Matrix)
						m = <Matrix> this.activeField;
					else if (this.activeField.parent instanceof Matrix)
						m = <Matrix> this.activeField.parent;
					else
						break;

					(key == ControlKey.Down ? m.extend : m.shrink)(false);

					var rec: RecordEditMatrix = {
						type: RecordType.EditMatrix,
						index: this.activeIndex,
						extend: key == ControlKey.Down,
						horizontal: false
					};
					this.records.push(rec);
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
					this.removeToken(this.markedIndex, this.activeIndex);
					this.markedIndex = -1;
				}
				else if (this.activeField instanceof Diagram
					&& this.diagramOption.arrowIndex >= 0)
				{
					(<Diagram> this.activeField).removeArrow(this.diagramOption.from, this.activeIndex);
				}
				else if (this.activeIndex > 0)
				{
					this.removeToken(this.activeIndex - 1, this.activeIndex);
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
	private processModifiedInput(key: string): void
	{
		switch (key)
		{
			case "c":
			case "x":
				if (this.markedIndex >= 0)
				{
					this.clipboard = this.activeField.copy(this.markedIndex, this.activeIndex);
					if (key == "x")
						this.removeToken(this.markedIndex, this.activeIndex);
					this.markedIndex = -1;
				}
				break;
			case "v":
				if (this.clipboard != null)
					this.pasteToken(this.clipboard);
				break;
			case "z":
				this.undo();
				break;
		}

		this.render();
	}

	private movePrev(): void
	{
		if (this.activeIndex == 0)
		{
			if (this.transferFormula(false))
				return;
		}
		this.moveHorizontal(false);
	}
	private moveNext(): void
	{
		if (this.activeIndex == this.activeField.count())
		{
			if (this.transferFormula(true))
				return;
		}
		this.moveHorizontal(true);
	}
	private moveHorizontal(forward: boolean): void
	{
		if (this.currentInput != "")
		{
			if (!forward)
			{
				this.currentInput = this.currentInput.slice(0, -1);
				return;
			}
			else
				this.interpretInput();
		}

		var dif = forward ? 1 : -1;

		if (this.activeField instanceof Formula)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
		{
			if (this.activeIndex + dif >= 0
				&& this.activeIndex + dif <= this.activeField.count())
			{
				if (!this.enterFormula(forward))
					this.activeIndex += dif;
				return;
			}
		}
		else if (this.activeField instanceof Matrix)
		{
			var m = <Matrix> this.activeField;
			var c = this.activeIndex % m.cols;

			if (forward && c < m.cols - 1 || !forward && c > 0)
			{
				this.activeIndex += (forward ? 1 : -1);
				return;
			}
		}

		var p = this.activeField.parent;

		if (p == null)
		{
			return;
		}
		else if (p instanceof Matrix)
		{
			var m = <Matrix> p;
			var a = m.around(<Formula> this.activeField, true, forward);

			if (a != null)
			{
				if (this.markedIndex >= 0)
				{
					this.leaveFormula(forward);

					var c = this.activeIndex % m.cols;
					if (forward && c < m.cols - 1 || !forward && c > 0)
						this.activeIndex += (forward ? 1 : -1);
					return;
				}
				if (this.transferFormula(forward, a))
					return;
			}
		}
		else if (p instanceof Structure)
		{
			if (this.transferFormula(forward))
				return;
		}

		this.leaveFormula(forward);
	}
	private moveVertical(upward: boolean): void
	{
		if (this.activeField instanceof Matrix)
		{
			var m = <Matrix> this.activeField;
			var r = Math.floor(this.activeIndex / m.cols);

			if (upward && r > 0 || !upward && r < m.rows - 1)
			{
				this.activeIndex += (upward ? -m.cols : m.cols);
				return;
			}
		}

		var ac = this.activeField;
		var p = ac.parent;

		if (this.markedIndex >= 0 && p instanceof Matrix)
		{
			this.leaveFormula(true);

			var m = <Matrix> p;
			var r = Math.floor(this.activeIndex / m.cols);
			if (upward && r > 0 || !upward && r < m.rows - 1)
				this.activeIndex += (upward ? -m.cols : m.cols);
			return;
		}

		while (p != null)
		{
			if (p instanceof Structure)
			{
				var s = <Structure>p;
				var neig: Formula;
				if (s.type == StructType.Infer)
					neig = (upward ? s.next : s.prev)(<Formula> ac);
				else if (s instanceof Matrix)
					neig = (<Matrix> s).around(<Formula> ac, false, !upward);
				else
					neig = (upward ? s.prev : s.next)(<Formula> ac);

				if (neig != null)
				{
					this.transferFormula(false, neig);

					var rect = this.active[0].getBoundingClientRect();
					var x0 = (rect.left + rect.right) / 2;
					var a : number[] = [];
					for (var i = 0; i < neig.tokens.length; i++)
					{
						var rect = neig.tokens[i].renderedElem[0].getBoundingClientRect();
						if (i == 0)
							a.push(rect.left);
						a.push(rect.right);
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
			if (i == 0 && i0 > 0)
				e.addClass("candidateSucc");
			else if (i == cand.length - 1 && i0 + i < this.candCount - 1)
				e.addClass("candidateLast");
			else if (i0 + i == this.candIndex)
			{
				e.addClass("candidateSelected");
				this.candSelected = c;
			}
			this.candy.append(e);
		});
	}

	private undo(): void
	{
		var i = this.records.length - 1;
		var dest: TokenSeq = this.activeField;

		while (i >= 0 && this.records[i].type == RecordType.Transfer)
		{
			var tr = <RecordTransfer> this.records[i];

			if (tr.deeper)
				dest = dest.parent;
			else
			{
				var t = dest.token(tr.index);
				if (t instanceof Structure || t instanceof Formula)
					dest = <TokenSeq> t;
				else
					console.error("[Application.undo] inconsistent transfer record");
			}

			i--;
		}
		if (i < 0)
			return;

		this.activeField = dest;

		if (this.records[i].type == RecordType.CreAnn)
		{
			var ca = <RecordCreAnn> this.records[i];

			if (ca.insert)
			{
				var to: number;
				if (ca.contents.length == 1 && ca.contents[0] instanceof Matrix
					&& this.activeField instanceof Matrix)
				{
					var a = (<Matrix> this.activeField);
					var p = a.pos(ca.index);
					var m = (<Matrix> ca.contents[0]);
					to = ca.index
						+ (Math.min(m.rows, a.rows - p.row) - 1) * a.cols
						+ (Math.min(m.cols, a.cols - p.col) - 1);
				}
				else
					to = ca.index + ca.contents.length;

				dest.remove(ca.index, to);
				this.activeIndex = Math.min(ca.index, to);
			}
			else
			{
				this.activeIndex = dest.paste(ca.index, ca.contents);
			}
		}
		else if (this.records[i].type == RecordType.EditMatrix)
		{
			var em = <RecordEditMatrix> this.records[i];
			var m: Matrix;

			if (dest instanceof Matrix)
				m = <Matrix> dest;
			else if (dest.parent instanceof Matrix)
				m = <Matrix> dest.parent;
			else
				console.error("[Application.undo] incosistent record");

			(em.extend ? m.shrink : m.extend)(em.horizontal);
		}

		this.records.splice(i, this.records.length - i + 1);
	}

	//////////////////////////////////////
	/*  input interpretation			*/
	//////////////////////////////////////
	private interpretInput(forceTrans?: boolean): void
	{
		var t: Token = null;
		var input = this.currentInput;

		if (this.inputType == InputType.Number && this.postInput == "")
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
		
		this.currentInput = "";
		this.inputType = InputType.Empty;
	}
	private pushNumber(): void
	{
		var t: Token = null;
		var input = this.currentInput;

		if (input.match("[0-9]+(\.[0-9]*)?"))
		{
			this.insertToken(new Num(input));
		}
	}
	private pushCommand(): void
	{
		var input = this.currentInput;
		var struct: Structure;
		var style = FontStyle.Normal;

		switch (input)
		{
			case "infer":
			case "/":
			case "frac":
				struct = new Structure(this.activeField,
					input == "infer" ? StructType.Infer : StructType.Frac);
				struct.elems[0] = new Formula(struct);
				struct.elems[1] = new Formula(struct);
				if (struct.type == StructType.Infer)
					struct.elems[2] = new Formula(struct);
				this.insertToken(struct, last => input != "frac"
					&& !(last instanceof Symbol && (<Symbol> last).str == "&"));
				break;
			case "^":
			case "_":
				struct = new Structure(this.activeField,
					input == "^" ? StructType.Power : StructType.Index);
				struct.elems[0] = new Formula(struct);
				this.insertToken(struct);
				break;
			case "matrix":
			case "pmatrix":
			case "bmatrix":
			case "Bmatrix":
			case "vmatrix":
			case "Vmatrix":
				struct = new Matrix(this.activeField, 1, 1);
				struct.elems[0] = new Formula(struct);
				var br = this.keywords[input];
				if (br != "")
				{
					var f = new Formula(this.activeField, br, this.bracketCor[br]);
					this.insertToken(f);
					struct.parent = f;
				}
				this.insertToken(struct);
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
				this.insertToken(new Formula(this.activeField, br, this.bracketCor[br]));
				break;
			case "mathbf":
			case "mathrm":
			case "mathscr":
			case "mathfrak":
			case "mathbb":
			case "mathtt":
				this.insertToken(new Formula(this.activeField, "", "", LaTeX.styles[input]));
				break;
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
				this.postInput = this.keywords[input];
				break;
			case "widetilde":
			case "widehat":
			case "overleftarrow":
			case "overrightarrow":
			case "overline":
			case "underline":
			case "overbrace":
			case "underbrace":
				this.insertToken(new Accent(this.activeField, this.keywords[input], input != "underline" && input != "underbrace"));
				break;
			case "xymatrix":
				this.insertToken(new Diagram(this.activeField, 1, 1));
				break;
			default:
				if (input in this.keywords &&
					this.operators.indexOf(this.keywords[input]) >= 0)
				{
					struct = new BigOpr(this.activeField, this.keywords[input]);
					struct.elems[0] = new Formula(struct);
					struct.elems[1] = new Formula(struct);
					this.insertToken(struct);
				}
				else
				{
					var s = (input in this.keywords)
						? new Symbol(this.keywords[input] + this.postInput, false)
						: new Symbol(input, this.inputType == InputType.String);
					this.insertToken(s);
					this.postInput = "";
				}
				break;
		}
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
			t = new Symbol(input[i] + this.postInput, this.inputType == InputType.String);
			this.insertToken(t);
		}

		if (t.str in this.bracketCor)
		{
			this.insertToken(new Symbol(this.bracketCor[t.str], false));
			this.activeIndex--;
		}

		this.postInput = "";
	}

	//////////////////////////////////////
	/*  activeFormula transition		*/
	//////////////////////////////////////
	private transferFormula(forward: boolean, target?: Formula): boolean
	{
		var adj: Formula;
		var p = this.activeField.parent;

		if (p !== null)
		{
			if (target)
				adj = target;
			else
			{
				var a = (forward ? p.next : p.prev)(this.activeField);
				if (!(a instanceof Formula))
					return false;
				adj = <Formula> a;
			}

			var rec1: RecordTransfer = {
				type: RecordType.Transfer,
				index: this.activeField.parent.indexOf(this.activeField),
				deeper: false
			};
			var rec2: RecordTransfer = {
				type: RecordType.Transfer,
				index: p.indexOf(adj),
				deeper: true
			};
			this.records.push(rec1);
			this.records.push(rec2);

			this.activeField = adj;
			this.activeIndex = (forward ? 0 : adj.count());

			return true;
		}

		return false;
	}
	private leaveFormula(forward: boolean): boolean
	{
		var t: TokenSeq = this.activeField;

		if (t.parent instanceof Structure
			&& !(this.markedIndex >= 0 && t.parent instanceof Matrix
				|| t.parent instanceof Diagram))
		{
			var rec0: RecordTransfer = {
				type: RecordType.Transfer,
				index: (<Structure> t.parent).indexOf(t),
				deeper: false
			};
			this.records.push(rec0);

			t = t.parent;
		}

		var f = t.parent;
		var inFormula = f instanceof Formula;

		var rec: RecordTransfer = {
			type: RecordType.Transfer,
			index: f.indexOf(t),
			deeper: false
		};
		this.records.push(rec);

		var index = f.indexOf(t);
		this.activeIndex = index;
		if (inFormula && forward)
			this.activeIndex++;
		if (this.markedIndex >= 0)
		{
			this.markedIndex = index;
			if (inFormula && !forward)
				this.markedIndex++;
		}
		this.activeField = f;

		if (f instanceof Diagram)
			this.diagramOption.from = -1;

		return true;
	}
	private enterFormula(forward: boolean): boolean
	{
		var i = this.activeIndex;

		if (this.activeField instanceof Formula && !forward)
			i--;
		var dest = this.activeField.token(i);

		if (this.markedIndex < 0 && dest && (dest instanceof Structure || dest instanceof Formula))
		{
			var rec: RecordTransfer = {
				type: RecordType.Transfer,
				index: i,
				deeper: true
			};
			this.records.push(rec);

			if (dest instanceof Structure)
			{
				var s = <Structure> dest;
				var j = forward ? 0 : s.elems.length - 1;
				this.activeField = <Formula> s.token(j);

				var rec2: RecordTransfer = {
					type: RecordType.Transfer,
					index: j,
					deeper: true
				};
				this.records.push(rec2);

				if (dest instanceof Diagram)
					this.diagramOption.from = -1;
			}
			else
				this.activeField = <Formula> dest;

			this.activeIndex = forward ? 0 : this.activeField.count();

			return true;
		}

		return false;
	}

	//////////////////////////////////////
	/*  activeFormula editing			*/
	//////////////////////////////////////
	private insertToken(t: Token, capture?: (last: Token) => boolean): void
	{
		console.log("insert " + t.toString() + " at " + this.activeIndex + (capture ? " with capture" : ""));

		if (!(this.activeField instanceof Formula))
			return;

		var f = <Formula> this.activeField;
		var captured = false;

		if (t instanceof Structure)
		{
			var struct = <Structure> t;
			var last: Token;

			if (this.activeIndex > 0 && capture
				&& capture(last = f.tokens[this.activeIndex - 1]))
			{
				captured = true;
				struct.elems[0].insert(0, last);
				this.removeToken(this.activeIndex - 1, this.activeIndex);
			}
		}

		f.insert(this.activeIndex, t);

		var rec: RecordCreAnn = {
			type: RecordType.CreAnn,
			index: this.activeIndex,
			insert: true,
			contents: [t.clone(null)]
		};
		this.records.push(rec);

		if (t instanceof Structure || t instanceof Formula)
		{
			this.enterFormula(true);
			if (captured)
				this.transferFormula(true);
		}
		else
			this.activeIndex++;
	}
	// "paste" method rewrites token's parent
	private pasteToken(t: Token[]): void
	{
		if (this.activeField instanceof Matrix
			&& t.length == 1 && t[0] instanceof Matrix)
		{
			var a = <Matrix> this.activeField;
			var p = a.pos(this.activeIndex);
			var m = <Matrix> t[0];
			var mr = Math.min(m.rows, a.rows - p.row);
			var mc = Math.min(m.cols, a.cols - p.col);

		outerloop:
			for (var i = 0; i < mr; i++)
				for (var j = 0; j < mc; j++)
				{
					if (a.elems[this.activeIndex + i * a.cols + j].tokens.length > 0)
					{
						this.removeToken(this.activeIndex,
							this.activeIndex + (mr - 1) * a.cols + (mc - 1));
						break outerloop;
					}
				}
		}

		console.log("paste " + t.toString());

		var rec: RecordCreAnn = {
			type: RecordType.CreAnn,
			index: this.activeIndex,
			insert: true,
			contents: t.map(x => x.clone(null))
		};
		this.records.push(rec);

		this.activeIndex = this.activeField.paste(this.activeIndex, t);
	}
	private removeToken(from: number, to: number): void
	{
		console.log("remove " + from + " ~ " + to);

		var removed = this.activeField.remove(from, to);
		var index = Math.min(from, to);

		var rec: RecordCreAnn = {
			type: RecordType.CreAnn,
			index: index,
			insert: false,
			contents: removed
		};
		this.records.push(rec);

		this.activeIndex = index;
	}

	//////////////////////////////////////
	/*  formula output					*/
	//////////////////////////////////////
	private outputToken(q: JQuery, t: Token): JQuery
	{
		var e: JQuery;

		if (t instanceof Symbol)
		{
			var v = <Symbol> t;
			var str = v.str;
			var style = this.outputCurrentStyle[0];

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
			console.error("[Application.outputToken] unexpected argument : " + t);

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
			default: console.error("[Application.transStyle] unexpected font style : " + style);
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
				e = $("<div/>").addClass("frac");
				var prim = this.outputToken(e, s.token(0));
				var seco = this.outputToken(e, s.token(1));
				if (s.type == StructType.Infer)
				{
					e.addClass("reverseOrdered");
					prim.addClass("overline");
				}
				else
					seco.addClass("overline");
				break;

			case StructType.Power:
			case StructType.Index:
				e = $("<div/>").addClass(s.type == StructType.Power ? "power" : "index");
				this.outputToken(e, s.token(0));
				break;

			case StructType.Diagram:
				this.renderAfterLayout.push(s);
			case StructType.Matrix:
				var m = <Matrix> s;
				e = $("<div/>").addClass("matrix");
				if (this.activeField == m && this.markedIndex >= 0)
				{
					var mark = true;
					var ai = Math.floor(this.activeIndex / m.cols);
					var aj = this.activeIndex % m.cols;
					var mi = Math.floor(this.markedIndex / m.cols);
					var mj = this.markedIndex % m.cols;
					var i1 = Math.min(ai, mi);
					var j1 = Math.min(aj, mj);
					var i2 = Math.max(ai, mi);
					var j2 = Math.max(aj, mj);
				}
				for (var i = 0; i < m.rows; i++)
				{
					var r = $("<div/>").addClass("row");
					for (var j = 0; j < m.cols; j++)
					{
						var c = $("<div/>").addClass(m.type == StructType.Diagram ? "xycell" : "cell");

						var t = this.outputToken(c, m.tokenAt(i, j));
						if (m == this.activeField)
						{
							var k = i * m.cols + j;
							if (k == this.diagramOption.from)
								t.addClass("arrowStart");
							if (k == this.activeIndex)
								t.addClass("active");
						}
						if (mark && i >= i1 && i <= i2 && j >= j1 && j <= j2)
							c.addClass("marked");
						r.append(c);
					}
					e.append(r);
				}
				break;

			case StructType.BigOpr:
				var o = <BigOpr> s;
				if (["∫", "∮", "∬", "∭", "⨌"].indexOf(o.operator) >= 0)
				{
					e = $("<div/>").addClass("math");
					e.append($("<div/>").text(o.operator).addClass("operator"));
					var f = $("<div/>").addClass("frac");
					this.outputToken(f, s.token(1)).addClass("subFormula");
					this.outputToken(f, s.token(0)).addClass("subFormula");
					e.append(f);
				}
				else
				{
					e = $("<div/>").addClass("frac");
					this.outputToken(e, s.token(1)).addClass("subFormula");
					e.append($("<div/>").text(o.operator).addClass("operator"));
					this.outputToken(e, s.token(0)).addClass("subFormula");
				}
				break;

			case StructType.Accent:
				var a = <Accent> s;
				if (a.symbol == "‾")
					e = this.outputFormula(a.elems[0]).addClass("overline");
				else if (a.symbol == "_")
					e = this.outputFormula(a.elems[0]).addClass("underline");
				else
				{
					e = $("<div/>").addClass("frac");
					if (!a.above)
						e.addClass("reverseOrdered");
					var ac = this.makeGlyph(a.symbol).addClass("accent").text(Unicode.EnSpace);
					e.append(ac);
					this.outputToken(e, s.token(0));
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
				braced.append(this.makeGlyph(f.prefix).addClass("bracket"));

			var inner = this.outputFormulaInner(f);
			if (f.prefix == "√")
				inner.addClass("overline");
			braced.append(inner);

			if (f.suffix != "")
				braced.append(this.makeGlyph(f.suffix).addClass("bracket"));

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
	private makeGlyph(char: string): JQuery
	{
		var q = $("<div/>");
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

		if (f == this.activeField)
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

var app;

window.onload = () =>
{
	app = new Application($("#field"), $("#latex"), $("#candy"), $("#ghost"), $("#proofMode"));
};
