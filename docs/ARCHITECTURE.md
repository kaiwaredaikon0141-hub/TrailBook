# ARCHITECTURE.md

Version: 1.1
Status: Official
Baseline: Release 0.8.0
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
- `TreeView.js`は現在500行を超えており、分割検討対象である。
- Release 0.9の範囲とSearch実装の安全性を優先し、Release 0.9で無理にTreeViewを分割しない。

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
│  ├─ MapView.js
│  └─ StatusBar.js
├─ services/
│  ├─ FolderScanner.js
│  ├─ GPXLoader.js
│  ├─ GPXParser.js
│  └─ GPXDisplayQueue.js
├─ state/
│  └─ DisplayState.js
├─ map/
│  └─ LayerManager.js
└─ models/
```

将来のSearchは責務に応じて`search/`または小さなServiceとして追加できるが、Release 0.9の設計承認前に構造を固定しない。

## App — Application Coordinator

`App`はアプリケーション全体のCoordinatorである。

Responsibilities:

- Component生成とLayout構築
- EventBusの接続
- Folder選択とLibrary読込の調停
- GPXの主選択を表す非永続Presentation State
- `DisplayState`と`GPXDisplayQueue`の調停
- GPX個別表示とFolder一括表示の開始・停止
- 解析成功、失敗、古いrequestの結果処理
- 複数GPXの再フォーカス調停
- Waypoint表示設定のセッション保持
- Clear操作とLibrary切り替え

主選択は「どのGPXにユーザーの操作対象があるか」を表す。表示状態は「どのGPXが地図上でONか」を表す。両者を同一視しない。

AppはFolderやLibraryへ解析結果、表示状態、選択状態を書き込まない。

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

主選択は`aria-selected`、表示状態はnative checkboxで表す。GPX行の選択だけで表示をON/OFFしない。

TreeViewの検索対象は生成済みDOMではなくpathベースmetadataとする。Release 0.9では結果選択時だけ必要な祖先Folderを展開する。

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

## Models

Modelはデータ構造だけを保持し、UI状態とLeaflet Layerを保持しない。

- Library
- Folder
- Metadata
- Track
- TrackSegment
- TrackPoint
- Waypoint

Folder構造とGPXが正本であり、解析結果をLibrary Modelへ永続化しない。

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

## Object Lifetime

- App、EventBus、UI components: application lifetime
- Library、Tree metadata、DisplayState registrations: current Library lifetime
- Parsed result cache: current Library session、最大100件
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
- ユーザーのGPXを暗黙に変更または上書きしない。
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
