\# ROADMAP.md



Version : 1.0

Status  : Official



Depends :



PROJECT.md



ARCHITECTURE.md



CODING\_RULES.md



\---



\# Development Strategy



TrailBook は



小さく完成させる



↓



安定させる



↓



次へ進む



を繰り返す。



未完成な巨大機能は作らない。



各 Release は



単独で動作すること。



\---



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



Map



↓



Phase 4



Search



↓



Phase 5



Statistics



↓



Phase 6



Advanced Features



↓



Version 1.0



\---



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



TreeView



Goal



ライブラリ表示



Tasks



□ Folder表示



□ GPX表示



□ Icon



□ Expand



□ Collapse



□ Selection



Done Definition



Explorerのように閲覧可能



\---



\# Release 0.5



Map



Goal



GPXを地図表示



Tasks



□ Leaflet



□ Track Draw



□ Marker



□ Auto Zoom



□ Layer



Done Definition



地図表示完成



\---



\# Release 0.6



Property



Goal



情報表示



Tasks



□ Distance



□ Time



□ Elevation



□ Speed



□ Metadata



□ Thumbnail



Done Definition



Track情報確認



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



=



1 Commit



Commit例



Release 0.3



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

