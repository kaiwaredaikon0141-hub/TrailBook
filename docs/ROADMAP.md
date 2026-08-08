# ROADMAP.md

Version: 1.3 Completed
Status: Official
Current Release: 1.4.0 Library Browsing / Track Discovery
Next Release: Not defined

## Version Policy

- Major: 設計または互換性に関わる大きな変更
- Minor: 機能追加
- Patch: バグ修正

## Release History

### Release 0.1 — App Skeleton

Status: Completed

Goal: 開発基盤を完成させる。

- App
- EventBus
- Config
- Toolbar
- TreeView
- StatusBar

Done: アプリケーションのSkeletonが起動する。

### Release 0.2 — Folder Library

Status: Completed

Goal: Folderをライブラリとして扱う。

- FolderScanner
- Folder Model
- Library Model
- Folder Tree
- Library Update

Done: ユーザーがFolderを開き、再帰的なFolderとGPX一覧を表示できる。

### Release 0.3 — GPX Parser

Status: Completed

Goal: 明示的に要求されたGPXの情報を取得する。

- GPXLoader
- GPXParser
- Track、TrackSegment、TrackPoint Model
- Waypoint Model
- Metadata Model
- Error Handling

Done: GPX 1.0/1.1を解析できる。

### Release 0.4 — Map Display

Status: Completed

Goal: 選択したGPXのTrackを地図へ表示する。

- GPX Selection
- 非永続Presentation State
- Leaflet Local Distribution
- MapView
- LayerManager
- TrackSegmentごとのPolyline
- Waypoint Marker
- Track BoundsへのAuto Zoom
- Loading、Error、Clear Display

Done: 選択GPXのTrackとWaypointを地図へ表示できる。

### Release 0.5 — TreeView Improvements

Status: Completed

Goal: 大量のGPXを扱いやすいTreeViewへ改善する。

- Lazy Folder Tree
- Folder Expand / Collapse
- Keyboard Navigation
- Roving Focus
- ARIA Tree Structure
- Long Name Handling
- 同一Library再読込時のNavigation State Restoration

Done: 展開FolderだけをDOM生成し、キーボード操作と状態復元ができる。

### Release 0.6 — Multiple GPX Display

Status: Completed

Goal: 複数GPXを独立してON/OFFし、地図へ同時表示する。

- GPX Display Checkbox
- 主選択と表示状態の分離
- DisplayState
- GPXDisplayQueue
- Session Result Cache
- Path-keyed Layer Entries
- Stable Display Colors
- Multi-GPX Track Bounds

Done: 複数GPXを独立して表示・非表示にでき、主選択を別に維持できる。

### Release 0.7 — Folder Bulk Display

Status: Completed

Goal: Folder行のcheckboxから配下の全GPXを一括ON/OFFする。

- Folder Display Checkbox
- ModelからのDescendant GPX Enumeration
- Checked、Indeterminate、Disabledの集約状態
- Bulk Queue Integration
- Lazy DOM Compatibility
- Queued / Active Request Invalidating

Done: 折りたたみ中でDOM未生成の子孫を含め、Folder単位でGPX表示を一括制御できる。

### Release 0.8 — Waypoint Display Option

Status: Completed

Goal: Waypoint表示をユーザーがセッション中にON/OFFできるようにする。

- Waypoint Visibility Checkbox
- Track / Waypoint LayerGroup Separation
- Cached Waypoint Toggle
- Session Display Option
- Track-only Bounds

Done: GPXを再解析せず、表示中GPXのWaypointだけをON/OFFできる。

### Release 0.9 — Search

Status: Completed

Goal: 大量GPXライブラリから、GPXファイル名、Folder名、相対パスで目的の項目を検索する。

Included:

- GPXファイル名の検索
- Folder名の検索
- 相対パスの検索
- TreeViewが保持するpathベースmetadataを対象とした検索
- DOM未生成項目を含む検索
- 結果選択時に必要な祖先Folderだけを展開するNavigation

Constraints:

- 検索のためにGPX内容を解析しない。
- SearchだけでGPXDisplayQueueへ要求を投入しない。
- Searchによって解析cacheを増やさない。
- MapViewとLayerManagerを変更しない。
- 検索対象を生成済みDOMに限定しない。
- 結果の選択まではFolderを展開しない。
- 結果選択時だけ必要な祖先Folderを展開する。
- 日付抽出、車両情報、Track内容検索は実装しない。

Done Definition:

- GPXファイル名、Folder名、相対パスを高速に検索できる。
- 折りたたまれたFolder内の項目も検索結果へ現れる。
- 結果選択時だけ対象までのTreeを展開し、対象へ移動できる。
- 検索だけではGPX解析、Queue投入、cache追加、地図変更が発生しない。

### SearchEntry Future Extension Notes

将来のIndex拡張では次のfieldを候補とするが、Release 0.9では実装しない。

- `displayName`
- `recordedAt`
- `trackName`
- `originalFileName`
- `vehicleId`
- `vehicleName`
- `vehicleType`
- `vehicleColor`

## Previous Stable Release

### Release 1.0 — Stable Viewer

