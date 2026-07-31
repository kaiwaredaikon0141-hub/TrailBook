\# GLOSSARY.md



Version : 1.0

Status  : Official



Purpose :

TrailBook で使用する用語を統一する。



人間・AI・設計書・ソースコードは

本書の定義を使用する。



意味が曖昧な場合は

本書を優先する。



\---



\# A



\## App



TrailBook アプリケーション本体。



システム全体を統括するクラス。



App は処理を持たず、

各コンポーネントを接続する役割を持つ。



\---



\# C



\## Cache



一時的に保持する高速アクセス用データ。



マスターデータではない。



削除されても復元できる。



\---



\## Component



UIを構成する独立部品。



Toolbar



StatusBar



TreeView



など。



\---



\# D



\## Directory



OS上のフォルダ。



Folder Modelとは区別する。



\---



\# E



\## Event



システム内通知。



UI同士は直接通信せず、

EventBusを介して通知する。



例



library:loaded



track:selected



\---



\## EventBus



イベント中継機構。



UI間通信は必ずEventBus経由とする。



\---



\# F



\## Folder



TrailBook内の論理フォルダ。



OS上のDirectoryを表現するModel。



\---



\## FolderScanner



Directoryを読み取り、

Libraryを生成するService。



\---



\# G



\## GPX



GPS Exchange Format。



TrailBookが扱う唯一のマスターデータ。



\---



\## GPXLoader



GPXファイルを読み込むService。



解析は行わない。



\---



\## GPXParser



GPXを解析し

Track Modelを生成するService。



\---



\# L



\## Library



TrailBook全体のGPXコレクション。



Folder



Track



Metadata



を保持する。



Libraryはアプリ内で一つだけ存在する。



\---



\# M



\## Metadata



Trackに付随する情報。



例



作成日時



距離



時間



説明



\---



\## Model



データのみを保持するオブジェクト。



画面を知らない。



\---



\# P



\## Property



Trackに関する情報表示。



距離



時間



標高



速度



など。



\---



\# R



\## Replay



Trackを時間順に再生する機能。



動画ではない。



\---



\## Route



移動予定経路。



Trackとは異なる概念。



TrailBookでは基本対象外。



\---



\# S



\## Service



アプリケーション処理を担当するクラス。



UIを知らない。



\---



\## State



現在のアプリ状態。



例



選択Track



現在Folder



表示Map



など。



\---



\# T



\## Tag



ユーザーが付与する分類情報。



GPXとは独立した管理情報。



\---



\## Toolbar



画面上部の操作パネル。



\---



\## Track



実際に移動したGPSログ。



TrailBookで最も重要なデータ。



TrackはGPXから生成される。



\---



\## TreeView



LibraryをExplorer形式で表示するUI。



\---



\# U



\## UI



画面表示を担当する層。



データ処理は禁止。



\---



\## Utility



共通関数。



状態を保持しない。



副作用を持たない。



\---



\# W



\## Waypoint



GPX内の地点情報。



Track Pointとは異なる。



\---



\## Workspace



現在開いているLibraryの作業状態。



将来追加予定。



\---



\# General Terms



\## Asset



ユーザーが所有するデータ。



TrailBookでは



GPX



写真



タグ



などを指す。



\---



\## Master Data



唯一の正しいデータ。



TrailBookでは



GPX



のみ。



\---



\## View



画面表示を担当するUI。



ビジネスロジックを持たない。



\---



\## Selection



現在ユーザーが選択している対象。



Folder



Track



Waypoint



など。



\---



\## Session



TrailBook起動から終了までの実行期間。



保存対象ではない。



\---



\# Naming Rules



Track



実際のGPSログ



Route



予定経路



Folder



論理フォルダ



Directory



OSフォルダ



Library



GPXコレクション全体



Model



データ保持



Service



処理



View



表示



Utility



共通関数



Component



UI部品



\---



\# Reserved Words



以下はTrailBook専用語として使用する。



Library



Track



Waypoint



Folder



Property



Replay



Selection



Workspace



これらを他用途で使用しない。



\---



\# Future Terms



Version 2以降で追加予定。



Plugin



Timeline



Cloud Sync



Photo Library



Video Library



AI Search



3D View



\---



\# Golden Rule



一つの言葉には

一つの意味しか持たせない。



同じ意味には

一つの言葉しか使わない。



言葉が統一されれば



設計は統一され



コードも統一される。



End of Document

