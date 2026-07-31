/**
 * A single point in a GPX track segment.
 */
export default class TrackPoint {

    /**
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude, longitude) {

        this.latitude = latitude;
        this.longitude = longitude;
        this.elevation = null;
        this.time = null;
    }

}