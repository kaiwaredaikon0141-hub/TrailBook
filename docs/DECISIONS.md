# DECISIONS.md

Version: 1.1
Status: Official

TrailBookの設計判断と、その理由を将来へ残す。

既存Decisionの意味は変更しない。後のReleaseで設計が発展した場合も元のDecisionを残し、新しいDecisionから関係を明記する。

## Record Format

各Decisionは次を記録する。

- Decision ID
- Title
- Date
- Status
- Decision
- Reason
- Alternatives
- Consequences

## Decision 0001 — GPX is the Single Source of Truth

Date: 2026-07
Status: Accepted

Decision: GPXファイルを唯一のマスターデータとする。TrailBookはGPXを管理するが、独自形式へ変換しない。

Reason: GPXはオープンフォーマットであり、他ソフトとの互換性とユーザーデータの可搬性を維持できる。

Alternatives: SQLiteへの取込、独自フォーマットへの変換。

Consequences: GPX解析が必要になるが、ユーザー資産を閉じ込めない。

## Decision 0002 — Folder is Database

Date: 2026-07
Status: Accepted

Decision: Folder構造そのものをLibraryとして扱う。

Reason: Explorerで自由に整理でき、他ソフトからも利用でき、バックアップが容易である。

Alternatives: SQLite、IndexedDB、XML Database。

Consequences: 検索性能には工夫が必要だが、データ管理は単純になる。

## Decision 0003 — Framework Free

Date: Not recorded
Status: Accepted

Decision: React、Vue、AngularなどのApplication frameworkを採用しない。

Reason: 軽量性と長期保守性を優先し、Library依存を減らす。

Alternatives: React、Vue、Angular。

Consequences: 一部UIを自前実装する。

## Decision 0004 — JavaScript Only

Date: Not recorded
Status: Accepted

Decision: TypeScriptを採用せず、Browserで直接動作するJavaScript ES Modulesを使用する。

Reason: 開発速度と直接実行可能な構成を維持し、AIによる修正コストを抑える。

Alternatives: TypeScript。

Consequences: 型情報はJSDocで補う。

## Decision 0005 — Event Driven Architecture

Date: Not recorded
Status: Accepted

Decision: UI同士は直接通信せず、EventBusを使用する。

Reason: 疎結合を維持し、将来の機能追加を容易にする。

Alternatives: UI間の直接参照、Singleton管理。

Consequences: Event名とpayload契約が重要になる。

## Decision 0006 — Responsibility Based Structure

Date: Not recorded
Status: Accepted

Decision: Source folderは画面や機能ではなく責務で分割する。

Reason: 機能追加後も構造を安定させ、配置判断を明確にする。

Alternatives: 機能別、画面別の構造。

Consequences: 初期理解には時間が必要だが、長期保守性が向上する。

## Decision 0007 — Offline First

Date: Not recorded
Status: Accepted

Decision: ネット接続なしでも主要機能を利用可能にする。

Reason: ツーリング先や登山など、通信できない環境を考慮する。

Alternatives: Cloud接続を前提にする。

Consequences: 同期機能は補助機能となる。Online地図tileの完全なoffline化は別途設計を必要とする。

## Decision 0008 — Human Driven Design

Date: Not recorded
Status: Accepted

Decision: 設計変更は人間が行い、AIは承認なく設計を変更しない。

Reason: TrailBookの設計思想と範囲を維持する。

Alternatives: AIが自由に設計を改善する。

Consequences: 設計変更には人間のreviewが必要になる。

## Decision 0009 — Small Increment Development

Date: Not recorded
Status: Accepted

Decision: 小さなReleaseを積み重ねる。

Reason: 品質を維持し、変更とreviewの範囲を限定する。

Alternatives: 大型Release。

Consequences: Version番号は増えるが、各段階を検証しやすい。

## Decision 0010 — Documentation First

Date: Not recorded
Status: Accepted

Decision: 設計文書を先に更新し、コードはその後に修正する。

Reason: 設計と実装の乖離を防ぐ。

Alternatives: Code first。

Consequences: 文書更新の作業は増えるが、長期保守性が向上する。

## Decision 0011 — FolderScanner is a Service

Date: 2026-08
Status: Accepted

Decision: FolderScannerをService Layerへ配置する。

Reason: Directory走査はApplication処理であり、UIやBrowser API接続の詳細から分離するため。

Alternatives: `file/`への配置、Appへの直接実装。

Consequences: FolderScannerがService LayerからFolderとLibrary Modelを生成する。

## Decision 0012 — Release 0.2 Does Not Parse GPX Content

Date: 2026-08
Status: Accepted

Decision: Release 0.2ではGPXファイルの存在だけを検出し、内容を解析しない。

