enum ControlKey
{
	Left, Right, Up, Down, Backspace, Delete, Tab, Enter, Shift
}

class IO
{
    private keyMapNormal: { [key: number]: string };
    private keyMapShifted: { [key: number]: string };

    public constructor()
    {
        this.keyMapNormal = {
				173: '-', 160: '^', 220: '¥',  64: '@', 219: '[',
                 59: ';',  58: ':', 221: ']', 188: ',', 190: '.',
				191: '/', 226:'\\',  32: ' ' };
        this.keyMapShifted = {
                 49: '!',  50: '"',  51: '#',  52: '$',  53: '%',
                 54: '&',  55: "'",  56: '(',  57: ')', 173: '=',
                160: '~', 220: '|',  64: '`', 219: '{',  59: '+',
                 58: '*', 221: '}', 188: '<', 190: '>', 191: '?',
				226: '_',  32: ' ' };
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
			case 37: return ControlKey.Left;
			case 38: return ControlKey.Up;
			case 39: return ControlKey.Right;
			case 40: return ControlKey.Down;
			case 46: return ControlKey.Delete;
		}

		return null;
	}
    public static isDigit(c: string): boolean
    {
        switch (c)
        {
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
                return true;
            default:
                return false;
        }
    }
}
