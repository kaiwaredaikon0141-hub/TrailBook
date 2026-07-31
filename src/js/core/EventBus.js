/**
 * Very small EventBus
 * Components communicate only through this class.
 */

export default class EventBus {

    constructor() {

        this.events = {};

    }

    on(name, callback) {

        if (!this.events[name]) {

            this.events[name] = [];
        }

        this.events[name].push(callback);

    }

    emit(name, data = null) {

        if (!this.events[name]) {

            return;
        }

        this.events[name].forEach(callback => callback(data));

    }

}