Reason: GPXParser、Track、WaypointはRelease 0.3の責務であり、Folder Libraryの範囲に含めないため。

Alternatives: Folder走査と同時にGPX内容を解析する。

Consequences: Release 0.2はGPXファイルの一覧と件数だけを扱う。

## Decision 0013 — Release 0.2 Library Events

Date: 2026-08
Status: Accepted

Decision: Folder選択要求に`folder:open-requested`を使用する。`library:loaded`のpayloadは`{ library }`、`library:load-failed`は`{ error }`とし、Folder選択のcancelではfailure eventを発行しない。

Reason: UIとServiceを分離し、cancelと実際の失敗を区別する。

Alternatives: UIからFolderScannerを直接呼ぶ、cancelをfailureとして扱う。

Consequences: Appがeventを調停し、TreeViewとStatusBarがLibrary eventを受け取る。

## Decision 0014 — Release 0.4 Uses Single GPX Display

Date: 2026-08
Status: Accepted
Scope: Release 0.4
Extended by: Decision 0018 in Release 0.6

Decision: Release 0.4では、TreeViewで選択した一つのGPXだけを地図へ表示し、別GPXの選択で以前の表示を置き換える。

Reason: 単一選択の操作を明確にし、大量GPXの表示負荷と初期状態管理を抑える。

Alternatives: Clickごとに複数GPXを追加表示する。

Consequences: Release 0.4では複数GPX比較を行わず、後のReleaseで追加する。

## Decision 0015 — Leaflet is Locally Bundled

Date: 2026-08
Status: Accepted

Decision: LeafletをCDNではなく`src/vendor/leaflet/`へlocal bundleする。

Reason: 地図表示Library本体へのCDN依存を避け、Offline Firstへ近づける。

Alternatives: CDNからLeafletを読み込む。

Consequences: 通常のWeb地図tileはnetwork依存のままである。Offline tile、cache、独自tile管理は別Releaseで扱う。

## Decision 0016 — Release 0.4 Presentation State Stays in App

Date: 2026-08
Status: Accepted
Scope: Release 0.4
Extended by: Decision 0018, which later extracted display state

Decision: Release 0.4では`selectedFileHandle`、`selectedFileName`、`parsedResult`、`status`をApp内部の非永続Presentation Stateとして保持し、FolderやLibraryへ解析結果を保存しない。

Reason: Release 0.4の状態は小さく、独立State moduleを追加せずAppの調停責務内で管理できる。

Alternatives: `src/js/state/AppState.js`として分離する。

Consequences: 状態が複雑化した時点でState分離を検討する。Release 0.6では表示状態を`DisplayState`へ分離したが、主選択はAppに残る。

## Decision 0017 — App Mediates Map Display Events

Date: 2026-08
Status: Accepted

Decision: AppがGPX解析結果を受け、MapViewへ表示を依頼する。MapViewはGPX解析eventを直接購読しない。

Reason: MapViewを地図表示へ限定し、GPXParserとの結合を避ける。

Alternatives: MapViewが解析eventを直接購読する。

Consequences: Appのevent接続は増えるが、表示経路を一箇所で管理できる。

## Decision 0018 — Primary Selection and Display State Are Separate

Date: 2026-08
Status: Accepted

Decision: Release 0.6以降、GPX行の主選択と地図表示ON/OFFを分離する。主選択はApp、path単位の表示状態は`DisplayState`が管理する。

Reason: 複数GPXを同時表示しながら、操作対象を一つに保つため。

Alternatives: 選択中のGPXだけを表示する、複数選択を表示状態として兼用する。

Consequences: `aria-selected`とdisplay checkboxは別の意味を持つ。Decision 0014の単一表示はRelease 0.4の履歴として残るが、現在の表示Architectureは本Decisionに従う。

## Decision 0019 — TreeView Uses Lazy DOM and Path-based Metadata

Date: 2026-08
Status: Accepted

Decision: TreeViewはLibrary全体のmetadataを相対pathで保持し、展開FolderだけをDOM生成する。

Reason: 大量Libraryでも初期DOMと更新量を抑え、DOM未生成項目の状態を維持するため。

Alternatives: Library全体を常時DOM生成する、DOMを唯一の状態として扱う。

Consequences: Navigation、Folder集約、将来のSearchはDOMではなくmetadataとModelを基準にする。

## Decision 0020 — Display Layers Use Relative Path Identity and Session Cache

Date: 2026-08
Status: Accepted

Decision: GPXの相対pathを表示状態、cache、Leaflet Layer entryの識別子として使用する。解析結果はLibrary session内だけcacheし、上限を100件とする。

