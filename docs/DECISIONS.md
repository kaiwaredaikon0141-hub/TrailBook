# DECISIONS.md

Version: 1.2 Planning
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

## Decision 0026 — Release 1.0 Is a Personal Stable Viewer

Date: 2026-08
Status: Accepted
Scope: Release 1.0

Decision: Release 1.0は一般公開版ではなく、個人利用環境で安全・安定・再現可能に使うためのStable Viewerとする。正式対応はWindows 10 / Windows 11上の最新安定版Google Chrome desktopおよびMicrosoft Edge desktopとし、対応originはHTTPS、`http://localhost`、`http://127.0.0.1`とする。その他Chromium系desktopはbest effort、Firefox、Safari、`file://`、通常のLAN内HTTP IPは非対応とする。

Android、iPhone、iPadの最新Google ChromeはRelease 1.0完了前の実機検証対象とし、検証に合格した端末だけをbest effortへ追加する。未確認または`showDirectoryPicker`など必要APIが不足する端末は非対応として既知の制限へ記載する。Mobile検証のために既存Folder Library設計を変更せず、代替Folder選択、複数GPX選択、ZIP Library、クラウドFolder import、Mobile専用Library入口はRelease 1.0へ追加しない。

TrailBook本体には現時点でオープンソースライセンスを付与せず、作者名義およびcopyright名義も確定しない。rootの`LICENSE`は将来の作業単位で、ライセンス未指定かつAll rights reservedであることを簡潔に示す文面へ置き換える。空の`LICENSE`は方針を誤認させるため正式版まで残さないが、Release 1.0 Unit 1 / Unit 2では変更しない。Leafletなど第三者ソフトウェアのライセンスとOpenStreetMap attributionはTrailBook本体のライセンスとは分離して保持する。

一般公開、end-user向けZIP、配布artifact、SHA-256公開、hosted HTTPS版、公開サポート窓口、一般公開用`SECURITY.md`はRelease 1.0の対象外とする。

Reason: 現時点の利用範囲は個人利用・開発用途であり、公開配布の制度設計よりもRelease 0.9までのViewer機能の品質確定を優先する。ライセンスを未決定のまま空ファイルで示すより、権利付与がないことを明確にする方が意図を誤解されにくい。

Alternatives: 一般公開版として配布物と公開窓口を整備する。TrailBook本体へMIT Licenseを付与する。空の`LICENSE`を維持する。

Consequences: Release 1.0は公開配布の準備完了を意味しない。将来公開する場合は、TrailBook本体のライセンス、作者・copyright表記、配布物、セキュリティ窓口を新しいDecisionで確定する必要がある。第三者ライセンス遵守とattributionは個人利用版でも維持する。Mobile端末の対応可否は端末ごとの実機結果に基づき、未確認端末を対応済みと表記しない。

Implementation Note: Release 1.0 Unit 6でroot `LICENSE`を、OSS licenseを付与せず権利許諾がないことを示すnoticeへ置き換え、第三者条件を`THIRD_PARTY_NOTICES.md`へ分離した。作者名およびcopyright名義は追加していない。

Mobile Validation Note: iPhone ChromeはHTTPS起動、Google Drive Folder選択、Folder走査、Tree表示までは成功したが、GPX checkbox、Track表示、touch UIが動作しなかったためRelease 1.0では非対応とする。Android ChromeとiPad Chromeは未確認である。

## Decision 0027 — SelectionState Owns the Single GPX Selection

Date: 2026-08
Status: Accepted
Scope: Release 1.1

Decision: 新規`SelectionState`がcurrent Library内の単一GPX pathを選択状態の正本として保持する。TreeView、SearchView、MapView、LayerManager、EventBusだけを正本にしない。Appがselection requestを検証してstateを更新し、commit後の`selection:changed`でTreeとMapの表示を同期する。

Reason: 現在はTreeViewの`selectedFilePath`とApp private Presentation Stateに選択情報が分散している。Map Track clickを追加すると更新経路がさらに増えるため、将来のTrackPoint editingでも参照できるUI非依存の正本が必要である。

Alternatives: App private stateを継続する、DisplayStateへ統合する、LayerManagerまたはTreeViewへ保持する、EventBus eventだけで状態を表す。

Consequences: 主選択と表示状態の分離を維持する。Tree / Searchは非表示GPXも主選択できるがMap highlightは表示中Trackだけとし、Mapから非表示Trackを選択できない。選択中Trackの非表示、Clear、Library切り替え、parse failureで選択を解除する。Tree / Search originの既存refocusは維持し、Map originではviewportを変更しない。

## Decision 0028 — Track Style Is Pure and Track Hit Testing Uses Canvas Tolerance

Date: 2026-08
Status: Accepted
Scope: Release 1.1

Decision: 新規`TrackStyleService`へFolder color、zoom bucket、selected stateからstyle descriptorを求めるpure calculationを集約する。Track PolylineはLeaflet Canvas rendererのtoleranceをclick hit areaとして使用し、全Trackへ透明hit Polylineを追加しない。選択中GPXだけにnon-interactive outlineを生成する。

