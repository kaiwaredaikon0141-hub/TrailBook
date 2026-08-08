const PANEL_ID = "library-access-status";

/**
 * Presents persistent Library access guidance without blocking interaction.
 */
export default class LibraryAccessPanel {

    constructor() {

        this.element = this.#create();
        this.previousLibraryButton = this.element.querySelector(
            ".previous-library-open"
        );
        this.previousLibraryAction = null;
        this.previousLibraryButton.addEventListener("click", () => {
            this.previousLibraryAction?.();
        });
    }

    get descriptionId() {

        return PANEL_ID;
    }

    showInitial() {

        this.#show(
            "ライブラリを開く",
            "「ライブラリを開く」を押し、GPXを含むFolderを選択します。" +
            "TrailBookはGPXを読み取り専用で扱い、移動・変更・削除・保存しません。"
        );
    }

    showInsecureContext() {

        this.#show(
            "安全な接続が必要です",
            "このページは安全な接続で開かれていません。HTTPS、" +
            "http://localhost、http://127.0.0.1で開いてください。" +
            "file://や通常のLAN内HTTP IPでは利用できません。",
            "error"
        );
    }

    showUnsupportedBrowser() {

        this.#show(
            "Folder選択を利用できません",
            "このbrowserではFolder選択APIを利用できません。" +
            "Windows版ChromeまたはEdge desktopを推奨します。" +
            "Mobileでは必要APIが利用できる端末だけ実機試験できます。" +
            "代替のFolder選択方式はRelease 1.0では実装していません。",
            "error"
        );
    }

    showUnverifiedMobile() {

        this.#show(
            "未検証のMobile環境です",
            "Folder選択APIを利用できるため実機試験を続行できます。" +
            "この端末は正式対応環境ではなく、合格するまでbest effort対応にも含めません。"
        );
    }

    showLoading(folderName) {

        this.#show(
            "ライブラリを読み込み中",
            `${folderName}を確認しています。`
        );
    }

    showPreviousLibrary(folderName, permission = "prompt") {

        const denied = permission === "denied";

        this.#show(
            "前回のLibraryがあります",
            denied
                ? `${folderName}へのアクセスは許可されていません。` +
                    "明示的に開き直すか、通常のLibraryを選択できます。"
                : `${folderName}を開くにはアクセスの確認が必要です。` +
                    "通常のLibrary選択も引き続き利用できます。",
            denied ? "error" : "info"
        );
        this.previousLibraryButton.hidden = false;
        this.previousLibraryButton.setAttribute(
            "aria-label",
            `前回のLibrary ${folderName} を開く`
        );
    }

    setPreviousLibraryAction(action) {

        this.previousLibraryAction = action;
    }

    showPermissionFailure() {

        this.#show(
            "Folderを開けませんでした",
            "Folderへのアクセスを許可して、もう一度「ライブラリを開く」を押してください。" +
            "現在のLibraryがある場合、その内容は維持されています。",
            "error"
        );
    }

    showLoadFailure() {

        this.#show(
            "ライブラリを開けませんでした",
            "Folderを読み取れませんでした。内容とアクセス権を確認して、もう一度お試しください。" +
            "現在のLibraryがある場合、その内容は維持されています。",
            "error"
        );
    }

    showEmpty(libraryName) {

        this.#show(
            `${libraryName}: GPX 0件`,
            "このFolderにはGPXファイルがありません。別のLibraryへ切り替えることができます。"
        );
    }

    hide() {

        this.element.hidden = true;
    }

    #create() {

        const section = document.createElement("section");

        section.id = PANEL_ID;
        section.className = "library-access-panel";
        section.setAttribute("role", "status");
        section.setAttribute("aria-live", "polite");
        section.setAttribute("aria-atomic", "true");
        section.innerHTML = `
            <h4 class="library-access-title"></h4>
            <p class="library-access-message"></p>
            <button class="previous-library-open" type="button" hidden>
                前回のLibraryを開く
            </button>
        `;

        return section;
    }

    #show(title, message, state = "info") {

        this.previousLibraryButton.hidden = true;
        this.element.dataset.state = state;
        this.element.querySelector(".library-access-title").textContent = title;
        this.element.querySelector(".library-access-message").textContent = message;
        this.element.hidden = false;
    }
}
