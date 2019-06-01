const Gamemode = require('./gamemode');

module.exports = class {
    constructor(properties) {
        Object.assign(this, properties);
    }

    get artist() {
        return this._artist;
    }

    set artist(artist) {
        this._artist = artist.trim();
    }

    get captain() {
        return this._captain;
    }

    set captain(captain) {
        this._captain = captain.trim();
    }

    get creators() {
        return this._creators;
    }

    set creators(creators) {
        if (Array.isArray(creators))
            this._creators = creators;
        else if (typeof creators === 'string')
            this._creators = creators.split(',').map(c => c.trim());
        else
            throw new TypeError('The provided list of creators is neither an Array nor a String');
    }

    get description() {
        return this._description;
    }

    set description(description) {
        this._description = description.replace(/\n\\\n/g, '\n\n').trim();
    }

    get excludedBeatmaps() {
        return this._excludedBeatmaps || [];
    }

    set excludedBeatmaps(excludedBeatmaps) {
        if (Array.isArray(excludedBeatmaps))
            this._excludedBeatmaps = excludedBeatmaps;
        else if (typeof excludedBeatmaps === 'string')
            this._excludedBeatmaps = excludedBeatmaps.split(',').map(e => parseInt(e));
        else
            throw new TypeError('The provided list of creators is neither an Array nor a String');
    }

    get id() {
        return this._id;
    }

    set id(id) {
        if (typeof id === 'string')
            this._id = parseInt(id);
        else if (typeof id === 'number' && Number.isInteger(id))
            this._id = id;
        else
            throw new TypeError('The provided ID is not an integer');
    }

    get metadataEdits() {
        return this._metadataEdits;
    }

    set metadataEdits(metadataEdits) {
        this._metadataEdits = metadataEdits.trim();
    }

    get metadataMessageAuthor() {
        return this._metadataMessageAuthor;
    }

    set metadataMessageAuthor(author) {
        this._metadataMessageAuthor = author.trim();
    }

    get mode() {
        return this._mode;
    }

    set mode(mode) {
        if (mode instanceof Gamemode)
            this._mode = mode;
        else
            this._mode = new Gamemode(mode);
    }

    get position() {
        return this._position;
    }

    set position(position) {
        if (typeof position === 'string')
            this._position = parseInt(position);
        else if (typeof position === 'number' && Number.isInteger(position))
            this._position = position;
        else
            throw new TypeError('The provided position is not an integer');
    }

    get title() {
        return this._title;
    }

    set title(title) {
        this._title = title.trim();
    }

    imageFilename() {
        return `${this.position}-${this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^\-|\-$/g, '')}.jpg`;
    }
}
