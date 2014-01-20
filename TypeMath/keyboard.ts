enum ControlKey
{
	Space, Left, Right, Up, Down, Backspace, Delete, Tab, Enter, Shift
}

class Keyboard
{
    private static keyMapNormal = {
		189: '-', 222: '^', 220: '¥', 192: '@', 219: '[',	/* Opera, Chrome, Safari */
		187: ';', 186: ':', 221: ']', 188: ',', 190: '.',
		191: '/', 226: '\\',
		173: '-', 160: '^',  64: '@',  59: ';',  58: ':'	/* Firefox */
	};
	private static keyMapShifted = {
		 49: '!',  50: '"',  51: '#',  52: '$',  53: '%',
		 54: '&',  55: "'",  56: '(',  57: ')', 173: '=',
		189: '=', 222: "~", 220: '|', 192: '`', 219: '{',
		187: '+', 186: '*', 221: '}', 188: '<', 190: '>',
		191: '?', 226: '_',
		160: '~',  64: '`',  59: '+',  58: '*'
	};
	private static keyMapWebkit = {
		"U+00BD": ["-", "="],
		"U+00DE": ["^", "~"],
		"U+00DC": ["¥", "|"],
		"U+00C0": ["@", "`"],
		"U+00DB": ["[", "{"],
		"U+00BB": [";", "+"],
		"U+00BA": [":", "*"],
		"U+00DD": ["]", "}"],
		"U+00BC": [",", "<"],
		"U+00BE": [".", ">"],
		"U+00BF": ["/", "?"],
		"U+00E2": ["\\", "_"],
	};

	public static knowKey(e: KeyboardEvent): string
	{
		var code = e.keyCode;
		var key = "";

		if (e.char && e.keyCode > 32)	// IE
			key = e.key;
		else if ((<any> e).keyIdentifier !== undefined)	// Safari, Opera, Chrome
		{
			var id = <string> (<any> e).keyIdentifier;
			key = (id in Keyboard.keyMapWebkit
				? Keyboard.keyMapWebkit[id][e.shiftKey ? 1 : 0]
				: this.getAsciiKey(parseInt(id.substr(2), 16)));
			if (!e.shiftKey)
				key = key.toLowerCase();
		}
		else if (!e.shiftKey)
			key = (code in this.keyMapNormal
				? this.keyMapNormal[code]
				: this.getAsciiKey(code).toLowerCase());
		else
			key = (code in this.keyMapShifted
				? this.keyMapShifted[code]
				: this.getAsciiKey(code));

		return key;
	}
	private static getAsciiKey(code: number): string
	{
		if (code >= 48 && code <= 57 || code >= 65 && code <= 90)
			return String.fromCharCode(code);
		else
			return "";
	}
	public static knowControlKey(e: KeyboardEvent): ControlKey
	{
		switch (e.keyCode)
		{
			case 8: return ControlKey.Backspace;
			case 9: return ControlKey.Tab;
			case 13: return ControlKey.Enter;
			case 16: return ControlKey.Shift;
			case 32: return ControlKey.Space;
			case 37: return ControlKey.Left;
			case 38: return ControlKey.Up;
			case 39: return ControlKey.Right;
			case 40: return ControlKey.Down;
			case 46: return ControlKey.Delete;
		}

		return null;
	}
}