Reason: 同名GPXを区別し、再表示時の不要な再解析を減らしながらmemory使用量を制限する。

Alternatives: File名だけをkeyにする、FileHandle object identityだけを使う、無制限cache、永続Index。

Consequences: Library切り替えでcacheとLayerを破棄する。現在のpath hash色は安定したfallback色となる。cacheはGPXの正本ではない。

## Decision 0021 — GPX Display Queue Concurrency is Two

Date: 2026-08
Status: Accepted

Decision: GPX表示要求はFIFO Queueで処理し、同時実行数を最大2件とする。requestIdとlibraryGenerationで古い結果を無効化する。

Reason: 一括表示時にBrowserを占有せず、一定のthroughputと応答性を両立する。

Alternatives: 無制限並列、完全直列、表示操作ごとの独立Promise管理。

Consequences: queuedおよびactive requestは論理的に無効化できる。実行中読込の強制cancelではなく、callback抑止で整合性を守る。

## Decision 0022 — Folder Bulk Display Traverses the Model

Date: 2026-08
Status: Accepted

Decision: Folder checkboxはFolder Modelを再帰走査し、DOM未生成の子孫を含む全GPXへ既存の個別表示処理を適用する。

Reason: Lazy DOMの展開状態に関係なく、Folder単位の表示操作を一貫させる。

Alternatives: 現在DOMにあるcheckboxだけを操作する、Folder独自の表示状態をModelへ保存する。

Consequences: Folder自身のchecked状態は保存せず、子孫GPXからchecked、indeterminate、disabledを算出する。一括操作は既存DisplayStateとQueueを再利用する。

## Decision 0023 — Waypoints Are Optional Separate Layers

Date: 2026-08
Status: Accepted

Decision: Waypoint表示の初期値はOFFとする。pathごとのTrack LayerGroupとWaypoint LayerGroupを分離し、WaypointをTrack Boundsへ含めない。

Reason: 大量Waypointによる視認性と描画負荷への影響を避け、Track表示と地図位置を安定させる。

Alternatives: Waypointを常時表示する、Trackと同じLayerGroupへ格納する、Waypointをfit boundsへ含める。

Consequences: Waypoint切り替えはcache済み結果から追加・削除し、GPX再解析、Track再描画、refocusを行わない。設定はSession中維持し、永続保存しない。

## Decision 0024 — Release 0.9 Search Is Metadata-only Navigation

Date: 2026-08
Status: Accepted

Decision: Release 0.9 SearchはGPXファイル名、Folder名、相対pathだけをTreeView metadataから検索する。DOM未生成項目を含め、結果選択時だけ必要な祖先Folderを展開する。

Reason: GPX解析や地図表示から独立した高速なLibrary Navigationを最初に成立させるため。

Alternatives: 検索時に全GPXを解析する、生成済みDOMだけを検索する、検索結果を自動表示する。

Consequences: SearchだけではQueue投入、cache追加、MapView変更を行わない。日付、Track名、車両属性は将来のMetadata Indexで扱う。

## Decision 0025 — Future Metadata, Vehicle, and Editing Boundaries

Date: 2026-08
Status: Accepted
Scope: Future design boundary

Decision: 日付表示、車両属性、TrackPoint編集をRelease 0.9から分離し、書き込みを伴う機能はViewerとは別のEditor責務として設計する。

Reason: Read-only Searchへ解析、domain metadata、GPX書込みの責務を混在させず、GPX正本を保護する。

Alternatives: Release 0.9で同時にMetadata解析、車両設定、編集機能を追加する。

Consequences:

- 日付候補は`metadata.time`、最初の`TrackPoint.time`、`File.lastModified`、`originalFileName`の順で将来検討する。
- 車両候補は`vehicleId`、`vehicleName`、`vehicleType`、`vehicleColor`とする。
- 将来は`vehicleId`をGPX extensionsへ保存し、車両設定から色を解決する。現在のpath hash色はfallbackとして維持する。
- 編集対象は単一GPXに限定し、明示的な保存、元GPX保護、外部変更競合確認、Undo / Redo、保存失敗処理を先に設計する。
- GPXを暗黙に上書きせず、編集中は他GPXを編集不可にする。

## Decision Status

- Accepted: 正式採用
- Proposed: 提案中
- Deprecated: 非推奨
- Rejected: 却下
- Superseded: 新しいDecisionに置き換え

## How to Update

- 議論途中ではなく、確定した判断だけを書く。
- 既存Decisionを削除または書き換えない。
- 変更が必要な場合は新しい一意なIDを追加し、関係する過去Decisionを参照する。
- IDは文書内で重複させない。

## Golden Rule

設計は忘れる。記録は残る。コードは変わる。理由は残す。