Status: Completed

Goal: Release 0.9までの機能を変更せず、個人利用環境で安全・安定・再現可能に使える正式安定版にする。

Scope:

- 初回起動とFolder選択の導線
- File System Access API非対応Browserと非secure contextの案内
- 空Library、壊れたGPX、一部解析失敗、Library切り替えの品質確認
- 大量GPX、Search、Folder一括表示、Waypoint設定の回帰確認
- Keyboard、ARIA、body scroll、sidebar scroll、MapView固定の確認
- favicon 404、開発用log、未使用codeの整理
- TreeViewの挙動を変えない限定的な責務抽出と1,000行規則への適合
- 個人利用者向けREADME、localhost起動手順、offline範囲、外部通信、データ保護、既知制限
- 統合受け入れtest、性能測定、Release checklist
- Android、iPhone、iPadの最新Google Chrome実機検証と対応可否の記録
- Leaflet licenseとOpenStreetMap attributionの維持、第三者表記の整理

Supported Environment:

- OS: Windows 10 / Windows 11
- Browser: 最新安定版Google Chrome desktop / Microsoft Edge desktop
- Best effort: その他Chromium系desktop
- Mobile candidate: 実機検証に合格したAndroid / iPhone / iPadの最新Google Chromeだけをbest effortへ追加可能
- Unsupported Browser: Firefox / Safari / 未確認または必要API不足のMobile browser
- Supported Origin: HTTPS / `http://localhost` / `http://127.0.0.1`
- Unsupported Origin: `file://` / 通常のLAN内HTTP IP

Performance Baseline:

- 同一PC、同一Browser、同一806 GPX Library、同一操作条件で比較する。
- 各測定は複数回行い、中央値を記録する。
- cold解析とwarm cache再表示を分離する。
- Release 0.9.0比で20%を超える明確かつ再現可能な性能悪化を許容しない。
- Unit 2 baselineを履歴として維持した。Unit 7のChrome / Edge手動確認では明確な性能回帰はなく定性的受け入れに合格したが、同一条件の数値再測定と20%比較はDeferredとする。

Out of Scope:

- 一般公開、公開support窓口、hosted HTTPS版
- end-user向けZIP、配布artifact、公開checksum
- TrailBook本体のOSS license決定、作者名義またはcopyright名義の公開
- `SECURITY.md`
- GPX Metadata Index、日付表示、車両情報、Track色編集
- GPX書き込み、GPX Editing Foundation、TrackPoint Editing、Undo / Redo、保存、別名保存
- Statistics、Replay、HeatMap、Cloud Sync、Mobile専用UIまたはFolder選択fallback、Plugin、AI Search

Done Definition:

- 対応環境で統合受け入れtestに合格する。
- 806 GPXのUnit 2 baselineを維持し、定性的受け入れで明確な性能回帰がないことを確認する。数値再測定と20%比較は将来候補へDeferredとする。
- TreeViewが1,000行規則へ適合し、既存挙動を維持する。
- localhost起動、offline範囲、外部通信、データ保護、既知制限が文書化される。
- Mobile実機結果を記録し、合格端末だけをbest effortとする。iPhone Chromeは非対応、Android ChromeとiPad Chromeは未確認として既知の制限へ記録する。
- TrailBook本体のlicense未指定方針と第三者licenseが明確に分離される。
- Release checklistの必須項目が完了し、個人利用向けStable Viewerとして再現可能に起動できる。

Completed内容:

- 個人利用向けStable Viewer
- startup / compatibility UX
- TreeView metadata / path責務の限定的な整理
- favicon、Console、未使用code候補を含むrelease quality cleanup
- README、LICENSE、third-party notices
- Windows Chrome / Edge統合受け入れ

## Completed Release

### Release 1.1 — Track Selection & Styling

Status: Completed

Goal: MapとTreeViewで同期する単一Track選択、Folder単位の継承色、zoomに応じた線幅、再生成可能なUI設定の永続化、背景tileのMonochrome表示を追加する。GPXとFolder構造はread-onlyの正本として維持する。

Scope:

- 表示中TrackのMap clickとTreeView / Searchの主選択を、path単位の単一Selectionへ統合する。
- 選択TrackはFolder色を維持し、太いmain line、対比するoutline、前面表示で強調する。他Trackは薄くしない。
- Folderごとに明示色を設定できる。対象Folder自身の明示色を最優先し、自身が未設定の場合だけroot方向へ探索して最初に見つかる最も近い祖先色を継承する。Library内に明示色がなければv1.0.0と同じGPX relative path hash色を維持する。
- Folder行のkeyboard操作可能なcolor swatch buttonから、単一のFolder color dialogを開く。Apply、Defaultへ戻す、Cancelを提供する。
- Mapの`zoomend`後、zoom bucketが変化した場合だけ表示中Trackの線幅を更新する。
- Folder colorとglobal Map modeを、GPXから再生成可能なschema version 1のUI設定として`localStorage`へ保存する。
- FileHandle、FolderHandle、GPX XML、解析geometry、cacheは永続化しない。
- storage失敗時もsession内のViewerと色設定操作を継続する。
- Color / Monochrome切り替えを提供し、背景OSM tileだけをグレースケール化する。初期値はColorとし、Track、Waypoint、UI、tile provider、attributionは変更しない。
- 806 GPXでselection、zoom、Folder color変更の回帰とlayer更新範囲を確認する。

