/**
 * A standalone GPX waypoint.
 */
export default class Waypoint {

    /**
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude, longitude) {

        this.latitude = latitude;
        this.longitude = longitude;
        this.elevation = null;
        this.time = null;
        this.name = null;
        this.description = null;
        this.symbol = null;
        this.type = null;
    }

}