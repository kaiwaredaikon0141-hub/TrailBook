# TrailBook

TrailBookは、GPXを含むFolderをLibraryとして閲覧する、個人利用向けのOffline First GPX Viewerです。Folder構造とGPXファイルを唯一の正本とし、独自DBへ取り込みません。

## Current Status

- Current Release: `1.1.0` Track Selection & Styling
- Release 1.1 Track Selection & Styling: Completed

Release 1.1は個人利用向けStable Viewerを維持しながら、Track選択、表示style、Folder色、背景地図表示設定を追加した完成Releaseです。一般公開版や配布artifactではありません。

## Implemented Features

- 選択したFolderとサブFolderを再帰走査するFolder Library
- GPX 1.0 / 1.1のTrack、Segment、TrackPoint、Waypoint、Metadata解析
- 遅延DOMを使ったTreeViewとFolder構造表示
- 複数GPXの独立表示、個別ON / OFF、Folder / root一括ON / OFF
- 最大2件並列の解析Queueと最大100件のsession cache
- Folder名、GPXファイル名、相対pathを対象とするmetadata Search
- 表示中GPXの個別refocusと全体refocus
- Waypoint表示option（初期OFF）
- zoom levelに応じたTrack線幅
- Map、TreeView、Searchで同期する単一Track選択
- 元のTrack色を維持するselected highlightとoutline
- rootとnested Folderの明示色、最も近い祖先色の継承、Default / Auto
- Color / Monochrome背景地図表示（初期Color）
- Folder色とMap表示modeに限定したUI設定の`localStorage`保存
- ローカル同梱したLeaflet 1.9.4による地図表示

SearchはGPX内容を解析せず、検索入力だけでGPX表示、Queue、cache、Mapを変更しません。

## Data Principles

- GPXは読み取り専用で扱います。
- GPXを変更、移動、削除、保存しません。
- SQLite、IndexedDBなどの独自DBを使用しません。
- `localStorage`はFolder色とMap表示modeだけに使用し、GPXや解析結果を保存しません。
- Folder構造とGPXファイルが唯一の正本です。
- FileHandleと解析cacheは現在のbrowser sessionだけで保持し、Library切り替えで破棄します。

## Supported Environment

正式対応:

- Windows 10 / Windows 11
- 最新安定版Google Chrome desktop
- 最新安定版Microsoft Edge desktop

Best effort:

- その他のChromium系desktop browser

非対応または未確認:

- Firefox、Safari desktop、その他の未確認browser
- `file://`
- 通常のLAN内HTTP IP

File System Access API、secure context、対応originが必要です。対応originはHTTPS、`http://localhost`、`http://127.0.0.1`です。

### Mobile

iPhone Chromeでは、HTTPSでの起動、Google Drive上のFolder選択、Folder走査、Tree表示までは成功しました。一方、GPX checkbox、Track表示、touch UIは動作しなかったため、Release 1.1では非対応です。原因分類はAPI不足ではなくMobile UI / touch操作未対応です。

Android ChromeとiPad Chromeは未確認です。将来候補`Mobile Viewer UX`でresponsive layout、touch操作、gesture分離などを検討します。

## Start TrailBook

TrailBookは静的HTTP serverから配信してください。`file://`で`src/index.html`を直接開く方法には対応していません。

### A. VS Code Live Server

1. TrailBook repositoryをVS Codeで開きます。
2. Live Serverでrepository rootを配信します。
3. browserでLive Serverの`src/index.html`を開きます。

### B. Python HTTP server

PowerShellでrepository rootへ移動してserverを起動します。

```powershell
cd C:\path\to\TrailBook
python -m http.server 8000
```

その後、次を開きます。

```text
http://localhost:8000/src/index.html
```

### C. Other static HTTP servers

任意の静的HTTP serverでrepository rootを配信し、`src/index.html`を開きます。HTTPS、`http://localhost`、`http://127.0.0.1`を使用してください。

### Open a Library

1. 「ライブラリを開く」を押します。
2. GPXを含むFolderを選択します。
3. browserのpermission確認を許可します。

Folder pickerは`showDirectoryPicker({ mode: "read" })`で開きます。Cancelしても既存Libraryは維持されます。

## Offline Scope and External Communication

Leaflet本体はTrailBookへ同梱されています。次の処理はOpenStreetMap背景tileを必要としません。

- Folder走査
- Tree操作とSearch
- GPX解析とsession cache
- Track / Waypoint layer生成
- すでに読み込んだGPX表示データの操作

OpenStreetMap背景tileはオンライン依存です。地図を表示・移動・zoomすると、表示地点に対応するtile requestがOpenStreetMapのtile serverへ送信されます。そのため、閲覧中の概略地域がtile server側へ伝わる可能性があります。

TrailBookはGPXファイルやGPX内容を外部serverへアップロードしません。OSM tileのbulk download、prefetch、offline保存は実装していません。

## Data Protection

- File System AccessはユーザーがFolder pickerを操作したときだけ開始します。
- pickerはread-only modeを指定し、`createWritable`を使用しません。
- GPXを変更、移動、削除、保存しません。
- FileHandleと解析cacheはsession限定で、Library切り替え時に破棄します。
- SQLiteとIndexedDBを使用しません。
- `localStorage`にはFolder色とColor / Monochrome modeだけを保存します。
- FileHandle、FolderHandle、GPX XML、TrackPoint、解析geometryを永続化しません。
- 自動同期や外部serverへのGPX送信を行いません。

## Known Limitations

- Mobile UIは未対応です。
- iPhone ChromeはFolderとTree表示までは可能ですが、GPX操作とtouch UIには対応していません。
- Android ChromeとiPad Chromeは未確認です。
- 大量GPX表示中にWaypointをONにすると、多数のMarker描画により操作が重くなります。大量LibraryではWaypoint OFFを推奨します。
- Waypointは初期OFFです。
- OpenStreetMap背景tileはオンライン依存で、offline地図保存はありません。
- GPX編集、GPX書き込み、Undo / Redo、保存、別名保存はありません。
- 自動同期はありません。
- Google DriveはFolder選択時点でbrowserから参照できる内容を読むだけです。Drive側の更新後はLibraryを再読込してください。
- File System Access API対応browserと対応originが必要です。
- `file://`では起動できません。
- overlapping Trackをclickした場合は、最前面の1件を選択します。
- 同名root Folderは同じLibrary IDとなり、Folder色設定が共有される場合があります。root名を変更すると別Libraryとして扱われます。
- Monochrome Map Modeは既存OSM tileへCSS filterを適用する方式です。

## Documentation

設計・開発文書は[docs/README.md](docs/README.md)から参照してください。開発を始める場合は[docs/START_HERE.md](docs/START_HERE.md)を最初に読んでください。

## License and Third-Party Components

TrailBook source codeは、現時点ではオープンソースライセンスで提供されていません。複製、変更、配布の許諾は与えられていません。詳細は[LICENSE](LICENSE)を参照してください。将来一般公開する場合は、ライセンス方針を新しいDecisionとして再検討します。

LeafletおよびOpenStreetMapはTrailBook本体とは別の条件に従います。[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)と[src/vendor/leaflet/LICENSE](src/vendor/leaflet/LICENSE)を参照してください。