Out of Scope:

- 前回表示Track、前回Map位置の復元
- Date Tree、vehicle metadata / color
- GPX / TrackPoint / Waypoint編集、容量削減、Undo / Redo、保存、上書き
- Mobile Viewer UX、Waypoint clustering、hover preview
- GPX単位色、共有palette、Cloud Sync
- Folder構造変更
- Mobile向けMonochrome UI

Unit Plan:

1. Planning and architecture
2. `TrackStyleService` and zoom-based width
3. `SelectionState`、Map click、highlight
4. UI settings persistence foundation
5. Folder color UI and inheritance
6. Monochrome Map Mode
7. Integrated acceptance、performance、documentation、Release finalization

Unit 2でstyle計算とzoom更新を先に独立させ、Unit 3で選択とhighlightを接続する。永続化は選択から独立するためUnit 4、Folder UIはstorage契約確定後のUnit 5とする。Unit 6はUnit 4のUI settings persistence基盤を共用でき、Unit 7で全機能を統合確認する。

Done Definition:

- Map、TreeView、Searchの選択が単一の`SelectionState`へ同期し、非表示化、Clear、Library切り替え、parse failureで不正な選択が残らない。
- 選択Trackは元色を維持したoutline付き強調となり、解除時に元styleへ戻る。
- Folder色が対象Folder自身、rootを含む最も近い祖先、GPX relative path hash、最終fallbackの規定順で解決される。
- zoom 8 / 9 / 12 / 15の境界がtestされ、同じbucket内で全Trackを再styleしない。
- reload後に同じLibrary名のFolder色が復元され、storage unavailable、破損JSON、未知schemaでもViewerが動作する。
- Monochrome Map Modeは初期Colorを維持し、背景tileだけへfilterを適用してTrack、Waypoint、UI、attributionへ影響させない。
- 806 GPXで既存表示、bulk checkbox、Search、Waypointに明確な回帰がない。

Completed内容:

- zoom 8以下1.5 px、9〜11は2 px、12〜14は3 px、15以上4 pxのTrack線幅
- `SelectionState`によるMap / TreeView / Searchの単一GPX選択同期
- Map Track click、背景click解除、元色を維持するselected highlight / outline
- rootを含むFolder明示色、nearest ancestor継承、Default / Auto
- Folder色とglobal Map modeに限定したschema version 1のUI設定persistence
- 背景OSM tileだけへ適用するColor / Monochrome表示
- Chrome統合受け入れとUnit 2〜6のEdge受け入れ
- 806 GPX Libraryの定性的性能評価Acceptable、明確な性能回帰なし

## Current Release — Release 1.2 Shared Library Settings

Status: Completed

Goal: Folder colorをLibrary root直下の`trailbook.json`へ保存し、同じFolderを開くChrome、Edge、別PC、将来の対応端末でLibrary固有設定を共有できる基盤を作る。TrailBookはGoogle Drive / OneDrive APIや独自cloud syncを実装せず、通常ファイルの同期は外部Folder同期へ委ねる。

### Scope

- Release 1.2 schema version 1の`trailbook.json`読込、検証、明示保存
- rootを含むFolder relative pathとFolder colorsの共有
- JSON、legacy localStorage、Auto / path hash colorの優先順位
- readwrite permission、保存失敗fallback、明示的な再読込
- 読込時fingerprintと保存直前再読込による外部変更検出
- localStorage Folder色からの明示移行
- Chrome / EdgeとGoogle Drive同期Folderの実機確認
- 既存Viewer、GPX read-only、端末固有UI設定の維持

### Shared and Device-local Boundary

`trailbook.json`へ保存するRelease 1.2の設定はFolder colorsだけとする。vehicle metadata、Folder表示名、Library固有の分類 / 表示規則、Date Tree補助設定、編集関連metadataはschemaを拡張可能にする将来候補であり、Release 1.2では保存しない。

Color / Monochrome、Map center / zoom、前回表示Track、selected Track、sidebar状態、検索文字列は端末固有とし、`trailbook.json`へ保存しない。FileHandle、FolderHandle、GPX XML、TrackPoint、parsed geometry、cache、Queue状態も保存しない。

### Save and Conflict Boundary

- Folder openと通常閲覧はread-onlyとし、ファイルを作成または変更しない。
- Folder color Applyはsessionとdevice-local fallbackだけを更新し、shared settingsをdirtyとする。
- 別の明示的な`Libraryへ保存`操作でのみreadwrite permissionを確認し、`trailbook.json`を書き込む。
- 権限拒否または保存失敗でもViewerを継続し、session / localStorageの色を失わない。
- 保存直前に既存fileを再読込し、読込時fingerprintとの差を検出した場合は保存を停止する。Reload / 明示Overwrite / Cancelを提示し、自動mergeとlast-write-winsを行わない。
- Library open、再選択、page reloadで設定を読み、明示的な`設定を再読み込み`も提供する。polling、background sync、File System Observerは使わない。

