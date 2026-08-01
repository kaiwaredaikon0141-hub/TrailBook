# TrailBook Documentation

このdirectoryはTrailBookの設計・運用に関する正本文書の入口です。利用方法と起動手順はrootの[README.md](../README.md)を参照してください。

## Current Status

- Current Release: `1.0.0` Stable Viewer
- Completed: Release 0.1からRelease 1.0
- Next Release: Release 1.1 Track Selection & Styling（Planning）

Release 1.0は個人利用向け正式安定版として完了しています。Release 1.1はTrack selection、Folder color、zoom-based width、UI設定persistenceの設計段階であり、production実装はまだ開始していません。

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

Release 1.0のUnit 1〜8（scope確定、baseline、TreeView限定分割、起動・互換性UX、品質整理、文書・license、統合受け入れ、Release確定）は[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)に記録しています。

## Implemented Through Release 1.0

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

実装済み範囲の詳細は[CHANGELOG.md](../CHANGELOG.md)、Release順序は[ROADMAP.md](ROADMAP.md)を正本とします。

## Future Features

Statistics、Replay、HeatMap、GPX Metadata Index、日付表示、vehicle metadata、GPX編集、Cloud Sync、Mobile Viewer UX、Waypoint性能最適化、数値性能再測定、Plugin、AI SearchなどはRelease 1.1対象外の将来候補です。Release 1.0の実装済み機能またはRelease 1.1 Scopeとして扱いません。

## Source of Truth

- GPXとFolder構造がデータの正本です。
- 設計判断はこのdocs directoryの正本文書を優先します。
- 実装と文書が矛盾する場合は、推測で修正せず差異を確認します。
- TrailBook本体のlicense方針と第三者条件は[LICENSE](../LICENSE)および[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)を参照します。