Reason: 806 GPXで細いTrackを操作可能にしながら、Polylineを常時二重または三重にしてlayer数を大きく増やすことを避けるため。style ruleをAppとLayerManagerへ散在させず、zoom境界とselected styleを単体test可能にするため。

Alternatives: SVG visible lineだけをclick targetにする、全Segmentへ透明hit Polylineを追加する、全Trackへ常設outlineを追加する、他Trackを薄くする、Map背景clickでは選択を解除しない。

Consequences: `zoomend`後にbucketが変わった場合だけ表示中Trackを更新する。初期bucketは15以上4 px、12〜14は3 px、9〜11は2 px、8以下は1.5 pxとし、selected mainは+3 px、outlineはさらに+2 pxとする。main colorを選択色へ置換せず、他Trackのopacityも変えない。Canvas acceptanceに問題がある場合だけ透明hit layerを再評価し、806 GPX性能を再確認する。

Map背景clickはselection clear requestとする。layer eventはLeaflet eventのsourceを見て背景clickと区別し、double-click zoomをpreventしない。overlap時は最前面の1件を選び、cycle selectionは実装しない。

## Decision 0029 — Folder Colors Inherit from the Nearest Explicit Ancestor

Date: 2026-08
Status: Accepted
Scope: Release 1.1

Decision: 新規`FolderColorState`が、rootを含むFolder relative pathに対するcurrent Libraryの明示色と継承解決を担当する。GPXの色は、対象Folder自身の明示色、対象Folderからroot方向へ探索して最初に見つかる最も近い祖先Folderの明示色、既存GPX relative path hash色、最終fallback色の順で解決する。対象Folder自身に明示色があれば必ず使用し、自身が未設定の場合だけ祖先を探索する。rootの明示色も祖先色として利用できる。

Folder行のkeyboard操作可能なcolor swatch buttonから単一`FolderColorDialog`を開き、native color input、Apply、Defaultへ戻す、Cancelを提供する。right clickだけには依存しない。GPX単位色はRelease 1.1で扱わない。

Reason: Folder構造をLibrary分類として利用し、車・用途などのまとまりへ少ない設定数で一貫した色を適用するため。明示色がない既存Libraryでは現在のpath hash色をそのまま維持するため。

Alternatives: GPX単位色だけを設定する、自動色だけを使う、親色を継承しない、Toolbarで選択Folderを別途管理する、context menuだけを使う。

Consequences: 色変更は対象Folder配下だけを再解決し、表示中の該当Trackだけをrestyleする。GPX再解析、Queue、cache、refocusを発生させず、GPXやFolder構造へ書き込まない。Folder色はvehicle metadataではなく、将来vehicle colorを接続する場合は新しい優先規則をDecisionとして追加する。

`FolderColorState`は対象Folder自身、続いてroot方向の祖先に明示色がなければ`null`を返し、Appが各GPX relative pathの既存hash色へfallbackする。明示色が一切ないLibraryはv1.0.0と同じ色を維持し、未設定Folder配下をFolder path由来の単一色へ変更しない。

Implementation Note: Unit 5では`FolderColorControl`がTreeViewのlazy DOMを外部から装飾し、TreeViewを997行のまま維持する。Folder色変更は対象枝のうち別の明示色で遮られないFolderだけを再解決し、表示中Trackへ`setStyle`する。選択main / outline、zoom weight、opacity、Layer、Bounds、Waypoint、Queue、cache、refocusを維持する。

## Decision 0030 — localStorage Stores Only Regenerable UI Settings

Date: 2026-08
Status: Accepted
Scope: Release 1.1

Decision: 固定key`trailbook.uiSettings`のlocalStorageを、schema version付きの再生成可能なUI設定storageとして許可する。Release 1.1ではFolder明示色とglobalなMap表示modeだけを保存する。Library IDは案Aのroot Folder name完全一致から`root-name:<name>`を作り、Folder relative pathと組み合わせる。

Reason: FileHandleを永続化せず、GPX内容hashや追加走査を行わず、個人利用で説明可能な最小構造にするため。localStorage削除時にDefault色へ戻るだけであり、GPXとFolder構造が正本である方針を変更しない。

Alternatives: root nameとFolder構造signatureを使う、ユーザーがLibrary IDを入力する、初回にrandom IDを作る、IndexedDBへHandleまたはIndexを保存する、設定を永続化しない。

Consequences: root Folder名変更時は新LibraryとしてDefault色になる。異なる場所の同名root Folderは色設定を共有する可能性があるが、GPXを変更しないUI上の既知制限として受け入れる。保存失敗時はsession内設定でViewerを継続し、破損JSON、invalid color、未知schemaは無視する。

GPX内容、TrackPoint、Waypoint、解析geometry、FileHandle、FolderHandle、GPX XML、解析cacheを保存しない。前回表示TrackとMap位置はRelease 1.1では保存しない。将来これらのUI状態を追加する場合もschema migrationと新しいDecisionを必要とする。

