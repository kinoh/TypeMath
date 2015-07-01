enum ControlKey
{
	Space, Left, Right, Up, Down, Backspace, Delete, Tab, Enter, Shift
}

class Keyboard
{
	private static keyMapBlink = {
		"U+0031": ["1", "!"],
		"U+0032": ["2", "\""],
		"U+0033": ["3", "#"],
		"U+0034": ["4", "$"],
		"U+0035": ["5", "%"],
		"U+0036": ["6", "&"],
		"U+0037": ["7", "'"],
		"U+0038": ["8", "("],
		"U+0039": ["9", ")"],
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

		if (e.key !== undefined && e.key != " " && e.key.length == 1)
			key = e.key;
		else if ("keyIdentifier" in e)	// Webkit, Blink
		{
			var id = <string> (<any> e).keyIdentifier;
			if (id in Keyboard.keyMapBlink)
				key = Keyboard.keyMapBlink[id][e.shiftKey ? 1 : 0];
			else
			{
				key = this.getAsciiKey(parseInt(id.substr(2), 16));
				if (!e.shiftKey)
					key = key.toLowerCase();
			}
		}

		return key;
	}
	private static getAsciiKey(code: number): string
	{
		if (code >= 0x21 && code <= 0x7E)
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
