import App from "./core/App.js";

window.addEventListener("DOMContentLoaded", () => {

    const app = new App();

    app.initialize();

    app.eventBus.emit("app:ready");

});