# TrailBook Release 0.4 UI Specification

Version : 1.0
Status  : Proposed for implementation
Depends : PROJECT.md, ARCHITECTURE.md, ROADMAP.md

Release 0.5 TreeView仕様は本書末尾に追記する。

---

# 1. Purpose

Release 0.4では、TreeViewでGPXファイルを明示的に選択し、
そのGPXに含まれるTrackを地図へ表示する。

表示対象は常に選択中のGPX一つとする。
別のGPXを選択した場合、現在のTrack表示を新しいGPXの表示で置き換える。

複数GPXの同時表示、Track編集、検索、統計、ReplayはRelease 0.4の対象外とする。

# 2. Scope

## Included

- GPXファイルのシングルクリック選択
- 明示的なGPX解析要求
- GPX解析結果のイベント経由受け渡し
- 全Trackの表示
- TrackSegmentごとのPolyline表示
- 選択GPXのWaypoint Marker表示
- Track Boundsへの自動ズーム
- 選択、loading、loaded、error、idleの状態表示
- MapView上の明示的な表示解除
- Leafletによる地図表示

## Excluded

- ライブラリを開いた直後の全GPX自動解析
- 複数GPXの同時表示
- Track単位のTreeView選択
- WaypointのPopup、詳細表示、編集、選択操作
- Track編集、検索、統計、Replay
- オフライン地図タイル、タイルキャッシュ、独自タイル管理
- GPX解析結果のFolderまたはLibraryへの保存

# 3. Layout

```text
+------------------------------------------------------+
| Toolbar                                              |
+----------------------+-------------------------------+
| TreeView             | MapView                       |
|                      |                               |
| Folder               | Leaflet map                  |
|   GPX file           | Track polylines              |
|                      | Waypoint markers             |
+----------------------+-------------------------------+
| StatusBar                                            |
+------------------------------------------------------+
```

既存のToolbar、TreeView、StatusBarの位置と責務を維持する。
MapViewはworkspaceの右側を使用し、地図DOMを管理する。

# 4. TreeView

## Display

- フォルダを先、GPXファイルを後に表示する
- 同じ種類の項目は名前の昇順に表示する
- FolderとLibraryのModelを変更しない
- Track名をGPXファイルの子として表示しない
- TreeViewはGPXファイルの選択までを担当する

## Selection

GPXファイルを選択すると、選択状態を視覚的に表示し、
対象要素へ`aria-selected="true"`を設定する。

選択状態は同時に一つだけとする。

## Click behavior

### Single click

- GPXファイルを選択する
- Presentation Stateを`loading`へ変更する
- `gpx:parse-requested`を発行する

### Double click

Release 0.4では特別な動作を割り当てない。

### Right click

独自コンテキストメニューを追加しない。

## Same file selection

- `loading`: 新しい解析要求を無視する
- `loaded`: 再解析せず、現在のTrack Boundsへ再フォーカスする
- `error`: 再解析を許可する

# 5. MapView

MapViewは`src/js/ui/MapView.js`に配置する。

## Responsibilities

- 地図表示用DOMの生成
- Leaflet mapの初期化
- 空状態、loading、error状態の表示
- LayerManagerへの描画依頼
- 現在表示中のLayerの解除
- Track Boundsへの再フォーカス
- クリア操作の提供

## Must not handle

- FileSystemFileHandle
- GPX XML
- GPXParser
- Folder
- Library
- TreeView内部状態

MapViewはGPX解析結果を受け取るが、解析そのものは行わない。

## Initial map position

日本全体を見渡せる位置を初期表示候補とする。
実装前に次の候補から人間が最終決定する。

| Candidate | Latitude | Longitude | Zoom |
|---|---:|---:|---:|
| Japan overview A | 36.2048 | 138.2529 | 5 |
| Japan overview B | 35.6812 | 139.7671 | 5 |
| Japan overview C | 36.0000 | 138.0000 | 5 |

Release 0.4では、Trackに有効な点がない場合も初期位置を維持する。

## Fit bounds

解析成功後、選択GPXに含まれる全Track、全TrackSegment、全TrackPointを
対象としてBoundsを計算し、自動ズームする。

- 複数Trackを一つのBoundsに含める
- 複数Segmentを一つのBoundsに含める
- Segment同士を接続しない
- Pointが1件だけの場合は固定ズームを使用する
- Pointがない場合は初期位置を維持する

## Clear

MapView上部に明示的な「クリア」操作を設ける。

クリア時:

- Track Layerを削除する
- Waypoint Markerを削除する
- TreeViewの選択状態を解除する
- Presentation Stateを`idle`へ戻す
- 地図を初期位置へ戻す

最後の初期位置への復帰は、上記動作をRelease 0.4の標準案とする。

# 6. LayerManager

