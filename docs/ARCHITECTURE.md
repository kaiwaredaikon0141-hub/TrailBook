# ARCHITECTURE.md

Version: 1.2 Completed
Status: Official
Baseline: Release 1.2.0
Current: Release 1.2 Shared Library Settings Completed
Depends: PROJECT.md, ROADMAP.md, DECISIONS.md

## Architecture Overview

TrailBookは責務分離、低結合、Event Driven Architectureを採用する。

GPXとFolder構造を永続データの正本とし、アプリケーション内には表示と操作に必要なセッション状態だけを保持する。

```text
Browser File System Access API
              |
       FolderScanner
              |
       Library / Folder
              |
          TreeView metadata
              |
 EventBus <-> App Coordinator
      |          |          |
DisplayState  GPXDisplayQueue  MapView
                  |              |
          GPXLoader/Parser  LayerManager
                                 |
                     Path-keyed Leaflet Layers
```

## Layer Structure

```text
Application / Coordination
        |
Presentation
        |
Services and Session State
        |
Models
        |
Browser API / Leaflet API
```

上位層は必要最小限の下位層だけを利用する。UI同士を直接接続せず、EventBusとAppを介して調停する。

## Dependency Rules

- 依存は上位Layerから下位Layerへのみとする。
- 下位Layerから上位Layerへの逆参照を禁止する。
- 循環参照を禁止する。
- UIはServiceやModelの内部状態を直接操作しない。
- ModelはUIやLeafletを参照しない。
- Map LayerはFile System Access APIを扱わない。
- UI同士の連携はEventBusとAppの調停を使用する。

具体的なimportと実装上の依存規約は`CODING_RULES.md`に従う。

## Utility Rules

- Utilityは状態を持たない。
- 副作用を最小限にする。
- 特定のUIやAppのsession stateへ依存しない。
- 特定機能の責務を持つ処理はUtilityへ逃がさず、適切なService、Manager、Stateへ配置する。

## Class and File Rules

- 一つのClassは一つの明確な責務を持つ。
- 責務が曖昧または複数になった場合はClassを分割する。
- 巨大Classと巨大Fileは禁止する。
- 500行を超えるFileは分割検討対象とする。
- `TreeView.js`はRelease 1.0でmetadata構築とpath計算を`TreeMetadataBuilder`へ限定抽出し、1,000行未満へ適合させた。
- 抽出後もTreeViewのDOM、Event、keyboard、ARIA、表示状態の挙動を変更しない。
- `App.js`は500行を超えているが、Release 1.0では無理に分割しない。

詳細なFile Size、Function Size、Single Responsibilityの基準は`CODING_RULES.md`を正本とする。

## Naming Rules

- `*View`: 画面表示とそのDOMを担当するUI。
- `*Dialog`: 一時的な対話UI。
- `*Panel`: 画面内の独立した表示領域。
- `*Service`: UIを知らないApplication処理。
- `*Loader`: 外部またはBrowser APIからデータを読み込む処理。
- `*Scanner`: Folderなどの構造を走査してModelを生成する処理。
- `*Manager`: 外部API、resource、またはlifecycleを管理する処理。
- `*State`: 非永続のApplicationまたはPresentation Stateを管理する処理。
- Model名: `Track`、`Waypoint`、`Library`、`Folder`のように対象データを直接表す。

命名の詳細は`CODING_RULES.md`と`GLOSSARY.md`に従う。

## Source Structure

```text
src/js/
├─ core/
│  ├─ App.js
│  ├─ Config.js
│  └─ EventBus.js
├─ ui/
│  ├─ Toolbar.js
│  ├─ TreeView.js
│  ├─ TreeMetadataBuilder.js
│  ├─ SearchView.js
│  ├─ LibraryAccessPanel.js
│  ├─ MapView.js
│  └─ StatusBar.js
├─ services/
│  ├─ FolderScanner.js
│  ├─ GPXLoader.js
│  ├─ GPXParser.js
│  ├─ GPXDisplayQueue.js
│  └─ SearchService.js
├─ state/
│  └─ DisplayState.js
├─ map/
│  └─ LayerManager.js
└─ models/
   └─ SearchEntry.js
```

Release 0.9 Searchは責務別構造を維持し、入力と結果表示を`SearchView`、metadata検索を`SearchService`、結果契約を`SearchEntry`へ分離する。

## App — Application Coordinator

`App`はアプリケーション全体のCoordinatorである。

Responsibilities:

- Component生成とLayout構築
- EventBusの接続
- Folder選択とLibrary読込の調停
- secure context、対応origin、Folder選択API、Mobile判定の調停
- Folder選択Cancel、permission failure、空Libraryの表示調停
- Search queryと結果選択のEvent調停
- GPXの主選択を表す非永続Presentation State
- `DisplayState`と`GPXDisplayQueue`の調停
- GPX個別表示とFolder一括表示の開始・停止
- 解析成功、失敗、古いrequestの結果処理
- 複数GPXの再フォーカス調停
- Waypoint表示設定のセッション保持
- Clear操作とLibrary切り替え

主選択は「どのGPXにユーザーの操作対象があるか」を表す。表示状態は「どのGPXが地図上でONか」を表す。両者を同一視しない。

AppはFolderやLibraryへ解析結果、表示状態、選択状態を書き込まない。

## Library Access — Startup and Compatibility

`FolderScanner.getFolderPickerSupport()`は`window.isSecureContext`、対応origin、`showDirectoryPicker`の実在だけでFolder選択可否を判定する。User-AgentはMobileの未検証案内と診断用の補助情報にだけ使用し、Mobileであること自体を無効化理由にしない。対応originはHTTPS、`http://localhost`、`http://127.0.0.1`とする。

`LibraryAccessPanel`は初回操作、非対応理由、permission failure、空Libraryをsidebar内で説明する。Toolbarは判定結果からFolder選択buttonをdisabledにし、`aria-describedby`で説明へ関連付ける。StatusBarはlive regionとして簡潔な状態を通知する。

Folder pickerは`{ mode: "read" }`で開く。Cancelはerror eventまたはConsole errorを発生させず、初回案内または既存Library表示へ戻す。permission failureは内部error文字列を表示せずretry可能な案内を出し、既存Libraryを破棄しない。GPX 0件のLibraryは正常状態として表示し、空のSearch indexと既存のMap初期状態を使用する。

Mobileで必要APIが利用可能ならbuttonを有効にして実機試験を可能にするが、合格前は正式対応またはbest effort対応とはしない。Mobile向けFolder選択fallbackは追加しない。

## TreeView — Lazy Library Presentation

`TreeView`はLibraryのNavigation UIである。

Responsibilities:

