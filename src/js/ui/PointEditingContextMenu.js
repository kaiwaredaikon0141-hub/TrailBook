/**
 * One reusable Desktop context menu for Track Point editing actions.
 */
export default class PointEditingContextMenu {

    constructor({
        documentObject = globalThis.document,
        windowObject = globalThis.window
    } = {}) {

        this.document = documentObject;
        this.window = windowObject;
        this.element = null;
        this.#ensureElement();
    }

    show({ clientX, clientY, actions }) {

        if (!this.element || !Array.isArray(actions) || actions.length === 0) {
            return false;
        }

        this.element.replaceChildren(...actions.map(action => {
            const button = this.document.createElement("button");

            button.type = "button";
            button.setAttribute("role", "menuitem");
            button.textContent = action.label;
            button.addEventListener("click", () => {
                this.close();
                action.run?.();
            });
            return button;
        }));
        this.element.hidden = false;
        this.element.style.left = `${Number(clientX) || 0}px`;
        this.element.style.top = `${Number(clientY) || 0}px`;
        this.#clampToViewport();
        this.document.addEventListener("pointerdown", this.#handleOutside, true);
        this.document.addEventListener("keydown", this.#handleKeyDown, true);
        this.element.querySelector("button")?.focus({ preventScroll: true });
        return true;
    }

    close() {

        if (this.element) this.element.hidden = true;
        this.document?.removeEventListener("pointerdown", this.#handleOutside, true);
        this.document?.removeEventListener("keydown", this.#handleKeyDown, true);
    }

    destroy() {

        this.close();
        this.element?.remove();
        this.element = null;
    }

    #ensureElement() {

        if (!this.document?.body || this.element) return;

        this.element = this.document.createElement("div");
        this.element.className = "track-point-context-menu";
        this.element.setAttribute("role", "menu");
        this.element.hidden = true;
        this.document.body.append(this.element);
    }

    #clampToViewport() {

        const bounds = this.element.getBoundingClientRect();
        const maximumLeft = Math.max(
            4,
            (this.window?.innerWidth || 0) - bounds.width - 4
        );
        const maximumTop = Math.max(
            4,
            (this.window?.innerHeight || 0) - bounds.height - 4
        );

        this.element.style.left = `${Math.max(4, Math.min(bounds.left, maximumLeft))}px`;
        this.element.style.top = `${Math.max(4, Math.min(bounds.top, maximumTop))}px`;
    }

    #handleOutside = event => {

        if (!this.element?.contains(event.target)) this.close();
    };

    #handleKeyDown = event => {

        if (event.key !== "Escape") return;
        event.preventDefault();
        this.close();
    };
}
