# START_HERE.md

TrailBookの開発を始める人とAIのための入口です。

## Current Status

- Current Release: `v0.8.0` Waypoint Display Option
- Completed: Release 0.1からRelease 0.8
- Next Release: Release 0.9 Search
- Branch: `main`
- Baseline at the start of Release 0.9 planning: `main` and `origin/main` are aligned, working tree is clean

Gitの状態は作業開始時に必ず再確認する。上記のGit状態はRelease 0.9設計開始時点の記録であり、将来の状態を保証するものではない。

## What is TrailBook?

TrailBookは、フォルダ構造をそのままライブラリとして利用する、オフラインファーストのGPXライブラリアプリケーションである。

GPXを独自形式へ取り込むのではなく、ユーザーのGPX資産を唯一の正本として閲覧・整理・活用する。

## Read These Documents First

次の順序で読む。

1. `PROJECT.md` — 目的、スコープ、設計思想
2. `VISION.md` — 長期的な製品像
3. `ARCHITECTURE.md` — 現在の責務分割とデータフロー
4. `CODING_RULES.md` — 実装規約
5. `ROADMAP.md` — 完了Releaseと次Release
6. `UI_SPEC.md` — Release 0.4から0.8までの確定UI仕様
7. `DECISIONS.md` — 採用済み設計判断と理由
8. `AI_GUIDE.md` — AIとの開発手順
9. `CONTRIBUTING.md` — 作業規約
10. `GLOSSARY.md` — 用語
11. リポジトリルートの`README.md`、`CHANGELOG.md` — 公開概要とリリース履歴

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

## Release 0.9 Boundary

次のReleaseはSearchである。

Release 0.9では、GPXファイル名、Folder名、相対パスをmetadataから検索する。検索のためにGPX内容を解析せず、表示Queueや解析cache、MapViewへ影響させない。

検索機能の詳細な範囲と将来拡張境界は`ROADMAP.md`を正本とする。

## Non-Negotiable Rules

- GPXは唯一の正本である。
- ユーザーのGPXを暗黙に変更、移動、削除、上書きしない。
- Folder構造とGPXファイルをデータの正本とする。
- SQLite、IndexedDBなどの独自DBを持たない。一時的なセッションcacheは独自DBに含めない。
- 独自DBを持たない方針を変更する場合は、新しいDecisionを必要とする。
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
