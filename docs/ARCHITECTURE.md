# ARCHITECTURE.md

Version : 1.0
Status  : Official
Depends : PROJECT.md

---

# Architecture Overview

TrailBook は
責務分離 (Separation of Concerns)
を最優先とする。

一つのクラスは
一つの責務のみを持つ。

各モジュールは独立し、
最小限の依存関係のみを持つ。

---

# System Overview

                   +----------------+
                   |    Browser     |
                   +-------+--------+
                           |
                     File System API
                           |
                    +------+------+
                    | FolderScanner|
                    +------+------+
                           |
                  Directory / GPX List
                           |
                     +-----+------+
                     | Library     |
                     +-----+------+
                           |
          +----------------+----------------+
          |                                 |
     GPXParser                       CacheManager
          |                                 |
          +----------------+----------------+
                           |
                     GPX Model
                           |
      +----------+---------+---------+----------+
      |          |                   |          |
  TreeView   MapView            PropertyView  Search
      |          |                   |          |
      +----------+---------+---------+----------+
                           |
                          App
                           |
                      Toolbar
                           |
                      StatusBar

---

# Layer Structure

Application

↓

Presentation Layer

↓

Service Layer

↓

Model Layer

↓

Browser API

上位レイヤーは
下位レイヤーのみを利用できる。

逆方向の参照は禁止。

---

# Directory Structure

src/

    css/

    js/

        core/

        ui/

        services/

        models/

        map/

        file/

        search/

        utils/

        assets/

---

# Core Layer

core/

システム全体を管理する。

含まれるクラス

App

Config

EventBus

ApplicationState

ThemeManager

責務

・初期化

・終了処理

・イベント管理

・設定管理

---

# UI Layer

ui/

画面表示のみを担当する。

ビジネスロジックは禁止。

対象

Toolbar

TreeView

StatusBar

MapView

PropertyView

Dialog

Panel

---

# Service Layer

services/

アプリケーションの処理を担当する。

UIは知らない。

対象

FolderScanner

GPXLoader

GPXParser

StatisticsService

ReplayService

HeatMapService

ImportService

ExportService

---

# Model Layer

models/

データだけを保持する。

画面を知らない。

処理も持たない。

例

Library

Folder

Track

Waypoint

Statistics

Tag

Favorite

---

# Utility Layer

utils/

共通処理のみ。

副作用を持たない。

例

DateUtil

GeoUtil

MathUtil

FileUtil

ColorUtil

StringUtil

---

# Event System

UI同士は直接通信しない。

すべて EventBus を経由する。

例

Folder Opened

↓

FolderScanner

↓

Library Updated

↓

TreeView Update

↓

Map Update

↓

Status Update

直接

TreeView -> MapView

は禁止。

---

# Data Flow

Folder

↓

FolderScanner

↓

GPXLoader

↓

GPXParser

↓

Library

↓

TreeView

↓

MapView

↓

PropertyView

---

# Dependency Rules

App

↓

Service

↓

Model

↓

Utility

依存は必ず上から下。

逆参照は禁止。

循環参照は禁止。

---

# Naming Rules

UI

○○View

○○Dialog

○○Panel

Service

○○Service

○○Loader

○○Scanner

Model

Track

Waypoint

Library

Folder

Utility

○○Util

---

# Object Lifetime

App

常駐

Library

常駐

Folder

常駐

Track

必要時のみ生成

MapLayer

表示中のみ存在

Dialog

使い捨て

---

# Future Expansion

将来追加されるモジュール

Cloud Sync

Plugin System

Timeline

3D View

Photo Manager

Video Manager

Statistics Dashboard

AI Search

これらは既存コードを変更せず
追加のみで実装できることを目標とする。

---

# Architecture Principles

Single Responsibility

Open Closed Principle

Low Coupling

High Cohesion

Composition over Inheritance

Small Components

Event Driven

---

# Golden Rules

UIはデータを持たない。

Modelは画面を知らない。

ServiceはUIを知らない。

Utilityは状態を持たない。

EventBus以外でUI同士を接続しない。

責務が曖昧になったら
新しいクラスを作る。

巨大クラスは禁止。

巨大ファイルは禁止。

---

End of Document