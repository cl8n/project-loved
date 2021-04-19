const linkNames = ['osu', 'taiko', 'fruits', 'mania'];
const longNames = ['osu!', 'osu!taiko', 'osu!catch', 'osu!mania'];
const shortNames = ['osu', 'taiko', 'catch', 'mania'];

module.exports = class GameMode {
    #mode;

    static modes() {
        return [0, 1, 2, 3].map(m => new this(m));
    }

    constructor(mode) {
        if (typeof mode === 'number' && Number.isInteger(mode) && mode >= 0 && mode <= 3)
            this.#mode = mode;
        else if (typeof mode === 'string')
            switch (mode.toLowerCase().trim()) {
                case '0':
                case 'osu':
                case 'osu!':
                case 'osu!standard':
                case 'osu!std':
                case 'standard':
                case 'std':
                    this.#mode = 0;
                    break;
                case '1':
                case 'osu!taiko':
                case 'taiko':
                    this.#mode = 1;
                    break;
                case '2':
                case 'catch':
                case 'catch the beat':
                case 'ctb':
                case 'fruits':
                case 'osu!catch':
                case 'osu!ctb':
                    this.#mode = 2;
                    break;
                case '3':
                case 'mania':
                case 'osu!mania':
                    this.#mode = 3;
                    break;
                default:
                    throw new RangeError('The provided mode is not valid');
            }
        else
            throw new TypeError('The provided mode is neither an integer nor a String');
    }

    get integer() {
        return this.#mode;
    }

    get linkName() {
        return linkNames[this.#mode];
    }

    get longName() {
        return longNames[this.#mode];
    }

    get shortName() {
        return shortNames[this.#mode];
    }
}
