\# DECISIONS.md



Version : 1.0

Status  : Official



Purpose :

TrailBook の設計判断を記録する。



この文書は

「何を決めたか」

ではなく

「なぜ決めたか」

を残すためのものである。



設計の背景を未来へ伝える。



\---



\# Rule



新しい設計判断を行った場合



以下を必ず記録する。



・Decision ID

・Date

・Status

・Decision

・Reason

・Alternatives

・Consequences



---

# Decision 0007

Title

FolderScanner is a Service

Date

2026-08

Status

Accepted

Decision

FolderScannerをService Layerへ配置する。

Reason

Directoryの走査はアプリケーション処理であり、
UIやBrowser APIの接続処理から分離するため。

Alternatives

fileディレクトリに配置する

Appに直接実装する

Rejected

Consequences

FolderScannerはService LayerからModelを生成する。

---

# Decision 0008

Title

Release 0.2 Does Not Parse GPX Content

Date

2026-08

Status

Accepted

Decision

Release 0.2ではGPXファイルの存在だけを検出し、
内容解析は行わない。

Reason

GPXParser、Track、WaypointはRelease 0.3の責務であり、
Release 0.2のFolder Libraryに含めないため。

Alternatives

GPX内容を同時に解析する

Rejected

Consequences

Release 0.2ではGPXファイルの一覧と件数だけを扱う。

---

# Decision 0009

Title

Release 0.2 Library Events

Date

2026-08

Status

Accepted

Decision

Release 0.2では、ライブラリ操作に次のイベントを使用する。

folder:open-requested

library:loadedのペイロードは{ library }とする。

library:load-failedのペイロードは{ error }とする。

フォルダ選択のキャンセルではlibrary:load-failedを発行しない。

Reason

UIとServiceの依存を分離し、
キャンセルと実際の失敗を区別するため。

Alternatives

UIからFolderScannerを直接呼び出す

キャンセルを失敗イベントとして扱う

Rejected

Consequences

Appがイベントを中継し、
TreeViewとStatusBarはライブラリイベントを購読する。

議論途中の内容は記録しない。



決定事項のみを書く。



\---



\# Decision 0001



Title



GPX is the Single Source of Truth



Date



2026-07



Status



Accepted



Decision



GPXファイルを唯一のマスターデータとする。



TrailBook は GPX を管理するが、

独自形式へ変換しない。



Reason



GPXはオープンフォーマットであり、

将来も他ソフトとの互換性を維持できる。



ユーザーの資産を閉じ込めない。



Alternatives



SQLiteへ取り込む



独自フォーマットへ変換する



Rejected



Consequences



GPX解析は毎回必要になる。



しかしデータの可搬性が高くなる。



\---



\# Decision 0002



Title



Folder is Database



Status



Accepted



Date



2026-07



Decision



フォルダ構造そのものをライブラリとする。



Reason



ユーザーがExplorerで自由に整理できる。



他ソフトでも利用できる。



バックアップが容易。



Alternatives



SQLite



IndexedDB



XML Database



Rejected



Consequences



検索性能は工夫が必要。



しかし管理が非常にシンプルになる。



\---



\# Decision 0003



Title



Framework Free



Status



Accepted



Decision



React等のフレームワークを採用しない。



Reason



TrailBook は画面遷移中心のWebアプリではない。



軽量性と長期保守を優先する。



Alternatives



React



Vue



Angular



Rejected



Consequences



一部UIは自前実装となる。



ライブラリ依存が減る。



\---



\# Decision 0004



Title



JavaScript Only



Status



Accepted



Decision



TypeScriptを採用しない。



Reason



開発速度を優先する。



ブラウザでそのまま動くコードを維持する。



AIによる修正コストも低い。



Alternatives



TypeScript



Rejected



Consequences



型安全性はJSDocで補う。



\---



\# Decision 0005



Title



Event Driven Architecture



Status



Accepted



Decision



UI同士は直接通信しない。



EventBusを利用する。



Reason



疎結合を維持できる。



将来の機能追加が容易。



Alternatives



直接参照



Singleton管理



Rejected



Consequences



イベント設計が重要になる。



\---



\# Decision 0006



Title



Responsibility Based Structure



Status



Accepted



Decision



フォルダは責務で分割する。



Reason



機能追加しても構造が変わらない。



AIが配置を判断しやすい。



Alternatives



機能別



画面別



Rejected



Consequences



最初は理解に時間がかかる。



長期保守性は向上する。



\---



\# Decision 0007



Title



Offline First



Status



Accepted



Decision



ネット接続無しで主要機能を利用可能とする。



Reason



ツーリング先や登山など

通信できない環境を考慮する。



Alternatives



クラウド前提



Rejected



Consequences



同期機能は補助機能となる。



\---



\# Decision 0008



Title



Human Driven Design



Status



Accepted



Decision



設計変更は人間が行う。



AIは設計を変更しない。



Reason



設計思想を維持するため。



Alternatives



AIが自由に改善する



Rejected



Consequences



設計変更にはレビューが必要。



\---



\# Decision 0009



Title



Small Increment Development



Status



Accepted



Decision



小さなReleaseを積み重ねる。



Reason



品質を維持しやすい。



AIによるレビューも容易。



Alternatives



大型リリース



Rejected



Consequences



Version番号は多くなる。



品質は向上する。



\---



\# Decision 0010



Title



Documentation First



Status



Accepted



Decision



設計書を先に更新する。



コードは後で修正する。



Reason



設計と実装の乖離を防ぐ。



Alternatives



コード優先



Rejected



Consequences



ドキュメント更新の手間は増える。



長期保守性は向上する。



\---



\# Decision Status



Accepted



正式採用



Proposed



提案中



Deprecated



非推奨



Rejected



却下



Superseded



新しいDecisionに置き換え



\---



\# How to Update



新しいDecisionを追加する場合



既存を書き換えない。



末尾へ追加する。



Decision IDは連番。



過去を書き換えない。



変更が必要な場合は



Superseded



として新しいDecisionを追加する。



\---



\# Golden Rule



設計は忘れる。



記録は残る。



コードは変わる。



理由は変えてはならない。



未来の開発者は



コードではなく



Decisionを読むことで



TrailBookを理解する。



End of Document

