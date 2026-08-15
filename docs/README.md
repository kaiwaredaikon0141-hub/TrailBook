# TrailBook Documentation

このdirectoryはTrailBookの設計・運用に関する正本文書の入口です。利用方法と起動手順はrootの[README.md](../README.md)を参照してください。

## Current Status

- Current Release: `1.7.0`
- Completed: Release 0.1からRelease 1.7
- Next Release: Not defined

Release 1.4 Library Browsing / Track DiscoveryはCompletedです。Release 1.3の前回Library / view restorationとgeometry cacheを維持し、1つのDiscovery IndexからDate Tree、Track Info、Track名 / Folder / date range Search・Filterを提供します。

Release 1.4 Unit 1〜6の設計、実装、Browser Acceptance、performance、data protection、finalization記録はCompletedです。warm Discovery Indexは約806 GPXで中央値3秒、warm Track restoreは既存中央値3秒を維持する定性的受け入れを完了しています。

Release 1.6はCompletedです。Date Tree簡略化、Track日付修正・date-based filename rename・平行移動、Date mode selection同期、OSM / 国土地理院標準地図切替、一括簡略化を確定し、Release 1.5のOriginal Backup + In-place Edited GPXを維持します。

Release 1.7はCompletedです。Mobile Viewer、GPS Current Position / Follow、Driving Mode / Screen Wake Lock、read-only Google Drive Library Reader、Drive Geometry Cache / cold-load 4並列、GitHub Pages HTTPS deployment、Mobile UI改善を確定します。

## Read Order

1. [START_HERE.md](START_HERE.md) — 現在状態、作業開始条件、変更禁止原則
2. [PROJECT.md](PROJECT.md) — Projectの目的と原則
3. [VISION.md](VISION.md) — 長期Vision
4. [ARCHITECTURE.md](ARCHITECTURE.md) — 現在の構造と依存関係
5. [CODING_RULES.md](CODING_RULES.md) — 実装規則
6. [ROADMAP.md](ROADMAP.md) — Release履歴、次Release、将来候補
7. [UI_SPEC.md](UI_SPEC.md) — 確定UI仕様
8. [DECISIONS.md](DECISIONS.md) — 採用済みDecision
9. [AI_GUIDE.md](AI_GUIDE.md) — AIとの作業方法
10. [CONTRIBUTING.md](CONTRIBUTING.md) — Gitと変更手順
11. [GLOSSARY.md](GLOSSARY.md) — 用語

Release 1.0のUnit 1〜8、Release 1.1のUnit 1〜7、Release 1.2のUnit 1〜5、Release 1.3のUnit 1〜7、Release 1.4のUnit 1〜6、Release 1.5のUnit 1〜6、Release 1.6のUnit 1〜7、Release 1.7のUnit 1〜6は[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)に記録しています。

Release 1.1 Unit roles:

1. Planning and architecture
2. TrackStyleService and zoom-based width
3. SelectionState、Map click、highlight
4. UI settings persistence foundation
5. Folder color UI and inheritance
6. Monochrome Map Mode
7. Integrated acceptance、qualitative performance、documentation、Release finalization

Release 1.2 Unit roles:

1. Planning、schema、permission / conflict policy
2. `trailbook.json` read-only loader
3. Explicit Save、write permission、conflict protection
4. Migration、manual Reload、Conflict recovery
5. Integrated acceptance、documentation、Release finalization

Release 1.3 Unit roles:

1. Scope、Architecture、Decisions、schema、identity、restore / test plan
2. ViewStateStore、Map center / zoom、desktop sidebar、Reset基盤
3. visible Track restore、existing Queue、bulk coalescing、806 GPX性能
4. previous DirectoryHandle、permission UX、自動 / 手動Library open
5. 806 GPX warm restore約5秒のperformance gate、条件付きgeometry cache
6. selected Track restore、Reset UI、error / Library lifecycle
7. Chrome / Edge統合受け入れ、性能、文書、Release finalization

Release 1.4 Unit roles:

1. Planning、Architecture、Decision、date / summary contract
2. Library Discovery Indexとshared derived-data cache
3. Date Tree、Folder / Date mode、年月bulk visibility、Track Alpha Blending
4. Track Info、Sidebar resize、GPX encoding / cache invalidation
5. Track名 / Folder / date range Search・Filter
6. Chrome / Edge統合、performance、data protection、documentation、finalization