### Units

1. Scope、Architecture、Decisions、schema、permission / conflict policy、test plan（Completed）
2. read-only loader、schema validation、Library open時の読込、localStorage fallback（Completed）
3. readwrite permission、safe writer、明示保存、failure handling（Completed）
4. localStorage migration、status UI、manual reload、conflict handling（Completed）
5. Chrome / Edge、Google Drive Folder、統合受け入れ、文書、Release finalization（Completed）

Unit 1 Planning、Unit 2 read-only loader、Unit 3 explicit save、Unit 4 migration / Reload / conflict recovery、Unit 5 integrated acceptance / finalizationはCompletedである。

### Out of Scope

- GPX編集、GPX上書き、TrackPoint編集、GPX容量削減
- Folder移動 / 改名とorphan pathの自動追従
- Google Drive / OneDrive等のcloud API、background sync
- automatic merge、multi-user collaboration、account、server、database
- Mobile Viewer UX、Date Tree、vehicle metadata本体、previous display state restoration
- Import / Export UI、backup / temporary file管理、GPX編集保存基盤の実装

正式な保存原則は「TrailBookは、ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。」とする。Release 1.2のproduction実装は、明示操作時の`trailbook.json`だけを書き込み対象とし、GPXは引き続きread-onlyである。

## Current Release — Release 1.3 Previous View Restoration

Status: Completed

Goal: Libraryを再度開いた時に、端末ごとの前回表示状態を安全かつ軽量に復元し、日常利用の再開操作を減らす。Release 1.2のshared settings、GPX read-only、既存表示Queueとselection契約は変更しない。

### Scope

- Map center / zoom
- checkbox上の表示意図を表すvisible GPX relative path list
- visibleかつ正常に表示できたselected Track
- desktop sidebarのopen / closed。現行UIには開閉状態がないため、Release 1.3でkeyboard操作可能な最小toggleを追加する
- current Libraryだけの保存済み前回表示状態を消去するReset UI
- 最後に正常に開いた`FileSystemDirectoryHandle`をIndexedDBへ保存し、次回起動時にread permissionが`granted`なら同じ既存Library load pipelineで自動openする
- permissionが`prompt` / `denied`、または自動openできない場合に、Viewerを止めず`前回のLibraryを開く`と通常のLibrary pickerを提示する
- Chrome / Edge、0 / 1 / 50 / 200 / 806 GPXでの復元、安全性、性能確認

sidebar width、Search query、Tree expanded paths、Tree scroll、Tree focusはFuture Candidateとし、Release 1.3へ含めない。Map modeは既存のglobal device-local設定を継続し、新しいview stateへ重複保存しない。

### Shared and Device-local Boundary

`trailbook.json`はFolder colors等のLibrary共有設定の正本であり、previous view stateを保存しない。Map、visible / selected Track、sidebarはbrowser originと端末に限定した`localStorage`へ保存する。最後に選択した`FileSystemDirectoryHandle`とcache専用opaque namespaceはprevious Library再開用のIndexedDB recordへstructured cloneで保存するが、localStorage、`trailbook.json`、Consoleへ出さない。GPX XMLとLeaflet Layerは永続化しない。parsed geometryは5秒性能目標の不達により、再生成可能な別IndexedDB cacheとして採用する。

Release 1.3は専用storage keyとschema version 1を持つ`ViewStateStore`を採用する。既存`DisplaySettingsStore` schema version 1とshared settings schema version 1は変更せず、schema migrationやFolder color / Map modeとの結合を発生させない。

### Library Identity

Release 1.3は`ViewStateStore`のLibrary keyとして既存の`root-name:<encoded root folder name>`を継続する。前回Library用IndexedDB recordはDirectoryHandleと内部用のopaque cache namespaceを保持できるが、このnamespaceはshared identityまたはlocalStorage keyへ流用しない。手動選択したhandleと保存handleの同一性確認には`FileSystemHandle.isSameEntry()`を使用できる。Library全内容hash、GPX内容hash、構造fingerprintはscan負荷とrename / moveへの不安定さから採用しない。Library aliasまたは`trailbook.json`内の明示IDは将来候補とする。

このため同名root Folderは同じdevice-local view stateを共有し得て、root名変更時は別Library扱いになる。HandleをlocalStorageへ保存せず、view state Resetと前回Library handleの破棄を別の回復操作として扱う。IndexedDBはorigin単位で分離されるため、scheme、host、portが変わると以前のhandleとcacheは利用できない。

### Save and Restore Boundary