- Folderを先、GPXを後に名前順で表示
- pathベースの全Library metadata保持
- 展開Folderだけの遅延DOM生成
- Folder展開状態、focus、scrollのNavigation State
- roving tabindexとARIA Tree操作
- GPXの主選択
- GPX個別表示checkbox
- Folder一括表示checkbox
- Folder checkboxのchecked、indeterminate、disabled集約
- DOM未生成の子孫を含むFolder Model走査
- loading、loaded、error、表示色のUI反映
- Search用source metadataの提供
- Search結果activate時の必要Folder展開、対象行focus、既存主選択への接続
- Search結果checkboxから既存GPX表示toggleへの接続

主選択は`aria-selected`、表示状態はnative checkboxで表す。GPX行の選択だけで表示をON/OFFしない。

TreeViewの検索対象は生成済みDOMではなくpathベースmetadataとする。Release 0.9では結果選択時だけ必要な祖先Folderを展開する。

## TreeMetadataBuilder — Path Metadata Construction

`TreeMetadataBuilder`はLibraryを入力として、pathベースmetadata、`fileHandlesByPath`、`pathsByFileHandle`を構築する。path join、parent path、子孫判定、展開path filter、focus復元候補、子孫GPX列挙、Search用metadata投影もDOMへ依存しない処理として担当する。

依存方向は`TreeView`から`TreeMetadataBuilder`への一方向とする。`TreeMetadataBuilder`はUI状態を持たず、TreeView、DOM、EventBus、Leafletを参照しない。TreeViewは構築結果を保持し、DOM、interaction、Navigation State、表示状態、EventBus契約を引き続き担当する。

## DisplayState — Session Display State

`DisplayState`はLibrary内のGPX表示状態と解析cacheをpath単位で管理する。

Each display entry:

- `path`
- `fileHandle`
- `checked`
- `state`: `idle` / `loading` / `loaded` / `error`
- stable display `color`
- `error`
- `requestId`
- `lastUsedAt`

Additional state:

- 最大100件のセッション解析cache
- Library切り替えを識別する`libraryGeneration`
- pathごとのrequestId
- 現在のLibrary root handle

Library切り替え時はdisplay、cache、requestIdを破棄し、generationを更新する。古いgenerationまたはrequestIdの非同期結果は表示へ反映しない。

cacheは永続IndexでもGPXの正本でもない。Release 0.9 Searchはcacheを検索に利用せず、検索によってcacheを増やさない。

## GPXDisplayQueue — Bounded Parsing Queue

`GPXDisplayQueue`は表示要求によるGPX読込・解析を制御する。

- FIFO
- 最大2件並列
- queued requestとactive requestを追跡
- pathとrequestIdによる個別無効化
- Library切り替えまたはClear時の一括無効化
- 無効化されたrequestのsuccess / failure callbackを抑止

実行中のFile読込自体を強制停止するものではない。結果を無効化し、現在のUIへ反映しないことで整合性を保つ。

Searchは検索だけでQueueへrequestを投入しない。

## MapView — Leaflet UI Adapter

`MapView`は地図領域のDOMとLeaflet mapを扱うUI Adapterである。

Responsibilities:

- Leaflet mapとbase tile layerの初期化
- empty、loaded、error状態の表示
- `LayerManager`への表示・削除・refocus依頼
- 表示をすべてClearする操作の提供
- Waypoint visibility optionの提供
- 初期表示位置へのreset

Must not handle:

- FileSystemFileHandleの読込
- GPX XMLの解析
- LibraryやFolderの走査
- TreeView内部状態
- Search結果
- pathごとの表示状態の正本

Release 0.9 SearchではMapViewを変更しない。

## LayerManager — Leaflet Layer Ownership

`LayerManager`はLeaflet Layer APIとの接続を担当する。

pathごとに次のLayer entryを保持する。

```text
GPX path
├─ Track LayerGroup
│  └─ TrackSegmentごとのPolyline
├─ Waypoint LayerGroup（表示時だけ生成）
├─ Track Bounds
├─ Display Color
└─ Waypoint Count
```

Responsibilities:

- pathごとのLayer entry生成・保持
- Track LayerGroup生成
- TrackSegmentごとのPolyline生成
- Waypoint LayerGroupの独立した追加・削除
- GPX単位のTrack / Waypoint一括削除
- 全GPX LayerのClear
- GPX単位のTrack Bounds refocus
- 表示中の複数GPX全体のTrack Bounds refocus

WaypointはTrack Boundsへ含めない。Waypoint visibilityの変更ではfit、refocus、GPX再解析を行わない。

LayerManagerは主選択、Folder checkbox、Queue、cache、Searchを知らない。

## Services

### FolderScanner

BrowserのDirectoryHandleを再帰走査し、LibraryとFolder Modelを生成する。GPX内容は解析しない。

### GPXLoader

明示的に表示要求されたFileHandleからtextを読み込む。

### GPXParser

GPX textをTrack、TrackSegment、TrackPoint、Waypoint、Metadataへ変換する。UIとLeafletを知らない。

### SearchService

TreeViewから受け取ったFolder名、GPXファイル名、相対pathを正規化したsession indexとして保持し、総一致件数と先頭100件を返す。FileHandle、GPX内容、解析cache、Queue、DOM、Mapを扱わない。

## Models

Modelはデータ構造だけを保持し、UI状態とLeaflet Layerを保持しない。

- Library
- Folder
- Metadata
- Track
- TrackSegment
- TrackPoint
- Waypoint
- SearchEntry

Folder構造とGPXが正本であり、解析結果をLibrary Modelへ永続化しない。

`SearchEntry`は`kind`、`path`、`name`だけをRelease 0.9の実体fieldとして保持する。`displayName`、`recordedAt`、`originalFileName`、`trackName`、`vehicleId`、`vehicleName`、`vehicleType`、`vehicleColor`は将来候補として文書とJSDocにだけ残し、Release 0.9ではinstance生成、検索、解析、表示を行わない。FileSystemFileHandleも保持しない。

## Event Flow

### Library Load

```text
Toolbar
  -> folder:open-requested
  -> App / FolderScanner
  -> library:loaded
  -> App resets Queue, Layers, DisplayState
  -> TreeView render and file registration
```

### Individual Display

```text
GPX checkbox
  -> gpx:display-toggled
  -> App / DisplayState
  -> cached result OR GPXDisplayQueue
  -> GPXLoader / GPXParser
  -> request validation
  -> MapView / LayerManager
```

### Folder Bulk Display

```text
Folder checkbox
  -> TreeView enumerates descendant GPX from Model
  -> folder:display-toggled (once per operation)
  -> App applies existing individual display flow to each entry
```

### Primary Selection

```text
GPX row / Enter
  -> gpx:selected
  -> App updates primary selection
  -> displayed GPX only: refocus that GPX
```

