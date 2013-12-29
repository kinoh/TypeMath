enum ControlKey
{
	Space, Left, Right, Up, Down, Backspace, Delete, Tab, Enter, Shift
}

class IO
{
    private keyMapNormal: { [key: number]: string };
    private keyMapShifted: { [key: number]: string };

    public constructor()
	{
		
		this.keyMapNormal = {
			189: '-', 222: '^', 220: '¥', 192: '@', 219: '[',	/* Opera, Chrome, Safari */
			187: ';', 186: ':', 221: ']', 188: ',', 190: '.',
			191: '/', 226: '\\',
			160: '^',  64: '@',  59: ';',  58: ':'				/* Firefox */
		};
        this.keyMapShifted = {
			 49: '!',  50: '"',  51: '#',  52: '$',  53: '%',
			 54: '&',  55: "'",  56: '(',  57: ')', 173: '=',
			189: '~', 220: '|', 192: '`', 219: '{', 187: '+',
			186: '*', 221: '}', 188: '<', 190: '>', 191: '?',
			226: '_',
			160: '~',  64: '`',  59: '+',  58: '*'
		};
    }

    public knowKey(e: KeyboardEvent): string
    {
	    var code = e.keyCode;
	    var key = "";

	    if (!e.shiftKey)
	    {
            if (code in this.keyMapNormal)
                key = this.keyMapNormal[code];
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
	public knowControlKey(e: KeyboardEvent): ControlKey
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