- Mapは操作終了後、display / selection / sidebarは既存Event契約の確定後に、単一のdebounce save queueへ集約する。bulk ON / OFFでもlocalStorage書き込みは一回へcoalesceする。
- unloadだけへ依存せず、Library切り替え前はold Libraryのpending snapshotをflushする。storage failure時はsession memory fallbackとし、Viewerを停止しない。
- restore中は自動refocusがsaved Mapを上書きしないよう抑止し、既存`DisplayState`と`GPXDisplayQueue`へvalid pathを投入する。専用の解析Queueと重複Layerを作らない。
- 全restore対象がloaded / error / cancelledへ確定した後、Mapをanimationなしで一回復元する。saved Mapがない場合だけ既存fitBounds / defaultを使用する。
- selected Trackはcurrent Libraryに存在し、checkedかつloadedの時だけ`SelectionState`へsystem restoreする。Treeは祖先をrevealできるがfocus、scroll、Map panを発生させない。
- restore中の利用者操作は対象stateごとにsaved値より優先する。Library generationが変わった結果は破棄する。
- 起動時は保存handleへ`queryPermission({ mode: "read" })`だけを行う。`granted`なら自動openし、`prompt` / `denied`では自動でpermission promptを出さない。利用者が`前回のLibraryを開く`を実行した時だけ、必要に応じて`requestPermission({ mode: "read" })`を行う。
- IndexedDB unavailable、破損record、stale / missing handle、permission拒否でも初回案内と手動pickerを維持する。恒久的に無効と確認できたrecordは安全に破棄できるが、一時的なprovider offlineを自動削除理由にしない。

### Performance Policy

既存Queueの並列数2、session cache上限100、path identity、通常のbulk表示pipelineを再利用する。0 / 1 / 50 / 200 / 806 Trackで、UI応答性、復元時間、Queue重複、localStorage size、Waypoint OFF / ONの既知制限を測定する。806前後のprevious visible Trackは、Library scanとpermission処理を分けたwarm restoreを同一PC / browser / origin、Waypoint OFF、最低3回の中央値で約5秒以内とする性能目標を追加する。初回cold loadは従来速度を許容する。

既存GPX再parse方式を約807 visible Tracksで測定した結果は24秒、25秒、25秒、中央値25秒で、約5秒目標に不達だった。このため、IndexedDBへparser / cache schema version、Library cache namespace、relative path、`File.size`、`File.lastModified`と描画用Track / Waypoint座標を保存するcacheを採用する。source情報が一致するentryだけを使用し、変更時はそのGPXだけを無効化して既存Queueで再parseする。cache read / validation / write failureは既存Queueへfallbackし、Leaflet Layer、GPX XML、Queue状態を保存せず、同じpathをparseまたはrenderへ二重投入しない。

採用後の同条件warm restoreは3秒、3秒、3秒、中央値3秒となり、約5秒目標をPassした。baseline中央値25秒から約8倍高速化し、UI停止、duplicate表示、pan / zoom回帰、Console errorは確認されなかった。

### Units

1. Scope、Architecture、Decisions、schema、identity、save / restore order、performance / test plan（Completed）
2. `ViewStateStore` / pure schema、Map state、desktop sidebar open / closed、Reset基盤（Completed）
3. visible Track snapshot / restore、existing Queue統合、bulk coalescing、stale path / generation（Completed。少数Trackと807 visible TrackのBrowser Acceptance済み）
4. Previous Library Handle Store / Coordinator、permission UX、自動 / 手動open、stale handle recovery（Completed）
5. 806 GPX warm restore performance gate、derived geometry cache（Completed。中央値25秒から3秒へ改善）
6. selected Track restore、Reset UI、error recovery、Library lifecycle統合（Completed）
7. Chrome / Edge統合受け入れ、806 GPX性能、文書、Release finalization（Completed）

### Out of Scope

- shared JSONへのview state保存、browser / device間共有、Google Drive同期
- sidebar width、Search query、Tree expanded paths / scroll / focusの復元
- FileHandleのlocalStorage / shared JSON保存、account、server、Library正本となる独自database
- GPX内容hash、Library全内容hash、構造fingerprint、automatic Library alias
- automatic save / edit of GPXまたは`trailbook.json`
- Date Tree、GPX編集、Folder rename / move、Track軽量化、Mobile Viewer UX、cloud API

## Current Release — Release 1.4 Library Browsing / Track Discovery

Status: Completed

Goal: 実Folder構造とGPXを変更せず、Libraryを日付、Track名、Folder、基本Track情報から横断的に見つけられるようにする。Release 1.3の表示、selection、Geometry Cache、previous view restorationを維持し、Discovery用GPX解析を表示解析と重複させない。

### Proposed Scope

- 既存Folder Treeと切り替え可能なvirtual Date Tree。GPXはrelative pathをidentityとして年 / 月 / 日へ1回だけ配置する
- selected GPXのTrack Info。距離、TrackPoint数、開始 / 終了日時、duration、取得可能なelevation最小 / 最大、Track名、元file名を表示する
- 既存のfile / Folder / relative path Searchを維持し、Discovery Index準備後にTrack名とdate range filterを追加する
- Index構築、progress、cancel、Library generation guard、壊れたGPXの部分失敗継続
- Geometry Cacheと同じsource identity、parser result、inflight deduplicationを利用するcompact discovery summary
- 通常Track opacity 0.55のalpha blending。Track色を維持し、重なりを自然な混色として表示する。selected Trackはopacity 1.0と既存outlineを維持する

