# TrailBook UI Specification

Version : 1.2
Status  : Implemented through Release 1.0 / Release 1.1 Planning
Depends : PROJECT.md, ARCHITECTURE.md, ROADMAP.md

Release 0.5からRelease 0.9までの追加仕様は本書末尾に追記する。

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

# 16. Release 0.6 Multiple GPX Display

Release 0.6では、GPX行のcheckboxで複数GPXを個別に地図表示する。

- GPX行クリックとEnterは主選択だけを変更する
- 表示中の主選択GPXでは、そのGPXのBoundsへ再フォーカスする
- 非表示GPXの主選択では地図を移動しない
- TreeItemのSpaceまたはcheckboxで表示をON/OFFする
- `aria-selected`は主選択、checkboxの`checked`は表示状態を表す
- GPXごとに独立したLeaflet LayerGroupを保持する
- OFF時は対象GPXのTrackとWaypointだけを削除する
- 解析結果はセッション中のcacheに保持し、Library切り替えで破棄する
- 解析Queueは最大2件のFIFOとする
- TrackSegment間は接続しない
- Waypointは既存のLeaflet標準Markerを使用する
- 表示色は相対パスの安定ハッシュから固定パレットで決定する
- 表示中GPX全体のBoundsへ250ms debounce後に自動fitする
- 表示クリアは全GPXをOFFにし、主選択とcacheは維持する
- フォルダ一括表示、Canvas renderer、検索、編集、統計、Replay、HeatMapは対象外とする

# 17. Release 0.7 Folder Bulk Display

Release 0.7では、Folder行のnative checkboxで配下GPXを一括表示する。

- Folder名・展開アイコンのクリックは展開・折りたたみだけを行う
- Folder checkboxはFolder Modelを再帰走査し、DOM未生成の子孫GPXも対象にする
- `folder:display-toggled`をFolder操作ごとに1回発行する
- Folder checkboxは配下GPXのchecked状態からchecked、indeterminate、disabledを算出する
- 空Folderのcheckboxはdisabledとする
- Folder自身のchecked状態はModelへ保存しない
- 一括ON/OFFは既存のDisplayStateとGPXDisplayQueueを利用する
- 一括ON中のOFFではqueued・実行中の結果を無効化する
- 個別GPXの表示状態、主選択、loading、loaded、errorを維持する
- 折りたたみ中の子孫GPXも表示対象にできる
- 表示クリア時は全GPXと全Folder checkboxをuncheckedにする
- Folder一括専用の進捗UI、キャンセル、検索、編集、統計、Replay、HeatMapは追加しない

# 18. Release 0.8 Waypoint Display Option

Release 0.8では、Map toolbarのnative checkboxでWaypoint表示を切り替える。

- 初期値はOFFとする
- ON/OFFはTrack表示へ影響させない
- 表示中GPXのcache済み解析結果からWaypointだけを追加・削除する
- Waypoint ON/OFFでGPXを再解析しない
- Waypoint ON/OFFで自動ズームやBounds計算を行わない
- GPXごとにTrack LayerGroupとWaypoint LayerGroupを分離する
- 非表示GPXへWaypointを追加しない
- GPX OFFではTrackとWaypointの両方を削除する
- Library切り替えではLayerとcacheを破棄するが、設定値はセッション中維持する
- Waypoint件数や設定状態はStatusBarへ表示しない
- Waypoint個別設定、編集、Marker色変更、clustering、永続保存は対象外とする

# 19. Release 0.9 Search

Release 0.9では、TreeViewが保持するmetadataからGPXファイル名、Folder名、相対パスを検索する。

## Search input and results

- inputは`type="search"`とし、150ms debounce後に検索する
- 空queryでは結果を即時に解除する
- NFKC正規化後に大文字小文字を区別せず部分一致検索する
- 名前の完全一致、名前の前方一致、名前の部分一致、path一致の順に優先する
- 同順位はpathの`localeCompare`順とする
- 総一致件数を表示し、結果DOMは先頭100件まで生成する
- 検索だけではGPX内容を解析せず、Queue、解析cache、主選択、表示状態、Mapを変更しない
- DOM未生成項目もpathベースmetadataから検索する

## Result activation

- Folder結果は必要な祖先と対象Folder自身を展開し、対象行へfocusする
- GPX結果は必要な祖先だけを展開し、対象行へfocusして既存の主選択処理へ接続する
- 表示中GPXのactivateは対象GPXへ個別refocusする
- 非表示GPXのactivateはMapを変更せず、自動的に表示ONにしない
- 検索解除では検索前のTree展開状態へ戻さない

## GPX result checkbox

- GPX結果にはnative checkboxを表示する
- checkboxは既存のGPX個別表示ON/OFF処理へ接続する
- checkbox操作では主選択とresult activateを変更・発火しない
- checked、loading、loaded、error、表示色は既存TreeViewとDisplayStateの状態へ同期する
- Folder一括、root一括、表示クリア、Library切り替え後も検索結果を現行状態へ同期する

## Keyboard and accessibility

