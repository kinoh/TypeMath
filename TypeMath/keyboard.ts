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

    public static knowKey(e: KeyboardEvent): string
    {
	    var code = e.keyCode;
	    var key = "";

	    if (!e.shiftKey)
	    {
            if (code in Keyboard.keyMapNormal)
                key = Keyboard.keyMapNormal[code];
            else if (code >= 48 && code <= 57 || code >= 65 && code <= 90)
                key = String.fromCharCode(code).toLowerCase();
	    }
	    else
	    {
            if (code in this.keyMapShifted)
                key = this.keyMapShifted[code];
            else if (code >= 48 && code <= 57 || code >= 65 && code <= 90)
                key = String.fromCharCode(code);
        }

        return key;
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
