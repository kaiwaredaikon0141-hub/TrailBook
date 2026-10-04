const COMMANDS = new Map([
    ["ズームイン", "zoomIn"], ["ズームインして", "zoomIn"],
    ["拡大", "zoomIn"], ["拡大して", "zoomIn"],
    ["ズームアウト", "zoomOut"], ["ズームアウトして", "zoomOut"],
    ["縮小", "zoomOut"], ["縮小して", "zoomOut"],
    ["現在地に戻る", "returnToPosition"],
    ["現在地に戻って", "returnToPosition"], ["現在地", "returnToPosition"]
]);

export function resolveVoiceMapCommand(transcript) {
    const normalized = String(transcript ?? "").normalize("NFKC")
        .replace(/[\s。、.!！?？]/g, "");
    return COMMANDS.get(normalized) ?? null;
}

/** Session-only, Android-only push-to-talk; no microphone routing or persistence. */
export default class VoiceMapController {
    constructor({
        zoomIn, zoomOut, returnToPosition,
        navigatorObject = globalThis.navigator,
        windowObject = globalThis.window,
        documentObject = globalThis.document,
        Recognition = windowObject?.SpeechRecognition ||
            windowObject?.webkitSpeechRecognition,
        secureContext = globalThis.isSecureContext,
        confirmUse = () => windowObject.confirm(
            "音声操作では、音声がChromeの認識サービスへ送信される場合があります。" +
            "Bluetoothマイクの使用はAndroid／Chromeの入力設定に依存します。続行しますか？"
        )
    }) {
        this.actions = { zoomIn, zoomOut, returnToPosition };
        this.Recognition = Recognition;
        this.windowObject = windowObject;
        this.documentObject = documentObject;
        this.confirmUse = confirmUse;
        this.supported = Boolean(secureContext && typeof Recognition === "function" &&
            (navigatorObject?.userAgentData?.platform === "Android" ||
                /Android/i.test(navigatorObject?.userAgent || "")));
        this.consent = false;
        this.recognition = null;
        this.attached = false;
        this.element = documentObject.createElement("div");
        this.element.className = "voice-map-control";
        this.element.innerHTML = `
            <button class="voice-map-button" type="button" aria-pressed="false"
                aria-label="音声操作：ズームイン、ズームアウト、現在地に戻る"
                title="音声操作：ズームイン／ズームアウト／現在地に戻る">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
                </svg>
            </button>
            <span class="voice-map-status" role="status" aria-live="polite"></span>`;
        this.button = this.element.querySelector("button");
        this.status = this.element.querySelector(".voice-map-status");
        this.handleClick = event => { event.stopPropagation(); this.toggle(); };
        this.handleHidden = () => {
            if (documentObject.visibilityState === "hidden") this.cancel();
        };
        this.handlePageHide = () => this.cancel();
    }

    attach(container) {
        if (!this.supported || this.attached) return false;
        container.append(this.element);
        this.button.addEventListener("click", this.handleClick);
        this.documentObject.addEventListener("visibilitychange", this.handleHidden);
        this.windowObject.addEventListener("pagehide", this.handlePageHide);
        this.attached = true;
        return true;
    }

    detach() {
        this.cancel();
        clearTimeout(this.feedbackTimer);
        this.button.removeEventListener("click", this.handleClick);
        this.documentObject.removeEventListener("visibilitychange", this.handleHidden);
        this.windowObject.removeEventListener("pagehide", this.handlePageHide);
        this.element.remove();
        this.attached = false;
    }

    toggle() {
        if (!this.attached) return;
        if (this.recognition) { this.cancel(); return; }
        if (!this.consent && !this.confirmUse()) return;
        this.consent = true;
        try {
            const recognition = new this.Recognition();
            this.recognition = recognition;
            recognition.lang = "ja-JP";
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.onresult = event => {
                if (this.recognition !== recognition) return;
                const result = event.results?.[event.resultIndex ?? 0];
                if (!result?.isFinal) return;
                const command = resolveVoiceMapCommand(result[0]?.transcript);
                this.#finish();
                try {
                    const action = this.actions[command];
                    const accepted = typeof action === "function" && action() !== false;
                    this.#feedback(accepted ? {
                        zoomIn: "ズームインしました", zoomOut: "ズームアウトしました",
                        returnToPosition: "現在地へ移動します"
                    }[command] : "ズームイン／ズームアウト／現在地に戻る、と話してください");
                } catch { this.#feedback("地図を操作できませんでした"); }
            };
            recognition.onerror = event => {
                if (this.recognition !== recognition) return;
                this.#finish();
                this.#feedback({
                    "not-allowed": "マイクの利用が許可されていません",
                    "audio-capture": "マイクを利用できません",
                    network: "音声認識に接続できません",
                    "no-speech": "音声を認識できませんでした"
                }[event.error] || "音声認識を終了しました");
            };
            recognition.onend = () => {
                if (this.recognition !== recognition) return;
                this.#finish();
                this.#feedback("音声を認識できませんでした");
            };
            clearTimeout(this.feedbackTimer);
            this.status.textContent = "音声受付中…（もう一度押すと取消）";
            this.button.setAttribute("aria-pressed", "true");
            this.listenTimer = setTimeout(() => {
                if (this.recognition !== recognition) return;
                this.#finish();
                this.#feedback("音声受付を終了しました");
            }, 15000);
            // Keep start inside the trusted button click; never auto-restart.
            recognition.start();
        } catch {
            this.#finish();
            this.#feedback("音声認識を開始できませんでした");
        }
    }

    cancel() {
        this.#finish();
        clearTimeout(this.feedbackTimer);
        this.status.textContent = "";
    }

    #finish() {
        const recognition = this.recognition;
        this.recognition = null;
        clearTimeout(this.listenTimer);
        this.button.setAttribute("aria-pressed", "false");
        try { recognition?.abort(); } catch { /* Already ended. */ }
    }

    #feedback(message) {
        clearTimeout(this.feedbackTimer);
        this.status.textContent = message;
        this.feedbackTimer = setTimeout(() => { this.status.textContent = ""; }, 6000);
    }
}