Implementation Note: schema version 1は`{ version: 1, global: { mapMode: "color" }, libraries: { [libraryId]: { folderColors: { [folderPath]: "#RRGGBB" } } } }`とする。`global`がない既存payloadとinvalid `mapMode`はColorへfallbackする。root Folder nameはtrim後にURL encodingし、空名を`unnamed`へfallbackして`root-name:<name>`を生成する。unknown fieldは無視し、危険key、配列、`null`、不正path / colorを取り込まない。read / write failure時はlocalStorageからsession memoryへfallbackする。

## Decision 0031 — Monochrome Mode Filters Only the OSM Tile Pane

Date: 2026-08
Status: Accepted
Scope: Release 1.1

Decision: Monochrome Map Modeは既存OSM tile providerを維持し、Map rootの状態class配下にあるLeaflet tile paneの画像だけへCSS filterを適用する。Track Canvas、Waypoint、Leaflet control、attribution、TrailBook UIにはfilterを適用しない。初期値はColorとし、Map表示modeはLibrary非依存の`global.mapMode`としてDisplaySettingsStoreへ保存する。

Reason: GPXごとのFolder colorとselection highlightを保ったまま背景地図の彩度を抑え、Library切り替えに依存しない利用者の表示設定として扱うため。tile provider追加、tile cache、geometry再生成を避け、即時かつ可逆な表示変更に限定する。

Consequences: filter値は`grayscale(100%) brightness(108%) contrast(82%)`へ集約する。Colorへ戻す場合はclassを外すだけで、tile再取得、Track再描画、Map refocus、zoom / center変更を行わない。保存値欠落・invalid valueはColorへfallbackし、storage write failure時もsession内切り替えを維持する。Mobile対応は対象外とする。

## Decision 0032 — Shared Library Settings File Boundary

Date: 2026-08
Status: Proposed
Scope: Future Candidate — Release 1.2 Shared Library Settings

Historical Note: Decision記録時点ではFuture Candidateだった。Release 1.1完了後にNext ReleaseのPlanningへ移行した。

Decision Proposal: Library固有設定をLibrary root直下の候補ファイル`trailbook.json`へ保存し、Google Driveなど外部Folder同期を通じて共有できる境界を検討する。TrailBook自身はGoogle Drive APIによるcloud syncを実装せず、同期は外部Folder同期へ委ねる。Folder colors、将来のvehicle metadata、Library固有の分類 / 表示規則、編集関連metadataを共有候補とし、Color / Monochrome、Map center / zoom、前回表示Track、selected Track、sidebarなど端末固有UI状態とは分離する。

Future Principle: TrailBookは、ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。

Required Design Work: `trailbook.json` schema、readwrite permission、設定ファイルだけを書き込む境界、localStorage Folder色からの移行、ファイル欠落・保存失敗時のfallback、外部変更検出、競合処理、Import / Export、将来のGPX編集保存基盤との共通化を設計し、人間の承認を得る。

Current Boundary: このProposalはRelease 1.1のread-only契約を変更しない。Release 1.1はGPXとLibrary設定ファイルを作成・更新せず、現在のAccepted Decision 0030のlocalStorage UI設定だけを使用する。

Extended by: Decision 0033、0034、0035でRelease 1.2のschema、source precedence、permission、save、conflict方針を具体化する。

## Decision 0033 — Shared Settings Use a Versioned File at the Library Root

Date: 2026-08
Status: Accepted
Scope: Release 1.2 Planning

Decision: Library固有設定は、実際に開いたLibrary root直下の固定名`trailbook.json`へ保存する。schema version 1は`{ schemaVersion: 1, settings: { folderColors } }`とし、Release 1.2で読み書きするsettingはFolder colorsだけとする。Folder keyはrootを空文字`""`とする`/`区切りrelative path、色は正規化済み`#RRGGBB`とする。

Reason: fileをLibrary Folderと共に移動・同期でき、root名をidentityにするlocalStorageの同名衝突を解消できる。root直下の可視fileは個人利用者が発見、backup、手動reviewしやすく、隠しFolderより単純である。`settings` envelopeとschema versionにより将来fieldの明示migrationが可能になる。

Consequences: UTF-8 BOMなし、LF、2-space indent、最終改行、stable key orderingを使用する。array、`null`、comment、dangerous key、不正path / color、未知schema、未知structural fieldはfail closedとし、既存fileを暗黙修復しない。orphan Folder pathは保持するが適用せず、Folder改名 / 移動を自動追従しない。FileHandle、GPX、geometry、cache、device-local UI状態は保存しない。

## Decision 0034 — Shared Settings Require Explicit Permission and Save

Date: 2026-08
Status: Accepted
Scope: Release 1.2 Planning

Decision: Library openは`showDirectoryPicker({ mode: "read" })`を維持し、Folder openだけでwrite permissionを要求しない。Folder color Applyはsession / local fallbackを更新してdirty化するだけとし、別の`Libraryへ保存`操作でのみ`queryPermission({ mode: "readwrite" })`、必要時の`requestPermission({ mode: "readwrite" })`、`trailbook.json`書き込みを行う。

Reason: 通常Viewerのread-only起動を維持し、permission promptと外部同期へのwrite回数を抑えながら、利用者が保存境界と失敗を理解できるようにするため。browser再起動後もpermissionが保持されるとは仮定しない。