Folder Treeのfile / Folder表示、Map、DisplayState、SelectionState、GPXDisplayQueue、Search結果100件上限、Waypoint初期OFFは変更しない。Date TreeとTrack Infoは同じGPX relative pathを既存selection / display eventへ投影する。

### Date Source Policy

`recordedAt`は次の最初のvalid値を使用する。

1. GPX `metadata.time`
2. document順で最初のvalidな`TrackPoint.time`
3. `File.lastModified`
4. `originalFileName`内の厳密な日付pattern

time文字列はvalidなISO 8601だけを採用する。file名fallbackは境界付き`YYYY-MM-DD`、`YYYY_MM_DD`、`YYYYMMDD`だけをcalendar validation後に採用し、推測的な数字列解析をしない。全候補がinvalidなら`Unknown Date`へ置く。Date Treeとdate rangeは利用端末のlocal calendar dateでgroup / compareするため、timezone変更でgroup日付が変わり得ることを既知制限とする。`recordedAtSource`を保持し、fallback理由をTrack Infoで確認可能にする。

### Discovery Summary

1 GPX fileにつき1件のimmutable summaryをrelative pathで保持する。複数Trackを含むGPXもDate Tree上では1件であり、Track Infoはfile内全Track / Segmentを集計する。

- `path`、`folderPath`、`originalFileName`
- `displayName`、`trackNames`
- `recordedAt`、`recordedAtSource`、local `dateKey`
- `pointCount`
- Segment境界を跨がずHaversine計算した`distanceMeters`
- validなpoint time全体の`startedAt` / `endedAt`と、非負の場合だけの`durationMs`
- valid elevationがある場合だけの`elevationMin` / `elevationMax`
- parse / index statusとsource identity

Release 1.4ではelevation gain / loss、速度、統計chart、個別Track単位の選択を追加しない。

### Parse and Cache Boundary

現在のGeometry Cache recordを再生成可能なderived GPX recordへ拡張し、描画geometryとcompact discovery summaryを同じparser resultから生成する。cache / parser schema、Library namespace、relative path、`File.size`、`File.lastModified`でvalidityを判定する。schema更新で既存entryが無効になった場合は各GPXを一度だけ再parseし、新しいgeometryとsummaryを同時に保存する。

Discovery Indexはsummary-only readを使用し、warm index構築時に全geometryをmemoryへ複製しない。cache miss時はshared loaderの同一path inflight requestを表示処理と共有し、同じGPXのduplicate read / parse / cache writeを禁止する。cache unavailable、corrupt、quota、schema mismatchではmemory indexと既存parseへfallbackし、Viewerを停止しない。GPX XML、Leaflet Layer、Queue状態を保存しない。

Library openと基本Searchでは全GPXをeager parseしない。Date Treeを初めて開く、またはTrack名 / date filterを初めて使う明示操作で1回だけcancellable index buildを開始する。query入力ごとにparseせず、準備後のfilterはmemory indexだけを使う。Track Infoはselected pathのsummaryだけをshared loaderから要求できる。

### UI Boundary

- Sidebarに`Folder` / `Date`のkeyboard操作可能なbrowse modeを置き、既存TreeViewを改造せず`DateTreeView`を独立させる
- Date Treeはlazy DOM、roving tabindex、年 / 月 / 日groupのexpand / collapse、GPX activate / individual checkboxを提供する
- 年 / 月 / 日groupはDiscovery Index descendantとDisplayStateからchecked / unchecked / indeterminateを算出し、既存bulk display経路で未展開Trackも一括ON / OFFする
- Track Infoはselected GPXのread-only panelとし、selectionやMapを自動変更しない
- Track InfoをSidebar下部へ固定し、Folder / DateのTrack listだけを独立scroll領域とする。desktopではSidebar / Map境界をdragまたはkeyboardでresizeし、Library単位のdevice-local view stateへ幅を保存する
- Track list / Track Info境界もdesktopで上下resize可能とし、両領域の最小高とTrack Info内部scrollを維持する。Track Info高はSidebar幅と同じLibrary単位device-local view stateへ保存する
- 基本Searchはindex未準備でも従来どおり利用可能とし、高度filterはindex statusとpartial failureを文字で示す
- App / TreeViewへ責務を直接追加せず、`TrackDiscoveryCoordinator`がindex lifecycleとUI projectionを調停する

### Performance Policy

- Folder Library openと基本Searchの初期性能をRelease 1.3から悪化させない。Discovery Indexは明示操作まで遅延する
- 806前後のwarm indexはWaypoint OFF、同一PC / browser / origin、最低3回の中央値で約5秒以内を目標とする
- cold indexは従来parse時間を許容するが、UI、Map pan / zoom、Folder Tree、Cancelをblockしない
- in-memory summaryは1 GPX 1件とし、TrackPoint配列やgeometryをDiscovery Indexへ複製しない
- Date Treeはlazy DOM、filter結果は既存同様最大100件表示とtotal countを維持する
- Library switchはgenerationで旧index結果を破棄し、cache / parse / UI stateを新Libraryへ混在させない

