# START_HERE.md

TrailBookの開発を始める人とAIのための入口です。

## Current Status

- Current Version: `1.8.0`
- Current Release: Release 1.8
- Completed: Release 0.1からRelease 1.7
- Next Release: Not defined
- Branch: `main`

Gitの状態は作業開始時に必ず再確認する。

## What is TrailBook?

TrailBookは、フォルダ構造をそのままライブラリとして利用する、オフラインファーストのGPXライブラリアプリケーションである。

GPXを独自形式へ取り込むのではなく、ユーザーのGPX資産を唯一の正本として閲覧・整理・活用する。

## Read These Documents First

次の順序で読む。

1. `PROJECT.md` — 目的、スコープ、設計思想
2. `VISION.md` — 長期的な製品像
3. `ARCHITECTURE.md` — 現在の責務分割とデータフロー
4. `CODING_RULES.md` — 実装規約
5. `ROADMAP.md` — 完了Releaseと将来候補
6. `UI_SPEC.md` — Release 1.7までの確定UI仕様
7. `DECISIONS.md` — 採用済み設計判断と理由
8. `AI_GUIDE.md` — AIとの開発手順
9. `CONTRIBUTING.md` — 作業規約
10. `GLOSSARY.md` — 用語
11. リポジトリルートの`README.md`、`CHANGELOG.md` — 公開概要とリリース履歴
12. `RELEASE_CHECKLIST.md` — Release 1.0〜1.7のbaseline / 完了記録

## Current Architecture

- `App`がアプリケーション全体のCoordinatorとしてイベントを調停する。
- `TreeView`はpathベースmetadataを持ち、展開Folderだけを遅延DOM生成する。
- GPXの主選択と地図への表示状態は別の状態として扱う。
- `DisplayState`がpathごとの表示状態、解析cache、requestId、libraryGenerationを管理する。
- `GPXDisplayQueue`がGPX解析要求をFIFO、最大2件並列で処理する。
- `MapView`はLeaflet UI Adapterであり、Layer生成は`LayerManager`へ委譲する。
- `LayerManager`はpathごとにTrack LayerGroupとWaypoint LayerGroupを保持する。
- Folder checkboxはDOMの有無に依存せず、Model上の子孫GPXを一括表示する。
- Waypoint表示はセッション設定で、初期値はOFF。Track Boundsには含めない。
- `SearchService`はTreeView metadataを検索し、総一致件数と先頭100件を返す。
- `SearchView`は検索入力、結果表示、ARIAとキーボード操作を担当する。
- `SearchEntry`は`kind`、`path`、`name`だけを保持し、FileHandleやGPX内容を持たない。
- `SelectionState`がMap / TreeView / Searchで共有する単一GPX pathを管理する。
- `TrackStyleService`がzoom bucket、normal、selected main、outlineのstyleを副作用なしで計算する。
- `FolderColorState`がrootを含むFolder明示色とnearest ancestor継承を解決する。
- `DisplaySettingsStore`はlegacy Folder色fallbackとglobal Map modeだけをschema version 1の`localStorage`へ保存する。
- Monochrome Map Modeは背景OSM tileだけへCSS filterを適用する。
- `LibrarySettingsRepository`がLibrary root直下の`trailbook.json`だけを読込・検証し、明示保存時だけ書き込む。
- `LibrarySettingsState`がshared snapshot、source、dirty、saving、conflictを保持する。
- `LibrarySettingsCoordinator`がload、explicit save、migration、manual Reload、Conflict recoveryを調停する。
- `LibrarySettingsPanel`と`SettingsConflictDialog`がstatusとReload / Overwrite / Cancel操作を担当する。

Release 1.3 Unit 1〜7はCompletedであり、v1.3.0はfinal commit / tag可能な状態である。Unit 5は約807 visible Trackの既存再parse中央値25秒によりIndexedDB geometry cacheを採用し、導入後中央値3秒で約5秒Performance GateをPassした。Unit 6はselected Trackをsystem sourceで復元し、Tree / Search / highlight / ARIAを通常selection経路へ同期する。Unit 4はDirectoryHandleとopaque cache namespaceをorigin-local IndexedDBへ保存し、granted時の自動openとprompt / denied時の明示操作を既存Library lifecycleへ接続する。既存DisplaySettingsStore / shared settings schema、DisplayState、SelectionState、GPXDisplayQueueを正本として維持する。

Release 1.4 Library Browsing / Track DiscoveryのUnit 1〜6はCompletedである。Discovery Index、Date Tree、年月日bulk visibility、Track Info、Track Alpha Blending、Sidebar resize、GPX encoding decode、broken Track name fallback、Track名 / Folder / date range Search・Filterを実装した。Library openとbasic Searchはeager parseせず、Geometry Cacheと共有loaderから同じGPXを一度だけ解析する。

Release 1.5 Safe GPX Editing / Track SimplificationのUnit 1〜6はCompletedである。初回保存はoriginal bytesをreserved `TrailBook_Backup`へ検証付きで保存し、その成功後だけ同じGPX pathを更新する。2回目以降も最初のBackupを上書き・削除せず、automatic restoreは行わない。

