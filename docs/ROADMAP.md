\# ROADMAP.md

\# Version Policy



Major



設計変更



Minor



機能追加



Patch



バグ修正



例



0.4.2



\---



\# Development Phases



Phase 1



Foundation



↓



Phase 2



Library



↓



Phase 3



\# Release 0.1



Project Foundation



Goal



開発基盤を完成させる



Tasks



■ ディレクトリ構成



■ App



■ EventBus



■ Config



■ Toolbar



■ StatusBar



■ TreeView



Done Definition



アプリが起動する



\---



\# Release 0.2



Folder Library



Goal



フォルダをライブラリとして扱う



Tasks



■ FolderScanner



■ Folder Model



■ Library Model



■ Folder Tree



■ Library Update



Done Definition



フォルダを開ける



\---



\# Release 0.3



GPX Parser



Goal



GPX情報を取得する



Tasks



■ GPXLoader



■ GPXParser



■ Track Model



■ Waypoint Model



■ Metadata



■ Error Handling



Done Definition



GPXを解析できる



\---



\# Release 0.4



TreeView GPX Selection and Map Display



Goal



TreeViewでGPXを選択し、そのGPXのTrackを地図へ表示する



Tasks



■ GPX Selection



■ Presentation State



■ Leaflet Local Distribution



■ MapView



■ LayerManager



■ Track Polyline



■ Waypoint Marker



■ Auto Zoom



■ Loading and Error State



■ Clear Display



Done Definition



選択したGPXのTrackを地図へ表示できる

Status

Completed



\---



\# Release 0.5



TreeView Scalability and Navigation

Status

Completed

Goal

大量のGPXを扱いやすいTreeViewへ改善する

Tasks

■ Lazy Folder Tree

■ Folder Expand and Collapse

■ Keyboard Navigation

■ Roving Focus

■ ARIA Tree Structure

■ Long Name Handling

■ TreeView State Restoration

Done Definition

展開されたフォルダだけをDOM生成し、キーボード操作と単一GPX選択を維持できる



\---



\# Release 0.6

Multiple GPX Display

Status

Completed



Goal



複数のGPXを任意にON/OFFし、地図上へ同時表示できる



Tasks



■ GPX Display Toggle



■ DisplayState



■ GPX Display Queue



■ Session Result Cache



■ Path-keyed Layer Groups



■ Stable Display Colors

■ Multi-GPX Bounds



Done Definition



複数GPXを独立して表示・非表示でき、個別Layer削除と単一GPX主選択を維持できる



\---



\# Release 0.7



Search



Goal



検索



Tasks



□ Keyword



□ Folder



□ Date



□ Tag



□ Favorite



Done Definition



高速検索



\---



\# Release 0.8



Statistics



Goal



統計



Tasks



□ Distance



□ Monthly



□ Yearly



□ Graph



□ Summary



Done Definition



統計完成



\---



\# Release 0.9



Advanced



Goal



便利機能



Tasks



□ Replay



□ HeatMap



□ Bookmark



□ Tag



□ Export



□ Import



Done Definition



主要機能完成



\---



\# Release 1.0



Official



Goal



正式版



Tasks



□ UI Review



□ Performance



□ Bug Fix



□ Documentation



□ Test



□ Release Build



Done Definition



一般公開可能



\---



\# Quality Gate



各 Release は



以下を満たすこと。



□ エラーなし



□ Console Warningなし



□ 未使用コードなし



□ TODO整理



□ コメント更新



□ 設計書との差分なし



\---



\# AI Workflow



各 Release では



① ROADMAP確認



↓



② 実装



↓



③ 自己レビュー



↓



④ テスト



↓



⑤ ドキュメント更新



↓



⑥ Commit



↓



⑦ 次Release



\---



\# Commit Rules



1 Release

Folder Bulk Display

Status

Completed



フォルダ行のcheckboxで、配下の全GPXを一括ON/OFFできる



■ Folder Display Checkbox

■ Descendant GPX Enumeration

■ Aggregate Checked State
Release 0.3
■ Indeterminate State

■ Bulk Queue Integration

■ Lazy DOM Compatibility

Done Definition

折りたたみ中の子孫GPXを含め、フォルダ単位で表示を一括制御できる

Implement GPX Parser



\---



\# Branch Policy



main



安定版



develop



開発版



feature/\*



各機能



\---



\# AI Instructions



AIは



Releaseを跨いで実装しない。



未定義機能を作らない。



Roadmapに無い機能を追加しない。



次Releaseのコードを書かない。



\---



\# Future Ideas



Plugin



Cloud Sync



Photo



Video



Timeline



3D



AI Search



Mobile



これらは



Version 2以降とする。



\---



\# Success Definition



TrailBook が成功したと言える条件



・大量GPXでも軽い



・Explorer感覚で使える



・学習コストが低い



・10年後も保守できる



・設計書だけでAIが開発を継続できる



\---



End of Document

