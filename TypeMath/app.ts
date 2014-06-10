﻿/// <reference path="jquery.d.ts" />
/// <reference path="keyboard.ts" />
/// <reference path="formula.ts" />
/// <reference path="diagram.ts" />
/// <reference path="latex.ts" />
/// <reference path="latexReader.ts" />
/// <reference path="unicode.ts" />
/// <reference path="glyph.ts" />
/// <reference path="calc.ts" />

class Rect
{
	public left: number;
	public top: number;
	public right: number;
	public bottom: number;
	public width: number;
	public height: number;

	constructor(left: number, top: number, width: number, height: number)
	{
		this.left = left;
		this.top = top;
		this.right = left + width;
		this.bottom = top + height;
		this.width = width;
		this.height = height;
	}
	public static fromJQuery(a: JQuery)
	{
		var pos = a.offset();
		return new Rect(pos.left, pos.top, a.width(), a.height());
	}
	public center(): Point
	{
		return { x: (this.left + this.right) / 2, y: (this.top + this.bottom) / 2 };
	}
	public size(): { width: number; height: number }
	{
		return { width: this.width, height: this.height };
	}
	public contains(containee: Rect): boolean;
	public contains(containee: Point): boolean;
	public contains(a: any): boolean
	{
		if (a instanceof Rect)
		{
			var r = <Rect> a;
			return r.left >= this.left && r.right <= this.right && r.top >= this.top && r.bottom <= this.bottom;
		}
		else
		{
			var p = <Point> a;
			return p.x >= this.left && p.x <= this.right && p.y >= this.top && p.y <= this.bottom;
		}
	}
}

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
	Edit,
	EditMatrix,
	DiagramEdit,
	DiagramDeco,
}
interface Record { type: RecordType; index: number; }
interface RecordTransfer { type: RecordType; index: number; deeper: boolean; }
interface RecordEdit { type: RecordType; index: number; insert: boolean; contents: Token[]; }
interface RecordEditMatrix { type: RecordType; index: number; horizontal: boolean; extend: boolean; }
interface RecordDiagramEdit { type: RecordType; index: number; insert: boolean; option: DiagramOption; }
interface RecordDiagramDeco { type: RecordType; index: number; command: string; prev: StrokeStyle; }
interface RecordDiagramTrans { type: RecordType; index: number; from: number; to: number; n: number; deeper: boolean; }

interface DiagramOption
{
	from: number;
	to: number;
	arrowIndex: number;
	num: number;
	style: StrokeStyle;
	head: string;
}

interface OutputInfo
{
	arguments: Macro;
	actGenerated: boolean;
}

class Application
{
	private field: JQuery;
	private active: JQuery;
	private latex: JQuery;
	private importer: JQuery;
	private importerBox: JQuery;
	private candy: JQuery;
	private ghost: JQuery;
	private selectedArea: JQuery;
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
	private diagramOption: DiagramOption = {
		from: -1,
		to: -1,
		arrowIndex: -1,
		num: 1,
		style: StrokeStyle.Plain,
		head: ">"
	};
	private macroOption: { field: Formula; epoch: number } = {
		field: null,
		epoch: 0
	};
	private importMode: boolean;
	private proofMode: boolean;
	private clipboard: Token[] = [];
	private outputCurrentStyle: FontStyle[];
	private afterLayout: Token[];
	private records: Record[] = [];
	private dragFrom: { x: number; y: number } = null;
	private dragRect: Rect = null;

	public candMax = 16;
	public activeArrowColor = "#f39";
	public intendedArrowColor = "#999";

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
	private macroTable: { [key: string]: { argc: number; content: Token } } = {};

	private bracketCor = {
		"(": ")", "{": "}", "[": "]", "|": "|", "‖": "‖", "⌊": "⌋", "⌈": "⌉", "〈": "〉", "√": ""
	};

	private get selectingArrow(): boolean
	{
		return this.activeField instanceof Diagram
			&& this.diagramOption.arrowIndex >= 0;
	}
	private get inMacroMode(): boolean
	{
		return this.macroOption.field !== null;
	}