LayerManagerは`src/js/map/LayerManager.js`に配置する。

## Responsibilities

- TrackごとのLayer生成
- TrackSegmentごとのPolyline生成
- Waypoint Marker生成
- 現在表示中Layerの保持
- Layer解除
- Bounds計算
- Leaflet Layer APIとの接続

## Must not handle

- GPXファイル読み込み
- GPX解析
- TreeView
- StatusBar
- FileSystemFileHandle
- アプリ全体の選択状態

## Layer structure

```text
Current GPX Layer
├─ Track Layer 1
│  ├─ Segment Polyline 1
│  └─ Segment Polyline 2
└─ Track Layer 2
   └─ Segment Polyline 1
```

TrackSegmentは結合せず、Segmentごとに別Polylineを作成する。
Segment間に線を引いてはならない。

## Waypoint

選択中GPXのWaypointだけをMarker表示する。

- Popupを追加しない
- 詳細パネルを追加しない
- Waypointの選択操作を追加しない
- Waypoint名があってもクリック動作を追加しない
- 名前の表示方法は実装時にLeafletの標準Marker表示を確認する

# 7. Track style

基本スタイルはConfigで管理する。
Release 0.4では全Track、全Segmentを同じスタイルで描画する。
Trackごとの色分けは行わない。

実装値の候補:

```js
const MAP_STYLE = {
    lineColor: "#2563eb",
    lineWeight: 4,
    lineOpacity: 0.9
};
```

上記は候補値であり、実装値は人間の承認後に確定する。

# 8. Presentation State

FolderやLibraryへ解析結果を保存しない方針を維持する。
画面表示のためだけに、非永続のPresentation Stateを保持する。

```js
{
    selectedFileHandle,
    selectedFileName,
    parsedResult,
    status
}
```

`status`は次のいずれかとする。

- `idle`
- `loading`
- `loaded`
- `error`

Presentation Stateは次の性質を持つ。

- 永続データではない
- GPXの正本ではない
- FolderやLibraryのModelではない
- アプリ終了時に保存しない
- 現在のUI表示のためだけに使用する

## Placement comparison

### App内部のprivate state

利点:

- Release 0.4の状態数に対して最小構成
- 新しい公開モジュールを増やさない
- Appがイベント調停と表示状態を一箇所で管理できる
- 将来のState設計を早期に固定しない

欠点:

- Appが大きくなりやすい
- MapViewやTreeViewから直接状態を参照できない

### `src/js/state/AppState.js`

利点:

- 状態保持の責務を分離できる
- 将来の状態追加に対応しやすい

欠点:

- Release 0.4では小さな状態のため、抽象化が増える
- 状態変更通知のAPIが別途必要になる
- UIが独立Stateへ依存する設計になりやすい

## Recommendation

Release 0.4では、App内部のprivate stateとして保持する案を推奨する。

Appは`presentationState`を持ち、TreeView、MapView、StatusBarは
EventBus経由の通知だけを受け取る。状態が複雑になった時点で、
人間の承認を得て`AppState.js`へ分離する。

# 9. Event flow

## Existing events

- `gpx:parse-requested { fileHandle }`
- `gpx:parsed { fileHandle, result }`
- `gpx:parse-failed { fileHandle, error }`

## Release 0.4 events

- `gpx:selected { fileHandle, fileName }`
- `map:clear-requested {}`
- `map:display-cleared {}`
- `map:display-failed { fileHandle, error }`

`gpx:selected`はTreeViewからAppへ通知する。
AppはPresentation Stateを更新し、`gpx:parse-requested`を発行する。

## Recommended route

```text
TreeView single click
        ↓
gpx:selected
        ↓
App updates Presentation State
        ↓
gpx:parse-requested
        ↓
GPXLoader / GPXParser
        ├─ gpx:parsed
        │    ↓
        │  App updates Presentation State
        │    ↓
        │  App requests MapView display
        │
        └─ gpx:parse-failed
             ↓
           App updates error state
             ↓
           StatusBar and MapView error state
```

## App mediation vs direct MapView subscription

### App mediation

Appが`gpx:parsed`を受け、MapViewへ表示を依頼する。

利点:

- Presentation Stateの更新箇所がAppに集約される
- MapViewがGPXイベントやParserの存在を知らない
- TreeView、Parser、MapViewの結合が弱い
- 既存のApplication層の責務に一致する

欠点:

- Appのイベント接続が増える

### MapView direct subscription

MapViewが`gpx:parsed`を直接購読する。

利点:

- Appの中継処理が減る

欠点:

- MapViewがGPX解析イベントと解析結果の契約を知る
- Presentation Stateの更新経路が分散する
- ParserとUIの結合が強くなる

## Recommendation