Consequences: 保存前に既存fileを再読込し、読込時のexact content SHA-256、`lastModified`、sizeとのfingerprint差を検出する。外部変更時はwriteを停止してReload / 明示Overwrite / Cancelを提示し、自動mergeと無条件last-write-winsを行わない。競合がない場合だけ`getFileHandle(..., { create: true })`、`createWritable()`、full write、`close()`を行い、close後の再読込一致でsavedとする。独自`.tmp` / `.bak` / renameは初期実装に追加しない。

## Decision 0035 — Shared JSON Is Authoritative and Local Storage Is a Fallback

Date: 2026-08
Status: Accepted
Scope: Release 1.2 Planning

Decision: validかつsupportedな`trailbook.json`が存在する場合、その`folderColors` map全体を共有正本とする。JSONが空、またはFolder keyが欠落している場合はAutoであり、旧localStorage Folder colorを項目単位で混ぜない。JSONがmissingまたは一時的にunreadableな場合だけlocalStorageをfallbackとし、その後はpath hash colorを使う。

Reason: JSONとdevice-local値をmergeすると、別端末で削除した明示色が古いlocalStorageにより復活し、共有正本が不明確になるため。Viewer継続用fallbackとshared source of truthを分離する。

Consequences: JSONがない状態でlegacy colorがある場合は、非blockingな`現在の色設定をLibraryへ保存`を提示する。自動file作成と自動移行はせず、JSON既存時はmigrationを提案しない。成功後もRelease 1.2ではlocalStorage値をrecovery fallbackとして保持する。Color / Monochrome等の端末固有設定はDisplaySettingsStoreへ残す。Library open / reselection / page reloadと明示ReloadでJSONを読み、polling、File System Observer、cloud API、Import / Exportは初期scopeに含めない。

## Decision 0036 — Previous View State Uses a Dedicated Device-local Store

Date: 2026-08
Status: Accepted
Scope: Release 1.3 Planning
Extended by: Decision 0039 / 0040（DirectoryHandleと再生成可能geometry cacheに限りorigin-local IndexedDBを使用する）

Decision Proposal: Map center / zoom、visible Track relative paths、selected Track、desktop sidebar open / closedをLibrary単位のdevice-local previous view stateとし、専用`trailbook.viewState` keyとschema version 1を持つ`ViewStateStore`へ保存する。`trailbook.json`、GPX、既存`trailbook.uiSettings`には保存しない。Map modeは既存global設定、Folder colorsはshared JSON / legacy fallbackの既存契約を維持する。

Reason: 作業状態は同じ端末とbrowser originの再開用であり、Libraryを同期する利用者全員へ共有すべき設定ではない。既存DisplaySettingsStore schemaをversion 2へ上げると、Map mode / legacy Folder colorとLibrary lifecycleを結合し、migrationとfailure範囲を広げる。専用Storeなら既存schema version 1を変更せず、削除・失敗を再生成可能なUI状態に限定できる。

Consequences: FileHandle、FolderHandle、GPX XML、TrackPoint、geometry、cache、Queue状態を保存しない。malformed / unknown / oversize dataはfail closed、storage failureはsession fallbackとし、raw dataをConsoleへ出さない。current Library stateだけをconfirmation後に消すResetをRelease 1.3 Scopeへ含める。sidebar width、Search / Tree navigationはFuture Candidateとする。

## Decision 0037 — Release 1.3 Retains Root-name Library Identity

Date: 2026-08
Status: Accepted
Scope: Release 1.3 Planning
Superseded in part by: Decision 0039（DirectoryHandleはprevious Library再開用IndexedDB recordだけへ保存する）

Decision Proposal: previous view stateのLibrary keyは既存`root-name:<encoded root folder name>`を使用する。FileHandleをlocalStorage / IndexedDBへ保存せず、Library全内容hash、GPX内容hash、構造fingerprint、user aliasをRelease 1.3へ追加しない。

Reason: File System APIの`isSameEntry()`は二つのhandleを比較できるが、localStorageへ保存する安定文字列IDを返さない。serializable handleの永続化はstructured-clone storageを必要とし、TrailBookの独自DBなし方針とRelease Scopeに反する。構造fingerprintはscan負荷が増え、rename / move / file増減で変わる。既存IDならLibrary移動後もroot名が同じ限り追加scanなしで再利用できる。

Consequences: 同名root Folderは同じdevice-local view stateを共有し得て、root名変更時は別Libraryになる。制限をUI、test、known limitationsへ記載し、Resetを回復手段とする。将来のLibrary aliasまたはshared settings内の明示IDは別Decisionを必要とする。

## Decision 0038 — Restoration Reuses Runtime State and the Existing Display Queue

Date: 2026-08
Status: Accepted
Scope: Release 1.3 Planning

Decision Proposal: `DisplayState`をvisibility、`SelectionState`をselection、`GPXDisplayQueue`をparse concurrencyの唯一の正本として維持する。restoreはvalid relative pathを既存display pipelineへ投入し、専用RestoreQueue、duplicate parser / layer、GPX内容hashを作らない。restore中の自動fitBoundsを抑止し、target確定後にsaved Mapを一回、visibleかつloadedなselected Trackをsystem sourceで一回投影する。

