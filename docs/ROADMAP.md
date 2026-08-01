# ROADMAP.md

Version: 1.2 Planning
Status: Official
Current Release: 1.1.0 Track Selection & Styling
Next Release: 1.2 Shared Library Settings（Planning / Production not started）

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

## Current Release

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

## Next Release — Release 1.2 Shared Library Settings

Status: Planning / Production not started

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

1. Scope、Architecture、Decisions、schema、permission / conflict policy、test plan
2. read-only loader、schema validation、Library open時の読込、localStorage fallback
3. readwrite permission、safe writer、明示保存、failure handling
4. localStorage migration、status UI、manual reload、conflict handling
5. Chrome / Edge、Google Drive Folder、統合受け入れ、文書、Release finalization

Unit 1はPlanningであり、Unit 2以降のproduction実装は開始していない。

### Out of Scope

- GPX編集、GPX上書き、TrackPoint編集、GPX容量削減
- Folder移動 / 改名とorphan pathの自動追従
- Google Drive / OneDrive等のcloud API、background sync
- automatic merge、multi-user collaboration、account、server、database
- Mobile Viewer UX、Date Tree、vehicle metadata本体、previous display state restoration
- Import / Export UI、backup / temporary file管理、GPX編集保存基盤の実装

正式な保存原則は「TrailBookは、ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。」とする。Release 1.1の実装は引き続きread-onlyで、Release 1.2のproduction codeは未実装である。

## Future Design Boundaries

以下はRelease 1.1には含めない将来設計境界である。

### GPX Internal Date and Date-based Display

将来、TreeViewの表示名をファイル名ではなく、GPX内部の日付を基準に表示できる構造を検討する。

日付候補の優先順位:

1. `metadata.time`
2. 最初の`TrackPoint.time`
3. `File.lastModified`
4. `originalFileName`

Index候補は`displayName`、`recordedAt`、`originalFileName`、`trackName`とする。

Release 0.9ではGPX内容を解析せず、日付抽出と日付表示を実装しない。

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

Release 1.2 Shared Library Settingsは上記のNext ReleaseとしてPlanning中である。以下はRelease 1.2より後の候補であり、設計承認時にRelease番号を決定する。

- GPX Metadata Index
- Date-based Display
- Vehicle Metadata / Track Style
- GPX Editing Foundation
- TrackPoint Editing
- Mobile Viewer UX
- Waypoint Performance Optimization
- Unit 2-equivalent Performance Remeasurement
- Previous Display / Map Position Restoration
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