主選択だけでは解析要求も表示ONも発生しない。

### Waypoint Option

```text
Waypoint checkbox
  -> map:waypoint-visibility-toggled
  -> App reads displayed cached results
  -> MapView
  -> LayerManager adds/removes Waypoint LayerGroups
```

### Search

```text
SearchView query
  -> search:query-changed
  -> App / SearchService
  -> SearchView results

Folder result activate
  -> search:result-activated
  -> App / TreeView
  -> expand ancestors and target Folder
  -> focus target Folder

GPX result activate
  -> search:result-activated
  -> App / TreeView
  -> expand ancestors and focus target GPX
  -> existing selectFile / gpx:selected flow
  -> displayed GPX: refocusGPX
  -> hidden GPX: Map unchanged

GPX result checkbox
  -> search:gpx-display-toggled
  -> App / TreeView metadata lookup
  -> existing gpx:display-toggled flow
```

Query入力だけではGPX解析、Queue投入、解析cache追加、display checkbox、主選択、Map表示を変更しない。

Result activateとcheckboxはquery入力から分離する。GPX activateは主選択だけを既存処理へ接続し、自動的に表示ONにしない。GPX checkboxは既存表示ON/OFF処理へ接続するが主選択を変更せず、result activateを発火させない。

## Object Lifetime

- App、EventBus、UI components: application lifetime
- Library、Tree metadata、DisplayState registrations: current Library lifetime
- Parsed result cache: current Library session、最大100件
- Search index and SearchEntry: current Library session
- Display queue request: request completionまたは無効化まで
- Track LayerGroup: 対象GPXの表示中だけ
- Waypoint LayerGroup: 対象GPXが表示中かつWaypoint optionがONの間だけ

## Release 0.9 Search Boundary

SearchはLibrary metadataに対するread-onlyなNavigation機能として開始する。

- GPXファイル名、Folder名、相対パスだけを検索する。
- GPX内容を解析しない。
- Queue、cache、MapView、LayerManagerを変更しない。
- DOM未生成項目もmetadataから検索する。
- 結果選択時だけ必要な祖先Folderを展開する。

日付Index、Track名、車両属性、GPX編集は将来機能であり、Release 0.9のArchitectureへ混在させない。

## Release 1.0 Stable Viewer Boundary

Release 1.0はRelease 0.9までのViewer機能を個人利用環境で安定させる品質Releaseであり、新しいLibrary機能を追加しない。

- 対応環境はWindows 10 / 11と、最新安定版Chrome / Edge desktopとする。
- Android、iPhone、iPadの最新Chromeは実機検証候補とし、合格した端末だけをbest effortへ追加する。未確認端末は対応区分未確定、必要API不足の端末は非対応とする。
- HTTPS、`http://localhost`、`http://127.0.0.1`を対応originとし、`file://`と通常のLAN内HTTP IPは対応外とする。
- 初回起動、File System Access API非対応、空Library、解析失敗、Library切り替えを明示的に扱う。
- TreeViewはmetadata構築とpath計算を`TreeMetadataBuilder`へ限定分割し、DOM、Event、keyboard、表示状態の挙動を維持する。
- GPX読込はread-onlyを維持し、書き込み、DB、永続cacheを追加しない。
- 一般公開、配布artifact、hosted版、公開support、TrailBook本体のOSS license決定は扱わない。
- Mobile検証のためにFolder LibraryのFile System Access API設計を変更せず、`showDirectoryPicker`が利用できない端末向けfallbackはRelease 1.0へ追加しない。
- LeafletとOpenStreetMapは第三者のlicenseおよび利用条件としてTrailBook本体と分離する。

## Release 1.1 Architecture

Release 1.1 Track Selection & StylingはCompletedである。既存のpath identity、App mediation、read-only GPX、bounded Queue / cacheを維持したまま、Selection、Track style、Folder color、UI設定storageを追加した。

### SelectionState — Selection Source of Truth

新規`SelectionState`を`src/js/state/SelectionState.js`へ置き、current Library内の単一`selectedPath`だけを選択状態の正本として管理する。FileHandle、DOM、Leaflet layer、解析結果、表示checkboxは保持しない。

| Candidate | Evaluation |
| --- | --- |
| App private state | 現在に近く変更は小さいが、Map selectionと将来EditorでApp責務が増える |
| DisplayState | path identityは共有できるが、表示ON / OFFと主選択を再結合するため不採用 |
| SelectionState | UI非依存、単一責務、将来editingへ拡張可能。採用 |
| LayerManager / TreeView | UIまたはLeafletを正本にするため不採用 |
| EventBus only | 現在値を問い合わせられず、event missed時に同期不能となるため不採用 |

- AppはTreeView、Search、MapViewからのrequestを検証し、`SelectionState`を更新してprojectionへ通知する。
- TreeViewとMapView / LayerManagerは選択の正本にならず、`selection:changed`を受けた表示projectionだけを持つ。
- Tree / Searchからは非表示GPXも主選択できるが、Map highlightとMap-origin selectionは表示中Trackだけを対象とする。
- 選択中Trackを非表示にした場合、Clear、Library切り替え、対象GPXのparse failureでは選択を解除する。
- Map背景clickは選択解除requestとする。dragでは解除しない。layer由来clickは`sourceTarget`で区別し、背景解除と二重処理しない。
- Tree / Search originの表示中GPX選択は既存どおり個別refocusする。Map originのTrack選択では現在のviewportを維持し、refocusしない。

`selection:changed.reason`は`tree`、`search`、`map`、`background`、`hidden`、`clear`、`library-switch`、`parse-failure`のいずれかとする。

既存App private Presentation StateはUnit 3で`SelectionState`のprojectionへ移行する。主選択と`DisplayState`の表示状態を分離するDecision 0018は維持する。

Unit 3実装では`SelectionState.select`、`clear`、`reset`、`isSelected`を単一pathの正本とし、同一pathの再選択は変更を返さない。Appはrequestのpathとsourceを検証してcommitし、実際に変更された場合だけ`selection:changed`を発行する。Tree / Search由来の表示中GPXだけ既存refocusを行い、Map由来ではviewportを変更しない。

選択解除reasonは`background`、`hidden`、`clear`、`library-switch`、`parse-failure`としてAppが付与する。選択中GPXの個別・Folder・root OFF、Clear、Library切り替え開始、parse failureでstateと全projectionを同期して解除する。

### TrackStyleService — Pure Style Rules

新規`TrackStyleService`を`src/js/services/TrackStyleService.js`へ置く。Folderから解決済みの色、zoom levelまたはbucket、selected flagを入力し、Leafletへ渡せるstyle descriptorを副作用なしで返す。