Release 1.5 Unit roles:

1. Planning、Architecture、Decision、data protection、algorithm / serializer / test contract
2. Immutable editing source、working copy、session、command history、serializer
3. Segment-local Ramer–Douglas–Peucker、metrics、Undo / Redo core
4. Editor UI、line / point preview、Apply、Done / draft、Cancel
5. Original Backup + In-place Save、verification、reserved Folder、targeted refresh
6. Integration acceptance、documentation、Release finalization

## Implemented Through Release 1.7

- Folder Libraryと再帰走査
- GPX Parser
- Leaflet Map
- TreeView遅延DOM
- 複数GPX表示とsession cache / Queue
- GPX個別、Folder、root一括表示
- Waypoint表示option
- Folder名、GPXファイル名、相対pathのSearch
- 初回起動、非対応環境、read-only Folder選択の案内
- Stable Viewer向け品質整理、利用文書、licenseと第三者表記
- zoom連動Track線幅
- Map / TreeView / Searchの単一Track選択とhighlight / outline
- root / nested Folder color、nearest ancestor継承、Default / Auto
- Folder色とglobal Map modeに限定したUI設定persistence
- 背景OSM tileだけを対象とするColor / Monochrome表示
- Library root直下のschema version 1 `trailbook.json` read / validation
- Folder色のLibrary共有、明示Save、legacy migration
- manual ReloadとReload / Overwrite / Cancel Conflict recovery
- invalid shared JSONのfail-closed処理と明示Overwrite recovery
- Google Drive等の同期Folderを通常fileとして利用する運用
- LibraryごとのMap center / zoom、Sidebar、visible / selected Track復元
- IndexedDBのprevious DirectoryHandleによる前回Library再開
- 再生成可能なIndexedDB geometry cacheと約807 Trackの3秒warm restore中央値
- 1 GPX 1件のLibrary Discovery Indexと約806 GPXの3秒warm build中央値
- 年 / 月 / Track / Unknown Dateのlazy Date Treeと年月bulk visibility（日nodeなし）
- selected Trackのread-only Track Info
- Track名 / Folder path / inclusive date range Search・Filter
- Track Alpha Blendingとdesktop Sidebar / Track Info resize
- GPX encoding decodeとbroken Track nameのfilename fallback
- immutable sourceとmemory working copyによる単一GPX editing session
- Segment単位Ramer–Douglas–Peucker、metrics、line / point preview
- Apply、Undo / Redo、Done / draft再開、Cancel
- 作業中のOriginal Backup + In-place Save、source protection、read-back verification、targeted Library refresh
- responsive Mobile Viewer、overlay Sidebar、touch UI、mobile Track Info
- GPS現在地 / Follow、Driving Mode、Screen Wake Lock
- read-only Google Drive Library Reader、pre-download Geometry Cache lookup、cold cache miss 4並列
- GitHub Pages HTTPS deploymentとruntime Google config

実装済み範囲の詳細は[CHANGELOG.md](../CHANGELOG.md)、Release順序は[ROADMAP.md](ROADMAP.md)を正本とします。

## Current Release and Future Features

Release 1.7はCompletedです。Release 1.6までのViewer / Editorを維持し、Mobile Viewer、GPS / Follow、Driving Mode / Wake Lock、read-only Google Drive Reader、GitHub Pages deploymentを追加しました。Drive large cold-loadの追加高速化とoffline mapは将来候補です。

Search / Tree navigation復元、Stable Library Identity / Alias、point移動・追加・削除、区間削除、Track分割・結合、Backup overwrite / deleteに加え、Statistics、Replay、HeatMap、vehicle metadata、Cloud Sync、Mobile editing、offline map、Drive large cold-load optimization、Waypoint性能最適化、Plugin、AI Searchなどは未実装の将来候補です。

## Source of Truth

- GPXとFolder構造がデータの正本です。
- 設計判断はこのdocs directoryの正本文書を優先します。
- 実装と文書が矛盾する場合は、推測で修正せず差異を確認します。
- TrailBook本体のlicense方針と第三者条件は[LICENSE](../LICENSE)および[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)を参照します。