- inputではEscapeでquery解除、ArrowDownで先頭結果へfocusする
- 結果ではArrowUp、ArrowDown、Home、Endでfocusを移動する
- Enterで結果をactivateし、Escapeでqueryを解除してinputへfocusする
- GPX結果行のSpaceは表示を1回だけtoggleし、Folder結果行のSpaceは何もしない
- checkboxへ直接focusした場合はnative Space操作を使用し、結果行handlerで二重toggleしない
- 結果行はroving tabindexで管理する
- 結果件数は`aria-live="polite"`で通知する
- Folder、GPX、result activate、checkboxのaccessible nameを区別する

## Release boundary

- `SearchEntry`の実体fieldは`kind`、`path`、`name`だけとする
- `FileSystemFileHandle`を`SearchEntry`または検索結果DOMへ保持しない
- 日付、Track名、車両metadata、GPX内容検索を実装しない
- MapView、LayerManager、GPXParser、GPXDisplayQueueの責務を変更しない

# 20. Release 1.0 Stable Viewer

Release 1.0は個人利用向け正式安定版であり、Release 0.9までのUI機能を変更せず品質を確定する。

## Environment guidance

- Windows 10 / 11の最新安定版Chrome / Edge desktopを正式対応とする
- File System Access API非対応または非secure contextでは、Folder選択が利用できない理由を画面内で案内する
- HTTPS、`http://localhost`、`http://127.0.0.1`を対応originとする
- Android、iPhone、iPadの最新Chromeは実機検証に合格した端末だけをbest effortとする
- 未確認のMobile browserは対応区分未確定とし、必要APIが不足する端末は対応外として既知の制限へ記載する
- `file://`、通常のLAN内HTTP IP、Firefox、Safariは対応外とする

Folder選択可否は`window.isSecureContext`、対応origin、`showDirectoryPicker`の実在で判定する。User-Agentだけでは決定せず、desktop Chromium判定は補助情報、Mobile判定は未検証案内と診断情報にだけ使用する。

Mobileでもsecure context、対応origin、`showDirectoryPicker`を満たす場合はFolder選択buttonを有効にし、非ブロッキングの未検証案内を表示して実機試験を可能にする。必要APIがない場合はMobileであることではなくAPI不足を理由に無効化する。実機合格前は正式対応またはbest effort対応とは記載しない。

非対応環境では「ライブラリを開く」をdisabledにし、sidebar内の常時確認できる説明と`aria-describedby`で理由を関連付ける。alertへの応答を必須にしない。

## Startup and Folder access

- Library未選択時はsidebarに「ライブラリを開く」、GPXを含むFolderの選択、read-onlyであることを短く表示する
- pickerは`{ mode: "read" }`で開く
- Cancelはerror表示またはConsole errorを発生させず、初回案内または既存Library状態へ戻る
- permission failureはretry可能な画面内メッセージを表示し、既存Libraryを維持する
- permission failureの内部error文字列またはstack traceを画面へ表示しない
- GPX 0件は正常なLibraryとしてLibrary名、GPX 0件、空Folderメッセージを表示する
- 空LibraryのSearch indexは空、Mapは初期状態、root checkboxはdisabled、Library切り替えは可能とする
- StatusBarは`role="status"`と`aria-live="polite"`で状態を通知する
- Mobile向けFolder選択fallbackはRelease 1.0へ追加しない

## Stable Viewer quality scope

- 初回起動時にLibraryを開く操作を明確にする
- 空Libraryを正常状態として扱う
- 壊れたGPXまたは一部解析失敗を対象GPXのerrorとして扱い、他GPXの操作を継続する
- Library切り替えで旧LibraryのQueue、cache、Layer、Search結果を反映しない
- Keyboard、ARIA、body scroll、sidebar scroll、MapView固定を維持する
- faviconを明示し、正常起動時の404を発生させない
- 開発用logを正式安定版へ残さない

## Scope boundary

- 一般公開、配布artifact、hosted版、公開supportは扱わない
- TrailBook本体のOSS license、作者名義、copyright名義を決定しない
- 日付表示、車両情報、GPX編集、Statistics、Replay、HeatMap、Cloud Sync、Mobile専用UI、Plugin、AI Searchを追加しない
- Mobile向けFolder選択fallback、複数GPX選択、ZIP Library読込、クラウドFolder importを追加しない

# 21. Release 1.1 Track Selection & Styling

Release 1.1はPlanning状態であり、次のUI contractを実装前仕様として確定する。

## Track selection

- Map上の表示中Trackはclick可能とする
- Map Track click、Tree GPX行、Search GPX result activateは同じ単一Selectionへ同期する
- Mapから選択した場合はviewportを動かさない
- Tree / Searchから表示中GPXを選択した場合は既存どおり対象GPXへrefocusする
- Tree / Searchから非表示GPXを主選択してもMapは変更しない
- 選択Trackを非表示にした場合、Clear、Library切り替え、対象GPXのparse failureで選択を解除する
- Map背景clickで選択を解除する。Track layer由来clickとdragでは解除しない
- overlapping Trackは最前面の1件を選択する。cycle selectionはRelease 1.1へ追加しない