出力はmain color / weight / opacity、outline color / weight、Canvas hit tolerance、選択時のz-order方針を含む。数値はConfigの単一sectionへ集約し、App、MapView、LayerManagerへ散在させない。hover、vehicle color、error styleは将来fieldを追加できるがRelease 1.1では実装しない。

Zoom bucket初期値:

| Zoom | Bucket | Normal weight |
| ---: | --- | ---: |
| 15以上 | near | 4 px |
| 12〜14 | middle | 3 px |
| 9〜11 | far | 2 px |
| 8以下 | overview | 1.5 px |

selected mainはnormal + 3 px、outlineはselected main + 2 pxとする。main colorはFolder colorのまま変更せず、opacityは通常0.85、selected 1.0とする。outline colorはmain colorとの明度差を確保するneutral colorをpure calculationで選ぶ。

Unit 3ではmain colorの簡易luminanceにより白または濃いグレーのoutlineを選び、selected main opacity 1.0、outline opacity 0.95とする。数値とCanvas hit toleranceはConfigへ集約する。

`zoomend`で現在bucketを比較し、bucketが変わった場合だけ表示中Trackをrestyleする。同じbucket内のzoomでは何もしない。

Unit 2では`TrackStyleService`のnormal style計算だけを実装する。Appが現在bucketを保持し、MapViewの`map:zoom-ended`を受けてbucket変更時だけLayerManagerへweight更新を依頼する。LayerManagerは現在のpath entryにあるTrack LayerGroupだけを`setStyle({ weight })`で更新し、色、opacity、Bounds、Waypoint LayerGroup、Layer数を変更しない。selected main、outline、Canvas hit tolerance、z-orderはUnit 3以降の設計として維持し、Unit 2では実装しない。

### LayerManager — Clickable and Highlighted Track Layers

GPX pathごとのentryを次へ拡張する。

```text
GPX path
├─ Main Track LayerGroup
│  └─ TrackSegmentごとのinteractive Canvas Polyline
├─ Selected Outline LayerGroup（選択中だけ生成）
├─ Waypoint LayerGroup（表示時だけ生成）
├─ Track Bounds
├─ Resolved Color
└─ Current Zoom Bucket
```

Release 1.1の初期方式はLeaflet Canvas rendererの`tolerance`で細線のhit areaを広げ、全Trackへ透明hit Polylineを重複生成しない。visible main Polylineがclick targetとなり、outlineは`interactive: false`とする。Canvas方式がbrowser acceptanceを満たさない場合だけ、透明hit Polylineをfallback候補として再評価し、layer数と806 GPX性能を再測定する。

outlineは選択GPXだけに生成し、mainより背面へ置く。選択mainは同じTrack renderer内で前面へ移動する。選択解除時はoutlineを削除し、mainを通常styleへ戻す。他Trackのopacityは変更しない。

Unit 3実装はTrack専用のLeaflet Canvas rendererを採用し、Configの`tolerance`でvisible main Polylineのclick領域を広げる。Waypoint Markerと背景tileはこのrendererを使用しない。outlineは選択中GPXの各Segmentへだけ生成し、`interactive: false`とする。outline追加後にselected mainを`bringToFront()`し、全Trackの順序は組み直さない。

LayerManager entryはmain Segment layerと元のlatLng参照、normal style、選択中だけのoutline LayerGroupを保持する。selection・zoom変更は`setStyle`を使い、GPX再parse、geometry再構築、Bounds、Queue、cache、Waypointを変更しない。

overlap時はrenderer上で最前面のhit対象1件を選ぶ。cycle selectionは行わず、隠れたGPXはTree / Searchから選択できる。Track clickはMap背景clickと区別し、double-click zoomを`preventDefault`しない。

### Folder Color Settings

Folder色はLibrary dataではなく、再生成可能なUI表示設定である。root Folder pathは空文字`""`とし、rootにも明示色を設定できる。

新規`FolderColorState`を`src/js/state/FolderColorState.js`へ置き、current Libraryの明示色Mapと継承解決を担当する。DOM、Leaflet、localStorageへ直接依存しない。`DisplaySettingsStore`は永続化だけを担当し、AppがLibrary load時の復元と明示変更後の保存を調停する。

GPX color解決順:

1. 対象Folder自身の明示色
2. 対象Folderからroot方向へ探索して最初に見つかる、最も近い祖先Folderの明示色
3. GPX relative pathによる既存path hash color
4. Configの最終fallback色

対象Folder自身に明示色があれば必ずそれを使用し、自身が未設定の場合だけ親からroot方向へ探索する。直接親に限定せず、最初に見つかった最も近い祖先色を継承し、rootの明示色も祖先色として利用する。明示色をDefaultへ戻すと、そのFolderは最も近い祖先色またはfallbackへ戻る。GPX単位色は扱わない。

`FolderColorState.getResolvedFolderColor(folderPath)`は対象Folder自身、続いてroot方向の祖先を順に調べ、最初の明示色を返す。どこにも存在しなければ`null`を返す。AppはGPXごとに`resolvedFolderColor ?? getPathHashColor(gpxPath) ?? finalFallback`を適用する。これにより明示色が一切ないLibraryでは、v1.0.0と同じGPX relative pathごとのhash色が変わらない。

Unit 5のAPIは`setActiveLibrary`、`loadFolderColors`、`setExplicitColor`、`removeExplicitColor`、`getExplicitColor`、`getResolvedFolderColor`、`resolveTrackColor`、`getAffectedFolderPaths`とする。Storeのvalidationを再利用し、`#RGB`または`#RRGGBB`を大文字`#RRGGBB`へ正規化する。

Folder color変更時は対象Folder配下の登録GPXだけを再解決し、表示中pathだけをLayerManagerでrestyleする。Queue投入、GPX再解析、cache更新、refocusは行わない。TreeとSearchの表示色projectionは同じresolved colorへ更新する。

Unit 5ではFolder pathとGPXの親Folder計算をstateやUIへ重複させず、stateを持たない`PathUtils`へ集約する。`FolderColorState.getAffectedFolderPaths`は変更Folder配下を走査し、途中に別の明示色がある子枝を除外する。Appは全登録displayのresolved colorを更新するが、LayerManagerへ通知するのは現在表示中の影響pathだけである。

`LayerManager.updateTrackColor`は既存Polylineへ`setStyle`し、Layer、geometry、Bounds、Waypointを再生成しない。選択中pathではselected mainとoutlineを新色から再計算し、selection path、現在zoomのweight、opacityを維持する。Map refocus、Parser、Queue、cacheを呼ばない。

### UI Settings Persistence

新規`DisplaySettingsStore`を`src/js/services/DisplaySettingsStore.js`へ設け、storage objectをconstructor injectionして固定key`trailbook.uiSettings`のJSONを安全に読み書きする。localStorageはGPXの正本や独自DBではなく、削除してもpath hash色から再生成できるUI設定storageとする。