Release 1.6のUnit 1〜7はCompletedである。Date Treeを年 / 月 / Trackへ簡略化し、Track日付修正、date-based filename renameとBackup association、Track平行移動、Date mode selection同期、OSM / 国土地理院標準地図切替、Folder / Library一括簡略化を追加した。Release 1.5のOriginal Backup + In-place Edited GPXを維持する。

Release 1.7のUnit 1〜6はCompletedである。responsive Mobile Viewer、GPS Current Position / Follow、Driving Mode / Screen Wake Lock、read-only Google Drive Library Reader、Drive cache pre-download lookup / cold-load 4並列、GitHub Pages HTTPS deployment、Library Open UI整理を追加した。Mobile editing、offline map、Drive large cold-loadの追加高速化は対象外である。

## Implemented Through Release 1.7

Release 1.0 Stable Viewerは完了している。Release 0.9までのFolder Library、GPX Parser、複数GPX表示、Folder / root一括表示、Waypoint option、Searchを維持し、個人利用向けの起動・互換性UX、品質整理、文書、licenseと第三者表記を確定した。

GPXファイル名、Folder名、相対パスをmetadataから検索する。検索のためにGPX内容を解析せず、query入力だけでは表示Queue、解析cache、主選択、表示状態、Mapへ影響させない。

現在の制限としてMobile editing、offline map、GPS track recordingは未実装である。大量GPX表示中のWaypoint ONは操作が重くなるため、大量LibraryではWaypoint OFFを推奨する。OSM / GSI背景tileとGoogle Drive直接接続はオンライン接続を必要とする。

Release 1.1 Track Selection & Stylingは完了している。zoom連動Track線幅、Map / TreeView / Searchの単一選択同期、selected highlight / outline、Folder色と継承、UI設定限定の`localStorage`、Color / Monochrome背景地図表示を実装した。806 GPX Libraryの人間による定性的性能評価はAcceptableで、明確な回帰やUIが固まる操作は確認されていない。数値benchmarkと20%比較は実施していない。

Release 1.2 Shared Library SettingsはCompletedである。Library root直下のschema version 1 `trailbook.json`からFolder色を読み、明示Save / migration / Overwrite時だけ書き込む。valid shared JSON、legacy localStorage、Autoの優先順位を固定し、manual ReloadとReload / Overwrite / CancelによるConflict recoveryを提供する。Chrome / Edge / Google Drive同期Folderで統合受け入れを完了した。Google Drive API、sync status取得、自動merge、polling、background sync、Import / Export、GPX編集は実装していない。

## Non-Negotiable Rules

- GPXは唯一の正本である。
- ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。
- Folder構造とGPXファイルをデータの正本とする。
- SQLite、IndexedDBなどをFolder / GPXに代わるLibrary正本として持たない。一時的なセッションcacheは独自DBに含めない。
- Release 1.3追加設計はDecision 0039 / 0040により、IndexedDBをprevious DirectoryHandleと、性能gate不達時の再生成可能geometry cacheにだけ使用可能とする。これはLibrary正本ではなく、削除・失敗時にViewerが継続できるorigin-local補助である。
- 現行production 1.7はMap表示mode、base map、legacy Folder色fallbackに加え、専用keyへ再生成可能なdevice-local Map / sidebar / visible / selected Track / Discovery UI stateを`localStorage`へ保存する。Folder色はvalidなshared JSONがある場合に項目単位でlegacy値を混ぜない。DirectoryHandleはorigin-local IndexedDBだけへ保存し、localStorage / `trailbook.json`へ保存しない。GPS位置、access token、Driving Modeは永続化しない。
- `trailbook.json`への書き込みはSave、migration、明示Overwriteだけに限定し、permissionの永続化を前提にしない。
- Framework、TypeScript、Node.jsを追加しない。
- UI同士を直接接続せず、EventBusとAppの調停を使用する。
- ModelへUI状態を保存しない。
- Releaseの範囲を越えて実装しない。
- 設計変更は文書を先に更新し、人間の承認後に実装する。

## Git Workflow

- 作業前と完了前に`git status`を確認する。
- ユーザーの既存変更を上書きしない。
- 1 Releaseを小さく検証可能な変更として扱う。
- commit、tag、pushは明示的な依頼がある場合だけ行う。
- Releaseタグと`CHANGELOG.md`を過去Releaseの事実として扱う。

## Source of Truth

設計上の正本は`docs/`である。

- プロジェクト原則: `PROJECT.md`
- 現行構造: `ARCHITECTURE.md`
- 実装規約: `CODING_RULES.md`
- Release範囲: `ROADMAP.md`
- 確定UI仕様: `UI_SPEC.md`
- 判断理由: `DECISIONS.md`
- 公開済み履歴: `CHANGELOG.md`とGitタグ

文書とコードが矛盾する場合は、勝手にどちらかへ合わせず、差異を報告して設計を確認する。