### Proposed Units

1. Planning、Architecture、Decision、date / summary contract、performance / test plan（Completed）
2. Discovery summary、shared derived-data cache、index lifecycle、failure / generation guard（Completed）
3. Date TreeとFolder / Date browse mode（Completed）
4. Track Infoとselected path projection、Sidebar usability、GPX decode / cache invalidation（Completed）
5. Track name / Folder / date range Search・Filter（Completed）
6. Chrome / Edge統合受け入れ、806 GPX性能、data protection、documentation、Release finalization（Completed）

Unit 2は`TrackDiscoveryEntry`、`TrackSummaryBuilder`、`LibraryDiscoveryIndexService`を追加し、`GPXGeometryLoader`の同一path inflight requestからdisplay resultとsummaryを投影する。Geometry Cache schema version 2はdrawing geometryとcompact summaryを同じderived recordへ保存する。Index Serviceは`setLibrary()`では読込を開始せず、明示`build()`までidleを維持する。Date Tree、Track Info、advanced Filterへのproduction接続はUnit 3以降で行う。

Unit 2 Browser Acceptanceでは約806 GPXのcold buildが21秒、22秒、20秒、中央値21秒、warm buildが3秒、3秒、3秒、中央値3秒だった。cold結果は初回buildの非blocking baselineとして扱い、warm約5秒目標はPassした。cache hit、duplicate parseなし、UI応答性、Map pan / zoom、Cancel、Library切り替え、Console、data protectionもPassした。

Unit 3は既存Folder Treeと独立した`DateTreeView`、pureな`DateTreeBuilder`、`DateTreeVisibilityIndex`、`TrackDiscoveryCoordinator`、device-localなbrowse mode Storeを追加した。Date modeへ切り替えた時だけUnit 2 Indexをbuildし、年 / 月 / 日 / TrackとUnknown Dateをlazy DOMへ投影する。Track activate、individual / group checkbox、selection / checked同期は既存EventBus、SelectionState、DisplayStateを正本として再利用する。group bulkは1回の既存`folder:display-toggled` eventへ全descendantを渡し、view-state saveをcoalesceする。Implementation / Static Test / Browser AcceptanceはCompletedである。

Track Alpha BlendingはUnit 3と並行する共通Map style変更として、通常Track opacityを0.55、selected mainを1.0、outlineを0.95とする。Track color、Waypoint、zoom weight、Folder color、Monochrome Map、Map / view restore契約は変更しない。Static TestとBrowser AcceptanceはCompletedであり、通常Track opacity 0.55を正式採用する。Date TreeのBrowser AcceptanceもCompletedである。

Unit 4は`TrackInfoCoordinator`と`TrackInfoView`を追加し、SelectionStateのpathから共有Discovery Index entryを選択ごとに投影する。Index未構築時は該当pathだけをshared loaderへ要求し、Geometry Cache / 通常parseを区別せず同じsummaryを表示する。追加したSidebar shellはTrack listと固定Track Infoを分離し、desktop用`SidebarResizeHandle`は幅、`TrackInfoResizeHandle`は上下split高を既存`trailbook.viewState`へ保存する。Track Info、Sidebar usabilityのImplementation / Static TestおよびUnit 4 Browser AcceptanceはCompletedである。

一部GPXのTrack名文字化けは、`File.text()`がXML declarationに関係なくUTF-8 decodeすることが原因だった。`GPXLoader`はbyte列からUTF-8 / UTF-16 BOM、XML declarationのUTF-8、Shift_JIS / Windows-31J aliasを判定し、宣言なしでstrict UTF-8が失敗した場合だけShift_JISを試す。unsupported declarationは従来互換のUTF-8 replacement fallbackとし、Viewerを停止しない。Geometry Cache schema version 3と`textDecoderSchemaVersion: 1`はschema 2およびdecode契約markerのない過渡的schema 3 summaryを該当path単位でinvalidにし、次回要求時にGPXから再生成する。DB全体はclearせず、GPX自体も書き換えない。手動clearなしのBrowser AcceptanceまでCompletedである。

Unit 5は既存Search欄へTrack / Folder path textとFrom / Toを追加し、明示filter入力時だけ共有Discovery Indexを遅延buildする。`DiscoveryFilterService`のmemory query結果を`FolderTreeFilterProjection`とDate Treeへ共通適用し、最大100件のSearch resultとtotal countを維持する。filterはDisplayState、SelectionState、Map visibility / center / zoomを変更せず、Library別device-local stateとして`trailbook.discoveryView`へ保存する。ImplementationとBrowser AcceptanceはCompletedである。追加したStatic test定義は維持し、production module graph、循環参照、file size、data protectionの静的検証をPassした。

### Out of Scope

- GPX、`trailbook.json`、shared settings schemaへのDiscovery data書き込み
- 実file / Folderの移動、rename、分類用Folder作成
- Track / TrackPoint編集、GPX保存、Undo / Redo
- DateをFolder Treeのfile名へ置換すること
- Timeline、Replay、Statistics dashboard、elevation chart
- vehicle metadata、tag / bookmark、Import / Export、cloud API、automatic sync
- Mobile layout / touch対応