	constructor(field: JQuery, latex: JQuery, importer: JQuery, candy: JQuery, ghost: JQuery, select: JQuery, proof: JQuery)
	{
		this.field = field;
		this.importer = importer;
		this.importerBox = importer.children("textarea");
		this.latex = latex;
		this.candy = candy;
		this.ghost = ghost;
		this.selectedArea = select;

		this.enrichKeywords();

		document.onkeydown = (e) => { this.processInput(e) };
		proof.change(e =>
		{
			this.proofMode = proof.prop("checked");
		});
		proof.change();
		ghost.mousedown((e) => { this.dragFrom = { x: e.pageX, y: e.pageY }; this.jumpTo(this.dragFrom); });
		ghost.mousemove((e) => { this.dragSelect(e); });
		ghost.mouseup((e) => { this.dragFrom = this.dragRect = null; this.render(); });

		$(document.body).append(this._status = $("<pre/>").css("font-size", "9pt"));
		$(document.body).append(this._log = $("<pre/>").css("font-size", "9pt"));

		this.render();

		this.glyph = new GlyphFactory();
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
		var a = (this.currentInput != "" ? this.currentInput : Unicode.SixPerEmSpace) + this.postInput;

		this.active = null;
		this.afterLayout = [];

		this.field.empty();
		this.outputCurrentStyle = [FontStyle.Normal];
		this.outputToken(this.field, this.formula, { arguments: null, actGenerated: false });

		if (this.active)
		{
			this.active.text(a);
			a = null;
		}

		this.drawAfterLayout();

		if (a && this.active)
			this.active.text(a);

		this.showCandidate();

		if (this.dragFrom && this.dragRect)
		{
			var ofs = this.field.offset();
			this.selectedArea.css({
				visibility: "visible",
				left: (this.dragRect.left - ofs.left) + "px",
				top: (this.dragRect.top - ofs.top) + "px",
				width: this.dragRect.width + "px",
				height: this.dragRect.height + "px"
			});
		}
		else
			this.selectedArea.css("visibility", "hidden");

		var latex = [];
		for (var macro in this.macroTable)
		{
			var m = this.macroTable[macro];
			var s = ["\\newcommand{\\", macro, "}"];
			if (m.argc > 0)
				s.push("[", m.argc.toString(), "]");
			s.push("{", LaTeX.trans(m.content), "}");
			latex.push(s.join(""));
		}
		if (latex.length > 0)
			latex.push("\n");
		latex.push(LaTeX.trans(this.formula, "", this.proofMode));
		this.latex.text(latex.join("\n"));

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
				"diag.to       = " + this.diagramOption.to,
				"diag.arrow    = " + this.diagramOption.arrowIndex,
				"diag.num      = " + this.diagramOption.num,
				"diag.style    = " + this.diagramOption.style,
				"diag.head     = " + this.diagramOption.head,
				"macro.field   = " + (this.macroOption.field ? this.macroOption.field.toString() : "null"),
				"macro.epoch   = " + this.macroOption.epoch,
				"macroTable    = " + Object.keys(this.macroTable).join(", "),
				"clipboard     = " + this.clipboard.toString(),
				"records       = " + this.records.map(this.writeRecord).join("\n")
			].join("\n"));
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

		if (this.importMode)
		{
			if (e.ctrlKey && key == "l")
			{
				var src = this.importerBox.val();
				var code = LaTeXReader.parse(src);
				this.interpretLaTeX(code);
				this.importer.css("visibility", "hidden");
				this.importMode = false;
				this.render();
				e.preventDefault();
			}
			return;
		}

		if (key == "")
		{
			this.processControlInput(e);
			return;
		}
		else if (e.ctrlKey)
		{
			this.processModifiedInput(e, key);
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
			if (t == this.inputType ||
				(this.inMacroMode
					&& this.currentInput.charAt(0) == '#'
					&& t == InputType.Number))
			{
				this.currentInput += key;
			}
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

		if (this.diagramOption.from < 0)
		{
			processed = this.decorateObject(key);
		}
		else if (this.selectingArrow)
		{
			switch (key)
			{
				case "^":
					this.labelArrow(LabelPosotion.Left);
					break;
				case "|":
					this.labelArrow(LabelPosotion.Middle);
					break;
				case "_":
					this.labelArrow(LabelPosotion.Right);
					break;
			}
		}
		else
		{
			switch (key)
			{
				case "n":
					if (this.diagramOption.style == StrokeStyle.None)
					{
						this.diagramOption.style = StrokeStyle.Plain;
						this.diagramOption.head = ">";
					}
					else
					{
						this.diagramOption.style = StrokeStyle.None;
						this.diagramOption.head = "";
					}
					break;
				case "=":
					this.diagramOption.num = 2;
				case "-":
				case "d":
					this.diagramOption.style =
						(this.diagramOption.style == StrokeStyle.Plain
						? StrokeStyle.Dashed : StrokeStyle.Plain);
					break;
				case ":":
					this.diagramOption.num = 2;
				case ".":
					this.diagramOption.style = StrokeStyle.Dotted;
					break;
				case ":":
					this.diagramOption.num = 2;
				case ".":
					this.diagramOption.style = StrokeStyle.Dotted;
					break;
				case "~":
					this.diagramOption.style = StrokeStyle.Wavy;
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
				else if (this.selectingArrow)
					this.diagramOption.arrowIndex++;	// moduloed in drawArrows()
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
						this.pasteToken(res !== null ? res : [new Symbol("?", false)]);
						break;
					}
				}
				if (this.activeField.parent instanceof Diagram)
					this.leaveFormula(true);
				else if (this.activeField instanceof Diagram)
				{
					if (this.diagramOption.from >= 0)
						this.addArrow();
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
					this.modifyMatrix(true, key == ControlKey.Right);
				else
					this.moveHorizontal(key == ControlKey.Right);
				break;
			case ControlKey.Up:
			case ControlKey.Down:
				if (e.ctrlKey)
					this.modifyMatrix(false, key == ControlKey.Down);
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
				else if (this.selectingArrow)
					this.removeArrow();
				else if (this.activeIndex > 0)
				{
					this.removeToken(this.activeIndex - (this.activeField instanceof Structure ? 0 : 1), this.activeIndex);
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
	private processModifiedInput(e: KeyboardEvent, key: string): void
	{
		var suppress = true;

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
			case "m":
				if (!this.inMacroMode)
					this.enterMacroMode();
				else
					this.exitMacroMode();
				break;
			case "l":
				if (!this.importMode)
				{
					this.importerBox.val("");
					this.importer.css("visibility", "visible");
					this.importerBox.focus();
					this.importMode = true;
				}
				break;
			default:
				suppress = false;
				break;
		}

		if (suppress)
			e.preventDefault();
		this.render();
	}

	//////////////////////////////////////
	/*  Import LaTeX                    */
	//////////////////////////////////////
	public interpretLaTeX(code: LaTeXAST): void
	{
		switch (code.type)
		{
			case LaTeXASTType.Sequence:
				console.debug("LaTeX: seq");
				for (var i = 0; i < code.children.length; i++)
					this.interpretLaTeX(code.children[i]);
				break;
			case LaTeXASTType.Environment:
			case LaTeXASTType.Command:
				console.debug("LaTeX: env/cmd " + code.value);
				this.interpretLaTeXCode(code.value, InputType.String);
				for (var i = 0; i < code.children.length; i++)
				{
					this.interpretLaTeX(code.children[i]);
					this.moveNext();
				}
				break;
			case LaTeXASTType.Number:
				console.debug("LaTeX: n " + code.value);
				this.interpretLaTeXCode(code.value, InputType.Number);
				break;
			case LaTeXASTType.Symbol:
				console.debug("LaTeX: s " + code.value);
				this.interpretLaTeXCode(code.value,
					this.symbols.indexOf(code.value) >= 0
					? InputType.Symbol : InputType.String);
				break;
		}
	}
	private interpretLaTeXCode(code: string, type: InputType): void
	{
		this.inputType = type;
		this.currentInput = code;
		this.interpretInput();
	}

	//////////////////////////////////////
	/*  macro registering				*/
	//////////////////////////////////////
	private enterMacroMode(): void
	{
		var epoch = this.records.length;

		this.extrudeToken(this.markedIndex, this.activeIndex);
		this.markedIndex = -1;
		this.enterFormula(true);

		this.macroOption.field = <Formula> this.activeField;
		this.macroOption.epoch = epoch;
	}
	private exitMacroMode(register: boolean = true): boolean
	{
		if (register)
		{
			var name: string;

			for (var accepted = false; !accepted; )
			{
				name = window.prompt("Macro Name:");

				if (name === null)
					return false;
				else if (name in this.keywords)
					window.alert("Duplicate Name!");
				else if (name.length == 0)
					window.alert("No Input!");
				else
					accepted = true;
			}

			this.registerMacro(name, this.macroOption.field.tokens.map(t => t.clone(null)));
		}
		else
		{
			if (!window.confirm("Would you exit macro mode?"))
				return false;
		}

		this.macroOption.field = null;

		while (this.records.length > this.macroOption.epoch)
			this.undo();

		this.macroOption.epoch = 0;

		return true;
	}
	private registerMacro(name: string, content: Token[]): void
	{
		if (name in this.keywords)
			console.error("[Application.registerMacro] duplicate macro name");

		var n = this.countArgs({
			count: () => { return content.length; },
			token: (i) => { return content[i]; }
		});

		var t: Token;
		if (content.length == 1)
			t = content[0];
		else
		{
			var f = new Formula(null);
			f.tokens = content;
			t = f;
		}
		this.macroTable[name] = { argc: n, content: t };
		this.keywords[name] = "";
	}
	private countArgs(seq: { count(): number; token(i: number): Token }): number
	{
		var n = seq.count();
		var count = 0;

		for (var i = 0; i < n; i++)
		{
			var t = seq.token(i);
			var c = 0;
			if (t instanceof Structure || t instanceof Formula)
			{
				var s = <TokenSeq> t;
				c = this.countArgs(s);
			}
			else if (t instanceof Symbol)
			{
				var m = (<Symbol> t).str.match(/^#(\d+)$/);
				if (m)
					c = parseInt(m[1]);
			}
			count = Math.max(count, c);
		}

		return count;
	}

	//////////////////////////////////////
	/*  transition						*/
	//////////////////////////////////////
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
			var a = m.around.bind(m)(<Formula> this.activeField, true, forward);

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
					neig = (<Matrix> s).around.bind(s)(<Formula> ac, false, !upward);
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

	//////////////////////////////////////
	/*  autocomplete					*/
	//////////////////////////////////////
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
		var cand = keys.filter(w => w.indexOf(key) == 0).sort((a, b) => a.length - b.length)
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

	//////////////////////////////////////
	/*  undo							*/
	//////////////////////////////////////
	private undo(): void
	{
		var i = this.records.length - 1;
		var dest: TokenSeq = this.activeField;

		while (i >= 0 && this.records[i].type == RecordType.Transfer)
		{
			if (this.inMacroMode && i == this.macroOption.epoch + 2)
			{
				this.exitMacroMode(false);
				return;
			}

			dest = this.rollbackTransfer(dest, <RecordTransfer> this.records[i]);
			i--;
		}

		this.activeField = dest;

		if (i >= 0)
			this.rollbackEdit(dest, this.records[i]);

		this.records.splice(i, this.records.length - i + 1);
	}
	private rollbackTransfer(dest: TokenSeq, rt: RecordTransfer): TokenSeq
	{
		if (rt.deeper)
			return dest.parent;

		var t: Token;

		if ("from" in rt)
		{
			var rdt = <RecordDiagramTrans> rt;
			if (dest instanceof Diagram)
			{
				var d = <Diagram> dest;
				var k = d.findArrow(rdt.from, rdt.to, rdt.n);
				t = d.arrows[k.row][k.col][k.i].label;
			}
			else
				console.error("[Application.rollbackTransfer] inconsistent transfer record (arrow label)");
		}
		else
			t = dest.token(rt.index);

		if (t instanceof Structure || t instanceof Formula)
			dest = <TokenSeq> t;
		else
			console.error("[Application.rollbackTransfer] inconsistent transfer record");

		return dest;
	}
	private rollbackEdit(dest: TokenSeq, r: Record): void
	{
		if (r.type == RecordType.Edit)
		{
			var re = <RecordEdit> r;

			if (re.insert)
			{
				var to: number;
				if (re.contents.length == 1 && re.contents[0] instanceof Matrix
					&& this.activeField instanceof Matrix)
				{
					var a = (<Matrix> this.activeField);
					var p = a.pos(re.index);
					var m = (<Matrix> re.contents[0]);
					to = re.index
					+ (Math.min(m.rows, a.rows - p.row) - 1) * a.cols
					+ (Math.min(m.cols, a.cols - p.col) - 1);
				}
				else
					to = re.index + re.contents.length;

				dest.remove(re.index, to);
				this.activeIndex = Math.min(re.index, to);
			}
			else
			{
				this.activeIndex = dest.paste(re.index, re.contents);
			}
		}
		else if (r.type == RecordType.DiagramEdit)
		{
			var rea = <RecordDiagramEdit> r;
			var d: Diagram;

			if (dest instanceof Diagram)
				d = <Diagram> dest;
			else
				console.error("[Application.rollbackEdit] incosistent record (diagram)");

			if (rea.insert)
				d.removeArrow(rea.option.from, rea.index, 0);
			else
				d.addArrow(rea.option.from, rea.index, rea.option.num, rea.option.style, rea.option.head);
		}
		else if (r.type == RecordType.DiagramDeco)
		{
			var rdd = <RecordDiagramDeco> r;
			var d: Diagram;

			if (dest instanceof Diagram)
				d = <Diagram> dest;
			else
				console.error("[Application.rollbackEdit] incosistent record (diagram decolation)");

			switch (rdd.command)
			{
				case "f":
					d.toggleFrame(rdd.index);
					break;
				case "o":
				case "=":
					d.alterFrameStyle(rdd.index, rdd.command == "o", rdd.command == "=");
					if (rdd.prev === null)
						d.toggleFrame(rdd.index);
					break;
				case ".":
				case "d":
					d.alterFrameStyle(rdd.index, false, false, rdd.prev);
					if (rdd.prev === null)
						d.toggleFrame(rdd.index);
					break;
				case "+":
				case "-":
					d.changeFrameSize(rdd.index, rdd.command == "-");
					break;
			}

			this.activeIndex = rdd.index;
		}
		else if (r.type == RecordType.EditMatrix)
		{
			var rem = <RecordEditMatrix> r;
			var m: Matrix;

			if (dest instanceof Matrix)
				m = <Matrix> dest;
			else if (dest.parent instanceof Matrix)
				m = <Matrix> dest.parent;
			else
				console.error("[Application.rollbackEdit] incosistent record (matrix)");

			(rem.extend ? m.shrink : m.extend).bind(m)(rem.horizontal);
		}
		else
			console.error("[Application.rollbackEdit] unexpected record");
	}

	//////////////////////////////////////
	/*  mouse operation					*/
	//////////////////////////////////////
	private dragSelect(e: JQueryEventObject): void
	{
		if (!this.dragFrom)
			return;
		var select = new Rect(
			Math.min(e.pageX, this.dragFrom.x), Math.min(e.pageY, this.dragFrom.y),
			Math.abs(e.pageX - this.dragFrom.x), Math.abs(e.pageY - this.dragFrom.y));

		this.selectByRect(select);
	}
	private selectByRect(select: Rect, parent: TokenSeq = this.formula): void
	{
		var n = parent.count();
		var selected = [];

		for (var i = 0; i < n; i++)
		{
			var t = parent.token(i);
			var rect = Rect.fromJQuery(t.renderedElem);

			if ((t instanceof Structure || t instanceof Formula) && rect.contains(select))
				return this.selectByRect(select, <TokenSeq> t);

			if (select.contains(rect.center()))
				selected.push(i);
		}

		if (parent != this.activeField)
			this.jumpFormula(parent);

		this.dragRect = select;

		if (selected.length == 0)
		{
			this.markedIndex = this.activeIndex;
			this.render();
			return;
		}

		if (parent instanceof Matrix)
		{
			this.markedIndex = selected[0];
			this.activeIndex = selected[selected.length - 1];
		}
		else
		{
			this.markedIndex = selected[0];
			this.activeIndex = selected[selected.length - 1] + 1;
		}

		this.render();
	}
	private jumpTo(p: Point, parent: TokenSeq = this.formula): void
	{
		var n = parent.count();
		var distMin = Number.MAX_VALUE;
		var indexNear = -1;

		for (var i = 0; i < n; i++)
		{
			var t = parent.token(i);
			var rect = Rect.fromJQuery(t.renderedElem);

			if ((t instanceof Structure || t instanceof Formula) && rect.contains(p))
				return this.jumpTo(p, <TokenSeq> t);

			var g = rect.center();
			var d = Util.normSquared(p.x - g.x, p.y - g.y);
			if (d < distMin)
			{
				distMin = d;
				indexNear = (p.x < g.x ? i : i + 1);
			}
		}

		if (indexNear < 0)
			return;

		if (parent != this.activeField)
			this.jumpFormula(parent);

		this.activeIndex = indexNear;

		this.render();
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
				if (input in this.macroTable)
				{
					this.insertToken(new Macro(this.activeField, input, this.macroTable[input].argc));
				}
				else if (input in this.keywords &&
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

		if (this.inMacroMode
			&& this.currentInput.match(/^#\d+$/))
		{
			this.insertToken(new Symbol(this.currentInput, false));
			this.postInput = "";
			return;
		}

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
	/*  diagram editing					*/
	//////////////////////////////////////
	private decorateObject(command: string): boolean
	{
		console.log("decorate " + this.activeIndex + " " + command);

		if (!(this.activeField instanceof Diagram))
			return false;

		var d = <Diagram> this.activeField;
		var prev: StrokeStyle = null;
		if (this.activeIndex in d.decorations)
		{
			var p = d.pos(this.activeIndex);
			if (d.decorations[p.row][p.col])
				prev = d.decorations[p.row][p.col].style;
		}

		switch (command)
		{
			case "f":
				d.toggleFrame(this.activeIndex);
				break;
			case "o":
				d.alterFrameStyle(this.activeIndex, true);
				break;
			case "=":
				d.alterFrameStyle(this.activeIndex, false, true);
				break;
			case "-":
				d.changeFrameSize(this.activeIndex, false);
				break;
			case "d":
				d.alterFrameStyle(this.activeIndex, false, false,
					(prev == StrokeStyle.Dashed ? StrokeStyle.Plain : StrokeStyle.Dashed));
				break;
			case ".":
				d.alterFrameStyle(this.activeIndex, false, false, StrokeStyle.Dotted);
				break;
			case "+":
				d.changeFrameSize(this.activeIndex, true);
				break;
			default:
				return false;
		}

		var rec: RecordDiagramDeco = {
			type: RecordType.DiagramDeco,
			index: this.activeIndex,
			command: command,
			prev: prev
		};
		this.records.push(rec);

		return true;
	}
	private addArrow(): void
	{
		console.log("arrow " + this.diagramOption.from + " -> " + this.activeIndex);

		if (!(this.activeField instanceof Diagram))
			return;

		var d = <Diagram> this.activeField;

		d.addArrow(this.diagramOption.from, this.activeIndex,
			this.diagramOption.num, this.diagramOption.style, this.diagramOption.head);

		var rec: RecordDiagramEdit = {
			type: RecordType.DiagramEdit,
			index: this.activeIndex,
			insert: true,
			option: <DiagramOption> $.extend({}, this.diagramOption)
		};
		this.records.push(rec);

		this.activeIndex = this.diagramOption.from;
		this.diagramOption.from = -1;
	}
	private removeArrow(): void
	{
		console.log("remove " + this.diagramOption.from + " -> " + this.activeIndex);

		if (!(this.activeField instanceof Diagram))
			return;

		var d = <Diagram> this.activeField;

		var removed = d.removeArrow(this.diagramOption.from, this.activeIndex, 0);

		var i = removed.from.row * d.cols + removed.from.col;
		var rec: RecordDiagramEdit = {
			type: RecordType.DiagramEdit,
			index: this.activeIndex,
			insert: false,
			option: <DiagramOption> $.extend(removed, { from: i })
		};
		this.records.push(rec);
	}
	private labelArrow(pos: LabelPosotion): void
	{
		console.log("label " + this.diagramOption.from + " -> " + this.activeIndex);

		if (!(this.activeField instanceof Diagram))
			return;

		var d = <Diagram> this.activeField;
		var a = d.labelArrow(this.diagramOption.from, this.activeIndex, this.diagramOption.arrowIndex, pos);

		var rec: RecordDiagramTrans = {
			type: RecordType.Transfer,
			index: this.activeIndex,
			from: this.diagramOption.from,
			to: this.diagramOption.to,
			n: this.diagramOption.arrowIndex,
			deeper: true
		};
		this.records.push(rec);

		this.diagramOption.to = this.activeIndex;
		this.activeIndex = 0;
		this.activeField = a.label;
	}

	//////////////////////////////////////
	/*  matrix editing					*/
	//////////////////////////////////////
	private modifyMatrix(horizontal: boolean, extend: boolean): void
	{
		var leave = false;
		var m: Matrix;
		if (this.activeField instanceof Matrix)
			m = <Matrix> this.activeField;
		else if (this.activeField.parent instanceof Matrix)
		{
			leave = true;
			this.leaveFormula(false, true);
			m = <Matrix> this.activeField;
		}
		else
			return;

		if (!extend)
		{
			if (horizontal && m.nonEmpty(0, m.cols - 1, m.rows, 1))
				this.removeToken(m.cols - 1, m.cols * m.rows - 1, true);
			else if (!horizontal && m.nonEmpty(m.rows - 1, 0, 1, m.cols))
				this.removeToken(m.cols * (m.rows - 1), m.cols * m.rows - 1, true);
		}

		(extend ? m.extend : m.shrink).bind(m)(horizontal);

		var rec: RecordEditMatrix = {
			type: RecordType.EditMatrix,
			index: this.activeIndex,
			extend: extend,
			horizontal: horizontal
		};
		this.records.push(rec);

		if (leave)
			this.enterFormula(false);
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
	private leaveFormula(forward: boolean, single?: boolean): boolean
	{
		var t: TokenSeq = this.activeField;

		if (this.inMacroMode && t == this.macroOption.field
			&& !this.exitMacroMode(false))
			return;

		if (t.parent instanceof Structure
			&& !(single
				|| this.markedIndex >= 0 && t.parent instanceof Matrix
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

		if (f instanceof Diagram && this.diagramOption.from >= 0)
		{
			(<RecordDiagramTrans> rec).from = this.diagramOption.from;
			(<RecordDiagramTrans> rec).to = this.diagramOption.to;
			(<RecordDiagramTrans> rec).n = this.diagramOption.arrowIndex;
			this.activeIndex = forward ? this.diagramOption.to : this.diagramOption.from;
			this.diagramOption.from = -1;
			this.diagramOption.to = -1;
			this.diagramOption.arrowIndex = -1;
		}
		else
		{
			this.activeIndex = rec.index;
			if (inFormula && forward)
				this.activeIndex++;
		}
		if (this.markedIndex >= 0)
		{
			this.markedIndex = rec.index;
			if (inFormula && !forward)
				this.markedIndex++;
		}

		this.records.push(rec);

		this.activeField = f;

		return true;
	}
	private enterFormula(forward: boolean): boolean
	{
		var i = this.activeIndex;

		if (this.activeField instanceof Formula && !forward)
			i--;
		var dest = this.activeField.token(i);

		if (this.markedIndex < 0 && dest
			&& (dest instanceof Structure && (<Structure> dest).count() > 0
				|| dest instanceof Formula))
		{
			var rec: RecordTransfer = {
				type: RecordType.Transfer,
				index: i,
				deeper: true
			};
			this.records.push(rec);

			if (dest instanceof Structure && !(dest instanceof Diagram))
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

			if (forward)
				this.activeIndex = 0;
			else
			{
				this.activeIndex = this.activeField.count();
				if (this.activeIndex > 0 && dest instanceof Matrix)
					this.activeIndex--;
			}

			return true;
		}

		return false;
	}
	private jumpFormula(target: TokenSeq): boolean
	{
		var leave = 0, enter = -1;
		var toSeq = [];
		var toIndex = [];

		for (var to = target; to; to = to.parent)
		{
			toSeq.push(to);
			if (to.parent)
				toIndex.push(to.parent.indexOf(to));
		}
	outer:
		for (var from = this.activeField; from; from = from.parent)
		{
			for (var j = 0; j < toSeq.length; j++)
				if (from == toSeq[j])
				{
					enter = j;
					break outer;
				}
			leave++;
		}

		if (enter < 0)
			console.error("[Application.jumpFormula] ill-structured formula");

		var t = this.activeField;
		for (var i = 0; i < leave; i++)
		{
			var f = t.parent;
			var rec: RecordTransfer = {
				type: RecordType.Transfer,
				index: f.indexOf(t),
				deeper: false
			};
			this.records.push(rec);
			t = t.parent;
		}
		for (var j = enter - 1; j >= 0; j--)
		{
			var rec: RecordTransfer = {
				type: RecordType.Transfer,
				index: toIndex[j],
				deeper: true
			};
			this.records.push(rec);
		}

		this.activeField = target;

		return true;
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

		var rec: RecordEdit = {
			type: RecordType.Edit,
			index: this.activeIndex,
			insert: true,
			contents: [t.clone(null)]
		};
		this.records.push(rec);

		if (t instanceof Structure && (<Structure> t).count() > 0
			|| t instanceof Formula)
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

			if (a.nonEmpty(p.row, p.col, mr, mc))
				this.removeToken(this.activeIndex,
					this.activeIndex + (mr - 1) * a.cols + (mc - 1));
		}

		console.log("paste " + t.toString());

		var rec: RecordEdit = {
			type: RecordType.Edit,
			index: this.activeIndex,
			insert: true,
			contents: t.map(x => x.clone(null))
		};
		this.records.push(rec);

		this.activeIndex = this.activeField.paste(this.activeIndex, t);
	}
	private removeToken(from: number, to: number, extensive?: boolean): void
	{
		console.log("remove " + from + " ~ " + to);

		var removed: Token[];

		if (extensive && this.activeField instanceof Diagram)
			removed = (<Diagram> this.activeField).remove(from, to, true);
		else
			removed = this.activeField.remove(from, to);

		var index = Math.min(from, to);

		var rec: RecordEdit = {
			type: RecordType.Edit,
			index: index,
			insert: false,
			contents: removed
		};
		this.records.push(rec);

		this.activeIndex = index;
	}
	private extrudeToken(from: number, to: number): void
	{
		console.log("extrude " + from + " ~ " + to);

		var target = this.activeField.remove(from, to);
		var index = Math.min(from, to);
		var extruded = [new Formula(null)];
		extruded[0].tokens = target;

		var rec1: RecordEdit = {
			type: RecordType.Edit,
			index: index,
			insert: false,
			contents: target
		};
		var rec2: RecordEdit = {
			type: RecordType.Edit,
			index: index,
			insert: true,
			contents: extruded
		};
		this.records.push(rec1);
		this.records.push(rec2);

		this.activeField.paste(index, extruded);
		this.activeIndex = index;
	}

	//////////////////////////////////////
	/*  formula output					*/
	//////////////////////////////////////
	private outputToken(q: JQuery, t: Token, info: OutputInfo): JQuery
	{
		var e: JQuery;

		if (t instanceof Symbol)
		{
			e = this.outputSymbol(q, <Symbol> t, info);
		}
		else if (t instanceof Num)
		{
			e = $("<div/>")
				.addClass("number")
				.text((<Num>t).value.toString());
			q.append(e);
		}
		else if (t instanceof Macro)
		{
			var m = <Macro> t;
			e = this.outputToken(q, this.macroTable[m.name].content, {
				arguments: m, actGenerated: info.actGenerated
			});
		}
		else if (t instanceof Structure)
		{
			var s = <Structure> t;
			e = this.outputStruct(s, info);
			q.append(e);
			if (s.type == StructType.Infer)
			{
				var a3 = $("<div/>").addClass("math label");
				this.outputToken(a3, s.token(2), info);
				q.append(a3);
			}
		}
		else if (t instanceof Formula)
		{
			e = this.outputFormula(<Formula> t, info);
			q.append(e);
		}
		else
			console.error("[Application.outputToken] unexpected argument : " + t);

		t.renderedElem = e;

		return e;
	}
	private outputSymbol(q: JQuery, s: Symbol, info: OutputInfo): JQuery
	{
		var str = s.str;

		if (info.arguments)
		{
			var m = str.match(/^#(\d+)$/);
			if (m)
			{
				var arg = info.arguments;
				info.arguments = null;
				var e = this.outputToken(q, arg.token(parseInt(m[1]) - 1), info);
				info.arguments = arg;
				return e;
			}
		}

		var style = this.outputCurrentStyle[0];

		if (style != FontStyle.Normal)
			str = this.transStyle(str, style);
		if (str == "&")
			str = Unicode.EmSpace;

		var e = $("<div/>").text(str);

		if (style != FontStyle.Normal)
			e.addClass("styledLetter");
		if (!this.proofMode && s.variable && (style == FontStyle.Normal || style == FontStyle.Bold))
			e.addClass("variable");
		else
			e.addClass("symbol");

		q.append(e);

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
	private outputStruct(s: Structure, info: OutputInfo): JQuery
	{
		var e: JQuery;

		switch (s.type)
		{
			case StructType.Frac:
			case StructType.Infer:
				e = $("<div/>").addClass("frac");
				var prim = this.outputToken(e, s.token(0), info);
				var seco = this.outputToken(e, s.token(1), info);
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
				this.outputToken(e, s.token(0), info);
				break;

			case StructType.Diagram:
				this.afterLayout.push(s);
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

						var t = this.outputToken(c, m.tokenAt(i, j), info);
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
					this.outputToken(f, s.token(1), info).addClass("subFormula");
					this.outputToken(f, s.token(0), info).addClass("subFormula");
					e.append(f);
				}
				else
				{
					e = $("<div/>").addClass("frac");
					this.outputToken(e, s.token(1), info).addClass("subFormula");
					e.append($("<div/>").text(o.operator).addClass("operator"));
					this.outputToken(e, s.token(0), info).addClass("subFormula");
				}
				break;

			case StructType.Accent:
				var a = <Accent> s;
				if (a.symbol == "‾")
					e = this.outputFormula(a.elems[0], info).addClass("overline");
				else if (a.symbol == "_")
					e = this.outputFormula(a.elems[0], info).addClass("underline");
				else
				{
					e = $("<div/>").addClass("frac");
					if (!a.above)
						e.addClass("reverseOrdered");
					var ac = this.makeGlyph(a.symbol).addClass("accent").text(Unicode.EnSpace);
					e.append(ac);
					this.outputToken(e, s.token(0), info);
				}
				break;
		}

		return e;
	}
	private outputFormula(f: Formula, info: OutputInfo): JQuery
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

			var inner = this.outputFormulaInner(f, info);
			if (f.prefix == "√")
				inner.addClass("overline");
			braced.append(inner);

			if (f.suffix != "")
				braced.append(this.makeGlyph(f.suffix).addClass("bracket"));

			r = braced;
		}
		else
			r = this.outputFormulaInner(f, info);

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
	private outputFormulaInner(f: Formula, info: OutputInfo): JQuery
	{
		var e = $("<div/>").addClass(this.proofMode ? "formula" : "math");

		if (f == this.macroOption.field)
			e.addClass("macroField");
		if (f == this.activeField && !info.actGenerated)
		{
			var r: JQuery;
			var markedFrom = Math.min(this.markedIndex, this.activeIndex);
			var markedTo = Math.max(this.markedIndex, this.activeIndex);
			var marked = false;
			for (var i = 0, j = 0; i <= f.count(); i++)
			{
				if (i == this.activeIndex)
				{
					this.active = $("<div/>");
					if (this.markedIndex < 0)
						this.active.addClass("active");
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

				this.outputToken(marked ? r : e, f.tokens[j++], info);
			}
			info.actGenerated = true;
		}
		else if (f.tokens.length > 0)
			f.tokens.forEach(s =>
			{
				this.outputToken(e, s, info);
			});
		else
			e.append($("<div/>").addClass("blank").text(Unicode.EnSpace));

		return e;
	}
	private drawAfterLayout(): void
	{
		var box = this.field[0].getBoundingClientRect();
		this.ghost.prop({
			"width": box.width,
			"height": box.height
		});
		var ctx = (<HTMLCanvasElement> this.ghost[0]).getContext("2d");

		for (var i = 0; i < this.afterLayout.length; i++)
		{
			if (this.afterLayout[i] instanceof Diagram)
				this.drawDiagram(ctx, box, <Diagram> this.afterLayout[i]);
		}
	}
	private drawDiagram(ctx: CanvasRenderingContext2D, box: ClientRect, d: Diagram): void
	{
		d.decorations.forEach((r, i) =>
			r.forEach((deco, j) =>
			{
				if (deco)
					d.drawFrame(ctx, box, i * d.cols + j, deco);
			}
		));

		this.drawArrows(ctx, box, d);
	}
	private drawArrows(ctx: CanvasRenderingContext2D, box: ClientRect, d: Diagram): void
	{
		var selected = false;
		var from = d.pos(this.diagramOption.from);
		var to = d.pos(this.activeIndex);

		d.arrows.forEach((ar, i) =>
			ar.forEach((ac, j) =>
			Util.groupBy(ac, a => a.to.row * d.cols + a.to.col)
				.forEach(as =>
			{
				var active = (i == from.row && j == from.col
					&& as[0].to.row == to.row && as[0].to.col == to.col);
				if (active)
				{
					if (this.diagramOption.arrowIndex < 0 || this.diagramOption.arrowIndex >= as.length)
						this.diagramOption.arrowIndex = 0;
				}
				as.forEach((a, k) =>
				{
					var label: JQuery = null;
					if (!a.label.empty() || this.activeField == a.label)
					{
						var label = $("<div/>").addClass("arrowLabel");

						// this implementation unable to macroize diagram
						this.outputToken(label, a.label, { arguments: null, actGenerated: false });
						if (this.activeField == a.label && a.label.empty())
							this.active.text(Unicode.EnSpace);	// there must be some contents to layout in drawArrow

						this.field.append(label);
					}

					var shift = 10 * (k - (as.length - 1) / 2);
					if (active && k == this.diagramOption.arrowIndex)
					{
						d.drawArrow(ctx, box, label, a, shift, this.activeField == d ? this.activeArrowColor : null);
						selected = true;
					}
					else
						d.drawArrow(ctx, box, label, a, shift);
				});
			})));
		if (d == this.activeField && this.diagramOption.from >= 0 && !selected)
		{
			var a: Arrow = {
				from:	d.pos(this.diagramOption.from),
				to:		d.pos(this.activeIndex),
				style:	this.diagramOption.style,
				head:	this.diagramOption.head,
				num:	this.diagramOption.num,
				label: null, labelPos: null
			};
			d.drawArrow(ctx, box, null, a, 0, this.intendedArrowColor);
		}
		if (!selected && d == this.activeField)	// otherwise arrowIndex is kept to undo leaving an arrow label
			this.diagramOption.arrowIndex = -1;
	}
}

var app;

window.onload = () =>
{
	app = new Application($("#field"), $("#latex"), $("#importer"), $("#candy"), $("#ghost"), $("#select"), $("#proofMode"));
};