Reason: Release 1.2までに806 GPXのroot一括表示、requestId、Library generation、Queue並列数2、cache上限100が検証済みである。別pipelineは表示状態、cancellation、error、performanceの契約を二重化する。Mapとselectionを最後に投影すれば、fitBoundsやselection refocusがsaved viewを上書きしない。

Consequences: initial designでは件数hard limitとconfirmationを固定せず、0 / 1 / 50 / 200 / 806 GPXで測定する。UI blockまたは再現可能な重大回帰がある場合だけ既存Queueへのchunked enqueue / progressを追加する。restore中の利用者操作とLibrary generationをsaved stateより優先し、missing / error Trackをselectionへ復元しない。Waypoint初期OFFと大量Markerの既知制限を維持する。

Implementation Note: Release 1.3 Unit 6はQueue terminal後、saved pathがvisible / checked / loadedでMap layerを持つ場合だけ`SelectionState.select(path, "system")`を行う。Tree ancestor reveal、Search、highlight / outline、`aria-current`は既存projectionを再利用し、focus、scroll、Map pan / zoom / fitを発生させない。stale / invisible / load failureとrestore中の利用者selectionではsaved selectionを投影しない。

## Decision 0039 — Previous Directory Handle Uses Origin-local IndexedDB

Date: 2026-08
Status: Accepted
Scope: Release 1.3 Additional Planning

Decision Proposal: 最後に正常に開いた`FileSystemDirectoryHandle`をorigin-local IndexedDBへstructured cloneで保存する。次回起動時は`queryPermission({ mode: "read" })`が`granted`の場合だけ、現在のLibrary load pipelineで自動openする。`prompt` / `denied`では自動permission requestを行わず、keyboard操作可能な`前回のLibraryを開く`と既存の手動pickerを提示する。HandleをlocalStorage、`trailbook.json`、Consoleへ保存または出力しない。

Reason: localStorageはFileSystemHandleを保存できず、起動直後のpermission requestは利用者gestureを必要とし得る。File System Access仕様が定義するserializable handleとIndexedDBのstructured cloneを使えば、GPXやLibrary設定を変更せずに前回Libraryへの再開入口を保持できる。これはFolder / GPXを正本とするLibrary databaseではなく、削除可能な端末・origin限定のcapability recordである。

Consequences: Decision 0036 / 0037の「HandleとIndexedDBをRelease 1.3で使わない」という提案境界を、この用途に限って変更する。IndexedDB failure、record破損、permission拒否、stale / missing handleでもViewerと手動pickerを継続する。恒久的に無効なrecordは安全に破棄できるが、一時的なprovider offlineは自動破棄しない。IndexedDBはscheme / host / portごとに分離され、site data削除やprivate browsing終了で失われ得る。readwrite permissionを保存または自動要求しない。

Extended by Decision 0040: 同じprevious Library recordは、geometry cache key専用のopaque namespaceをHandleとともに保持する。namespaceはshared identity、localStorage key、Library内容として使用しない。

## Decision 0040 — Parsed Geometry Cache Is a Conditional and Regenerable Accelerator

Date: 2026-08
Status: Accepted
Scope: Release 1.3 Additional Planning

Decision Proposal: 806前後のprevious visible Trackについて、Library scan後から全対象Layerがterminalになるまでのwarm restore中央値を約5秒以内とする。既存GPX再parse pipelineを先に測定し、目標を再現可能に満たせない場合だけIndexedDB parsed geometry cacheを導入する。cache keyはLibrary handle recordのopaque namespaceとGPX relative path、validation情報はparser / cache schema version、`File.size`、`File.lastModified`とする。

Reason: 現行session cache上限100では806 GPXを次回起動へ持ち越せず、全件XML read / parseがwarm再開の支配要因になり得る。一方、計測前の永続cache実装はstorage、quota、invalid data、schema、evictionのfailure範囲を不必要に増やすため、performance gateを先に置く。

Consequences: cacheはGPXから再生成可能で正本ではない。source情報不一致、schema不一致、missing / corrupt entry、IndexedDB read / write / quota failureでは該当GPXを既存`GPXDisplayQueue`へfallbackし、GPX変更時だけ再parseする。GPX XML、FileHandle、Leaflet Layer、Queue状態をgeometry entryへ保存しない。cold loadは従来速度を許容し、専用RestoreQueue、duplicate parse / render、GPX書き込みを追加しない。`size + lastModified`の衝突可能性、cache上限 / eviction、bulk read方式は実装Unitでtestと計測により確定する。

Implementation Note: 約807 visible Tracks、Waypoint OFF、scan / permission除外の既存再parse warm restoreは24秒、25秒、25秒、中央値25秒であり、約5秒gateに不達だった。Release 1.3 Unit 5はorigin-local IndexedDB geometry cacheを採用し、cache / parser schema、`File.size`、`File.lastModified`が一致するTrack / Waypoint座標だけを復元する。cache導入後は3秒、3秒、3秒、中央値3秒となり、約8倍高速化してgateをPassした。cache miss / invalid時は既存parseへfallbackし、cacheは削除・再生成可能な派生データとして正式採用する。