## Future Design Boundaries

以下は過去Releaseから保全している将来設計境界である。Release 1.4で実装済みとなった項目は、上記Release 1.4節を優先する。

### GPX Internal Date and Date-based Display

Decision 0025で保全した日付候補をRelease 1.4のvirtual Date Treeへ具体化する。既存Folder Treeのfile名を置換せず、同じrelative pathを別projectionで表示する。

日付候補の優先順位:

1. `metadata.time`
2. 最初の`TrackPoint.time`
3. `File.lastModified`
4. `originalFileName`

Index候補は`displayName`、`recordedAt`、`originalFileName`、`trackName`とする。

Release 0.9ではGPX内容を解析せず、日付抽出と日付表示を実装しなかった。Release 1.4で1つのderived Discovery Index、Date Tree、Track Info、Search / Filterとして実装し、GPXや実Folder構造へ書き戻さない境界を維持した。

### Vehicle Metadata and Track Style

Track色は将来、単なる装飾ではなく、使用した車またはバイクの属性を表す値として扱う。

候補field:

- `vehicleId`
- `vehicleName`
- `vehicleType`
- `vehicleColor`

将来は`vehicleId`をGPX extensionsへ保存し、TrailBook側の車両設定から色を解決する構造を検討する。現在のpath hash色は、車両情報がない場合のfallbackとして維持する。

Release 0.9では、車両情報の読み込み、保存、編集、色変更を実装しない。

### TrackPoint Editing Mode

将来、単一GPXだけを対象とする編集モードをViewerから分離して追加する。

候補機能:

- 編集対象GPXを1件に限定
- TrackPoint選択、移動、追加、削除
- Segment分割、結合
- Undo / Redo
- 保存、別名保存、編集破棄
- 元GPX保護
- 外部変更との競合確認

方針:

- GPXを唯一の正本とする。
- 勝手に上書きしない。
- 保存には明示的なユーザー操作を必要とする。
- 編集中は他GPXを編集不可にする。
- Viewer責務とEditor責務を分離する。
- 書き込み基盤、Undo / Redo、保存失敗処理を先に設計する。

編集機能はRelease 0.9の対象外とする。

## Future Candidates

Release 1.2 Shared Library SettingsとRelease 1.3 Previous View RestorationはCompletedである。以下はRelease 1.3より後の候補であり、設計承認時にRelease番号を決定する。

- GPX Metadata Index
- Date-based Display（Release 1.4でCompleted）
- Vehicle Metadata / Track Style
- GPX Editing Foundation
- TrackPoint Editing
- Mobile Viewer UX
- Waypoint Performance Optimization
- Unit 2-equivalent Performance Remeasurement
- Stable Library Identity / Alias
- Sidebar Width Restoration
- Search / Tree Navigation Restoration
- GPX Size Reduction
- Replay
- HeatMap
- Bookmark
- Tag
- Export / Import
- Statistics

Version 2以降の候補として、元RoadmapのFuture Ideasを維持する。

- Plugin
- Cloud Sync
- Photo
- Video
- Timeline
- 3D
- AI Search
- Mobile専用Library入口
- `input type="file" webkitdirectory`を使うFolder選択fallback
- 複数GPXファイル選択
- ZIP Library読込
- クラウドFolder import

## Quality Gate

各Releaseは次を満たす。

- エラーとConsole Warningがない。
- 未使用コードと不要なTODOがない。
- 設計文書、UI仕様、実装が一致する。
- Releaseの範囲外を実装しない。
- Git diffと対象範囲を確認する。

## Release AI Workflow

各Releaseでは次の順序で作業する。

1. ROADMAP確認
2. 実装
3. 自己レビュー
4. テスト
5. ドキュメント更新
6. Commit
7. 次Release

各工程でも現在のRelease範囲を越えない。

## Commit Rules

- 1 Releaseを一つの明確な変更単位として扱う。
- 実装、自己レビュー、テスト、ドキュメント更新が完了してからcommit対象とする。
- commit、tag、pushは明示的な承認後に行う。

## Git Policy

- `main`は安定版とする。
- commit、tag、pushは明示的な承認後に行う。
- 公開済みReleaseの事実はGitタグと`CHANGELOG.md`に合わせる。
- 過去Release履歴を将来計画の都合で書き換えない。

## Branch Policy

現在は`main`を安定版として使用する。次の構成は元Roadmapから維持するplanned policyであり、導入時には実際のGit運用と整合させる。

- `main`: 安定版
- `develop`: 開発版
- `feature/*`: 各機能

## AI Instructions

- Releaseを跨いで実装しない。
- ROADMAPにない機能を追加しない。
- 設計変更は文書を先に更新する。
- Next Releaseより先のコードを書かない。
- 迷った場合はGPX、ユーザーデータ、単純さ、長期保守性を優先する。

## Success Definition

TrailBookが成功したと言える条件:

- 大量GPXでも軽い。
- Explorer感覚で使える。
- 学習コストが低い。
- 10年後も保守できる。
- 設計書だけでAIが開発を継続できる。