```json
{
  "version": 1,
  "global": {
    "mapMode": "monochrome"
  },
  "libraries": {
    "root-name:TrailBook": {
      "folderColors": {
        "": "#E53935",
        "Vehicles": "#D32F2F",
        "Vehicles/Roadster": "#1976D2"
      }
    }
  }
}
```

保存対象はschema version、globalなMap表示mode、Library ID、Folder relative pathと明示色だけとする。Library IDのroot名部分はtrim後にURL encodingし、空名は`unnamed`へfallbackする。大文字小文字は保持し、separatorとcontrol characterを安全にidentityへ含める。GPX内容、TrackPoint、Waypoint、解析geometry、FileHandle、FolderHandle、GPX XML、解析cacheを保存しない。外部通信もしない。

JSON parse failure、invalid color、未知schema version、quota / security errorでは保存値を無視し、path hash fallbackまたはsession内設定でViewerを継続する。破損値を暗黙に上書きせず、次の明示設定操作まで保持しない。localStorage削除時はDefault色へ戻るだけである。

schema検証と正規化はStore内のpure処理としてstorage accessから分離する。初期schema 1にはlegacy migrationを持たず、version 1を検証して読み込み、未知または新しいversionはfail closedで無視する。将来version追加時は旧versionから新versionへの明示migrationとtestを追加する。

schema version 1から将来fieldを追加できるが、前回表示TrackやMap位置はRelease 1.1で保存しない。

Unit 4では`DisplaySettingsStore`をproductionへ実装し、constructor injectionされたstorageを起動時に一度だけ読む。Unit 6ではschema version 1を維持したままtop-levelへ`global.mapMode`を追加する。`global`がない既存payloadは`color`として読み、`color`と`monochrome`以外も`color`へfallbackする。Library entryは引き続き`folderColors`を持つplain objectとし、unknown fieldはschema 1では無視する。配列、`null`、危険key、invalid path / colorを保存状態へ取り込まず、内部dictionaryにはprototypeを持たせない。

色は`#RGB`または`#RRGGBB`だけを受理し、`#RRGGBB`大文字へ正規化する。root Folder pathの`""`は有効とし、nested pathはTree metadataと同じ`/`区切りを使用する。alpha、CSS color name、`rgb()`、control character、backslash、不正separator、`__proto__`、`constructor`、`prototype` segmentを拒否する。

storage未定義、read / JSON parse / write failure、quota / security errorではlocalStorageを切り離し、同じStore instanceのsession memoryで操作を継続する。Storeはstorage内容や例外文字列をConsoleへ出さず、`getStatus()`で`available`または`session-only`を診断可能にする。Unit 5ではFolder行のmode labelへ`Session only`を併記し、保存失敗時もblocking errorなしで現在sessionの色を利用できる。

### Monochrome Map Mode — Unit 6

Map toolbarのnative selectからColor / Monochromeを切り替え、初期値はColorとする。`MapView.setMapDisplayMode(mode)`は`.map-canvas`の`map--monochrome` classとselectのcurrent stateだけを更新し、invalid modeはColorへfallbackする。同一modeはno-opで、Map未初期化でも安全に動作する。

CSS selectorは`.map--monochrome .leaflet-tile-pane img`に限定し、`grayscale(100%) brightness(108%) contrast(82%)`を適用する。overlay paneのTrack Canvas、Marker / shadow pane、tooltip / popup、Leaflet control、attribution、TrailBook UIにはfilterを適用しない。tile provider、URL、OpenStreetMap attributionを変更せず、mode切り替えでtile再生成、Track再描画、Map refocus、`invalidateSize`、zoom / center変更を行わない。

`DisplaySettingsStore.getMapMode()` / `setMapMode(mode)`はLibrary非依存の`global.mapMode`をsession stateとlocalStorageへ保存する。Appが起動時の復元、`map:display-mode-changed` request、Store更新、MapView projectionを調停する。Library切り替えではmodeを変更しない。write failure時も同じStore instanceのsession内設定を維持する。Mobile対応は対象外とする。

Folder色UIは`FolderColorControl`と単一`FolderColorDialog`へ分離する。ControlはMutationObserverでlazy DOMのrender済みFolder行だけを装飾し、TreeView本体を変更しない。Dialog state、validation、storageはTreeViewへ置かず、TreeViewの997行と1,000行規則を維持する。

### Library Identity

Release 1.1では案A「root Folder name + Folder relative path」を採用する。storage scopeはorigin、Library IDはroot Folder nameの完全一致から`root-name:<name>`として作り、各Folder色はrelative pathをkeyとする。

| Candidate | Evaluation |
| --- | --- |
| A. root name + relative path | 追加走査、Handle永続化、ユーザー入力が不要。個人利用向けの最小案として採用 |
| B. root name + structure signature | 既存metadataから計算可能だが、Folder追加・削除でIDが変わり設定を失う |
| C. explicit Library ID | 衝突を避けられるが、初回設定と管理UIが必要 |
| D. random ID | Handleを保存しない条件では再選択時に同じLibraryへ自動対応できない |
| E. origin + root name | localStorage自体がorigin scopedのため案Aより識別力が増えない |

root Folder名を変更すると新Libraryとして扱いDefault色へ戻る。異なる場所の同名root Folderは同じ設定を共有する可能性がある。これは色だけの衝突でGPXを変更せず、個人利用の既知制限として受け入れる。将来必要ならexplicit Library IDへmigrationする。

### Release 1.1 Event Contract

| Event | Producer | Consumer | Payload / Rule |
| --- | --- | --- | --- |
| `gpx:selection-requested` | TreeView | App | `{ path, source }`; sourceは`tree`または`search`。stateを直接変更しない |
| `map:track-clicked` | MapView / LayerManager | App | `{ path }`; 表示中pathだけ |
| `map:background-clicked` | MapView | App | `{}`; selection clear request |
| `selection:changed` | App | TreeView / MapView | `{ path, previousPath, reason }`; SelectionState commit後だけ |
| `map:zoom-ended` | MapView | App | `{ zoom }`; bucket変更時だけrestyle |
| `folder:color-edit-requested` | FolderColorControl | App | `{ folderPath, folderName, origin }`; dialogを開く |
| `folder:color-change-requested` | Folder color dialog | App | `{ folderPath, color }`; valid explicit color |
| `folder:color-default-requested` | Folder color dialog | App | `{ folderPath }`; explicit valueを削除 |
| `map:display-mode-changed` | MapView | App | `{ mode }`; `color`または`monochrome`をStoreへ保存してMapViewへ投影 |