## Decision 0041 — Release 1.4 Uses One Derived Discovery Index

Date: 2026-08
Status: Accepted
Scope: Release 1.4

Decision Proposal: Date Tree、Track Info、Track name / date filterは、GPX relative pathをidentityとする1つのLibrary Discovery Indexを共有する。index summaryは既存Geometry Cacheのsource validationと同じderived recordから取得し、cache miss時は1回のGPX parse resultから描画geometryとsummaryを同時生成する。Library openと空Searchはmetadata-onlyのまま維持し、Discovery IndexはDate modeまたはtext / date filterの明示操作まで構築しない。

Unit 5 Refinement: 既存Search欄はTrack discovery filterの単一入口へ拡張する。空欄のLibrary openではIndexを構築せず、textまたはdate filterの明示入力時だけ遅延buildする。textはDiscovery summaryの`displayName` / Track nameとFolder pathを対象とし、date rangeとAND結合する。Library open時のeager parse禁止と1つのDiscovery Indexを共有するDecision本体は維持する。

Reason: Date、Track名、距離、時刻、elevationを各UIが個別解析すると806 GPXでread / parse / cache writeが重複し、Release 1.3のinflight deduplicationとwarm restoreを損なう。1 GPX 1 summaryならDate Tree、Info、Filterが同じ事実を参照でき、Folder / GPX正本とDisplayStateを変更しない。

Consequences: date sourceはvalid `metadata.time`、document順の最初のvalid TrackPoint time、`File.lastModified`、厳密なoriginal filename dateの順とする。summaryはTrackPoint配列を保持せず、path、名前、recordedAt / source、point count、Segment内distance、start / end / duration、elevation min / maxに限定する。Geometry Cache schema更新時はold entryを再生成し、cache failureはmemory indexと通常parseへfallbackする。AppとTreeViewへDiscovery責務を追加せず、Coordinator、Service、DateTreeView、TrackInfoPanelへ分離する。GPX、`trailbook.json`、shared settingsへDiscovery dataを書かない。

Implementation Note: Release 1.4 Unit 2〜5は1つのpath-keyed Discovery IndexをDate Tree、Track Info、Search / Filterで共有し、Geometry Cacheと同じsource identity / inflight parse結果を再利用した。warm Index中央値3秒、duplicate parse / renderなし、Library isolation、data protectionのBrowser AcceptanceをPassし、Unit 6 finalizationでDecisionをAcceptedとする。

Alternatives: UIごとにGPXをparseする、Library open時に全GPXをeager parseする、Date Treeを実Folderへ書き戻す、TrackPoint全体をDiscovery Indexへ複製する。

## Decision 0042 — Sidebar Width Is Device-local View State

Date: 2026-08
Status: Accepted
Scope: Release 1.4 Unit 4

Decision: Track InfoはSidebar下部へ固定し、Folder / DateのTrack listだけを独立scroll領域とする。desktopのSidebar / Map境界はpointerとkeyboardでresize可能とし、幅はLibrary単位のdevice-local `trailbook.viewState`へ保存する。`sidebar.width`はschema version 1のoptional fieldとして追加し、220〜520px、default 260pxとする。

Reason: Track listをscrollしてもselected Trackの情報を確認でき、Libraryごとに必要なlist幅を再利用できる。幅は端末と画面に依存するためLibrary共有設定の`trailbook.json`へ含めない。既存view-state save queueへ統合することでbulk操作やMap stateとは別の永続化経路を増やさない。

Consequences: Track Info自身が高すぎる場合はpanel内部をscrollする。drag中は誤selectionを抑止し、終了時にMapをsilentに`invalidateSize`するが、Map center / zoom、selection、visibilityは変更しない。Sidebar open / closedと共存し、旧payloadのmissing widthはdefaultへfallbackする。Mobile / coarse pointerへresize UIを表示せず、GPX、`trailbook.json`、shared settingsを書き換えない。

Extended from: Decision 0036のRelease 1.3 view-state境界。Release 1.3ではFuture CandidateだったSidebar widthをRelease 1.4でoptional fieldとして追加する。

## Decision 0043 — GPX Encoding Is Resolved Before XML Parsing

Date: 2026-08
Status: Accepted
Scope: Release 1.4 Unit 4

Decision: GPX byte列は`GPXLoader`でBOMとXML declarationを確認してUnicode文字列へdecodeし、その一つの文字列を`GPXParser`へ渡す。UTF-8を標準とし、UTF-16 BOM、Shift_JIS、Windows-31J / CP932 aliasをallowlistで扱う。宣言なしではstrict UTF-8を先に試し、invalid byte列の場合だけShift_JISへfallbackする。

Reason: `File.text()`は常にUTF-8としてdecodeするため、Windows-31J等を宣言した既存GPXのTrack名がreplacement characterへ変わっていた。Viewごとの文字列補正ではGeometry Cache、Discovery Index、Date Tree、Track Infoの値が一致せず、元byte列も復元できない。

