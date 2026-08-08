# TrailBook Documentation

このdirectoryはTrailBookの設計・運用に関する正本文書の入口です。利用方法と起動手順はrootの[README.md](../README.md)を参照してください。

## Current Status

- Current Release: `1.3.0` Previous View Restoration
- Completed: Release 0.1からRelease 1.3
- Next Release: Not scheduled（Future Candidatesから別途承認する）

Release 1.3 Previous View RestorationはCompletedです。前回Library、Map、Sidebar、visible / selected Trackを復元し、既存再parse中央値25秒からIndexedDB geometry cache導入後3秒へ改善して約5秒gateをPassしました。Chrome / Edgeの既存Browser AcceptanceとRelease 1.3 Unit 1〜7の完了記録を統合確認しています。

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

Release 1.0のUnit 1〜8、Release 1.1のUnit 1〜7、Release 1.2のUnit 1〜5、Release 1.3のUnit 1〜7は[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)に記録しています。

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

## Implemented Through Release 1.3

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

実装済み範囲の詳細は[CHANGELOG.md](../CHANGELOG.md)、Release順序は[ROADMAP.md](ROADMAP.md)を正本とします。

## Current Release and Future Features

Release 1.3 Previous View RestorationはCompletedです。TrailBookはGoogle Drive APIや同期statusを使用せず、同期後のmanual ReloadまたはLibrary再選択を利用します。前回表示状態と前回Libraryは端末・browser origin限定であり、共有設定やGPXの正本ではありません。

sidebar width、Search / Tree navigation復元、Stable Library Identity / Aliasに加え、Statistics、Replay、HeatMap、GPX Metadata Index、日付表示、vehicle metadata、GPX編集、GPX size reduction、Cloud Sync、Mobile Viewer UX、Waypoint性能最適化、数値性能再測定、Plugin、AI Searchなども未実装の将来候補です。

## Source of Truth

- GPXとFolder構造がデータの正本です。
- 設計判断はこのdocs directoryの正本文書を優先します。
- 実装と文書が矛盾する場合は、推測で修正せず差異を確認します。
- TrailBook本体のlicense方針と第三者条件は[LICENSE](../LICENSE)および[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)を参照します。