既存`gpx:selected`はUnit 3でrequest / changedを分離する際に置き換える。Search result activateはTreeViewの同じselection requestへ接続し、checkboxは選択を変更しない。既存`gpx:display-toggled`、`folder:display-toggled`、Waypoint、Queue、cache契約は変更しない。

### Release 1.1 Performance Boundary

- zoom eventは`zoomend`だけを使用し、bucket不変なら0件更新とする。
- bucket変更時も`LayerManager.getDisplayedPaths()`に存在するTrackだけを更新する。
- selection変更はprevious / nextの最大2 GPXだけを更新する。
- outlineは選択中GPXだけに生成する。
- Canvas toleranceを使い、初期実装では透明hit layerによる全Polyline倍増を避ける。
- Folder color変更は対象Folder配下だけを再解決し、表示中の該当pathだけをrestyleする。
- style変更ではGPX Parser、GPXDisplayQueue、100件cache、Track Bounds、Waypoint LayerGroup、refocusを変更しない。
- SVG維持案と透明hit layer案はfallbackとし、採用時は806 GPXでlayer数、click、pan / zoomを再評価する。

## Release 1.2 Architecture — Shared Library Settings

Release 1.2はLibrary root直下の`trailbook.json`をLibrary固有設定の共有先とする。Current Releaseは1.2.0であり、Unit 1〜5はCompletedである。

### File Placement and Identity

採用案はLibrary root直下の固定名`trailbook.json`である。隠しFolderや別名は個人利用時の発見性と手動確認を下げるため採用しない。

- fileそのものが、実際に選択したLibrary rootへ紐づく。root名だけで識別しないため、同名Libraryでも別fileなら衝突しない。
- root Folderを改名または移動しても、fileがLibrary root内に残れば設定は付いてくる。
- Folder color keyはrootからの`/`区切りrelative pathとし、rootは空文字`""`とする。
- 子Folderを外部で改名または移動すると旧pathは一致しなくなる。Release 1.2は自動追従せず、存在しないpathをorphan settingとして保持して適用しない。
- 将来TrailBookがFolder操作を実装する場合は、Folder操作と設定path更新を同じ明示操作として設計する。

### Schema Version 1

```json
{
  "schemaVersion": 1,
  "settings": {
    "folderColors": {
      "": "#455A64",
      "bike/crf": "#795548",
      "car": "#7E57C2"
    }
  }
}
```

`settings` envelopeを採用し、Library metadataや将来設定との責務境界を明示する。Release 1.2が読み書きするsettingは`folderColors`だけである。

- JSONはUTF-8、BOMなし、LF、2-space indent、最終改行ありとする。commentは許可しない。
- property順は`schemaVersion`、`settings`、`folderColors`とし、Folder pathはUnicode code point順に安定sortする。root `""`は先頭となる。stable outputは人間のreviewと外部同期diffを小さくするため必要である。
- 色は`#RGB`または`#RRGGBB`を入力時に受理し、保存前に大文字`#RRGGBB`へ正規化する。alpha、CSS color name、`rgb()`は拒否する。
- plain objectだけを受理し、array、`null`、control character、backslash、不正separator、`.` / `..` segment、`__proto__`、`constructor`、`prototype`を拒否する。内部dictionaryはprototypeを持たせない。
- 未知`schemaVersion`、空file、malformed JSON、不正なenvelope、dangerous key、未知のtop-level / settings fieldはfail closedとする。Viewerは継続できるがshared fileを正本として採用せず、通常saveを無効にして暗黙の修復やdata lossを防ぐ。
- 一部のFolder color entryだけが不正な場合はvalid entryをpreviewへ分離できるが、通常saveは停止する。userがfileを修正してReloadするか、内容を確認した明示Overwriteを選ぶまで既存fileを書き換えない。
- 将来schemaはversionを上げ、旧versionからのpure migrationとtestを追加する。同じschema versionに未知fieldを黙って追加しない。

### Shared / Device-local Boundary and Precedence

| Data | Shared `trailbook.json` | Device-local `DisplaySettingsStore` |
| --- | --- | --- |
| Folder colors | Release 1.2の共有対象 | JSON欠落・読込不能時のlegacy fallback / migration source |
| Color / Monochrome | 保存しない | 継続して保存 |
| Map center / zoom、previous / selected Track、sidebar、search query | 保存しない | Release 1.2でも追加しない |
| FileHandle、FolderHandle、GPX / geometry、cache / Queue | 保存しない | 保存しない |

読込優先順位は次とする。

1. validかつsupportedな`trailbook.json`のFolder colors
2. JSONが存在しない、または権限・一時的な同期状態等で読めない場合だけ、現行localStorageのLibrary Folder colors
3. Auto / GPX relative path hash color
4. Configの最終fallback色

valid JSONが存在する場合は、その`folderColors` map全体が共有正本である。JSONが空map、または特定Folder keyがないことは明示色なしを意味し、そのFolderについて古いlocalStorage値を混ぜない。JSONとlocalStorageが異なる場合もJSONを優先する。invalid / unsupported JSONではlegacy localStorageを混ぜずAutoでViewerを継続し、invalid fileを自動上書きしない。

### Unit 2 Read-only Loader Implementation

Unit 2は`LibrarySettingsRepository`、`LibrarySettingsState`、pureな`SharedSettingsSchema`を実装する。write、readwrite permission、save / migration / reload / conflict UIは実装しない。

- Repositoryはroot `FileSystemDirectoryHandle.getFileHandle("trailbook.json", { create: false })`だけを使用し、子Folder探索やLibrary全体の追加scanを行わない。返されたhandleのnameはcase-sensitiveに再確認する。
- file上限は1,048,576 bytesとする。exact bytesを`arrayBuffer()`で一度読み、fatal UTF-8 decode、JSON parse、schema validationを行う。raw text / bytesはStateへ渡さない。
- supported schemaはvalid entryだけを部分採用せず、document全体をfail closedで検証する。orphan relative pathはschema上validとしてsnapshotへ保持し、FolderColorStateへのprojection時だけcurrent Treeに存在するFolderへ限定する。
- SHA-256は読み込んだexact bytesへ`crypto.subtle.digest`を使用する。利用不能または失敗時もvalid shared JSONを採用し、fingerprintを`null`、errorCodeを`fingerprint-unavailable`として将来の競合検出不能を記録する。
- Repository resultは`loaded`、`missing`、`invalid`、`read-failed`を区別する。missing、permission denied、取得 / readの一時失敗だけがlegacy fallbackを許可し、malformed、unsupported schema、invalid structure、oversizeは許可しない。
- `LibrarySettingsState`はsource、status、dirty false、normalized snapshot、fingerprint、lastModified、size、errorCodeを保持する。`beginLoad()`のrequestIdと`App`のLibrary generationを両方確認し、stale resultをState、FolderColorState、Mapへ適用しない。
- Appはshared settings結果を確定してからFolderColorStateとDisplayStateへ色を投影するため、Track表示が旧色で始まってから再parseされることはない。Library切り替えでは旧snapshotと旧explicit colorsを新しいload結果で置き換える。