Consequences: unsupported declarationまたはdecode failureはUTF-8 replacement decodeでViewerを継続する。Geometry Cache schemaを3へ更新し、`textDecoderSchemaVersion: 1`を必須record markerとする。schema 2とmarkerのない過渡的schema 3 summaryは該当pathだけを削除し、既存parse fallbackで再生成・schema 3保存する。DB全体、GPX、timestamp、`trailbook.json`を書き換えず、encoding変換fileも作成しない。

Implementation Note: decode後のGPX内部`metadata.name`または`trk/name`がU+FFFD replacement character、制御文字、空文字を含む場合は明らかに壊れた表示名として採用しない。優先順位はusable metadata name、最初のusable Track name、relative path由来filenameとする。cache内のbroken display / Track nameはrecord単位でinvalidにし、そのGPXだけを再parseして同じschema 3へ再保存する。schema bumpやDB全体clearは行わない。

Acceptance Note: Unit 5 Browser AcceptanceでSearch、Date Tree、Track Infoの表示名、broken Track nameの検索除外、filename fallback、手動clearなしのpath単位cache再生成を確認し、このfallback規則をAcceptedとする。他GPX cache、Console、GPX / `trailbook.json`への書き込みに問題はない。

## Decision 0044 — Track Info Split Height Is Device-local View State

Date: 2026-08
Status: Accepted
Scope: Release 1.4 Unit 4

Decision: Track list / Track Info境界をdesktopのhorizontal separatorとし、pointerとkeyboardでTrack Info高を変更できるようにする。高さはLibrary単位のdevice-local `trailbook.viewState`へoptional `sidebar.trackInfoHeight`として保存する。120〜420px、default 220px、Track list最小100pxとする。

Reason: selected Track情報の必要高は画面と利用者によって異なる一方、Track listとInfoのどちらも潰さず同時に利用できる必要がある。端末layout固有値であるためLibrary共有設定へ含めない。

Consequences: Track Info内部scrollを維持し、Sidebar横resize / open / closeと同じschema version 1、750ms save queueを使用する。drag中の誤selectionを抑止するが、Map center / zoom、selection、visibilityは変更しない。Mobile / coarse pointerへseparatorを表示せず、GPXと`trailbook.json`を書き換えない。

## Decision 0045 — Release 1.5 Uses an Immutable GPX Source and Explicit Save As

Date: 2026-08
Status: Accepted
Scope: Release 1.5 Unit 2

Decision Proposal: Release 1.5の編集対象は同時に1 GPXだけとし、Edit開始時のGPX XMLをimmutable source snapshot、Segmentごとのretained TrackPoint indexをmemory working copyとして分離する。Track軽量化はRamer–Douglas–PeuckerをSegment単位へ適用し、Apply済みworking-copy commandだけをUndo / Redo対象とする。保存はsourceと異なる新規filenameへの明示Save Asだけを許可し、sourceまたはexisting fileのOverwrite、自動保存、background保存を行わない。

Reason: Viewerのparsed ModelまたはGeometry Cacheを直接編集すると、表示・cache・正本の境界が崩れ、Cancelや未知extensionsの保持が不確実になる。immutable source XMLとcompact working maskなら、previewとUndoをmemory内に限定し、retained pointのtime、elevation、extensionsとTrack / Segment / Waypoint構造をsemanticに保持できる。Save As限定なら最初のEditor Releaseで元GPX消失のriskを最小化できる。

Consequences:

- source XML Documentをcloneし、除外point elementだけをremoveするserializerを使用する。Parser ModelからGPX全体を再構築しない。
- outputはUTF-8 BOMなし、LF、XML declaration、final newlineとする。元のindent、quote、attribute順等のbyte formattingは保証しない。
- retained pointの属性 / children / extensionsは保持し、removed pointのtime / elevation / extensionsを補間または近傍へ移さない。
- TrackSegment境界、Waypoint、route、metadata、unknown root / Track / Segment extensionsを変更しない。
- permissionはSave Asの明示操作時だけ要求する。source同名とexisting targetは拒否し、v1.5ではOverwriteを提供しない。
- source fingerprint変更、permission deny、collision、write / close / verification failureでは元GPX、Library state、normal Layer、cache / Indexを変更せず、working copyを再試行可能なdirty状態に保つ。
- verification成功後だけnew pathをLibraryへrefreshし、Geometry Cache / Discovery Indexは新規pathの通常derived-data lifecycleから生成する。editing draftをcache正本にしない。
- manual point / range edit、Track split / joinは同じSession / Command / Serializer boundaryへ追加できる将来候補だが、Release 1.5 scopeへ含めない。

Alternatives: ViewerのTrack Modelを直接mutateする、full XML snapshotをUndoごとに保持する、Geometry Cacheをworking copyにする、source GPXをOverwriteする、uniform point samplingまたはVisvalingam–Whyattを最初のalgorithmにする。

Related: Decision 0025のViewer / Editor責務分離と暗黙上書き禁止、Decision 0032の明示書き込み原則を具体化する。Release 1.5 Unit 2の実装開始承認によりAcceptedとする。

