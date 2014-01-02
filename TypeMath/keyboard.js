var ControlKey;
(function (ControlKey) {
    ControlKey[ControlKey["Space"] = 0] = "Space";
    ControlKey[ControlKey["Left"] = 1] = "Left";
    ControlKey[ControlKey["Right"] = 2] = "Right";
    ControlKey[ControlKey["Up"] = 3] = "Up";
    ControlKey[ControlKey["Down"] = 4] = "Down";
    ControlKey[ControlKey["Backspace"] = 5] = "Backspace";
    ControlKey[ControlKey["Delete"] = 6] = "Delete";
    ControlKey[ControlKey["Tab"] = 7] = "Tab";
    ControlKey[ControlKey["Enter"] = 8] = "Enter";
    ControlKey[ControlKey["Shift"] = 9] = "Shift";
})(ControlKey || (ControlKey = {}));

var Keyboard = (function () {
    function Keyboard() {
    }
    Keyboard.knowKey = function (e) {
        var code = e.keyCode;
        var key = "";

        if (!e.shiftKey) {
            if (code in Keyboard.keyMapNormal)
                key = Keyboard.keyMapNormal[code];
            else if (code >= 48 && code <= 57 || code >= 65 && code <= 90)
                key = String.fromCharCode(code).toLowerCase();
        } else {
            if (code in this.keyMapShifted)
                key = this.keyMapShifted[code];
            else if (code >= 48 && code <= 57 || code >= 65 && code <= 90)
                key = String.fromCharCode(code);
        }

        return key;
    };
    Keyboard.knowControlKey = function (e) {
        switch (e.keyCode) {
            case 8:
                return 5 /* Backspace */;
            case 9:
                return 7 /* Tab */;
            case 13:
                return 8 /* Enter */;
            case 16:
                return 9 /* Shift */;
            case 32:
                return 0 /* Space */;
            case 37:
                return 1 /* Left */;
            case 38:
                return 3 /* Up */;
            case 39:
                return 2 /* Right */;
            case 40:
                return 4 /* Down */;
            case 46:
                return 6 /* Delete */;
        }

        return null;
    };
    Keyboard.keyMapNormal = {
        189: '-', 222: '^', 220: '¥', 192: '@', 219: '[',
        187: ';', 186: ':', 221: ']', 188: ',', 190: '.',
        191: '/', 226: '\\',
        173: '-', 160: '^', 64: '@', 59: ';', 58: ':'
    };
    Keyboard.keyMapShifted = {
        49: '!', 50: '"', 51: '#', 52: '$', 53: '%',
        54: '&', 55: "'", 56: '(', 57: ')', 173: '=',
        189: '~', 220: '|', 192: '`', 219: '{', 187: '+',
        186: '*', 221: '}', 188: '<', 190: '>', 191: '?',
        226: '_',
        160: '~', 64: '`', 59: '+', 58: '*'
    };
    return Keyboard;
})();
//# sourceMappingURL=keyboard.js.map