App mediationを採用する。
既存の「UI同士はEventBusを経由する」「Appが接続役を担う」という設計に一致し、
MapViewは地図表示だけに集中できる。

# 10. State display

## idle

- GPX未選択
- MapViewは初期位置
- StatusBarはReady

## loading

- 選択GPXを強調表示
- `aria-selected="true"`
- TreeViewにloading状態を表示
- StatusBarにファイル名付きの解析中表示
- 以前のTrackとWaypointは削除する

## loaded

- 選択GPXを強調表示
- TrackとWaypointを表示
- Track Boundsへ自動ズーム
- StatusBarに簡潔な成功状態を表示してよい

## error

- 選択状態を維持
- TreeViewにerror状態を表示
- MapViewは空状態にする
- StatusBarに簡潔なエラーを表示
- 詳細は`console.error`へ出力

# 11. Leaflet distribution and tiles

LeafletはCDNではなく、ローカル同梱とする。

想定配置:

```text
src/vendor/leaflet/
├─ leaflet.js
├─ leaflet.css
└─ images/
```

Release 0.4の設計段階ではLeaflet本体を追加しない。

Leaflet本体をローカルに置いても、通常のWeb地図タイルはネットワーク依存である。
Release 0.4ではオンラインタイルを使用してよいが、オフライン時には
地図背景が表示できない可能性がある。

オフラインタイル、タイルキャッシュ、独自タイル管理はRelease 0.4の対象外とする。
Trackの描画処理は、背景タイルが取得できない場合でも可能な範囲で維持する。

# 12. Accessibility

- GPX Tree itemにキーボードで到達できること
- 選択状態に`aria-selected="true"`を使用すること
- loading、loaded、errorを色だけで表現しないこと
- StatusBarの状態文を読み上げ可能な領域として扱うこと
- クリア操作に明確なAccessible Nameを付けること
- MapViewに地図領域の役割と名称を付けること
- エラー詳細を画面に過剰表示せず、簡潔な状態を表示すること

# 13. Definition of Done

- GPXファイルをシングルクリックで選択できる
- 選択中のGPXが視覚的に分かる
- 選択時だけ`gpx:parse-requested`が発行される
- ライブラリを開いただけではGPX解析されない
- `gpx:parsed`をAppが受け取りMapViewへ中継できる
- 選択GPXの全Trackを表示できる
- 複数TrackSegmentを別Polylineとして表示できる
- Segment間に線を引かない
- 選択GPXのWaypointをMarker表示できる
- 全TrackPointのBoundsへ自動ズームできる
- 1点だけの場合に固定ズームを使用できる
- 点がない場合に初期位置を維持できる
- 別GPX選択時に前の表示を置き換えられる
- loading、loaded、error、idleがUIに反映される
- クリア操作でLayer、選択状態、Presentation Stateを解除できる
- FolderとLibraryを変更しない
- 複数GPX同時表示を追加しない
- Track編集、検索、統計、Replayを追加しない
- Leafletをローカル同梱する方針を守る
- オフラインタイル機能を追加しない

# 14. Open decisions before implementation

実装前に人間が承認する事項:

1. 初期地図位置の候補値
2. 1点Track用の固定ズーム値
3. Track線の`lineColor`、`lineWeight`、`lineOpacity`
4. Leafletの具体的な配布物とバージョン
5. オンラインタイルの提供元と利用条件
6. Waypoint Markerの標準アイコンを使用するか
7. loaded時のStatusBar文言
8. error時にMapViewを空状態にする最終確認
9. クリア時に地図を初期位置へ戻す最終確認
10. TreeViewのキーボード選択をRelease 0.4に含める範囲

# 15. Release 0.5 TreeView

Release 0.5では、展開フォルダだけを遅延生成するTreeViewを提供する。

- ルートは常に展開し、ルート直下だけを初期生成する
- フォルダ行全体で展開・折りたたみを操作する
- GPX選択は既存の`gpx:parse-requested`を使用する
- 展開状態はTreeView内部で相対パスをキーに保持する
- Folder、Library、FolderScanner、GPXParser、MapView、LayerManagerは変更しない
- ArrowUp、ArrowDown、ArrowLeft、ArrowRight、Home、Endを提供する
- EnterとSpaceでフォルダ操作またはGPX選択を行う
- `role="tree"`、`role="treeitem"`、`aria-expanded`、`aria-selected`を使用する
- フォーカス管理はroving tabindexとする
- 折りたたまれたフォルダの子DOMは削除する
- loading、loaded、error状態は折りたたみ後の再展開で復元する
- 同じライブラリの再読み込みでは展開、フォーカス、スクロール位置だけを復元する
- GPXの選択状態と解析状態はライブラリ再読み込み時に解除する
- 仮想スクロール、複数GPX表示、検索、編集、統計、Replay、HeatMapは対象外とする