Implementation Note: Unit 2はsource XML string / fingerprintとprivate source DOM clone factory、document-order Track / Segment / TrackPoint mappingを持つ`GPXEditingSourceLoader`、retained-point boolean maskを持つ`GPXEditingSession`、上限20の`EditingCommandHistory`、source DOM cloneから除外`trkpt`だけをremoveする`GPXEditingSerializer`を追加した。lossy decode、XML / GPX parse failure、Parser ModelとDOMのcount / coordinate不一致はsave不可とし、GPX、Geometry Cache、Discovery Index、Tree、Appへ接続していない。Unit 3はSegment-localなiterative Ramer–Douglas–Peuckerとmeter-based metricsをpure serviceへ追加した。previewはhistoryを変更せず、Apply時だけretained maskを既存historyへ確定し、同一結果を重複記録しない。invalid coordinateは保持してrunを分断し、retained point属性を変更せず、cooperative yield可能なasync APIを維持する。Unit 4はApp / TreeView外の`TrackEditingCoordinator`、非modal `TrackEditingPanel`、normal LayerManager外の`EditingPreviewLayerManager`を接続した。lineとpointのBefore / After Layerはnon-interactiveで、normal Track presentationは編集中だけ一時抑止し、selection / visibility / Map view / cache / Indexを変更しない。Doneはworking mask / historyを1件のsession-memory draftとして保持して通常Viewerへ戻り、CancelはSessionとともに破棄する。Unit 4時点ではSave AsとGPX writeを実装していない。

Unit 5 Implementation Note: 明示Save As時だけreadwrite permissionを要求し、source / existing fileを拒否して新規GPXへserializer outputを書き、close後のread-back verification成功後だけnew pathをFolder Tree / DisplayState / Discoveryへ追加する。失敗時はsource、working Session、Library stateを維持し、targetが残る可能性を通知する。

Unit 6 Historical Note: Unit 1〜5のBrowser Acceptanceと統合確認により、immutable source、memory working copy、RDP preview、Undo / Redo、Done / Cancel、明示Save As、verification、targeted Library refreshのDecision境界を維持したままRelease 1.5をCompletedとした。元GPXと`trailbook.json`は意図せず変更せず、point / range editing、Track split / join、Overwrite、Mobile editorは将来候補として残す。

Historical Note: Unit 5のSave As境界と、それに基づくUnit 6 finalization記録はDecision 0046によりsupersededされた。immutable source、working mask、serializer、preview、Undo / Redo、Done / CancelのDecisionは引き続き有効である。

## Decision 0046 — First Save Preserves Original Bytes Before In-place GPX Update

Date: 2026-08-09
Status: Accepted
Scope: Release 1.5 Unit 5 revised save boundary
Supersedes in part: Decision 0045のSave As / new-path policy

Decision Proposal: TrailBookの編集保存は`<source>-simplified.gpx` siblingを作らず、original filename / relative pathを維持する。初回の明示`保存`ではsource Folder直下のreserved `TrailBook_Backup`へ現在sourceと同名で編集前のoriginal bytesを保存し、bytes / fingerprint / GPX mappingのread-back verification成功後だけsource pathへserializer outputを書き込む。既存Backupは上書き・削除せず、2回目以降は最初の原本を永久保持してsourceだけを更新する。

Reason: 通常Libraryへ編集後GPXとsimplified siblingを並存させると、利用者から見たidentity、Tree / Date / Search、visibility、cacheが分岐する。original bytesをreserved Folderへ1回だけ退避して同じpathを更新すれば、通常Libraryのidentityを維持しつつ、serializerや編集後verificationが失敗した場合にも明確な原本を残せる。

Consequences:

- permissionは明示`保存`操作時だけ要求する。permission deny、Backup create / write / verification failureではsourceを変更しない。
- Backupにはserializer outputでなく`GPXEditingSourceLoader`が保持するoriginal bytesを保存する。既存Backupは再利用前に検証し、invalid / partial Backupを暗黙修復しない。
- source write failureまたは編集後verification failureではBackupを保持し、UIへ復旧場所を明示する。automatic restore、Backup overwrite / deleteは行わない。
- `TrailBook_Backup`はcase-insensitiveなreserved Folder名とし、任意階層のLibrary scanから除外する。Folder Tree、Date Tree、Search、Discovery Index、Geometry Cache、GPX / Folder件数へ含めない。
- verification成功後は同じpathのsession cacheとDiscovery summaryだけをinvalidate / refreshする。Geometry CacheはFile.size / lastModifiedでinvalid化し、visible Trackは既存Queueから1回だけ再parse / renderする。
- visibility、selection、Map center / zoomを可能な限り維持し、new pathやduplicate entryを作らない。旧方式で既に作成されたsimplified GPXは通常GPXとして扱う。
- Release 1.5 Unit 5は新仕様のImplementation / Static Test / Browser Acceptance Completed。Unit 6 finalizationもCompletedである。

Alternatives: Save As siblingを継続する、毎回timestamp付きBackupを作る、Backupなしでsourceを上書きする、Backupをserializer outputから再構築する、Library全体をrescanする。

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