### Unit 3 Explicit Save Implementation

Unit 3は`LibrarySettingsCoordinator`へLibrary settingsのload / save調停、dirty state投影、stale Library guard、status UI更新を抽出する。AppはFolder color Apply / Default後のdirty通知と、Library選択前の切り替え確認だけを行い、permission、fingerprint比較、writer lifecycleを扱わない。

- `LibrarySettingsPanel`はshared statusと`Libraryへ保存`buttonを提供し、EventBusへ明示save requestだけを発行する。file、State、FolderColorStateを直接操作しない。
- Folder color Apply / Defaultは従来どおり表示とlegacy localStorageへ即時反映し、shared snapshotをdirtyにするだけでfileへ書き込まない。Cancel、selection、zoom、Map mode、Searchはdirtyにしない。
- save request時だけ`queryPermission({ mode: "readwrite" })`を行い、必要な場合だけ同じ明示操作の流れで`requestPermission({ mode: "readwrite" })`を行う。Library openは`mode: "read"`を維持する。
- `LibrarySettingsRepository.save()`はbaselineとcurrent fileのSHA-256 fingerprintを比較し、missing / existingの変化、fingerprint不一致、invalid current file、fingerprint取得不能では書き込みを停止する。
- conflictがない場合だけnormalized snapshotをUTF-8、BOMなし、LF、2-space indent、final newline付きでserializeし、`getFileHandle("trailbook.json", { create: true })`、`createWritable()`、full write、`close()`を行う。
- close後に同じRepositoryで再読込し、expected serialized bytesのSHA-256と一致した場合だけStateを`shared-json` / `loaded` / dirty falseへ更新する。不一致、permission / create / write / close failureではdirtyなsession色を維持し、Viewerを継続する。
- 保存中はLibrary pickerを一時disableする。保存開始前にdirtyなLibraryを切り替える場合はnative confirmで破棄を明示し、自動保存しない。generation / requestIdが変わったstale resultは新Libraryへ適用しない。
- snapshot更新時はcurrent Treeに存在するexplicit colorsを置き換え、既存snapshotのorphan pathを保持する。inherited / Auto resolved color、端末固有Map mode、FileHandle、GPX、geometry、cacheは保存しない。
- fingerprint確認後から`close()`までのexternal write raceは完全には排除できない。post-save verificationで不一致をfailureにできるが、exclusive writer、merge、Overwrite UIはUnit 3の範囲外である。

### Unit 4 Migration, Reload, and Conflict Recovery Implementation

Unit 4はmigration、manual Reload、conflict / invalid JSON recoveryを`LibrarySettingsCoordinator`へ集約し、AppはEventBus bindingと既存Folder色restyle callbackだけを提供する。App、Repository、State、Panel、Dialogの依存方向はUnit 3から変更しない。

- `LibrarySettingsState`は既存source / status / dirty / saveStatusを正本とし、`reloading`、save operation、derivedな`migrationAvailable`を追加する。別の重複Stateは作らない。
- JSON missing、legacy explicit Folder colorsあり、dirty / saving / reloading / conflictでない場合だけmigrationを提示する。migrationはUnit 3のrequire-match saveを再利用し、自動file作成とLibrary open時permission要求を行わない。
- manual ReloadはRepositoryの`load()`を再利用する。dirty時は破棄確認を必要とし、CancelではState、色、fileを変えない。実行時はload resultとlegacy fallback規則をStateへ適用し、dirty / conflict / save errorを解除する。
- Reload projectionはFolderColorStateのold / new explicit path集合だけを既存限定restyleへ渡す。visible Track、selected main / outline、root / inherited / child / Auto色を更新するが、GPX parse、Tree / Search再構築、Map refocus、selection / visibility / Waypoint / Map mode変更を行わない。
- `SettingsConflictDialog`はReload、明示Overwrite、Cancelを提供するnative modal dialogである。Cancelをdefault focusとし、EscapeをCancelとして扱い、close後は接続済みoriginへfocusを戻す。
- 通常saveは`conflictPolicy: "require-match"`を維持する。Dialogの明示Overwriteだけが`"explicit-overwrite"`を使用し、保存直前current fileがloaded / missing / invalidであることを確認してからfull write、close、reload verificationを行う。read failureではOverwriteを停止する。
- invalid / unknown schema fileは通常saveで置き換えない。Folder色編集後にDialogから明示Overwriteした場合だけvalid schemaで置換できる。
- Overwriteのpermission / write / close / verification failure後もdirtyとconflictを維持し、通常saveの再試行でconflict checkを迂回しない。
- valid JSONに含まれるorphan path、またはlegacy snapshot内のorphan pathはStateとsave snapshotへ保持し、Treeへ架空Folderを作らず、自動削除しない。
- 保存・migration・Reload中はLibrary pickerをdisableし、Conflict dialog表示中もLibrary切り替えを停止する。generation mismatchのresultは新Libraryへ適用しない。
- polling、`visibilitychange`、File System Observer、background sync、automatic merge、Import / Exportは実装しない。Google Drive等の同期後は利用者がmanual Reload、Library再選択、page reloadを行う。

### Responsibilities and Dependencies

```text
LibrarySettingsPanel / SettingsConflictDialog
                    │ request / projection
                    ▼
                   App
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
LibrarySettings  FolderColor   DisplaySettings
State            State         Store (device-local)
       ▲
       │ result / snapshot
LibrarySettingsRepository
       │
       ▼
Library root FileSystemDirectoryHandle / trailbook.json
```

- `LibrarySettingsRepository`はroot `FileSystemDirectoryHandle`を入力として`trailbook.json`のread / validation / serialization / permission / write / fingerprint / conflict checkを担当する。DOM、Leaflet、Folder color resolution、localStorageを参照しない。
- `LibrarySettingsState`はcurrent Libraryのvalidated snapshot、source、load fingerprint、dirty data、`loaded` / `local-only` / `unsaved` / `read-only` / `invalid` / `conflict` / `save-failed` statusを保持する。File System APIとUIを参照しない。
- `FolderColorState`はrelative pathによるcolor resolutionとsession projectionを維持し、RepositoryやFile System APIの詳細を知らない。
- `DisplaySettingsStore`はglobal Map modeなど端末固有設定と、Release 1.2移行期間のlegacy Folder color fallbackだけを扱う。shared settingsの正本にならない。
- `LibrarySettingsCoordinator`がLibrary load、fallback選択、explicit save / migration / Reload / Overwrite、State更新、FolderColorStateへのprojection、stale guardを調停する。
- `LibrarySettingsPanel`は状態とsave / migration / Reload requestを表示し、fileを直接操作しない。`SettingsConflictDialog`はReload / Overwrite / Cancel requestとfocus lifecycleだけを担当する。
- 依存方向はAppから各Service / State / UIへ、Repositoryからpure schema helperへ向ける。RepositoryからApp / UI / FolderColorStateへの逆参照と循環参照を禁止する。

