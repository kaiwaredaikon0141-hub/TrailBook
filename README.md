# TrailBook

TrailBookは、GPXを含むFolderをLibraryとして閲覧する、個人利用向けのOffline First GPX Viewerです。Folder構造とGPXファイルを唯一の正本とし、独自DBへ取り込みません。

## Current Status

- Current Release: `1.7.0`
- Release 1.7: Completed
- Next Release: Not defined

Release 1.7はMobile Viewer、GPS現在地 / Follow、走行中モード / Screen Wake Lock、read-only Google Drive Library Reader、GitHub Pages HTTPS deploymentを追加したCompleted Releaseです。Release 1.6までのViewer / Editorとdata protection境界を維持します。

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
- Library root直下の`trailbook.json`によるFolder色共有
- shared settingsの明示Save、legacy色migration、manual Reload
- 外部変更を保護するReload / Overwrite / Cancel conflict recovery
- LibraryごとのMap center / zoom、Sidebar、visible / selected Track復元
- 前回Libraryの自動復元とpermission拒否時の手動picker fallback
- 再生成可能なIndexedDB geometry cacheによる大量Trackのwarm restore
- 年 / 月 / TrackとUnknown Dateで横断表示するlazy Date Tree（日nodeなし）
- 年 / 月単位のbulk visibilityとFolder Treeとの状態同期
- selected Trackの距離、point数、日時、duration、elevationを表示するTrack Info
- Track名 / Folder pathとinclusive date rangeによるSearch / Filter
- 通常Track opacity 0.55のalpha blending
- desktop Sidebar幅とTrack list / Track Info高のresize・復元
- GPX encoding decodeと壊れた内部Track名のfilename fallback
- 単一GPXのRamer–Douglas–Peucker Track軽量化とBefore / After / Both preview
- Point preview、Apply、Undo / Redo、Done、Cancelとsession-memory draft再開
- original Backup後の明示保存、read-back verification、同一pathのtargeted refresh
- Track Point timeの一括日付shift、日付based filename rename、Track全体の平行移動
- OpenStreetMap / 国土地理院標準地図の背景地図切替（device-local設定）
- 選択Folder配下またはLibrary全体を対象にした解析後明示実行の一括簡略化
- 768px以下のresponsive Mobile Viewer、overlay Sidebar、touch target、mobile Track Info
- session-only GPS現在地、accuracy circle、Follow ON / OFF
- GPS FollowとScreen Wake Lockをまとめる走行中モード
- OAuth / Pickerによるread-only Google Drive Libraryの直接接続とlazy GPX load
- Drive geometry cacheのpre-download lookupとcold cache missの最大4並列取得
- GitHub Pages HTTPS deploymentとcredentialをcommitしないruntime config生成
- ローカル同梱したLeaflet 1.9.4による地図表示

従来のFolder名、GPXファイル名、relative path Searchはmetadataだけで動作します。Track名またはdate filterを明示した場合だけDiscovery Indexを遅延構築し、filter入力だけではGPX表示、SelectionState、DisplayState、Map center / zoomを変更しません。

## Data Principles

- Current Release 1.7は、利用者の明示`保存`時にoriginal bytesのBackupを検証した後だけGPXを更新します。日付filename rename時もBackup originalはrenameしません。
- Backup成功前、自動、backgroundではGPXを変更・移動・削除しません。date-based filename renameは明示`保存`と検証成功後だけ旧source pathを削除します。
- `trailbook.json`への書き込みはSave、Migration、明示Overwriteの利用者操作時だけ行います。
- SQLiteやIndexedDBをFolder / GPXに代わるLibrary正本として使用しません。
- `localStorage`はdevice-local Map mode、legacy Folder色fallback、Library別のprevious view stateに使用し、GPX XMLやgeometryを保存しません。
- validなshared JSONがある場合、Folder色へlegacy localStorage値を項目単位で混ぜません。
- Folder構造とGPXファイルが唯一の正本です。
- 前回LibraryのDirectoryHandleと再生成可能なparsed geometryだけをorigin-local IndexedDBへ保存します。GPXとFolder構造が引き続き唯一のデータ正本です。

## Supported Environment

正式対応:

- Windows 10 / Windows 11
- 最新安定版Google Chrome desktop
- 最新安定版Microsoft Edge desktop

Best effort:

- その他のChromium系desktop browser
- HTTPSで開いたAndroid Chrome Mobile Viewer（端末機能に依存）

非対応または未確認:

- Firefox、Safari desktop、その他の未確認browser
- `file://`
- 通常のLAN内HTTP IP

File System Access API、secure context、対応originが必要です。対応originはHTTPS、`http://localhost`、`http://127.0.0.1`です。

### Mobile

Release 1.7はMap主体のresponsive layout、overlay Library Sidebar、touch向けcontrol、GPS現在地 / Follow、走行中モードを提供します。GitHub PagesのHTTPS URLでGoogle Drive直接接続を利用できます。

