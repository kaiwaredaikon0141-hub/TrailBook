# ARCHITECTURE.md

Version: 1.3 Completed
Status: Official
Baseline: Release 1.3.0
Current: Release 1.3 Previous View Restoration Completed
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

Release 1.2はLibrary root直下の`trailbook.json`をLibrary固有設定の共有先とした。Release 1.2 completion時点でUnit 1〜5はCompletedである。

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

## Release 1.3 Architecture — Previous View Restoration

Status: Completed。Current Releaseは1.3.0であり、Unit 1〜7はCompletedである。

### Data Boundary

previous view stateはLibrary内容ではなく、同じbrowser origin上の端末ごとの作業状態である。`trailbook.json`、GPX、Folderへは書き込まず、専用storage key `trailbook.viewState`の`localStorage`へ保存する。

| Data | Shared `trailbook.json` | `trailbook.uiSettings` | Proposed `trailbook.viewState` |
| --- | --- | --- | --- |
| Folder colors | 正本 | legacy fallback | 保存しない |
| Color / Monochrome | 保存しない | global設定 | 保存しない |
| Map center / zoom | 保存しない | 保存しない | Library単位 |
| visible / selected Track | 保存しない | 保存しない | Library単位、relative path |
| sidebar open / closed | 保存しない | 保存しない | Library単位 |
| sidebar width、Search / Tree navigation | 保存しない | 保存しない | Release 1.3では保存しない |
| last DirectoryHandle | 保存しない | 保存しない | IndexedDBへ前回Library再開用として保存 |
| GPX XML、Leaflet Layer、Queue | 保存しない | 保存しない | 保存しない |
| parsed geometry | 保存しない | 保存しない | 5秒性能gate不達により再生成可能なIndexedDB cacheを採用 |

既存`DisplaySettingsStore` schema version 1をversion 2へ上げる案は採用しない。Map mode / legacy Folder colorとLibrary view lifecycleを同じdocumentへ結合し、既存schema migration、unknown-version failure範囲、test matrixを不要に広げるためである。専用Storeはschema version 1から開始するので、Release 1.3にschema 1からのdata migrationはない。既存key、schema、保存値をそのまま維持する。

### Proposed Schema Version 1

```json
{
  "version": 1,
  "libraries": {
    "root-name:GPXLog": {
      "map": {
        "lat": 35.0123,
        "lng": 135.6789,
        "zoom": 11
      },
      "visibleTracks": [
        "car/2026-07-01.gpx",
        "crf/2026-07-12.gpx"
      ],
      "selectedTrack": "car/2026-07-01.gpx",
      "sidebar": {
        "open": true
      }
    }
  }
}
```

- top-levelは`version`と`libraries`だけを受理し、plain object、prototype-free dictionary、dangerous key拒否を維持する。unknown Library state fieldはUnit 2では無視し、normalized snapshotと次回stable serializationへ保持しない。
- unknown schema、malformed JSON、不正top-level、設定した最大serialized size超過はStore全体をfail closedとする。raw valueを自動修復・自動上書きせず、同一sessionではmemory fallbackを使う。
- recognized schemaのLibrary entryはfield単位で検証する。invalid MapはMapだけ、invalid sidebarはsidebarだけ、invalid selected Trackはselectionだけをdefaultへ戻す。`visibleTracks`内に構文上invalidなpathが一つでもあればlist全体を採用しない。
- root-relative GPX pathは`/`区切り、case-sensitive、非emptyとし、absolute path、backslash、control character、empty / `.` / `..` segment、dangerous keyを拒否する。duplicateは最初の出現を残して除去する。
- current Tree metadataに存在しないstale pathはrestore時に無視する。保存documentは単なる候補であり、架空Tree nodeを作らない。利用者の次の明示的なview変更まで自動cleanupしない。
- Mapはfinite number、latitude -90〜90、longitude -180〜180、zoomはcurrent Leaflet Mapのmin / max範囲で検証する。invalidまたはmissingなら既存default / fitBoundsを使う。
- `selectedTrack`はvalid pathでもresolved visible targetに含まれなければ復元しない。
- `sidebar.open`はbooleanだけを受理し、invalid / missingはopenをdefaultとする。widthはschemaへ含めない。
- raw documentは1,048,576 bytes、raw `visibleTracks`は5,000件をdefensive capとする。current metadata解決後のtarget数はcurrent GPX件数を超えない。Unit 2はfieldを安全に保持するだけで、visible / selected Trackのsave / restoreを行わない。

### Library Identity

Release 1.3は`ViewStateStore`用に既存`createLibraryId(rootFolderName)`の`root-name:<encoded root folder name>`を継続する。identity生成はpure helperへ集約し、`DisplaySettingsStore`と`ViewStateStore`が同じ規則を利用するが、Store同士は参照しない。前回Library用IndexedDB recordのopaque ID / cache namespaceはHandleとcacheの内部識別に限定し、shared Library identityまたはlocalStorage keyを置き換えない。

比較結果:

| Candidate | Result | Reason |
| --- | --- | --- |
| A. existing root-name | 採用 | scan追加なし、Library移動後も同名なら復元、既存運用と一致 |
| B. FolderHandle由来ID | View State keyには不採用 | `isSameEntry()`はhandle同士の同一性確認に使用するが、localStorage用の安定IDを返さない。Handle自体はprevious Library用IndexedDB recordへ保存予定 |
| C. root構造fingerprint | 不採用 | rename / move / file増減で変わり、全内容hashは特に高コスト。GPX内容hashは行わない |
| D. user alias | Future | 衝突回避には有効だが、UI、rename、shared metadataとの意味付けがRelease 1.3を越える |

