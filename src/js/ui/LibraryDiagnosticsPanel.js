/**
 * Collects Library diagnostics behind one disclosure without owning their data.
 */
export default class LibraryDiagnosticsPanel {

    constructor(documentTarget = globalThis.document) {

        this.element = documentTarget.createElement("section");
        this.element.className = "library-diagnostics-panel";
        this.element.innerHTML = `
            <details class="library-diagnostics-disclosure">
                <summary>About / Diagnostics</summary>
                <div class="library-diagnostics-content">
                    <section class="library-diagnostics-section"
                        data-diagnostics-section="build">
                        <h4>Build / Runtime</h4>
                    </section>
                    <section class="library-diagnostics-section"
                        data-diagnostics-section="previous">
                        <h4>Previous Library</h4>
                    </section>
                    <div data-diagnostics-section="fast-restore"></div>
                    <div data-diagnostics-section="library-refresh"></div>
                </div>
            </details>
        `;
        this.disclosure = this.element.querySelector(
            ".library-diagnostics-disclosure"
        );
    }

    appendBuildInfo(...elements) {

        this.#append("build", elements);
    }

    attachPreviousLibrary(element) {

        this.#append("previous", [element]);
    }

    attachFastRestore(element) {

        if (element) element.open = true;
        this.#append("fast-restore", [element]);
    }

    attachLibraryRefresh(element) {

        if (element) element.open = true;
        this.#append("library-refresh", [element]);
    }

    #append(section, elements) {

        const target = this.element.querySelector(
            `[data-diagnostics-section="${section}"]`
        );

        elements.filter(Boolean).forEach(element => target?.append(element));
    }
}
