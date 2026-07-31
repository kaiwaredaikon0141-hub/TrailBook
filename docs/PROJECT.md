# PROJECT.md

Version : 1.0
Status  : Official
Author  : Project Owner / ChatGPT Architect

---

# TrailBook

## Project Definition

TrailBook は GPX ファイルを長期的に管理・閲覧・整理するための
オフラインファーストなライブラリアプリケーションである。

TrailBook の目的は

「GPSログを保存すること」

ではない。

「GPSログを資産として育てること」

である。

TrailBook は GPX を管理するソフトウェアであり、
ナビゲーションソフトではない。

GISソフトでもない。

SNSでもない。

クラウドサービスでもない。

GPXライブラリである。

---

# Vision

TrailBook は

"世界で最も快適な GPX ライブラリ"

を目指す。

大量の GPX を扱っても軽快であり、

誰でも直感的に操作でき、

10年後でも利用できる設計を目標とする。

---

# Design Philosophy

TrailBook の設計思想を以下に示す。

## 1. GPX First

GPX は唯一のマスターデータである。

TrailBook は GPX を加工・変換して保持しない。

GPX が常に正本である。

---

## 2. Folder is Database

フォルダ構造そのものをデータベースと考える。

SQLite等のDBを前提としない。

ライブラリはフォルダである。

ユーザーは Explorer 上で自由に整理できる。

TrailBook はその構造を尊重する。

---

## 3. Offline First

TrailBook はインターネット接続を必要としない。

すべての主要機能はローカルのみで動作する。

クラウド同期は補助機能である。

---

## 4. Simple is Better

必要以上に複雑な設計を採用しない。

理解しやすさを最優先とする。

---

## 5. Performance Matters

大量の GPX を扱うことを前提とする。

起動は高速。

検索は高速。

スクロールは高速。

表示は軽快。

---

## 6. Long Life Software

TrailBook は短期間で作り捨てるソフトではない。

10年以上保守できる設計を目指す。

---

# Target Users

TrailBook は以下の利用者を対象とする。

・ツーリング愛好家

・登山者

・サイクリスト

・旅行好き

・GPSログを大量に保存する人

・GPXを資産として管理したい人

---

# Scope

TrailBook が提供する機能

・GPX管理

・フォルダ管理

・検索

・地図表示

・統計

・タグ

・お気に入り

・Replay

・HeatMap

・将来的な拡張機能

---

# Out of Scope

TrailBook が目指さないもの

・SNS

・ナビゲーション

・リアルタイム位置共有

・クラウド依存

・高機能GIS

・GPSレコーダー

---

# Technical Policy

使用技術

HTML5

CSS3

JavaScript (ES Modules)

Leaflet

Browser File System Access API

Chrome を基準ブラウザとする。

フレームワークは使用しない。

TypeScript は採用しない。

---

# Data Policy

TrailBook はユーザーデータを所有しない。

GPX はユーザーの資産である。

TrailBook は管理・閲覧のみを行う。

勝手に変換しない。

勝手に移動しない。

勝手に削除しない。

---

# Quality Goals

最優先順位

1. 安定性

2. 保守性

3. 可読性

4. 拡張性

5. パフォーマンス

6. デザイン

機能追加より品質を優先する。

---

# AI Development Policy

TrailBook は AI との共同開発を前提とする。

設計は人間が行う。

実装は AI が支援する。

設計変更は設計書を更新してから行う。

コードは設計書に従う。

コードが設計書を書き換えることはない。

---

# Golden Rule

迷ったらシンプルな方を選ぶ。

迷ったら GPX を守る方を選ぶ。

迷ったらユーザーのデータを守る方を選ぶ。

迷ったら10年後も保守できる方を選ぶ。

---

End of Document