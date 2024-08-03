const linkNames = ['osu', 'taiko', 'fruits', 'mania'];
const longNames = ['osu!', 'osu!taiko', 'osu!catch', 'osu!mania'];
const shortNames = ['osu', 'taiko', 'catch', 'mania'];

export default class Ruleset {
	#id;

	static all() {
		return [0, 1, 2, 3].map((m) => new this(m));
	}

	constructor(rulesetId) {
		if (
			typeof rulesetId === 'number' &&
			Number.isInteger(rulesetId) &&
			rulesetId >= 0 &&
			rulesetId <= 3
		)
			this.#id = rulesetId;
		else if (typeof rulesetId === 'string')
			switch (rulesetId.toLowerCase().trim()) {
				case '0':
				case 'osu':
				case 'osu!':
				case 'osu!standard':
				case 'osu!std':
				case 'standard':
				case 'std':
					this.#id = 0;
					break;
				case '1':
				case 'osu!taiko':
				case 'taiko':
					this.#id = 1;
					break;
				case '2':
				case 'catch':
				case 'catch the beat':
				case 'ctb':
				case 'fruits':
				case 'osu!catch':
				case 'osu!ctb':
					this.#id = 2;
					break;
				case '3':
				case 'mania':
				case 'osu!mania':
					this.#id = 3;
					break;
				default:
					throw new RangeError('The provided mode is not valid');
			}
		else throw new TypeError('The provided mode is neither an integer nor a String');
	}

	get id() {
		return this.#id;
	}

	get linkName() {
		return linkNames[this.#id];
	}

	get longName() {
		return longNames[this.#id];
	}

	get shortName() {
		return shortNames[this.#id];
	}
}
