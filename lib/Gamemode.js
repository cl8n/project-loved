const longNames = ['osu!standard', 'osu!taiko', 'osu!catch', 'osu!mania'];
const shortNames = ['osu', 'taiko', 'catch', 'mania'];

exports = class {
    static modes() {
        return Array(4).map((_, i) => new this(i));
    }

    constructor(mode) {
        if (typeof mode === 'number' && Number.isInteger(mode) && mode >= 0 && mode <= 3)
            this._mode = mode;
        else if (typeof mode === 'string')
            switch (mode.toLowerCase().trim()) {
                case '0':
                case 'osu':
                case 'osu!':
                case 'osu!standard':
                case 'osu!std':
                case 'standard':
                case 'std':
                    this._mode = 0;
                    break;
                case '1':
                case 'osu!taiko':
                case 'taiko':
                    this._mode = 1;
                    break;
                case '2':
                case 'catch':
                case 'catch the beat':
                case 'ctb':
                case 'fruits':
                case 'osu!catch':
                case 'osu!ctb':
                    this._mode = 2;
                    break;
                case '3':
                case 'mania':
                case 'osu!mania':
                    this._mode = 3;
                    break;
                default:
                    throw new RangeError('The provided mode is not valid');
            }
        else
            throw new TypeError('The provided mode is neither an integer nor a String');
    }

    get integer() {
        return this._mode;
    }

    get longName() {
        return longNames[this._mode];
    }

    get shortName() {
        return shortNames[this._mode];
    }
}