TreeViewの`aria-selected`とMap highlightは`SelectionState`の同じpathを表示する。表示checkboxとSelectionは引き続き別の状態とし、selectionだけで表示ON / OFF、Queue投入、cache追加を行わない。

## Selected highlight

- 選択Trackのmain lineは解決済みFolder色を維持する
- main lineを通常より3 px太くする
- main lineより2 px太い対比色outlineを背面へ表示する
- selected opacityは1.0とする
- 選択Trackを同一pane内の前面へ移動する
- 他Trackのopacityは変更しない
- 選択解除時はoutlineを削除し、main lineを現在zoomの通常styleへ戻す
- outlineはclick targetにしない

細線のclick領域はLeaflet Canvas rendererのtoleranceで広げる。初期実装では全Trackへ透明hit Polylineを追加しない。

## Folder color control

各render済みFolder行にcolor swatch buttonを設ける。明示色または継承色がある場合はresolved colorを示し、どちらもない場合は子GPXごとのpath hash色を単一色に置き換えず「Auto」を示す。root Folderにも表示し、root色をLibrary全体の継承元として設定できる。

| Candidate | Evaluation |
| --- | --- |
| Folder context menu | right click依存と独自menu keyboard実装が必要なため不採用 |
| Folder menu button | 到達可能だが、色設定だけのRelease 1.1にはmenu階層が過剰 |
| Folder color swatch button | 現在状態と入口を一つにできるため採用 |
| Toolbarの選択Folder色 | 現在Folder selectionの新設が必要となるため不採用 |

- swatchはnative buttonとし、右clickだけに依存しない
- buttonのaccessible nameへFolder名と「色を設定」を含める
- 色だけでexplicit / inherited / Autoを伝えず、tooltipまたはdialog textでも状態を示す
- checkbox、Folder展開、row selectionと別のclick targetにし、event propagationで競合させない
- Tabで到達し、Enter / Spaceで単一のFolder color dialogを開く

dialogは現在Folder名、現在のresolved color、`input type="color"`、Apply、Defaultへ戻す、Cancelを持つ。

- Applyだけがvalidな`#RRGGBB`をcommitする
- Defaultへ戻す操作は対象Folderの明示色だけを削除する
- Cancel、Escape、dialog外終了では変更しない
- 閉じた後は起点swatchへfocusを戻す
- storageへ保存できない場合もsession中の色は反映し、StatusBarで非ブロッキングに通知する

## Folder color inheritance

表示色は次の順で解決する。

1. 対象Folder自身の明示色
2. 対象Folderからroot方向へ探索して最初に見つかる、最も近い祖先Folderの明示色
3. GPX relative pathの既存path hash色
4. 最終fallback色

対象Folder自身に明示色があれば必ず使用し、自身が未設定の場合だけ祖先を探索する。直接親だけに限定せず、rootを含めて最初に見つかった最も近い祖先色を継承する。Defaultへ戻すと祖先色へ戻り、Library内に明示色が一切なければv1.0.0と同じ各GPX relative pathのhash色へ戻る。色未設定Folderの子GPXをFolder path由来の単一色へ変更しない。GPX単位色は設定しない。

## Zoom-based width

線幅は`zoomend`後に次のbucketで更新する。

| Zoom | Normal | Selected main | Selected outline |
| ---: | ---: | ---: | ---: |
| 15以上 | 4 px | 7 px | 9 px |
| 12〜14 | 3 px | 6 px | 8 px |
| 9〜11 | 2 px | 5 px | 7 px |
| 8以下 | 1 px | 4 px | 6 px |

同じbucket内ではTrack styleを更新しない。bucket変更時は表示中Trackだけを更新し、refocus、GPX再解析、Queue、cache、Waypointを変更しない。

## Persistence feedback

Folder colorはLibrary再選択またはpage reload後に復元する。root Folder名変更、同名Library衝突、localStorage削除、破損値、未知schemaではDefault色へ戻る場合があるが、GPX表示は継続する。

GPX、Folder、FileHandle、解析geometryを保存しない。storage failureはblocking dialogにせず、色設定が現在sessionだけ有効であることをStatusBarで通知する。

## Release 1.1 accessibility

- Track clickの同等操作としてTreeViewとSearchのkeyboard selectionを維持する
- Map背景解除だけを唯一の解除手段にしない。Clearと選択中Trackの非表示でも解除できる
- Folder colorはkeyboardだけで設定、Default、Cancelできる
- swatchとdialogはfocus order、label、dialog name、focus returnを持つ
- highlightとFolder color状態を色だけで伝えない
- 既存roving tabindex、bulk checkbox、Search keyboard、Waypoint optionを回帰させない

## Release 1.1 scope boundary

- 前回表示Track、前回Map位置を復元しない
- Date Tree、vehicle metadata、GPX / TrackPoint / Waypoint編集を追加しない
- GPX単位色、palette共有、Cloud Sync、hover previewを追加しない
- Mobile Viewer UXとWaypoint clusteringを追加しない
- GPXまたはFolder構造へ色を保存しない