### Read, Permission, and Explicit Save Flow

Library pickerは`showDirectoryPicker({ mode: "read" })`を維持する。Folder openだけでreadwrite permissionを求めない。

1. Library scan成功後、Repositoryがrootから`trailbook.json`をread-onlyで探して読み、schemaとfingerprintを返す。
2. Folder color Applyはsessionとdevice-local fallbackへ反映し、shared stateをdirtyにする。file writeとpermission promptは行わない。
3. userが`Libraryへ保存`を実行した時だけ`queryPermission({ mode: "readwrite" })`を確認し、`prompt`ならそのuser activation内で`requestPermission({ mode: "readwrite" })`を呼ぶ。
4. `denied`またはAPI / provider failureでもViewerを停止せず、local / session状態を維持してRetryを可能にする。permissionがbrowser session間で保持されると仮定せず、保存ごとに確認する。
5. save中は同じApp instanceの多重saveを直列化する。保存成功を確認するまでdirty状態を解除しない。

この方式はreadwrite pickerを初回から要求する案、Applyごとの即時保存、debounce autosave、Library switch時の暗黙保存を採用しない。明示保存はpermission promptとGoogle Drive等へのwrite回数を抑え、保存失敗を利用者へ説明できる。

### Minimum Safe Write and Conflict Policy

読込時にfileのexact byte contentからSHA-256を求め、`lastModified`とsizeを併記したfingerprintを保持する。保存直前にfileの有無と内容を再読込し、読込時fingerprintと異なる、または当初missingだったfileが作成されている場合はconflictとして保存を停止する。`lastModified`だけには依存しない。

競合時はReload / 明示Overwrite / Cancelを提示し、自動mergeと無条件last-write-winsを行わない。Overwriteはcurrent external contentを表示上確認した後の別の明示操作とする。

競合がない場合だけ`getFileHandle("trailbook.json", { create: true })`、`createWritable()`、full documentの`write()`、`close()`を実行する。`createWritable`が使用するbrowser側のtemporary swapとclose commitを利用し、Release 1.2では独自`.tmp` / `.bak` / renameを追加しない。write / close / quota / permission / provider failure時は可能ならwriterをabortし、dirtyなsession / localStorage fallbackを保持する。close後は再読込して内容を検証し、一致した場合だけsavedとする。

この最小策でも、fingerprint確認後からcloseまでの外部write、provider固有の同期遅延、browser crash時の挙動を完全には排除できない。exclusive writer対応、backup、field単位merge、transaction journalは将来強化候補とする。

### Migration, Reload, and External Sync

- JSONがなくlegacy localStorage色がある場合、非blocking statusと`現在の色設定をLibraryへ保存`を表示する。自動作成、自動移行、起動ごとのmodal promptは行わない。
- migration buttonは保存対象件数と作成file名を示し、同じ明示save flowを使う。成功後はJSONが正本となる。Release 1.2ではlocalStorage値をfallbackとして保持し、削除しない。
- JSONが既にある場合はlocalStorageで上書きせず、migrationを提案しない。全entryのdiff previewは必須にせず、件数とsourceを表示する。
- Library open / reselection / page reloadで毎回読む。`設定を再読み込み`はexternal sync後の反映手段とする。dirty時のReloadとLibrary switchはSave / local fallbackへ残してDiscard / Cancelを選ばせる。
- polling、`visibilitychange`自動reload、File System Observer、background syncはRelease 1.2では行わない。

Google Drive / OneDrive同期Folderでも`trailbook.json`を通常fileとして扱う。TrailBookはcloud API、sync status、provider metadataを利用せず、offline時は端末上の最新同期済みcopyを読む。別端末の変更はproviderの同期完了後にmanual reloadまたはLibrary再選択で反映する。同時編集と同期遅延は競合し得る。

### Import / Export Boundary

Release 1.2の必須scopeはsupported Chrome / EdgeでのLibrary file read / explicit writeである。Import / ExportはFile System Access API非対応環境、backup、手動共有に有用だが、保存先選択、session/localのsource、conflict UXを増やすためFuture Candidateとする。API非対応環境ではRelease 1.2も現在のlocalStorage / session Viewerを継続し、shared fileを自動生成しない。

### Data Protection Principle

TrailBookは、ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。Release 1.2のwrite boundaryはLibrary rootの`trailbook.json`だけであり、GPXへ`createWritable`を使わない。将来のGPX編集も通常閲覧から分離し、明示保存、競合確認、保存失敗処理を備えるまで実装しない。

### Release 1.2 Completion Boundary

- Repository → State → Coordinator → Panel / Dialogの責務と依存方向をCurrent Architectureとして維持する。
- Library openとmanual Reloadはread-onlyで、明示Save / Migration / OverwriteだけがRepositoryのwrite flowへ到達する。
- `DisplaySettingsStore` schema version 1はdevice-local Map modeとlegacy Folder color fallbackを保持し、valid shared JSONへ項目単位で混ぜない。
- shared settings schema version 1が保存するLibrary設定はFolder colorsだけである。
- Google Drive等は通常の同期Folderとして扱い、cloud API、provider metadata、sync status、polling、background syncを扱わない。
- Release 1.2ではGPX writer / editor、Folder rename / move、Import / Export、automatic mergeを実装しない。

File System Access APIのpermissionとwrite lifecycleは[Chrome File System Access documentation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)、[File System Access specification](https://wicg.github.io/file-system-access/)、[MDN `createWritable()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)を設計根拠とする。

## Architecture Principles

- Single Responsibility
- Low Coupling / High Cohesion
- Composition over Inheritance
- Event Driven
- Path-based identity for Library presentation
- Explicit session state
- Bounded asynchronous work
- GPX First / Folder is Database

## Golden Rules

- `docs/`を設計の正本とする。
- GPXを唯一のデータ正本とし、Folder構造をLibraryとして扱う。
- ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。
- Frameworkを追加しない。
- LayerとClassの責務分離を守る。
- UIは永続データを持たない。
- Modelは画面とLeafletを知らない。
- ServiceはUIを知らない。
- Utilityは状態を持たない。
- MapViewはGPXを解析しない。
- UI同士を直接接続しない。
- GPXを暗黙に変更しない。
- 将来機能のために現在のRelease範囲を広げない。
- 一つのReleaseで責務が大きくなる場合は、小さいReleaseへ分割する。