同名root FolderはView State上で衝突し、root名変更時は別Libraryになる。この制限をUI / test / known limitationへ明記し、current Libraryのview stateだけを消すResetを回復経路とする。HandleをlocalStorageまたは`trailbook.json`へ保存しない。最後に正常に開いたDirectoryHandleとcache専用opaque namespaceはprevious Library用IndexedDBへ保存し、`isSameEntry()`で手動選択handleとの同一性を確認できる。[File System Access specification](https://wicg.github.io/file-system-access/)が定義するhandle serializationと`isSameEntry()`は、sharedまたはlocalStorage用の安定文字列identifierとは別の契約である。

### Responsibilities and Dependencies

`ViewStateSchema`:

- JSON shape、normalization、validation、duplicate除去を行うstate-free pure module
- DOM、EventBus、App state、Leaflet、File System Access API、storageへ依存しない

`ViewStateStore`:

- `localStorage` read / write / current-Library delete、schema dispatch、session memory fallback
- raw dataをConsoleへ出さず、storage failureを一度だけ診断可能にする
- Library identityの利用者だが、FileHandleを保持または永続化しない

`ViewStateCoordinator`:

- EventBusとLibrary lifecycleを購読し、一つのdebounce timer / save queueでsnapshotをcoalesceする
- restore generation、pending target、restore中のfield別user override、refocus抑止、restore完了を管理する
- `DisplayState`、`SelectionState`、Map / Sidebar UIの正本を置き換えず、callbackとEventBusを通じて既存処理へ接続する

`PreviousLibraryStore` / `PreviousLibraryCoordinator`:

- IndexedDBのversioned object storeへ最後に正常に開いた`FileSystemDirectoryHandle`とgeometry cache専用のopaque namespaceを保存し、localStorageとshared settingsを参照しない。namespaceはshared identityやlocalStorage keyへ流用しない
- 起動時は`queryPermission({ mode: "read" })`だけを行い、`granted`なら既存Library load callbackへ接続する。`prompt` / `denied`では自動promptを出さず、利用者gestureによる`requestPermission({ mode: "read" })`と手動pickerを維持する
- IndexedDB unavailable / corrupt、stale / missing handle、permission failureをnon-fatalにし、AppへIndexedDB transaction、permission分岐、cache policyを直接追加しない
- originのscheme / host / port変更、site data削除、private browsing終了ではrecordを共有または保証しない

`GeometryCacheRepository` / `GPXGeometryLoader`:

- 約807 Trackの既存再parse中央値25秒によりUnit 5の約5秒gateが不達となったため実装し、Library cache namespace + relative pathをentry keyとする
- parser / cache schema version、`File.size`、`File.lastModified`が一致するplain parsed DTOだけを返す。Leaflet Layer、GPX XML、FileHandle、Queue状態をentryへ含めない
- miss / stale / invalid / quota / transaction failureは既存`GPXDisplayQueue`のload / parseへfallbackする。cache hitとfallbackを同じpathへ二重enqueueまたは二重renderしない
- cacheは削除可能・再生成可能であり、Folder構造、GPX、`trailbook.json`の正本性を変更しない

HandleのIndexedDB保存とpermission lifecycleは[Chrome File System Access documentation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)、[File System Access specification](https://wicg.github.io/file-system-access/)、[MDN `queryPermission()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission)を根拠とする。origin分離は[MDN IndexedDB terminology](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology)、source validationは[MDN `getFile()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/getFile)と[MDN `File.lastModified`](https://developer.mozilla.org/en-US/docs/Web/API/File/lastModified)を参照する。

`ViewStateControls`:

- 現行TreeViewの`aside`を開閉するToolbarのdesktop専用toggle、`aria-controls`、`aria-pressed`、focus維持とdevice-local Reset panelを担当する
- width、drawer、touch layoutを持たない。TreeView.jsは997行のためsidebar責務を追加しない
- layout変更後にMapViewへsize再評価を要求する

`MapView`:

- `getViewState()`、`isValidViewState()`、validation済みstateをanimationなしで一回投影する`setViewState()`、sidebar layout後の`invalidateSize()`を提供する
- Leaflet `moveend`後にcenter / zoom snapshot eventを発行し、既存`zoomend`のTrack style eventと責務を混ぜない

`DisplayState`はchecked / loading / loaded / errorとLibrary generationのruntime source of truth、`SelectionState`は単一selectionのsource of truth、`GPXDisplayQueue`は最大2件並列の唯一のparse Queueを維持する。専用`RestoreQueue`は作らない。AppはCoordinator生成とLibrary lifecycle callbackの接続だけを行い、schema、debounce、restore順序を直接持たない。Unit 2完了時のAppは995行、TreeViewは997行である。

依存方向は`App → ViewStateCoordinator → ViewStateStore / ViewStateSchema`、`App → MapView / ViewStateControls / DisplayState / SelectionState / GPXDisplayQueue`とする。Store / SchemaからApp、UI、runtime Stateへの逆参照を禁止する。Library identityはstate-freeな`LibraryIdentity`へ抽出し、DisplaySettingsStoreとViewStateStoreの重複実装を避ける。path hash colorもstate-freeな`PathColor`へ抽出してAppの純粋計算責務を減らす。

### Unit 2 Implementation

- Configはstorage key `trailbook.viewState`、schema version 1、debounce 750ms、visibleTracks 5,000件、serialized document 1,048,576 bytes、zoom 0〜19を定義する。Config versionは1.2.0のまま変更しない。
- `ViewStateStore`はread / normalized write / current Library delete、stable Library key ordering、unknown / malformed / oversize fail closed、quota / security failure時のsession memory fallbackを担当する。invalid raw storageを自動上書きしない。
- `ViewStateCoordinator`はMap moveendとSidebar toggleを一つの750ms timerへcoalesceし、write時に最新のMap / sidebar runtime snapshotを取得する。Library picker確定後、generation変更前にold Library pending stateをflushする。
- Library loadではshared settingsとTree / DisplayState初期化後にSidebar、Map layout、Map center / zoomの順で復元する。Map restore / silent reset / invalidateSizeのprogrammatic moveendは保存しない。
- `ViewStateControls`はToolbarの「サイドバー」buttonと独立したDevice-local view panelを提供する。sidebar closeはDOM stateを破棄せず、workspaceを1 columnへ変更してMap sizeを再評価する。
- Resetはconfirmation後にcurrent Library entryだけを削除し、runtime Map / sidebar、Map mode、Folder colors、shared JSON、GPX、他Library stateを維持する。programmatic eventでは再保存せず、次のuser Map / sidebar操作で保存を再開する。
- Unit 2はexisting `visibleTracks` / `selectedTrack` fieldをnormalized snapshot内で保持するが、値の収集・復元は行わない。

### Unit 3 Visible Track Restoration Implementation

- `DisplayState.getCheckedPaths()`がcurrent Libraryの表示意図をrelative pathのstable listとして返し、`ViewStateCoordinator`がMap / sidebarと同じfull snapshotへ保存する。別のvisibility stateを作らない。
- individual / Search checkbox、Folder / root bulk、Clearの既存Eventを共通750ms timerへ接続する。bulk内部の各pathではなく、操作完了後の最新`DisplayState.checked`を原則一回だけ書く。
- restore時はschemaで正規化済み`visibleTracks`をcurrent `DisplayState`へ解決し、missing / stale pathを無視して、既存`gpx:display-toggled`経路から既存`GPXDisplayQueue`へ投入する。checked済みpathとduplicate pathを再投入しない。
- `GPXDisplayQueue.whenIdle()`は既存concurrency 2とFIFOを変更せず、queue / active requestがすべてterminalになった時だけ復元完了を通知する。専用RestoreQueue、件数limit、duplicate parser / Layerを追加しない。
- restore中はView State saveと自動refocusを抑止し、全target terminal後にsaved Mapをanimationなしで一回投影する。restore中のuser Map / sidebar / visibility操作はruntimeを優先し、完了後に最新snapshotをdebounce保存する。
- selected Trackの収集・復元、progress UI、chunked enqueueはUnit 3で実装しない。AppはCoordinatorへのruntime依存注入と既存UI projectionの接続だけを行い、999行を維持する。

### Release 1.3 Additional Restoration Plan

- Unit 3は少数Trackと807 visible TrackのBrowser Acceptanceを完了した。stale path、Map center / zoom、Sidebar、duplicate表示、UI応答性、data protectionに問題はなく、復元速度は通常のcold表示とほぼ同等だった。約5秒warm restoreはUnit 5の別Performance Gateとし、Unit 3へprogress UIを追加しない。
- Unit 4は`PreviousLibraryStore` / Coordinator、permission UX、自動 / 手動open、stale handle recoveryのImplementation / Static TestとChrome / Edge Browser Acceptanceを完了した。
- Unit 5の既存再parse方式は24秒、25秒、25秒、中央値25秒で約5秒gateに不達だった。geometry cache導入後は3秒、3秒、3秒、中央値3秒となり、約8倍高速化してgateをPassした。UI停止、pan / zoom、duplicate表示、Console errorはない。
- Unit 6でselected Track restoreと残るlifecycle / Reset統合、Unit 7でChrome / Edgeの既存受け入れ結果、warm restore、origin制限、data protection、finalizationを統合確認した。

### Unit 4 Previous Library Restore Implementation

- `PreviousLibraryStore`はversioned IndexedDB `trailbook.runtime`の`previousLibrary` object storeへ、固定key `last`で最後に正常に開いたDirectoryHandleとopaque cache namespaceをstructured cloneする。既存Handle-only recordはnamespaceをbest effortで補い、storage unavailable / blocked / corrupt / clone failureはnon-fatalである。

### Unit 5 Geometry Cache Implementation

- `GeometryCacheRepository`は別DB `trailbook.geometryCache` version 1の`entries` object storeを使用する。keyはprevious Libraryのopaque namespaceとrelative GPX pathの組である。
- recordはcache schema 1、parser schema 1、`File.size`、`File.lastModified`、Track segmentのlatitude / longitude、Waypointのlatitude / longitudeだけを保持する。metadata、name、time、elevation、warning、GPX XML、FileHandle、Leaflet Layer、Queue状態を保持しない。
- `GPXGeometryLoader`は`getFile()`でsource identityを取得し、valid cache hitなら`File.text()`と`GPXParser.parse()`を省略する。miss / stale / corrupt / schema mismatch / IndexedDB / quota failureは同じ既存Queue request内で通常parseし、成功geometryをbest effortでcacheへ書く。
- 同一namespace / pathの同時loadは一つのinflight Promiseへ統合する。AppはRepository詳細を扱わず、Library namespaceの設定と既存Queue `run`のLoader呼び出しだけを配線する。

### Unit 6 Selected Track Restore Implementation

- `ViewStateCoordinator`はfull snapshot保存時に`SelectionState.getSelectedPath()`を`selectedTrack`へ保存し、selection eventもMap / sidebar / visibilityと同じ750ms save queueへ統合する。Library切り替え前のflush後に行うruntime selection clearはold snapshotを消さない。
- restoreはvisible targetのQueueがidleになりsaved Mapを投影した後、saved pathがcurrent metadataに存在し、saved visible listに含まれ、`DisplayState`でchecked / loaded、Map layerが存在する場合だけ`SelectionState.select(path, "system")`を一回実行する。
- stale、invisible、load error、Layer不在はselectionなしとする。restore中に利用者がselectionを変更した場合は利用者状態を優先し、saved selectionを投影しない。
- `selection:changed`はreason `view-state-restore`で既存Tree / Search / Map projectionへ接続する。Treeはancestorだけを展開し、focus / scrollを移動せず、Map refocus / pan / zoom / fitを行わない。highlight / outline / `aria-current`は通常selectionと同じ経路を使う。
- visible Trackが通常parseまたはGeometry Cacheのどちらでloadedになったかを区別せず、同じterminal state条件を使用する。Reset、Library generation、Previous Library lifecycle、GPX / `trailbook.json`非書き込み契約を変更しない。
- `PreviousLibraryCoordinator`はsupport判定、manual picker、Folder scan、Library generation、read permission、last Handle更新を担当する。Appから既存picker / scan lifecycleを抽出し、AppはCoordinator生成と既存`handleLibraryLoaded()` callbackだけを提供する。
- startupは保存Handleへ`queryPermission({ mode: "read" })`だけを行う。`granted`なら既存Library lifecycleへ自動接続し、`prompt`では`前回のライブラリを開く`を表示する。`requestPermission({ mode: "read" })`はそのnative buttonの明示操作時だけ行い、`denied`は通常Library openへfallbackする。Library panelはHandle保存可否とpermissionを値やpathを含まない補助statusで表示する。
- manual picker成功後、scan、shared settings、Tree / Search、DisplayState登録までcurrent generationで正常完了した場合だけlast Handleを更新する。Map / Sidebar / visible Trackは同じ`ViewStateCoordinator.restoreLibrary()`を通る。
- `NotFoundError`のstale Handleはrecordを破棄する。IndexedDB failure、permission deny、その他read failureではViewerを停止せず、通常pickerを維持する。一時的provider failureをstaleと推測して自動削除しない。
- HandleをlocalStorage / `trailbook.json` / Consoleへ保存または出力せず、GPXとshared JSONへ書き込まない。Appは914行、TreeViewは997行である。

### Save Timing

- Mapは`moveend`でfinal center / zoomを取得し、pan / zoom中は書かない。`zoomend`と二重保存しない。
- individual / Search checkbox、Folder / root bulk、Clearの既存処理完了後に`DisplayState.checked`のpath集合をsnapshotとする。bulk内部のpath件数だけwriteしない。
- Unit 3はMap moveend、sidebar toggle、individual / Search checkbox、Folder / root bulk、Clearを同じ750ms debounce queueへ送る。selectionはUnit 6で接続する。
- 一つのLibraryに対するpending saveは常に最新full snapshot一件へ置換し、partial patchと複数timerを作らない。
- restore投影中はsaveをsuspendし、完了直後のprogrammatic Map / selection / sidebar eventで保存値を書き戻さない。
- Library switch前にold Libraryのpending snapshotを同期flushし、active identity変更後にold timerがnew Libraryへ書かないようgenerationを確認する。
- unloadだけを保存契機にせず、background interval、GPX parse完了ごとのwrite、`trailbook.json` writeを行わない。

### Restore Order and User Precedence

1. userがLibraryを選択し、Folder scanとTree path metadataを構築する。
2. shared settingsを既存順序で読み、Folder colorsを投影し、DisplayStateへ全fileをregisterする。
3. dedicated Storeからcurrent Library候補を読み、current metadataに存在するGPX pathだけへ解決する。
4. sidebar open / closedを投影してlayoutを確定し、Map sizeを再評価する。
5. resolved visible Trackを既存display toggle / `DisplayState` / `GPXDisplayQueue`経路へ一回だけ投入する。restore中の自動`fitBounds` / refocusは抑止する。
6. 全targetがloaded / error / cancelledへ確定した後、saved Mapをanimationなしで一回復元する。saved Mapがない場合はloaded Track bounds、TrackがなければConfig defaultを使用する。
7. saved selected Trackがchecked、loaded、Map layer存在の条件を満たす時だけ`SelectionState.select(path, "system")`を行う。
8. selected Tree ancestorはrevealしてよいが、focus、scrollIntoView、Map refocus / panを行わない。Search query / result focusは変更しない。
9. restore suspensionを解除し、Tree / Search / Map highlight / ARIAを既存projectionで同期する。

restore中にuserがMapを操作した場合は後続saved Map投影をskipし、selectionまたはsidebarを操作した場合も該当fieldのsaved投影をskipする。visible checkboxは開始時に全targetを既存Queueへ投入するため、その後のOFF / ClearがrequestId invalidationで優先される。Library切り替えはrestore generationをinvalidateし、old async resultを新Libraryへ適用しない。

### Performance and Failure Boundary

- 既存Queue concurrency 2、cache上限100、session parser、LayerManager path entryを変更しない。806件すべてをwarmとみなさない。
- 0 / 1 / 50 / 200 / 806 visible Trackでsave document size、enqueue時間、操作可能になるまで、全restore完了、pan / zoomを確認する。Waypointは初期OFFを維持し、大量Markerの既知制限を別評価する。
- 初期案は既存root bulk pipeline相当の一括enqueueである。UI blockまたは重大回帰が実測された場合だけ、20〜50件等の値を計測して既存Queueへのchunked enqueue / progressを採用する。別parse Queue、duplicate parse / render、Unit 1での恣意的200件limitは採用しない。
- malformed / unknown / oversize store、quota / SecurityErrorではViewerを継続し、defaultまたはsession memoryを使用する。raw JSON、Library path、GPX内容をConsoleへ出さず、同じfailureを反復warningしない。
- stale / invalid pathは無視し、Track load failureは既存error状態へ投影して他targetを継続する。failed / missing Trackをselectedにしない。
- Resetはcurrent Library entryだけをconfirmation後に削除する。Map mode、Folder colors、shared JSON、GPX、他Library stateを削除せず、現在表示は維持する。Reset直後は次の明示的なview変更まで自動再保存を抑止する。

## Release 1.4 Architecture Plan — Library Browsing / Track Discovery

Status: Completed。Unit 1〜6のArchitecture、Implementation、Browser Acceptance、performance、data protection、finalizationを完了した。broken internal Track name fallbackはAcceptedである。

### Responsibility Split

Release 1.4はexisting Folder TreeをLibrary構造のprojectionとして維持し、Date Tree、Track Info、advanced Search / Filterを同じDiscovery Indexの別projectionとして追加する。実Folder / GPX、`trailbook.json`、DisplayStateへDiscovery分類を書き戻さない。

Planned components:

- `TrackDiscoveryEntry` Model: 1 GPX pathのimmutable summary。DOM、FileHandle、Leaflet Layerを持たない
- `TrackSummaryBuilder` Service: 1回のparser resultとFile metadataからdate source、Track名、distance、point / time / elevation summaryをpure計算する
- `LibraryDiscoveryIndexService`: current Libraryのpath-keyed summary、build lifecycle、将来のTrack name / Folder / date range query基盤を管理する
- shared derived-data loader / repository: Geometry Cacheのsource validationとinflight deduplicationを再利用し、geometryとsummaryを同一parseから生成する
- `TrackDiscoveryCoordinator`: explicit index build、cancel、generation guard、selection projection、UI statusを調停する
- `DateTreeView`: virtual year / month / day hierarchyのlazy DOMとGPX path操作を担当する
- `TrackInfoView`: selected GPX summaryをread-only表示する
- `SidebarResizeHandle`: desktopのSidebar / Map境界resize、separator ARIA、width projectionだけを担当する
- `TrackInfoResizeHandle`: desktopのTrack list / Track Info境界resize、separator ARIA、height projectionだけを担当する
- `DiscoveryFilterService`: NFKC / case-insensitive textとinclusive local date rangeをpureに評価し、total countと最大100件の結果を返す
- 限定的な`SearchView`拡張: text、From / To、Clear、index status、既存result activate / checkbox / keyboard / ARIAを担当する
- `FolderTreeFilterProjection`: matching GPXと祖先FolderだけをTreeViewのlazy DOMへ投影し、TreeView metadata / expansion / selection / visibility stateは所有しない

依存方向はUI → Coordinator event contract → Index / Loader / Modelとする。`TrackDiscoveryEntry`とsummary builderはUI、EventBus、Map、File System Handleを参照しない。CoordinatorはAppの新しい大規模責務にせず、Appは生成と既存Event接続だけを行う。`TreeView.js`へDate hierarchy、Track Info、filter責務を追加しない。

### Shared Parse and Derived Cache

Release 1.3 `GeometryCacheRepository`は描画座標だけを保持し、cache hitではGPX metadata、Track名、time、elevation summaryを返せない。Release 1.4はcache schemaを明示的に更新し、compact discovery summaryをgeometryと同じderived recordへ追加する。

- source identityはLibrary opaque namespace + relative path + `File.size` + `File.lastModified` + parser / cache schemaを維持する
- cache miss時はGPX Parser resultからgeometryとsummaryを同時生成し、1 path 1 inflight promiseで表示要求とindex要求をdeduplicateする
- summary-only readはgeometry / TrackPoint配列をIndex memoryへcopyしない
- old schema、missing / corrupt summary、quota / IndexedDB failureは該当GPXだけ通常parseへfallbackする
- cold indexで得たgeometryは後続Map表示にも利用可能とし、同一GPXをindex用とdisplay用に二重parseしない
- GPX XML、Leaflet Layer、DisplayState、Queue状態はIndexedDBへ保存しない

Discovery IndexはLibrary session stateであり、Library切り替え時にclearする。derived cacheだけがorigin-localに残り、Folder / GPXの正本を置き換えない。Display session cache上限100とDiscovery summary件数は別責務であり、summaryは1 GPX 1件のcompact dataへ限定する。

### Date and Metrics Contract

date source priorityはDecision 0025を具体化し、valid `metadata.time`、document順の最初のvalid TrackPoint time、`File.lastModified`、厳密に解析可能なoriginal filenameの順とする。runtime `recordedAt`はDate、cache representationはvalidated ISO stringとsource enum、Date Tree keyはbrowser local calendarの`YYYY-MM-DD`とする。invalid / missingは`Unknown Date`へ置く。

distanceは各Segment内の隣接pointだけをHaversine計算し、Segment間を接続しない。point countは全valid TrackPoint、start / endは全valid point timeの最小 / 最大、durationは両方があり非負の場合だけ算出する。elevationはvalid値のmin / maxだけをRelease 1.4 Scopeとする。複数Trackを含むGPXもrelative path単位で集計し、個別Track selectionへ変えない。

### Existing Contract Protection

- Date Tree GPX activateは既存primary selection、表示中Track refocus、非表示TrackのMap不変契約を再利用する
- Date Tree individual checkboxは既存`gpx:display-toggled`相当のpath / FileHandle解決をCoordinator経由で使用し、selectionを変更しない
- Library openと空Searchはindex buildを開始しない。textまたはdate filterの明示入力でだけ1回indexを準備し、その後はmemory queryだけを行う
- textはdisplay / Track nameまたはrelative Folder path、date rangeはlocal calendarのinclusive From / Toを対象とし、複数条件はANDとする
- index buildはDisplayState.checked、SelectionState、Map、Folder expanded pathsを変更しない
- selected Track InfoのloadはMap pan / zoom / fit、visibility、selectionを変更しない
- generation変更、cancel、partial parse failureで旧Library entryを投影しない

### Unit 2 Index Foundation Implementation

- `TrackDiscoveryEntry`はrelative path、Folder path、display / Track name、resolved date / source、point / time / distance / elevation summary、File identity、ready / error statusだけをimmutableに保持する
- `TrackSummaryBuilder`はparser resultを一回走査し、Segment境界を跨がないHaversine distance、valid point timeのmin / max、duration、elevation min / maxを計算する
- `GPXGeometryLoader.load()`と`loadSummary()`はnamespace + pathの同じinflight bundleを共有し、同時要求でもXML read / parse / cache writeを一回にする
- `GeometryCacheRepository` schema version 2はdrawing geometryとserialized compact summaryを同じsource identityで検証する。GPX XML、Leaflet Layer、Queue状態は保存しない
- `LibraryDiscoveryIndexService.setLibrary()`はpath / FileHandle sourceだけを準備し、明示`build()`までFile readを行わない。buildはconcurrency 2、duplicate path排除、partial error fallback、progress、cancel、generation guardを持つ
- parse failureでもpathと取得可能なFile metadataからerror status entryを生成し、1 GPX 1 entryとViewer継続を維持する
- Unit 2ではApp、TreeView、Date Tree、Track Info、Search / Filterへ接続しない。Index Serviceが`main.js` graphへ未接続なのはUnit 3以降のUI開始前の意図した状態である
- Unit 2 Browser Acceptanceでは約806 GPXのcold build中央値21秒、warm build中央値3秒を確認した。coldは初回buildの非blocking結果として許容し、valid cached summaryを使うwarm buildは約5秒目標をPassした。cache hit時のduplicate parse、UI block、pan / zoom、Cancel、Library切り替え、data protectionに回帰はない

### Unit 3 Date Tree Implementation

- `DateTreeBuilder`はDiscovery entry参照を年 / 月 / 日へlocal calendarでgroup化し、年・月・日は新しい順、同日Trackはresolved date降順、display name、relative pathの順でstable sortする。日付なしは末尾の`Unknown Date`へ置く
- `DateTreeView`はFolder Treeと別DOMを持ち、初期描画はtop-level year / Unknown groupだけとする。月、日、Trackは親group展開時にだけ生成し、800件超のTrack rowを一括生成しない
- `DateTreeVisibilityIndex`はDOM非依存で各year / month / day groupの全descendant entryとpathから祖先groupへの逆indexを保持する。tri-stateはその都度DisplayState.checkedを集計し、Date Tree独自visibility stateを作らない
- `TrackDiscoveryCoordinator`はFolder / Date切替、明示Date表示時のIndex build、progress / cancel、Library generation、FileHandle解決、DisplayState / SelectionState projectionを調停する。Index groupingやDOM責務をApp / TreeViewへ置かない
- Date Track activateは既存`gpx:selection-requested`、checkboxは既存`gpx:display-toggled`を発行する。DisplayStateの購読通知でFolder / Date双方のchecked / loading / errorを同期し、selectionは既存`selection:changed`だけを投影する
- year / month / day checkboxはIndex descendantを`fileEntries`へ解決し、1回の既存`folder:display-toggled`を発行する。lazy未展開Trackも対象とし、既存App bulk、Queue、Map、TreeView、750ms view-state save coalescingを再利用する。Date group eventだけは`preserveMapView` / `preserveSelection`を指定して自動refocusとselection変更を抑止し、DisplayState通知のDate DOM反映もmicrotask単位にまとめる
- Folder / Date modeはschema version 1の`trailbook.discoveryView`へdevice-localに保存する。FileHandle、GPX、summary、geometry、Library設定を保存せず、storage failure時はsession stateでViewerを継続する
- mode切替とDate group bulkはselectionまたはMap center / zoomを変更しない。Track Infoとadvanced FilterはUnit 3へ含めない

### Track Alpha Blending

Status: Completed。通常Track opacity 0.55をChrome Browser Acceptance結果に基づいて正式採用する。

- 通常Trackのopacityは`TrackStyleService`と`Config.map.trackStyle`へ集約し、0.55とする。Folder / Date / Searchの表示入口に依存せず、全Track Layerへ同じstyle契約を適用する
- Track color、Folder color解決、zoom bucket別weightは変更せず、重なりはLeaflet Canvasの通常alpha合成へ委ねる。追加のblend layerやgeometry再生成は行わない
- selected mainはopacity 1.0、既存outlineはopacity 0.95を維持する。Waypoint、背景tile、Monochrome filter、Map restoreには通常Track opacityを適用しない
- style変更だけでGPX parse、Layer再生成、Bounds、Map center / zoom、GPX、`trailbook.json`を変更しない

### Unit 4 Track Info Implementation

- `TrackInfoCoordinator`は`selection:changed`のrelative pathとLibrary generationを受け、同じpathの最新requestだけを`TrackInfoView`へ投影する。SelectionStateを置き換えず、Map、Tree、Searchへselectionを書き戻さない
- `LibraryDiscoveryIndexService.loadEntry()`は既存entryを即時返し、未構築pathだけをshared `GPXGeometryLoader.loadSummary()`へ要求する。同一pathの進行中requestをdeduplicateし、full Index buildを開始しない
- summaryはGeometry Cache hitと通常parseのどちらでも同じ`TrackDiscoveryEntry`となる。load failureはerror entry、missing / stale pathはunavailable stateとし、Library generation変更後の結果を破棄する
- `TrackInfoView`はDOMと人間向けformatだけを担当する。distanceはm / km、durationは時間 / 分 / 秒、elevationはm、日時はbrowser localeで表示し、欠損値は`—`とする
- Track Info取得はvisibility、Map pan / zoom / fit、selection、Date / Folder mode、GPX、`trailbook.json`を変更しない

### Unit 4 Sidebar Layout and Width

- `TrackDiscoveryCoordinator`はSidebar shellを構築し、固定control領域、独立scrollするFolder / Date Track list、下部固定`TrackInfoView`を分離する。Track Infoが利用可能高を超える場合はpanel内部だけをscrollする
- `SidebarResizeHandle`はdesktopのfine pointer環境だけで表示し、pointer dragとkeyboardのArrow Left / Right、Home / Endを提供する。`role="separator"`、vertical orientation、現在値とmin / maxをARIAへ公開する
- 幅は220〜520px、default 260pxとし、drag中はtext selectionを抑止する。drag終了またはkeyboard変更時だけ既存layout eventを発行し、Mapは`invalidateSize({ silent: true })`で残り領域へ追従する
- `ViewStateSchema` schema version 1のoptional `sidebar.width`としてLibrary単位の`trailbook.viewState`へ保存する。旧payloadのmissing値は260pxへfallbackし、Sidebar open / closedと同じ750ms save queueを使う
- Track list / Track Info境界はhorizontal separatorとし、Track Info高120〜420px、default 220px、Track list最小100pxを維持する。Arrow Up / Downは16px、Home / Endはmin / available maxへ移動する
- Track Info高はschema version 1のoptional `sidebar.trackInfoHeight`として同じLibrary単位snapshotと750ms save queueへ保存する。旧payloadのmissing値は220pxへfallbackする
- width restore / resizeはMap center / zoom、selection、visibility、Tree / Search stateを変更しない。GPX、`trailbook.json`、shared settingsへ保存しない。Mobile / coarse pointerではresize handleを表示しない

### Unit 4 GPX Text Decoding

- root causeは`File.text()`がFile byte列を常にUTF-8としてdecodeし、XML declarationのShift_JIS / Windows-31Jを反映しなかったことである。TrackInfoViewで文字列を補正せず、`GPXLoader`をbyte decodeの単一入口とする
- BOMはUTF-8 / UTF-16LE / UTF-16BEを優先し、ASCII互換XML declarationからUTF-8、Shift_JIS、Windows-31J / CP932 aliasをallowlistで解決する。宣言なしではstrict UTF-8を先に試し、invalid byte列の場合だけShift_JISを試す
- unsupported declarationまたはdecoder failureはUTF-8 replacement decodeへfallbackし、Viewer全体を停止しない。判定のために外部通信せず、GPXを書き換えない
- `GPXGeometryLoader`のcache miss経路は`GPXLoader.decode()`を利用し、Parser、Geometry Cache、Discovery Index、Date Tree、Track Infoが同じUnicode parse resultを共有する
- Geometry Cache schema version 3と`textDecoderSchemaVersion: 1`はschema 2の誤decode済みcompact summary、およびdecode markerを持たない過渡的schema 3 recordをinvalidにする。source GPXのsize / lastModifiedが同じでも該当recordだけを削除し、既存parse fallbackでgeometryとsummaryを再生成する。DB全体clearは行わない
- `TrackSummaryBuilder`はdecode / Parser後のnameを共通validatorへ通し、空、U+FFFD、C0 / DEL制御文字を含むmetadata / Track nameをDiscovery nameとして採用しない。display nameはusable metadata name、最初のusable Track name、relative path由来filenameの順で決定し、Search / Date Tree / Track Infoへ同じentryを投影する
- `GeometryCacheRepository`も同じvalidatorでcached display / Track nameを検証する。broken summaryは該当cache keyだけを削除して既存parseへfallbackし、他GPX recordとDB全体は維持する。cache schema 3とdecoder marker 1は変更しない
- Browser AcceptanceではSearch / Date Tree / Track Infoの名前一致、broken Track nameの検索除外、filename fallback、手動cache clear不要、該当GPXだけの再生成と他cache維持をPassした

### Unit 5 Search / Filter Implementation

- `DiscoveryFilterService`は1 GPX 1件のready / error summaryをmemory内で走査し、NFKC後のcase-insensitive textを`displayName`、全Track name、`folderPath`へ適用する。From / Toはbrowser local calendarの`YYYY-MM-DD`でinclusive比較し、date指定時のUnknown Dateは除外する
- `TrackDiscoveryCoordinator`がSearch filter event、遅延Index build、generation guard、Folder / Date両projection、result status同期を調停する。warm Indexは再利用し、queryごとのFile read / parse / cache writeを行わない
- `FolderTreeFilterProjection`はmatching relative pathと祖先Folderの`hidden`だけをlazy DOMへ反映する。MutationObserverでfilter後に生成されたrowも同じpredicateへ投影し、TreeViewのmetadata、expanded paths、roving tabindex、DisplayState、SelectionStateを変更しない
- Date Treeは同じmatching entry集合からgroupを再構築するため、年 / 月 / 日bulkもfilter候補だけを対象にする。Folder / Date切替はfilter、selection、checked、Map center / zoomを維持する
- result listは既存activate / checkbox eventを再利用し、最大100件表示とtotal countを維持する。filter自体はMap visibilityを変更せず、filtered-out TrackをOFFにしない。Clearは両Treeを全entryへ戻す
- filter stateはschema version 1の`trailbook.discoveryView`へLibrary ID別device-local dataとして保存する。FileHandle、summary、geometry、GPX XMLは保存せず、Library切り替え時に別Library filterを混在させない
- AppはSearch ownershipをCoordinatorへ委譲し、既存result activate / checkbox eventの配線だけを維持する。App / TreeViewへfilter責務を追加しない

### Size Boundary

`App.js`と`TreeView.js`は各1,000行未満をhard gateとする。Release 1.4 UIを`TreeView`へ追加せず、Appへindex loop、date grouping、metrics計算、cache schema処理を置かない。500行を超える新規fileは分割検討対象とする。

## Release 1.5 Architecture — Safe GPX Editing / Track Simplification

Status: Completed。Unit 1〜6のImplementation、Static Test、Browser Acceptance、finalizationはCompleted。

Release 1.5はViewerへmutable TrackPoint stateを追加せず、単一GPXのEditor sessionを独立したapplication boundaryとして追加する。通常表示のGPXParser result、Track / Waypoint Model、DisplayState、SelectionState、LayerManager、Geometry Cacheはread-only projectionのまま維持する。

### Proposed Responsibility Split

`TrackEditingCoordinator`:

- 明示Edit開始、source load、preview request、Apply、Undo / Redo、Cancel、明示保存、Library switch guardを調停する
- active sessionを1件に限定し、別GPXのselectionとeditor targetを暗黙に同期しない
- AppへEditor state machine、simplification、serialization、write責務を追加しない

`GPXEditingSourceLoader`:

- source FileHandleからbytes、fingerprint、decoder結果、well-formed XML Documentを取得する
- existing GPX decode規則を再利用するが、lossy fallbackまたはDOM / parsed TrackPoint対応不一致をsave-capable sourceとして受理しない
- Geometry Cache hitだけでEditor sourceを構築せず、Backupと編集結果の保存に必要な元bytes / XMLを明示Edit開始時に読む

`GPXEditingSession`:

- immutable source snapshot、Segmentごとのsource point参照、working retained-index mask、preview candidate、metrics、history cursor、dirty / saving状態をsession memoryへ保持する
- source XML DocumentとViewer Modelを直接mutateしない
- Cancelで全working stateを破棄できる

`TrackSimplificationService`:

- DOM、EventBus、File System、Leafletを参照しないpure / async-compatible serviceとする
- Ramer–Douglas–PeuckerをTrackSegment単位へ適用し、source point indexの集合を返す
- meter tolerance、AbortSignal、progress callbackをAPI候補とし、実測で必要な場合にWorkerへ移してもCoordinator契約を変えない

`TrackSimplificationMetrics`:

- source / candidate point count、reduction ratio、Segment境界内distance、distance delta、removed pointからcandidate polylineまでのactual max deviationを算出する
- time / elevationを補間せず、retained pointだけのsummaryをpreview用に計算する

`EditingHistory`:

- compact retained-index maskとmetricsを持つcommandをsession memoryだけへ保持する
- Apply simplificationをUndo / Redo対象とし、input中preview、Map mode、save filename、file writeをhistoryへ含めない

`EditingPreviewLayerManager`:

- Before / After / Bothの専用Leaflet Layerを所有し、通常`LayerManager`のpath entry、Bounds、selection highlightを変更しない
- Editor終了時に全preview Layerとlistenerを破棄する

`TrackEditingPanel`:

- source path、Backup状態、tolerance、point count、削減率、distance delta、max deviation、preview mode、Undo / Redo、Cancel、保存を表示する
- Editor stateを正本にせずCoordinatorからのprojectionだけを表示する

`GPXEditingSerializer`:

- source XML Documentをcloneし、working maskで除外されたTrackPoint elementだけをremoveする
- Track / Segment構造、Waypoint、route、metadata、namespace、unknown extensionsとretained point childをsemanticに保持する
- UTF-8 BOMなし、LF、XML declaration、final newlineへ正規化し、出力を再parseして構造とpoint countを検証する

`GPXEditingSaveService`:

- explicit callからreadwrite permissionを要求し、初回はreserved `TrailBook_Backup`へsource original bytesを保存・検証してから同じsource pathへserializer outputを書き、close後にread-back verificationする
- 既存Backupは上書き・削除せず、2回目以降は最初のBackupを維持してsourceだけを更新する。automatic restoreは行わない
- failureをResultとして返し、Backup成功前はsourceを変更しない。source更新後のfailureではBackupの復旧場所を明示してViewerを継続する

`LibraryRefreshCoordinator`:

- Backupと編集後sourceのverification成功後だけsame-path cache / Index refreshを行う
- original relative pathを維持し、同じpathのmetadataとDiscovery Indexを置換する。new pathやduplicate entryを作らない
- source pathのsession cache / summaryを無効化し、Geometry Cacheは変更後のFile.size / lastModifiedにより通常pipelineで再生成する

Dependency directionはUI → TrackEditingCoordinator → Session / pure Services / Repositoryとする。Repository、Serializer、Simplification Service、Preview LayerからApp、TreeView、SearchViewへの逆参照を禁止する。App / TreeViewは1,000行未満を維持し、Editor event接続が必要な場合も既存または新Coordinatorへ委譲する。

### Editing State Machine

`idle → loading-source → ready → previewing → dirty → saving → saved`を基本とする。`loading-source` / `previewing`はcancel可能、permission deny / collision / write failure / verification failureは`dirty`へ戻り再試行可能とする。Cancelは`ready` / `previewing` / `dirty` / `saved-with-new-dirty-revision`から`idle`へ戻る。saving中のLibrary switchと別Edit開始は禁止する。

source fingerprint / bytes変更はsaving前に検査し、`source-conflict`として保存を停止する。利用者がpreviewしたsourceと現在sourceが異なる状態を暗黙に保存しない。

### Simplification and Geometry Boundary

各TrackSegmentを独立処理し、Segment境界を跨ぐdistanceまたはshortcutを作らない。0〜2 point Segmentは不変、その他は先頭 / 末尾を必ず保持する。Ramer–Douglas–Peuckerは再帰を避け、latitude-awareなlocal meter projectionまたは等価なgeodesic point-to-segment距離で評価する。high latitude、antimeridian、同一座標をfixtureで固定する。

Douglas–Peuckerは元pointを選択するため、retained pointのtime、elevation、extensionsをそのまま保持できる。Visvalingam–Whyattはarea閾値の説明、radial / uniform samplingは形状保証が弱いためRelease 1.5の主algorithmにしない。

### XML Preservation Boundary

GPXParser domain ModelからXMLを新規構築しない。Parser Modelは表示・metricsの入力として再利用できるが、serializerの正本はEdit開始時のsource XML Documentである。DOM mappingはTrack / Segment / TrackPointのdocument orderとparsed source indexを照合し、不一致ならsaveを禁止する。

retained TrackPoint elementは属性、`ele`、`time`、unknown child / extensionを全て保持する。removed TrackPointの属性を近傍pointへ移さず、time / elevationを補間しない。Waypoint、route、metadata、Track / Segment level extensionsは対象外であり、clone上で変更しない。XMLSerializerによるquote、attribute順、indent等のbyte formatting差は許容するが、namespaceとsemantic structureをverificationする。

### Write and Refresh Boundary

Release 1.5はsource parent Folderのreserved `TrailBook_Backup`へoriginal bytesを1回だけ保存し、検証後に同じsource `.gpx` pathへ編集結果を保存する。Backup名はsource filenameと一致し、自動suffix、別名保存、Backup overwrite / deleteを行わない。permissionは明示`保存` clickからだけ要求する。

writer close後のread-back validationに成功するまでLibraryへ更新後sourceを投影しない。failure時は検証済みBackupの復旧場所をerrorとして明示する。成功後refreshが失敗した場合はfile保存成功とUI refresh失敗を区別し、手動Library再読込を案内する。

### Cache Boundary

working copy、history、serialized draft、preview geometryをGeometry Cache / Discovery Index / localStorage / IndexedDBへ保存しない。保存前はcache / Indexを変更しない。成功後はsame pathのsession cache / summaryをinvalid化し、File.size / lastModified / schemaにより通常cacheを再生成する。

### Release 1.5 Out of Scope

- Backup verificationなしのsource更新、Backupのoverwrite / delete、automatic save、background save
- manual point move / add / delete、range delete、Track / Segment split / join
- Waypoint、route、metadata、extensions editor
- multi-GPX / batch simplification、Mobile editor
- editing session persistence、crash recovery、cloud sync / merge

### Unit 2 Editing Core Implementation

- `GPXEditingSourceLoader`は既存`GPXLoader` decodeと`GPXParser`を使用し、source text、File size / lastModified fingerprint、private source DOM clone factoryを1回の明示loadで生成する
- DOM mappingはdirect-childのTrack / Segment / TrackPointをdocument orderでParser Modelと照合し、countまたはlatitude / longitudeが一致しない場合は`DOM_MAPPING_MISMATCH`でsave不可にする
- U+FFFDを含むdecode結果、XML / GPX parse failure、mapping mismatchではViewerへ副作用を出さず`canSerialize: false`とreasonを返す
- source object、fingerprint、Track / Segment / point mappingをfreezeし、呼出側へmutable source DOMを公開しない。serializerはclone factoryから毎回独立DOMを取得する
- `GPXEditingSession`はsource shapeと同じboolean retained-point maskをworking stateとし、同一maskのpreviewはhistoryへ記録しない
- `EditingCommandHistory`はApply済みcommandのbefore / after maskだけをsession memoryへ保持し、Undo後の新規ApplyでRedo branchを破棄し、最大20件とする
- Cancelはsource-all-retained maskへ戻してhistoryをclearし、sessionをinactiveにする
- `GPXEditingSerializer`はsource DOM cloneからfalseの`trkpt`だけをremoveし、UTF-8 declaration、LF、final newlineへ正規化する。再parse後にversion、namespace、Track / Segment、Waypoint、route、retained point countを検証する
- Unit 2 moduleは`main.js`へ未接続であり、GPX write、RDP、preview、Save As、cache / Index / Tree更新を行わない

### Unit 3 Track Simplification Implementation

- `TrackSimplificationService`はDOM、EventBus、File System、Leafletへ依存せず、immutable editing sourceを入力にSegment shapeと同じretained-point boolean maskを返す
- Ramer–Douglas–Peuckerはrecursive callを使わないstack方式で、各Segmentとinvalid coordinateで分割したvalid runを独立処理する。Segmentの先頭 / 末尾、0〜2 point、invalid coordinateは保持する
- point-to-segment距離はlatitude-aware local equirectangular projection、path distanceはHaversineをmeter単位で使い、longitude deltaをantimeridian越しに正規化する
- `TrackSimplificationMetrics`はSegment、Track、全体ごとにsource / retained / removed point count、reduction ratio、source / simplified distance、signed / absolute distance difference、removed pointのactual max deviation、invalid point countを返す
- invalid coordinateはViewer全体を停止させず、その前後のdistanceを接続しない。retained pointの属性を参照・変更せず、removed pointの属性を補間・移送しない
- preview生成はasync-compatibleで、既定4,096 point-distance評価ごとにevent loopへcooperative yieldする。AbortSignalとSegment progress callbackを受け、実ブラウザで200 ms超long taskが再現する場合だけWorkerを再検討する
- `GPXEditingSession.setPreview()`はcandidateをsession memoryへ保持するだけでworking mask / historyを変更しない。`applyPreview()`だけが既存command historyへ確定し、同一maskでは新しいcommandを作らない。Undo / Redo / Cancelはpreviewを破棄する
- Unit 3 calculation modulesはViewerへ未接続であり、preview Layer、GPX write、Save As、Geometry Cache、Discovery Index、Folder / Date Treeを変更しない

### Unit 4 Editor UI and Preview Implementation

- `main.js`はApp初期化後に`TrackEditingCoordinator`をcompositionし、App / TreeViewへEditor state machine、source load、RDP、preview Layer責務を追加しない
- `TrackEditingPanel`はselected pathの明示`編集`、meter tolerance、lineとpointのpreview mode、progress / live status、point / reduction / distance / max deviation metrics、Apply、Undo、Redo、Done、Cancelだけを表示する。Save AsはUnit 5まで表示しない
- `TrackEditingCoordinator`はselected relative pathから既存Tree metadataのFileHandleを1件だけ解決し、`GPXEditingSourceLoader`、`GPXEditingSession`、`TrackSimplificationService`を調停する。source loadまたはpreview requestのrequestIdがstaleなら結果を採用しない
- tolerance inputは150 ms debounceし、新preview予約時と実行時に前AbortControllerを停止する。progressはSegment完了数を`role=status` / `aria-live=polite`とnative progressへ投影する
- `EditingPreviewLayerManager`はnormal `LayerManager`と別のBefore / After line LayerGroup、Before / After point LayerGroup、Leaflet paneを所有する。Before lineはneutral dashed、After lineはsolid orangeとし、両方ともnon-interactiveでinvalid coordinateによりline runを分断する
- 編集専用Canvas paneは高いz-indexで描画するが`pointer-events: none`とし、Layer削除後にpane / rendererが残っても通常Track Canvas、Map drag、background clickを遮断しない
- line modeはBeforeでsourceだけ、Afterでsimplifiedだけ、Bothで両方をMapへaddする。編集開始後は対象pathのnormal Track / outline presentationだけを一時removeし、DisplayState、Layer entry、Polyline、style、Waypointを維持したままDone / Cancelで同じLayerGroupをMapへ戻す
- point modeはOff / Before / After / Bothをline modeと独立して持ち、既定Offとする。source pointは小さいneutral marker、retained pointは大きいorange markerで区別し、共通Leaflet Canvas rendererへ要求時だけCircleMarkerを遅延生成する。point edit / hit eventは追加しない
- preview mode、candidate更新、CancelはMap center / zoom / fit、DisplayState、SelectionState、Waypoint、normal Track Layer、Geometry Cache、Discovery Indexを変更しない
- 編集中はsidebar shellを`inert`にしてFolder / Date / Search selectionを抑止し、MapViewはTrack / background selection eventだけを停止する。Leaflet pan / zoom / double-click zoomは停止しない。target selectionがsystem側で変わった場合はsessionを破棄する
- previewはimmutable sourceから生成し、Applyだけがworking retained maskをhistoryへ確定する。Undo / Redoはworking maskを専用After line / point Layerへ再投影する
- DoneはAbort、timer、preview Layer、selection lockを解除し、対象Track / outlineとその既存click handler、Sidebar selection操作、Edit操作をnormal Viewerへ戻す。current working mask / history / immutable sourceは1件のsession-memory draftとして保持する。同じLibrary identity / relative pathの明示Editでresumeし、別GPX Edit、Library identity変更、page reloadでは破棄する。normal Viewerへworking geometryを投影せず、Unit 5 Save As前の一時状態であることをPanelへ表示する
- Cancelはactive Sessionのpreview、working mask、historyを破棄し、normal Viewer presentationとselection interactionを復元する。DoneとCancelはそれぞれ`編集終了` / `破棄`と文字で区別する
- GPX / `trailbook.json` write、readwrite permission、Save As、draft cache / Index projectionは行わない

### Unit 5 Original Backup + In-place Save Implementation

- `GPXEditingSaveService`は明示`保存`操作からだけsource Folderのreadwrite permissionを確認する。初回は`TrailBook_Backup`へsourceと同名のFileHandleを作り、`GPXEditingSourceLoader`が保持するimmutable original bytesをそのまま書く。read-back bytes、fingerprint、GPX mappingのverificationが成功するまでsourceへ書かない
- `TrailBook_Backup`に同名fileが存在する場合は有効性を確認して再利用し、上書き・削除しない。2回目以降はoriginal Backupを永久保持し、source pathだけを更新する。partial / invalid Backupは安全側で保存を停止し、暗黙修復しない
- `GPXEditingSaveVerifier`は編集後sourceをclose後に再読込し、UTF-8 BOMなし、LF、XML declaration、single final newline、XML parse、GPX version / namespace、Waypoint / route、Track / Segment、working maskどおりのretained point countを確認する
- `LibraryReservedFolderPolicy`は`TrailBook_Backup`をcase-insensitiveなreserved Folder名として扱い、`FolderScanner`はrootを含む任意階層で再帰前に除外する。したがってFolder Tree、Date Tree、Search、Discovery Index、Geometry Cache、GPX / Folder件数へ含めない
- `EditedGPXLibraryRefreshCoordinator`はverification成功後だけ同じrelative pathのDisplayState session cacheをinvalidateし、同じFileHandleを再登録する。visible Trackは既存Queue経路で1回だけ再parse / renderし、hidden Trackはhiddenのままにする。`TrackDiscoveryCoordinator.refreshFileEntry`は同じpathのsummaryだけをinvalid化し、Date Tree、Search、Track Infoを更新する。Geometry CacheはFile.size / lastModified不一致から通常pipelineで再生成する
- Backup作成失敗 / verification失敗ではsourceを変更しない。source write失敗または編集後verification失敗ではBackupを保持し、復旧可能な場所をEditor statusへ明示する。Viewerとworking draftは継続し、`trailbook.json`と他GPXを変更しない
- 保存成功後はverified edited sourceを新しいimmutable baselineとしてSessionをrebaseする。Doneでは同じpathのsession-memory draftを保持でき、以後のApplyは新baselineからの未保存変更になる。Cancel semanticsは変更しない

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

## Release 1.6 Architecture

Status: Completed

- `DateTreeBuilder`はDiscovery entryを年 / 月 / Trackへgroup化し、日nodeを生成しない。resolvedDate、Unknown Date、stable sortの正本は既存Discovery Indexに置く
- `TrackDateCorrectionService`は最初の有効`trkpt/time`を基準にUTC offsetを計算し、Session commandとSerializer DOM cloneへ適用する。既存`metadata/time`だけを同offsetで更新する
- filename rename draftと`GPXBackupIndexService`はcurrent source filenameから最初のoriginal Backup filenameへのassociationを保持する。Backup GPX本体をrename / overwrite / deleteしない
- `TrackTranslationService`はproject / unprojectに基づく地理offsetをSessionへ保持し、Serializerが`trkpt`のlat / lonだけへ適用する。Waypoint / routeは対象外とする
- Date modeはSelectionStateのrelative pathを正本として、対象年 / 月を展開し同じTrack nodeを選択表示する
- `MapView`はOSMまたは国土地理院標準地図のbase layerを1枚だけ保持する。選択値はdevice-local view stateへ保存し、unknown値と旧`gsi-pale`はOSMへfallbackする
- `BatchSimplificationCoordinator` / `BatchSimplificationService` / `BatchSimplificationPanel`は既存RDP、Serializer、Backup + in-place save、targeted refreshを再利用する。解析はread-only、実行はsequentialで、0削減fileを変更せず、file単位failure後も継続し、安全なfile境界でCancelする
- Release 1.5のOriginal Backup + In-place Edited GPX、explicit save、verification、reserved `TrailBook_Backup`境界を変更しない

## Release 1.7 Architecture

Status: Completed

- 既存`ViewStateControls`とCSS breakpointがdesktop / mobile presentationを切り替え、Map instance、DisplayState、SelectionState、Folder / Date Treeを共有する。resize時はMapを再生成せずinvalidateだけを行う
- `CurrentPositionService` / `CurrentPositionController`が1つのGeolocation watch、marker / accuracy circle、Follow stateをsession memoryで管理する。位置は永続化・送信しない
- `ScreenWakeLockService` / `DrivingModeController`が明示的な走行中モード操作だけでWake Lockを取得し、visible復帰時に必要な場合だけ再取得する。unsupported / rejectはGPS / Viewerを停止させない
- `DriveLibraryCoordinator`がOAuth / Picker / Library lifecycle、`DriveLibraryService`がread-only virtual handlesとrecursive metadata scanを担当する。access tokenはsession memoryだけに保持する
- Drive GPXはmetadataのrelative path / size / lastModifiedで既存Geometry Cacheをmedia download前にlookupする。hitはdownload / parseを行わず、missだけを最大4並列でdownload / parse / cache writeする
- GitHub Pages workflowは`src/`だけをartifact rootへコピーし、repository secretsからartifact内だけのruntime configを生成する。actual credentialはsource / workflow / logへ保存しない
- Google Drive Readerは補助的な直接接続手段とし、端末 / Files / OS pickerの既存Library openを主導線とする