Mobile editingは対象外で、編集入口はmobile幅で非表示です。File System Access API、Geolocation、Wake Lockの利用可否とpermissionはbrowser / OSに依存します。iPhone / iPadのRelease 1.7統合操作は未確認です。

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

### D. GitHub Pages

GitHub PagesのHTTPS deployment手順は[docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md)を参照してください。

### Open a Library

1. 主導線の「端末からライブラリを開く」を押します。Google Drive API Readerを使う場合は「Google Driveに直接接続」を選びます。
2. GPXを含むFolderを選択します。
3. browserのpermission確認を許可します。

Folder pickerは`showDirectoryPicker({ mode: "read" })`で開きます。Cancelしても既存Libraryは維持されます。Folder色を共有fileへ保存する場合だけ、別の明示操作でreadwrite permissionを確認します。

### Shared Library Settings

- `trailbook.json`は選択したLibrary root直下だけから読みます。
- validなJSONのFolder色はdevice-localなlegacy色より優先されます。
- Folder color Apply / Defaultだけではfileへ書き込みません。
- `Libraryへ保存`、明示Migration、Conflict dialogの明示OverwriteだけがJSONを書き込みます。
- `設定を再読み込み`で外部変更を反映できます。未保存変更がある場合は破棄確認を表示します。
- Google Drive等の同期Folderも通常fileとして扱います。TrailBookはGoogle Drive API、同期status、provider metadataを使用しません。
- 外部同期完了をTrailBookは検出・保証しないため、同期後にmanual ReloadまたはLibrary再選択が必要な場合があります。

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
- 通常のLibrary pickerはread-only modeを指定します。`createWritable`を使用するのは、明示操作による`trailbook.json`保存と、Editorの初回原本Backupおよび同一path保存だけです。
- Editorは明示`保存`時だけreadwrite permissionを要求し、Backup成功前、自動、backgroundではGPXを書き換えません。
- session cacheはLibrary切り替え時に破棄します。前回Library Handleと再生成可能geometry cacheだけはorigin-local IndexedDBへ保存します。
- SQLiteやIndexedDBをLibraryの正本として使用しません。
- `localStorage`にはdevice-local UI設定とLibrary別previous view stateを保存します。
- DirectoryHandleをlocalStorage / `trailbook.json`へ保存せず、GPX XML、Leaflet Layer、Queue状態を永続化しません。
- 自動保存、polling、background sync、automatic merge、外部serverへのGPX送信を行いません。

## Known Limitations

- Mobile UIは未対応です。
- iPhone ChromeはFolderとTree表示までは可能ですが、GPX操作とtouch UIには対応していません。
- Android ChromeとiPad Chromeは未確認です。
- 大量GPX表示中にWaypointをONにすると、多数のMarker描画により操作が重くなります。大量LibraryではWaypoint OFFを推奨します。
- Waypointは初期OFFです。
- OpenStreetMap背景tileはオンライン依存で、offline地図保存はありません。
- point移動・追加・削除、区間削除、Track分割・結合、BackupのOverwrite / deleteは未実装です。
- 編集draftはsession memory限定で、page reload、Library変更、別GPXの編集開始では破棄されます。
- Folder rename / moveとImport / Exportは未実装です。
- automatic merge、polling、background sync、cloud APIはありません。
- Google Driveの同期statusは取得しません。Drive側の更新後はmanual ReloadまたはLibrary再選択が必要な場合があります。
- fingerprint確認後からwriter closeまでの競合raceは完全には排除できず、post-write verificationで不一致を検出します。
- File System Accessのpermissionがbrowser sessionを越えて保持されることを前提にしません。
- File System Access API対応browserと対応originが必要です。
- `file://`では起動できません。
- overlapping Trackをclickした場合は、最前面の1件を選択します。
- 同名root Folderは同じLibrary IDとなり、Folder色設定とdevice-local view stateが衝突する場合があります。root名を変更すると別Libraryとして扱われます。
- 前回Library recordとgeometry cacheはorigin単位です。scheme、host、portの変更やsite data削除後は利用できず、通常picker / parseへfallbackします。
- Monochrome Map Modeは既存OSM tileへCSS filterを適用する方式です。

## Documentation

設計・開発文書は[docs/README.md](docs/README.md)から参照してください。開発を始める場合は[docs/START_HERE.md](docs/START_HERE.md)を最初に読んでください。

## License and Third-Party Components

TrailBook source codeは、現時点ではオープンソースライセンスで提供されていません。複製、変更、配布の許諾は与えられていません。詳細は[LICENSE](LICENSE)を参照してください。将来一般公開する場合は、ライセンス方針を新しいDecisionとして再検討します。

LeafletおよびOpenStreetMapはTrailBook本体とは別の条件に従います。[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)と[src/vendor/leaflet/LICENSE](src/vendor/leaflet/LICENSE)を参照してください。
