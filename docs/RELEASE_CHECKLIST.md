# TrailBook Release Checklist

Version: 1.0.0 release record / 1.1.0 ready for final commit and tag
Status: Release 1.0 Completed / Release 1.1 Ready for final commit and tag
Baseline: v0.9.0

## Purpose

Release 1.0 Stable Viewerを、個人利用環境で安全・安定・再現可能に使える状態として確認するためのchecklistである。

本書はRelease完了条件と性能比較条件の正本とする。Release 1.0のScopeとOut of Scopeは`ROADMAP.md`、構造上の境界は`ARCHITECTURE.md`、確定した方針は`DECISIONS.md`を参照する。

## Release Scope Freeze

- Release 0.9までのFolder Library、GPX表示、Search、Folder一括表示、Waypoint optionの挙動を維持する。
- TreeViewの変更は挙動を変えない限定的な責務抽出に限る。
- AppはRelease 1.0で無理に分割しない。
- GPX内部の日付表示、車両情報、Track色編集、GPX書き込み、TrackPoint編集、Undo / Redo、保存、別名保存を追加しない。
- 一般公開、配布artifact、hosted版、公開窓口、TrailBook本体のOSS license決定を行わない。

## Supported Environment

- [ ] Windows 10で最新安定版Google Chrome desktopを確認した。
- [ ] Windows 10で最新安定版Microsoft Edge desktopを確認した。
- [ ] Windows 11で最新安定版Google Chrome desktopを確認した。
- [ ] Windows 11で最新安定版Microsoft Edge desktopを確認した。
- [ ] HTTPS、`http://localhost`、`http://127.0.0.1`の対応範囲を文書化した。
- [ ] `file://`および通常のLAN内HTTP IPを非対応として案内した。
- [ ] Firefox、Safariを非対応として案内した。
- [ ] その他Chromium系desktopをbest effortとして案内した。
- [ ] Android、iPhone、iPadの最新Chromeを実機検証した。
- [ ] 合格したMobile端末だけをREADMEのbest effort対応へ記載した。
- [ ] 未確認のMobile端末を対応区分未確定、必要API不足の端末を既知の制限へ記載した。

## Mobile Device Validation

実機検証はHTTPS環境で行う。`showDirectoryPicker`が利用できない場合はその端末を非対応として記録し、Release 1.0で代替選択方式を追加しない。Mobile対応のために既存Folder Library設計を変更しない。

| Device | OS version | Chrome version | Test date | Result | Limitation / Notes |
| --- | --- | --- | --- | --- | --- |
| Android実機 | Not recorded | Not recorded | Not tested | 未確認・対応区分未確定 | 実機sessionなし |
| iPhone実機 | Not recorded | Not recorded | Not recorded | Fail — Release 1.0非対応 | HTTPS Quick TunnelでGoogle Drive Folderの読込・Tree表示までは成功。Mobile UI / touch操作未対応 |
| iPad実機 | Not recorded | Not recorded | Not tested | 未確認・対応区分未確定 | 実機sessionなし |

各端末で次を個別に記録する。

| Test item | Android Chrome | iPhone Chrome | iPad Chrome |
| --- | --- | --- | --- |
| HTTPS環境で起動 | 未実施 | Pass | 未実施 |
| `showDirectoryPicker`の有無 | 未実施 | Pass | 未実施 |
| Folder選択 | 未実施 | Pass | 未実施 |
| 端末内Files / クラウドFolder参照 | 未実施 | Pass — Google Drive Folder | 未実施 |
| Folder走査 | 未実施 | Pass | 未実施 |
| 複数GPX読込 | 未実施 | 未実施 | 未実施 |
| Search | 未実施 | 未実施 | 未実施 |
| GPX個別表示 | 未実施 | Fail — checkbox / Track表示不可 | 未実施 |
| Folder一括表示 | 未実施 | 未実施 | 未実施 |
| Waypoint切り替え | 未実施 | 未実施 | 未実施 |
| Map pan / zoom | 未実施 | 未実施 | 未実施 |
| touch操作 | 未実施 | Fail | 未実施 |
| 縦画面 | 未実施 | 未実施 | 未実施 |
| 横画面 | 未実施 | 未実施 | 未実施 |
| sidebar操作 | 未実施 | Fail — pinch zoom対象 | 未実施 |
| Library切り替え | 未実施 | 未実施 | 未実施 |
| 画面回転後の状態 | 未実施 | 未実施 | 未実施 |
| GPX内容が変更されない | 未実施 | 未実施 | 未実施 |
| GPX更新日時が変更されない | 未実施 | 未実施 | 未実施 |

判定は次のとおりとする。

- Pass: 必要APIと主要機能が利用でき、データ保護を満たす。端末をbest effortへ追加可能。
- Fail: 必要API不足または主要機能が利用できない。既知の制限へ記載する。
- Not tested: 未確認であり、対応済みと記載しない。

Release 1.0では`input type="file" webkitdirectory`、複数GPXファイル選択、ZIP Library読込、クラウドFolder import、Mobile専用Library入口を実装しない。

### iPhone Chrome Result

Test environment: iPhone Chrome / HTTPS Quick Tunnel / Google Drive Folder。OS version、Chrome version、test dateは記録されていない。

| Test item | Result | Notes |
| --- | --- | --- |
| TrailBook起動 | Pass | HTTPS Quick Tunnel |
| HTTPS secure context | Pass | |
| Folder picker表示 | Pass | |
| Google Drive Folder選択 | Pass | |
| Folder scan | Pass | |
| TreeView表示 | Pass | |
| Folder構造表示 | Pass | |
| GPX checkbox操作 | Fail | |
| Track表示 | Fail | |
| touch操作 | Fail | |
| sidebar操作性 | Fail | sidebar部分もpinch zoom対象になる |
| Mobile layout | Fail | PC向け横並びlayoutのままでMobileに最適化されていない |

総合判定はFailとし、iPhone ChromeはRelease 1.0で非対応とする。API不足による完全非対応ではなく、Folder読込は可能だがMobile UI / touch操作未対応と分類する。READMEへbest effort対応として追加しない。

Release 1.0ではMobile responsive layout、sidebar drawer、touch専用checkbox処理、touch hit area拡大、pinch zoom制御、Mobile専用toolbar、Mobile用Library入口、input file fallback、ZIP import、Google Drive syncを実装しない。

将来Release候補を`Mobile Viewer UX`とする。候補範囲はresponsive layout、sidebar drawerまたはbottom sheet、touch hit target拡大、checkboxのtouch操作修正、Mapとsidebarのgesture分離、viewport設定、touch-action制御、portrait / landscape対応、iPhone / iPad / Android実機確認、Google Drive Folder再読込とする。自動同期は行わない。

## Startup and Library

- [ ] 初回起動時にFolder選択方法が理解できる。
- [ ] File System Access API非対応browserで理由と対応環境が分かる。
- [ ] 非secure contextで理由とlocalhost起動方法が分かる。
- [ ] Folder選択をcancelしても既存状態を破壊しない。
- [ ] 空Libraryを選択でき、空であることが分かる。
- [ ] Library切り替えで旧Libraryの選択、表示、Queue、cache、Search結果が残らない。

## GPX Error Handling and Data Protection

- [ ] 壊れたGPXを表示しようとしたとき、対象と失敗が分かる。
- [ ] 一部GPXの解析失敗後も他のGPXを操作できる。
- [ ] Folder一括表示の一部失敗を確認でき、処理全体が停止しない。
- [ ] GPXおよびFolderを暗黙に書き換えない。
- [ ] browser外へのGPX送信を行わない。
- [ ] 外部通信がOpenStreetMap tile取得に限られることを文書化した。
- [ ] offline時はローカルGPX操作が可能で、未cacheのmap tileは取得できないことを文書化した。

## Viewer Features

- [ ] GPX個別表示ON / OFFが機能する。
- [ ] Folder一括表示ON / OFFと中間状態が機能する。
- [ ] 複数GPX表示、個別refocus、全体refocusが機能する。
- [ ] Waypoint初期OFFと切り替えが機能する。
- [ ] SearchがFolder名、GPXファイル名、相対pathを対象にする。
- [ ] Search入力だけでは主選択、表示状態、Mapを変更しない。
- [ ] Search結果activate、checkbox、revealPathが既存Tree操作へ正しく接続する。
- [ ] Library切り替え後のSearch metadataが新Libraryだけを参照する。

## Keyboard, ARIA, and Layout

- [ ] TreeViewの既存keyboard操作に回帰がない。
- [ ] SearchのArrowUp / ArrowDown、Home / End、Enter、Escapeが機能する。
- [ ] GPX検索結果行のSpaceとnative checkboxのSpaceが二重toggleしない。
- [ ] 主選択、表示状態、Folder / GPX、検索件数がARIAで区別できる。
- [ ] keyboardだけで主要操作を完了できる。
- [ ] bodyがscrollせず、sidebar内scrollを維持する。
- [ ] MapViewが固定領域に収まる。

## Quality and Documentation

- [x] favicon取得で404を発生させない。
- [x] 開発用`console.log`を整理し、通常操作でアプリ由来errorがない。
- [x] 未使用codeを整理した。
- [x] TreeViewが1,000行規則に適合し、挙動を維持する。
- [x] READMEに個人利用向け導入、localhost起動、対応環境、offline範囲、既知の制限を記載した。
- [x] Leaflet license fileを保持した。
- [x] OpenStreetMap attributionをcopyright pageへのlink付きで維持した。
- [x] 第三者noticeをTrailBook本体のlicense方針と分離して記録した。
- [x] root `LICENSE`が空ではなく、Decision 0026の方針と一致する。

## v0.9.0 Performance Baseline Protocol

Unit 2 Status: Completed

本節の値をTreeView分割前の固定baselineとする。TreeView責務抽出後は同一条件で再測定し、本baselineと比較する。

### Fixed Conditions

- Production baseline: v0.9.0 code at commit `7076fdd`
- Measurement working commit: `9455be8`
- Difference: Release 1.0 planning documentation only. No production JavaScript, CSS, or HTML differences.
- OS: Windows 10またはWindows 11の同一PC
- Browser: 同一browser、同一version、通常profileの同一設定
- Origin: 同一localhost origin
- Library: 同一806 GPX Library
- Waypoint option: OFF
- Browser DevTools: 計測時の開閉状態を全runで統一
- Background load: 不要なapplicationを終了し、電源modeを固定
- Run count: 各項目で有効なrunを最低3回
- Result: 有効runの中央値。平均値を合否判定に使わない
- Comparison: TreeView責務抽出後も同じ手順、操作順、Library、browserで再測定する
- Measurement helper: `sample/release/performance-baseline.html`。TrailBook本番moduleをimportせず、手動計測とMarkdown出力だけを行う

### Cold and Warm Definitions

- Cold: 新しいLibrary sessionで、対象GPXの解析結果がTrailBookのsession cacheにない状態。
- Warm再表示: 同一Library sessionで一度表示を完了した後、全GPXをOFFにし、再度ONにする状態。session cache上限は100件であり、806件すべてがwarmとは限らない。
- Browser HTTP cacheとTrailBookのsession cacheを混同しない。
- 各cold runの前にpageをreloadし、Libraryを選択し直す。
- warm再表示は対応するcold runの直後に同一tab内で行い、cacheに存在した件数と再解析対象件数を可能な範囲で記録する。

### Timing Boundaries

- Library scan: Folder選択確定からLibrary scan完了表示まで。
- Initial Tree: scan完了から初期Treeと件数表示が操作可能になるまで。scanと分離できない場合は合算値も併記する。
- Search: 最後の入力eventから検索結果と総一致件数が更新されるまで。150 ms debounceを含むend-to-end値として測る。
- All GPX ON cold: root Folder checkboxをONにしてからQueueが空になり全表示件数が確定するまで。
- All GPX OFF: root Folder checkboxをOFFにしてから全Layerが消え、表示件数が0になるまで。
- Warm redisplay: cold表示完了後に全OFFし、同一sessionでroot Folder checkboxを再度ONにして全表示が完了するまで。
- Library switch: 別Libraryの選択確定から旧Library状態が消え、新LibraryのTreeが操作可能になるまで。
- Pan / zoom: 全806 GPX表示時と少数GPX表示時に連続pan、wheel zoom、zoom controlを同一操作順で行い、カクつき、操作遅延、tile遅延、Track layer追従をGood / Acceptable / Poorで記録する。
- Memory: 起動直後、scan後、cold全表示後、全OFF後、Library切り替え後のused JS heapを取得可能な場合だけ記録し、増減傾向を評価する。

### Measurement Record

計測単位は時間がms、memoryがMB、操作感がGood / Acceptable / Poorとする。空欄または`Not measured`は未測定であり、0を意味しない。

| Measurement | Run 1 | Run 2 | Run 3 | Median | Notes |
|---|---:|---:|---:|---:|---|
| Library scan | Not provided | Not provided | Not provided | 5207.7 | Initial Treeを含む |
| Initial Tree | — | — | — | — | Included in Library scan。単独baselineなし |
| Search | Not provided | Not provided | Not provided | 2876.3 | 手動end-to-end参考値。150 ms debounceと別windowでStopを押す人間の操作時間を含み、合格値には使用しない |
| All ON cold | Not provided | Not provided | Not provided | 22371.3 | Waypoint OFF、page reload後、cache空 |
| All OFF | 12920.7 | Not provided | Not provided | 3686.3 | Run 1はRun 2、3との差が大きい外れ値候補。中央値は変更しない |
| Re-display | Not provided | Not provided | Not provided | 3132.5 | cache上限100件。806件すべてがwarmではない |
| Library switch | Not provided | Not provided | Not provided | 3165.8 | 新Libraryが操作可能になるまで |

個別run値は、上表に明記したAll OFF Run 1を除いて提供されていない。推測で補完せず、最低3回の人間測定から得られた中央値だけを固定する。

### Search Performance Comparator

手動end-to-end値とは別に、次の既存SearchService単体baselineを正式比較値とする。

- Search対象: 806件
- 実行回数: 1,000回
- 合計: 約69 ms
- 1検索あたり: 約0.069 ms
- UI debounce: 150 ms

Release 1.0のSearch性能は次の両方で判定する。

1. SearchService単体値に20%を超える明確かつ再現可能な悪化がない。
2. 実ブラウザで、入力から結果DOM表示まで目立つ遅延がない。

| Display state | Rating | Observations |
|---|---|---|
| 全806 GPX表示時 | Not measured | 評価値未提供。カクつき、操作遅延、tile遅延、Track layer追従を確認対象とする |
| 少数GPX表示時 | Not measured | 評価値未提供。カクつき、操作遅延、tile遅延、Track layer追従を確認対象とする |

| Memory checkpoint | Used JS heap (MB) / Not available | Trend / Notes |
| --- | ---: | --- |
| 起動直後 | Not available | |
| Library scan後 | Not available | |
| 全表示後 | Not available | |
| 全解除後 | Not available | |
| Library切り替え後 | Not available | 継続的な増加がないか確認 |

### Measurement Environment Record

- Measurement date: 2026-08-01
- PC identifier: Not recorded
- OS: Windows
- OS build: Not recorded
- CPU: Intel Core Ultra 7 265KF
- Installed memory: 32 GB
- Browser: Google Chrome
- Browser version: 150.0.7871.187
- Origin: `http://localhost`
- Production baseline commit: `7076fdd`
- Measurement working commit: `9455be8`
- TrailBook version: `0.9.0`
- Library identifier: Not recorded
- GPX count: 806
- Folder count: Not recorded
- Library size: Not recorded
- Waypoint option: OFF
- DevTools state: Open
- Network state: Online
- Memory API: Not available
- Baseline result status: Completed — fixed as the pre-TreeView-split v0.9.0 production baseline

## Unit 3 TreeView Limited Split

Unit 3 Status: Completed

`TreeView.js`からmetadata / path構築を`TreeMetadataBuilder.js`へ限定抽出し、TreeViewを1,000行未満へ適合させた。実ブラウザ回帰確認に合格し、分割による見た目または操作の回帰は確認されなかった。

### Browser Regression Result

- [x] Library読込
- [x] Folder展開 / 折りたたみ
- [x] lazy DOM
- [x] GPX個別ON / OFF
- [x] Folder一括ON / OFF
- [x] root一括ON / OFF
- [x] Search
- [x] Folder result activate
- [x] GPX result activate
- [x] Search checkbox
- [x] Tree keyboard
- [x] Search keyboard
- [x] Library切り替え
- [x] body scroll / sidebar scroll
- [x] Waypoint OFFでの表示と操作
- [x] Consoleにアプリ由来errorなし
- [x] TreeView分割による見た目・操作回帰なし

### Known Limitation — Waypoint Rendering at Large Scale

大量のGPXを表示した状態でWaypoint表示をONにすると、多数のMarker描画によりpan / zoomやUI操作が重くなる。大量LibraryではWaypoint OFFを推奨する。

- Waypointの初期値はOFFを維持する。
- 本制限は今回のTreeView分割で新たに発生した回帰とは判断しない。
- Release 1.0ではWaypoint大量表示の性能最適化を実装しない。
- 将来候補はMarker clustering、Canvas renderer、Waypoint表示件数上限、現在の表示範囲内Waypointだけの描画、zoom levelによる表示制御とする。

## Unit 4 Startup and Compatibility UX

Unit 4 Status: Completed
Implementation Status: Completed
Browser Acceptance Status: Completed

- [x] secure contextと対応originを判定する
- [x] `showDirectoryPicker`の実在を判定する
- [x] User-Agentだけで対応可否を決定しない
- [x] Mobile User-AgentだけではFolder選択を無効化しない
- [x] capabilityを満たすMobileで非ブロッキングの未検証案内を表示する
- [x] Mobileを実機合格前は正式対応またはbest effort対応に含めない
- [x] pickerを`{ mode: "read" }`で開く
- [x] 初回Cancelをerrorにせず初期案内へ戻す
- [x] 既存Library選択中のCancelで既存状態を維持する
- [x] permission failureをretry可能な画面内案内へ接続する
- [x] permission failureで既存Libraryを破棄しない
- [x] GPX 0件を正常な空Libraryとして扱う
- [x] 空LibraryのSearch indexを空にする
- [x] StatusBarをlive regionにする
- [x] Folder選択buttonと説明を`aria-describedby`で関連付ける
- [x] Windows Chromeで初回、picker、Cancel、既存Library中のCancel、空Libraryを確認する
- [x] Windows Edgeで初回、picker、Cancel、既存Library中のCancel、空Libraryを確認する
- [x] keyboard、ARIA、focus、body / sidebar scrollを実ブラウザ確認する
- [x] 1 GPX Library、通常Library、Search、Folder一括、Waypointの回帰を実ブラウザ確認する

### Windows Browser Acceptance

| Test item | Windows Chrome | Windows Edge |
| --- | --- | --- |
| 初回起動案内 | Pass | Pass |
| Library button | Pass | Pass |
| Folder picker | Pass | Pass |
| Cancel | Pass | Pass |
| 既存Library中のCancel | Pass | Pass |
| 空Folder | Pass | Pass |
| 1 GPX Folder | Pass | Pass |
| 通常Library | Pass | Pass |
| Search回帰 | Pass | Pass |
| Folder一括回帰 | Pass | Pass |
| Waypoint回帰 | Pass | Pass |
| keyboard / focus / ARIA | Pass | Pass |
| body / sidebar scroll | Pass | Pass |
| Consoleのアプリ由来error | なし | なし |

### Unit 4 Mobile Result

iPhone ChromeはHTTPS起動、Google Drive Folder選択、Folder走査、Tree表示まではPassした。GPX checkbox、Track表示、touch UIはFailであり、原因はAPI不足ではなくMobile UI / touch操作未対応と分類する。Release 1.0では非対応とし、`Mobile Viewer UX`を将来候補とする。

Android ChromeとiPad Chromeは未確認のまま、対応区分未確定とする。

### Unit 4 Known Limitations

- Mobile UIはRelease 1.0対象外である。
- 大量GPXを表示した状態でWaypointをONにすると、多数のMarker描画により操作が重くなる。大量LibraryではWaypoint OFFを推奨する。

## Unit 5 Release Quality Cleanup

Unit 5 Status: Completed
Implementation Status: Completed
Browser Acceptance Status: Completed

- [x] production成功経路の`console.log`を削除する
- [x] Folder access、GPX display、Map、TreeView、Waypoint更新の診断用`console.error`を維持する
- [x] GPX診断ログへ相対pathを出さず、file nameだけを使用する
- [x] 参照のない`Config.debug`を削除する
- [x] 成功ログ削除後に参照がなくなった`Config.appName`を削除する
- [x] DOMへ追加されない`App.mapArea`を削除する
- [x] 参照のないStatusBar旧methodを削除する
- [x] ログ専用で参照されていた`app:ready` eventを削除する
- [x] 外部assetへ依存しない`favicon.svg`を追加する
- [x] Windows Chromeで通常起動・操作時に不要なlog / warningとfavicon 404がないことを確認する
- [x] Windows Edgeで通常起動・操作時に不要なlog / warningとfavicon 404がないことを確認する
- [x] 初回、Folder picker、Cancel、空Library、通常Library、GPX、Folder / root一括、Search、Waypoint、Library切り替え、StatusBarの回帰を確認する

### Unit 5 Browser Acceptance

| Test item | Windows Chrome | Windows Edge |
| --- | --- | --- |
| 初回起動 | Pass | Pass |
| favicon表示 | Pass | Pass |
| favicon 404なし | Pass | Pass |
| 成功経路`console.log`なし | Pass | Pass |
| アプリ由来warningなし | Pass | Pass |
| アプリ由来errorなし | Pass | Pass |
| Library picker | Pass | Not recorded |
| Cancel | Pass | Not recorded |
| 空Library | Pass | Not recorded |
| 通常Library | Pass | Pass |
| GPX個別ON / OFF | Pass | Not recorded |
| Folder / root一括ON / OFF | Pass | Pass — Folder一括 |
| Search | Pass | Pass |
| Waypoint | Pass | Not recorded |
| Library切り替え | Pass | Not recorded |
| StatusBar | Pass | Pass |
| `app:ready`削除による起動回帰なし | Pass | Pass |

### Unit 5 Known Limitations

- Mobile UIはRelease 1.0対象外である。
- 大量GPX表示中のWaypoint ONは操作が重くなる。
- 参照ゼロ候補のうち変更禁止対象内のAPIはUnit 5で削除していない。

## Unit 6 README, License, and Limitations

Unit 6 Status: Completed
Unit 6 Implementation Status: Completed
Unit 6 Documentation Review Status: Completed
Unit 6 Browser Attribution Status: Completed

- [x] root READMEを個人利用向けStable Viewerの導入文書へ更新する
- [x] Live Server、Python、その他の静的HTTP serverによる起動方法を記録する
- [x] 対応browser、対応origin、Mobile実機結果を記録する
- [x] offline範囲、OSM tileのonline依存、外部通信を記録する
- [x] read-only、session限定cache、独自DBなしのデータ保護方針を記録する
- [x] Mobile、Waypoint、OSM tile、編集・同期の既知制限を記録する
- [x] root `LICENSE`をDecision 0026に沿った非OSS noticeへ置き換える
- [x] `THIRD_PARTY_NOTICES.md`へLeaflet 1.9.4とOpenStreetMapを分離して記録する
- [x] `docs/README.md`を現在のdocs入口へ更新する
- [x] `src/vendor/leaflet/LICENSE`が存在することを確認する
- [x] 画面上のOpenStreetMap attributionをcopyright pageへのlink付きにする
- [x] 人間による文書reviewを完了する

### Unit 6 Attribution Acceptance

| Test item | Result |
| --- | --- |
| Chrome表示 | Pass |
| Edge表示 | Pass |
| OpenStreetMap copyright link | Pass |
| 新しいtabで開く | Pass |
| keyboard focus | Pass |
| Map layout崩れなし | Pass |
| Console errorなし | Pass |

### Unit 6 Documentation Review

- [x] READMEだけで起動可能
- [x] Unit 6 review時点のCurrent Releaseは0.9.0
- [x] Unit 6 review時点でRelease 1.0は作業中
- [x] 対応環境記述は正確
- [x] Mobile結果は正確
- [x] offline範囲と外部通信説明は正確
- [x] GPX read-only方針は正確
- [x] 独自DBを持たない
- [x] TrailBook本体のLICENSEと第三者licenseを分離する
- [x] Leaflet vendor LICENSEを維持する
- [x] OpenStreetMap attributionをcopyright pageへ接続する
- [x] 未実装機能を現在機能として記載しない

## Unit 7 Integrated Acceptance and Performance Comparison

Unit 7 Status: Completed
Unit 7 Implementation Status: Completed
Unit 7 Static Validation Status: Completed
Unit 7 Integration Acceptance Status: Completed
Unit 7 Chrome Integration Status: Completed
Unit 7 Edge Integration Status: Completed
Unit 7 Performance Remeasurement Status: Deferred
Performance Result: Pass by qualitative acceptance only. No numerical 20% comparison performed.
Reason: Manual Chrome / Edge testing found no observable regression. Formal Unit 2-equivalent timing comparison was not repeated.
Release 1.0 Completion Readiness: Ready

### Static Validation

| Test item | Result | Notes |
| --- | --- | --- |
| production module import | Pass | 27 / 27 modules |
| circular dependency | Pass | cycleなし |
| Search totalCount / 上限 | Pass | 806 metadata fixtureでtotalCount 806、results 100 |
| Search normalization | Pass | NFKC、大文字小文字無視、relative path |
| Queue / cache / Search上限 | Pass | 2並列 / 100件 / 100件を維持 |
| Waypoint初期値 | Pass | OFFを維持 |
| Folder picker | Pass | `{ mode: "read" }`を維持 |
| write / persistent storage API | Pass | `createWritable`、save picker、IndexedDB、localStorageなし |
| favicon / LICENSE / third-party notice | Pass | 必須fileが存在し、LICENSEは0 byteではない |
| production success log / warning | Pass | `console.log`、`console.warn`なし。診断用`console.error`だけ維持 |
| `git diff --check` | Pass | whitespace errorなし |

Node上でSearchServiceの処理時間も取得したが、browser、query、実Library条件がUnit 2 baselineと一致しないため正式比較値には使用しない。

### Browser Integration Result

| Test item | Windows Chrome | Windows Edge |
| --- | --- | --- |
| 初回起動 | Pass | Not recorded |
| Library選択 | Pass | Pass |
| root一括ON / OFF | Pass | Pass |
| Folder一括ON / OFF | Pass | Not recorded |
| Search | Pass | Pass |
| Search result activate | Pass | Not recorded |
| Search result checkbox | Pass | Not recorded |
| Waypoint OFFでpan / zoom | Pass | Not recorded |
| Library切り替え | Pass | Pass |
| Console errorなし | Pass | Pass |

### Post-Unit 3–6 Performance Remeasurement

| Measurement | Unit 2 baseline | Unit 7 median | Change | 20% judgment |
| --- | ---: | ---: | ---: | --- |
| Library scan | 5207.7 ms | Not remeasured | Not calculated | Deferred |
| All ON cold | 22371.3 ms | Not remeasured | Not calculated | Deferred |
| All OFF | 3686.3 ms | Not remeasured | Not calculated | Deferred |
| Re-display | 3132.5 ms | Not remeasured | Not calculated | Deferred |
| Library switch | 3165.8 ms | Not remeasured | Not calculated | Deferred |
| SearchService 806件 / 1,000回 | 約69 ms | Not remeasured in comparable browser conditions | Not calculated | Deferred |

Unit 2と同一条件での数値再測定は実施していないため、20%比較は算出しない。Unit 2 baselineは履歴として維持し、将来必要になった場合は同じ手順で再測定できる。Searchの手動window移動時間を含む値は正式比較へ使用しない。

Manual Chrome / Edge testing found no observable performance regression. Searchは実ブラウザで目立つ遅延がなく、定性的受け入れをPassとする。

| Pan / zoom state | Rating | Notes |
| --- | --- | --- |
| Waypoint OFFでの実操作 | Pass — qualitative | 実用上問題なし。Good / Acceptable / Poorの個別ratingは未記録 |

### Mobile Result Maintained

- iPhone ChromeはFolder選択、Google Drive走査、Tree表示まではPassしたが、GPX checkbox、Track表示、touch UIはFailであり、Release 1.0では非対応とする。
- Android ChromeとiPad Chromeは未確認である。
- Unit 7ではMobile対応を追加しない。

### Known Limitations and Pending Work

- 大量GPX表示中のWaypoint ONは重くなる。Release 1.0では最適化しない。
- Mobile UIはRelease 1.0対象外である。
- VS Code Problems 0件の確認は未実施である。
- Unit 2と同一条件の数値性能再測定および20%比較はDeferredである。

Chrome / Edge統合受け入れと定性的性能確認に明確な回帰はなく、Release 1.0完了処理へ進行可能と判定する。

## Unit 8 Release 1.0 Finalization

Unit 8 Implementation Status: Completed
Unit 8 Documentation Status: Completed
Unit 8 Version Status: Completed
Release 1.0 Status: Completed

### Release 1.0 Final State

- Version: `1.0.0`
- Unit 1 Status: Completed
- Unit 2 Status: Completed
- Unit 3 Status: Completed
- Unit 4 Status: Completed
- Unit 5 Status: Completed
- Unit 6 Status: Completed
- Unit 7 Status: Completed
- Unit 8 Status: Completed
- Chrome integration: Completed
- Edge integration: Completed
- Performance qualitative acceptance: Passed
- Numerical performance remeasurement: Deferred
- Mobile: Unsupported
- Known limitations: Documented
- License: Documented
- Third-party notices: Documented
- OpenStreetMap attribution: Confirmed
- `git diff --check`: Completed
- Final commit: Completed
- Tag: Completed — `v1.0.0`
- Push: Completed

Unit 2 baselineは履歴として維持する。Unit 7では数値を推測せず、同一条件の再測定と20%比較を実施していない。将来必要になった場合はUnit 2と同じ手順で再測定できる。

## Performance Acceptance

Post-TreeView-split measurement status: Deferred — Windows Chrome / EdgeでUnit 2と同じ手順による実ブラウザ再測定が将来必要になった場合に実施する。

- [x] v0.9.0 baselineを同一条件で最低3回測定し、中央値を記録した。
- [x] coldとwarm cacheを分離して記録した。
- [ ] TreeView責務抽出後に同じ条件で再測定した。
- [ ] v0.9.0比で20%を超える明確かつ再現可能な性能悪化がない。
- [ ] 20%を超えた項目は原因、再現手順、採否を記録した。
- [ ] 806 GPX表示後のpan / zoomが個人利用上実用的である。
- [ ] memoryが操作反復ごとに回収不能な単調増加を示さない。

## Integrated Acceptance

- [ ] 対応環境ごとにstartupからLibrary切り替えまでの受け入れtestを完了した。
- [ ] 空Library、壊れたGPX、一部解析失敗を確認した。
- [ ] 806 GPXでSearch、Folder一括操作、Waypoint optionを確認した。
- [ ] keyboard、ARIA、body / sidebar scroll、MapView固定を確認した。
- [ ] VS Code Problemsが0件である。
- [ ] `git diff --check`に問題がない。
- [ ] 変更禁止対象に意図しない差分がない。

## Release Procedure

- [x] Scope、Out of Scope、既知の制限を最終確認した。
- [x] Config、README、CHANGELOG、ROADMAP、START_HEREをRelease 1.0完了状態へ更新した。
- [x] version更新前後のtest結果を記録した。
- [x] working treeとrelease対象fileを確認した。
- [x] release commitを作成した。
- [x] annotated tagを作成した。
- [x] commitとtagをpushした。
- [x] `main`と`origin/main`およびtagの一致を確認した。

Unit 1 / Unit 2ではRelease Procedureを実行しない。

## Release 1.1 Track Selection & Styling

Release 1.1 Status: Ready for final commit and tag
Unit 1 Status: Completed
Architecture Status: Completed
Decision Status: Completed
Event Contract Status: Completed
Test Plan Status: Completed
Production Implementation Status: Completed
Current production version: `1.1.0`
Planning baseline commit: `29d7db7`

### Unit Plan

| Unit | Scope | Status | Dependency |
| --- | --- | --- | --- |
| 1 | Planning and architecture | Completed | Release 1.0 |
| 2 | TrackStyleService and zoom-based width | Completed | Unit 1 |
| 3 | SelectionState、Map click、highlight | Completed | Unit 2 |
| 4 | UI settings persistence foundation | Completed | Unit 1 |
| 5 | Folder color UI and inheritance | Completed | Unit 3、Unit 4 |
| 6 | Monochrome Map Mode | Completed | Unit 4 |
| 7 | Integrated acceptance、performance、documentation、Release finalization | Completed | Unit 2〜6 |

Unit 4はUnit 2 / 3とproduction fileの競合を避けて実施できるが、Unit 5はselection projectionとstorage contractの両方へ依存する。Unit 6はUnit 4のUI settings persistence基盤を共用でき、Unit 7で統合確認とRelease finalizationを行う。

Planned production files:

- `src/js/services/TrackStyleService.js`
- `src/js/state/SelectionState.js`
- `src/js/state/FolderColorState.js`
- `src/js/services/DisplaySettingsStore.js`
- `src/js/ui/FolderColorDialog.js`

既存のApp、TreeView、MapView、LayerManager、Configは各Unitで必要最小限だけ接続する。DisplayState、Queue、Parser、Search、Waypointの契約を変更しない。

### Frozen Scope

- [x] Map / TreeView / Searchの単一GPX selectionを`SelectionState`へ集約する
- [x] 選択Trackの元色を維持し、太線、outline、前面表示でhighlightする
- [x] 対象Folder自身の明示色を最優先する
- [x] 自身が未設定の場合だけroot方向へ探索し、最初に見つかる最も近い祖先色を継承する
- [x] rootの明示色を祖先色として利用できる
- [x] Library内に明示色がなければv1.0.0と同じGPX relative path hash colorと最終fallbackを使用する
- [x] zoom bucket変更時だけ表示中Trackをrestyleする
- [x] localStorageを再生成可能なUI設定だけに限定する
- [x] GPX、Folder構造、FileHandle、解析結果、cacheを永続化しない

### Out of Scope

- [x] 前回表示Track、前回Map位置の復元
- [x] Date Tree、vehicle metadata、GPX単位色
- [x] GPX / TrackPoint / Waypoint編集、容量削減、Undo / Redo、保存、上書き
- [x] Mobile Viewer UX、Waypoint clustering、hover preview
- [x] palette共有、Cloud Sync、Folder構造変更

### Static Test Plan

- [x] TrackStyleService pure calculation — Unit 2 normal style
- [x] zoom 8 / 9 / 12 / 15 bucket境界 — 小数、負数、`undefined`、`NaN`を含む
- [x] normal、selected main、outline style — Unit 3 static test Pass
- [x] outline contrast color — main color luminanceによる白 / 濃いグレーを確認
- [x] Folder明示色、親継承、子override、Default — Unit 5 static test Pass
- [x] FolderColorStateとDisplaySettingsStoreの責務分離 — Unit 5 module contract Pass
- [x] root Folder color — Unit 5 static test Pass
- [x] path hash fallbackと最終fallback — Unit 5 static test Pass
- [x] 色未設定Folder配下で既存GPX path hash色が維持される — Unit 5 static test Pass
- [x] valid `#RGB` / `#RRGGBB` normalizationとinvalid color拒否 — Unit 4 static test Pass
- [x] schema version 1 read / write — Unit 4 static test Pass
- [x] corrupted localStorage JSON — Unit 4 session fallback Pass
- [x] unknown / future schema version — fail closed Pass
- [x] localStorage read / write / quota / security failure — session fallback Pass
- [x] root名変更と同名Library collision behavior — Library ID pure test Pass
- [x] module import — production module 34 / 34（Unit 5の4 moduleを含む）
- [x] circular dependency — 0件
- [x] EventBus request / changed contract — Unit 3 static test Pass
- [x] SelectionState単一path、clear reason、Library切り替え — Unit 3 static test Pass

### Browser Acceptance Plan

- [x] Map Track click selection — Chrome / Edge Pass
- [x] thin line Canvas tolerance hit area — tolerance 6で実用上問題なし
- [x] Tree selection synchronization — Chrome Pass
- [x] Search result selection synchronization — Chrome Pass
- [x] selected highlightが元Folder色を維持する — Chrome / Edge Pass
- [x] Map背景click deselect — Chrome / Edge Pass
- [ ] hidden selected Trackのselection解除
- [x] ClearとLibrary switch — Unit 3 Chrome Pass
- [ ] parse failure後にselectionが残らない
- [ ] Tree / Search originだけが既存refocusを行う
- [ ] Map origin selectionでviewportが動かない
- [x] overlapping Trackのtopmost selection — 最前面の1件を選択
- [x] Track上のdouble-click zoom — Chrome Pass
- [x] Folder color Apply — Chrome / Edge Pass
- [x] parent inheritance、child override、root inheritance — Chrome / Edge Pass
- [x] Defaultへ戻す、Cancel、Escape、focus return — Chrome Pass、EdgeはDefaultを確認
- [x] reload後のFolder色復元 — Chrome / Edge Pass
- [x] root Folder名変更時は別Library ID — Unit 4 Chrome Pass
- [x] 同名Libraryが設定を共有する既知制限 — Unit 4 Chrome Pass
- [x] localStorage unavailableでもsession操作継続 — Unit 4 Chrome Pass
- [x] globalなし / invalid mapModeはColor — Unit 6 static test Pass
- [x] Color / Monochrome保存、reload復元、Library切り替え維持 — Unit 6 static test Pass
- [x] schema version 1と既存libraries / folderColorsを維持 — Unit 6 static test Pass
- [x] 初期Color、Monochrome切り替え、Color復帰 — Unit 6 Chrome / Edge Pass
- [x] OSM tileだけをfilterし、Track、Waypoint、control、attribution、UIを維持 — Unit 6 Chrome / Edge Pass
- [x] 地名・道路の可読性とTrack視認性 — Unit 6 Chrome Pass
- [x] mapMode reload復元、Library切り替え、fallback、session維持 — Unit 6 Chrome / Edge Pass
- [x] 806 GPXで即時切り替えと実用的なzoom操作 — Unit 6 Chrome Pass
- [x] zoom bucket内でrestyleなし — Chrome browser acceptance Pass
- [x] zoom bucket境界で表示中Trackだけrestyle — Chrome / Edge browser acceptance Pass
- [x] Folder色変更で対象配下だけrestyle — Chrome Pass
- [x] keyboard accessibility、ARIA、色以外の状態説明 — Chrome Pass
- [x] GPX個別、Folder / root bulk checkbox regression — Unit 2 Pass
- [x] Search checkbox regression — Unit 2 Pass
- [x] Waypoint OFF / ON regression — Unit 2 Pass
- [x] Console errorなし — Chrome / Edge Pass

### Performance Plan

- [ ] v1.0.0の同一806 GPX Library、同一PC、同一browser / version、Waypoint OFFを比較条件として記録する
- [ ] 806 GPX表示時のTrack / Segment / Canvas layer数を記録する
- [x] selection変更がprevious / nextの最大2 GPXだけを更新することをstatic testで確認する
- [x] 同一zoom bucket内の`setStyle`回数が0であることをstatic testで確認する
- [x] bucket変更時の更新対象が表示中Trackだけであることをstatic testで確認する
- [x] Folder色変更時の更新対象が対象Folder配下だけであることを確認する — Chrome Pass
- [x] outlineが選択中GPXだけに存在し、新色へ追従することを確認する — Chrome Pass
- [ ] Canvas rendererで全806 GPX表示時のpan / zoomをGood / Acceptable / Poorで記録する
- [ ] SVG + transparent hit layer fallbackを採用する場合はlayer数と操作感を再測定する
- [ ] Queue並列数2、cache上限100、Search上限100に変更がないことを確認する

### Unit 2 TrackStyleService and Zoom-based Width

Unit 2 Implementation Status: Completed
Unit 2 Static Test Status: Completed
Unit 2 Browser Acceptance Status: Completed
Unit 2 Status: Completed
Unit 3 Status at Unit 2 completion: Not started

実装内容:

- `TrackStyleService`へzoom bucket、normal weight、normal styleのpure calculationを集約した。
- normal weightはzoom 15以上で4 px、12以上15未満で3 px、9以上12未満で2 px、9未満で1.5 pxとした。非数値zoomはConfigのfallback zoomを使用する。
- Appが現在bucketを保持し、MapViewはLeafletの`zoomend`後だけ`map:zoom-ended`を通知する。
- 同一bucketではLayerManager更新を呼ばず、bucket変更時は現在表示中のTrack LayerGroup内で`setStyle({ weight })`を持つLayerだけを更新する。
- 初回Polyline生成時も現在zoomのnormal weightを使用する。既存のrelative path hash color、opacity、Track Bounds、Waypoint、refocus、Queue、cache、Search契約は変更していない。
- Track click、SelectionState、selected main、outline、Folder color、localStorageは実装していない。

Static test result:

| Test | Result | Notes |
| --- | --- | --- |
| zoom bucket / weight | Pass | 16 assertion。zoom 8以下1.5 px、9で2 px、12で3 px、15で4 px。小数、負数、`undefined`、`NaN`を含む |
| normal style | Pass | color、opacity、determinism、入力非破壊を確認 |
| displayed Track update | Pass | weightだけ変更、color維持、Marker非更新、削除済みLayer非更新を含む9 assertion |
| App bucket coordination | Pass | 同一bucket 0回、境界変更時だけ更新を含む7 assertion |
| production module import | Pass | 28 / 28。`TrackStyleService.js`と`main.js`を含む |
| circular dependency | Pass | 0件 |

Browser acceptance result:

| Test | Windows Chrome | Windows Edge |
| --- | --- | --- |
| 初回起動 | Pass | Not recorded |
| 通常Library読込 | Pass | Pass |
| 1 GPX表示 | Pass | Pass |
| 複数GPX表示 | Pass | Not recorded |
| root一括表示 | Pass | Pass |
| zoom 8以下 — 1.5 px | Pass | Pass — 8 / 9 / 12 / 15境界として確認 |
| zoom 9〜11 — 2 px | Pass | Pass — 8 / 9 / 12 / 15境界として確認 |
| zoom 12〜14 — 3 px | Pass | Pass — 8 / 9 / 12 / 15境界として確認 |
| zoom 15以上 — 4 px | Pass | Pass — 8 / 9 / 12 / 15境界として確認 |
| 同一bucket内で線幅維持 | Pass | Not recorded |
| bucket境界で線幅変更 | Pass | Pass |
| zoom終了後にstyle更新 | Pass | Not recorded |
| Track色維持 | Pass | Pass |
| opacity維持 | Pass | Not recorded |
| Waypoint表示維持 | Pass | Pass |
| Search回帰 | Pass | Not recorded |
| Folder / root一括回帰 | Pass | Not recorded |
| Clear | Pass | Not recorded |
| Library切り替え | Pass | Not recorded |
| Console errorなし | Pass | Pass |
| 不要なconsole log / warningなし | Pass | Not recorded |

806 GPX Library result:

- zoom操作可能: Pass
- 同一bucket内で目立つ待ち時間なし: Pass
- bucket変更時も実用上問題なし: Pass
- 広域表示時の視認性改善: Pass
- 1.5 pxは1 pxより見やすく、2 pxより重なりを抑えられる: Pass
- 明確な性能回帰なし: Pass

Unit 2の実装、static test、Chrome / Edge browser acceptanceは完了した。Monochrome Map ModeはRelease 1.1 Unit 6の未実装候補として維持し、Unit 2では実装していない。

### Unit 3 SelectionState, Map Track Click, and Highlight

Unit 3 Implementation Status: Completed
Unit 3 Static Test Status: Completed
Unit 3 Browser Acceptance Status: Completed
Unit 3 Status: Completed
Unit 4 Status: Completed

実装内容:

- `SelectionState`を単一GPX pathの正本とし、source、select、clear、reset、同一path抑制を管理する。
- Tree / Searchは`gpx:selection-requested`、Map Trackは`map:track-clicked`を発行し、Appだけがpathと表示状態を検証してstateをcommitする。
- Appは変更後にだけ`selection:changed { path, previousPath, reason }`を発行し、Tree、Search、Mapのprojectionを同期する。
- Tree / Search由来の表示中GPXは既存どおり個別refocusし、Map由来ではrefocusしない。同一pathのTree / Search再activateはhighlightを再生成せず、既存refocusだけを許可する。
- Map選択時はTreeの祖先Folderと行をreveal / scrollするが、keyboard focusをMapから移動しない。Search queryと結果DOMは再生成しない。
- Track専用Leaflet Canvas rendererとConfigのhit toleranceを使用し、visible main Polylineだけをclick targetとする。透明hit Polylineは追加しない。Waypoint Markerは対象外とする。
- Map背景の明示clickで選択解除する。Track clickではoriginal DOM eventの伝播を止め、double click handlerは追加しない。
- selected mainはnormal + 3 px、opacity 1.0、outlineはさらに+2 px、opacity 0.95とする。main色を維持し、outline色はmain色の明度から白または濃いグレーを選ぶ。
- outlineは選択GPXの全Segmentだけに生成し、non-interactiveとする。選択切替・解除・hide・Clear・Library切り替えで破棄し、mainをnormal styleへ戻す。
- zoom bucket変更時はnormal、selected main、outlineを`setStyle`で更新する。同一bucketではUnit 2どおり更新0回とする。
- 選択中GPXの個別・Folder・root OFF、Clear、Library切り替え開始、parse failureでselectionをclearする。非選択GPXのOFFではclearしない。

Config追加:

- `selectedWeightOffset: 3`
- `selectedOpacity: 1`
- `outlineWeightOffset: 2`
- `outlineLightColor: #ffffff`
- `outlineDarkColor: #263238`
- `outlineOpacity: 0.95`
- `hitTolerance: 6`

Static test result:

| Test | Result | Notes |
| --- | --- | --- |
| SelectionState | Pass | 15 assertion。initial、select、same path、previousPath、source、invalid path、clear、reset |
| TrackStyleService selected style | Pass | 27 assertion。zoom 8 / 9 / 12 / 15、color、opacity、outline contrast |
| LayerManager selection / highlight | Pass | 29 assertion。全Segment、outline限定、切替、clear、hide、zoom、Waypoint不変 |
| Map Track click contract | Pass | 21 assertion。main Polyline listener、同一GPX path、Canvas renderer、non-interactive outline、削除済みLayer抑止、background伝播境界 |
| App selection coordination | Pass | 27 assertion。Tree / Search / Map、same path、source検証、refocus規則、background clear |
| App cleanup | Pass | 8 assertion。hidden、Clear、Library switch、parse failure |
| production module import | Pass | 29 / 29。`SelectionState.js`を含む |
| circular dependency | Pass | 0件 |
| TreeView line count | Pass | 997行 |

修正後のChrome / Edge browser acceptanceは完了した。Track click、background deselect、event propagation、double-click zoom、Tree / Search同期、highlight、Clear / Library切り替え、Consoleに回帰は確認されなかった。

806 GPXでもTrack click、selection反応、highlight、zoom bucket変更は実用上問題なく、明確な性能回帰は確認されなかった。Unit 4は開始していない。

#### Map Track Click Browser Failure and Fix

- Map Track click browser test: Failed
- Tree selection / highlight: Pass
- Event-path finding: Tree起点の`SelectionState`更新とhighlight描画は成立した一方、Map上のTrack clickからselectionへ到達しなかった。main Polylineのclick listenerとGPX path closureは存在したが、Canvas PolylineのinteractionとLeaflet map clickへの伝播境界が暗黙設定に依存していた。
- Root cause: main Polylineで`interactive`とLeafletの`bubblingMouseEvents`を明示せず、native `originalEvent`の停止だけに依存していたため、Track layer clickとMap背景clickを確実に分離できていなかった。
- Fix: 各main Polylineへ`interactive: true`、`bubblingMouseEvents: false`、固定の`gpxPath` metadataを設定した。Polyline clickでは正しいpathのselection requestを先に発行し、`originalEvent`が存在する場合だけDOM伝播を停止する。削除または置換済みのPolylineは現在のLayer entryとの同一性を検証して通知しない。
- Canvas renderer: 継続。`L.canvas({ tolerance: 6 })`をTrack専用rendererとして各main Polylineへ明示し、outlineは`interactive: false`のままとする。通常rendererへの切り替えや透明hit layerの追加は行っていない。
- Retest Status: Completed — Chrome / Edgeで修正経路と回帰項目を確認した。
- Unit 3 Status: Completed

#### Unit 3 Browser Acceptance Result

| Test item | Windows Chrome | Windows Edge |
| --- | --- | --- |
| 1 GPX Track click | Pass | Pass |
| Track clickからTree row同期 | Pass | Not separately recorded |
| Track highlight | Pass | Pass |
| Track click直後にselectionを維持 | Pass | Not separately recorded |
| Map背景clickでselection解除 | Pass | Pass |
| pan / dragだけでは解除しない | Pass | Pass |
| zoomだけでは解除しない | Pass | Pass |
| double-click zoom | Pass | Not separately recorded |
| 複数Track選択 | Pass | Not separately recorded |
| overlapping Track | Pass — 最前面の1件を選択 | Not separately recorded |
| 同一GPXの別Segment click | Pass | Not separately recorded |
| Search同期 | Pass | Not separately recorded |
| Tree同期 | Pass | Not separately recorded |
| Clearで解除 | Pass | Not separately recorded |
| Library切り替えで解除 | Pass | Not separately recorded |
| Console errorなし | Pass | Pass |
| 不要なconsole log / warningなし | Pass | Not separately recorded |

806 GPX Library result:

- Track click実用性: Pass
- selection反応時間: 実用上問題なし
- highlight表示: 実用上問題なし
- zoom bucket変更: 実用上問題なし
- 明確な性能回帰なし: Pass

Known behavior:

- overlapping TrackではLeafletの描画順で最前面にある1件を選択する。
- `TreeView.js`は997行である。以後のUI追加では1,000行規則を守るためhelper抽出を優先する。

### Unit 4 UI Settings Persistence Foundation

Unit 4 Implementation Status: Completed
Unit 4 Static Test Status: Completed
Unit 4 Browser Acceptance Status: Completed
Unit 4 Status: Completed
Unit 5 Status at Unit 4 completion: Not started

実装内容:

- `DisplaySettingsStore`は固定key`trailbook.uiSettings`を起動時に一度読み、schema version 1を検証する。
- schemaは`{ version: 1, libraries: { [libraryId]: { folderColors } } }`とし、Folder color UIやTrack color適用より先に永続化責務だけを提供する。
- `createLibraryId(rootFolderName)`はtrim済みroot名をURL encodingし、空名を`unnamed`へfallbackして`root-name:<name>`を返す。caseを保持し、FileHandle、構造hash、GPX hash、追加走査を使用しない。
- Appは起動時にStoreを生成し、Library loadが完了した時点だけactive Library IDを更新する。未選択時は`null`、load failure時は以前の正常なidentityを維持する。
- root Folder pathの空文字とnested Folder pathを保存できるが、Unit 4ではTreeView、Track style、SelectionState、Queue、cache、Searchへ接続しない。
- valid colorは`#RGB`または`#RRGGBB`だけとし、`#RRGGBB`大文字へ正規化する。alpha、CSS color name、`rgb()`は拒否する。
- plain objectだけを読み、配列、`null`、control character、不正separator、危険keyを拒否する。内部dictionaryはprototypeを持たず、unknown fieldはschema 1では無視する。
- storage未定義、SecurityError、QuotaExceededError、JSON parse failure、schema mismatchではViewerを止めずsession memoryへfallbackする。storage内容、GPX、FileHandleをConsoleへ出力しない。
- same value、存在しないremove、空のLibrary clearでは保存処理を行わない。変更APIの戻り値はsession内状態が変更された場合だけ`true`とする。

DisplaySettingsStore API:

- `createLibraryId(rootFolderName)`
- `setActiveLibrary(rootFolderName)`
- `getActiveLibraryId()`
- `getFolderColors(libraryId)`
- `getFolderColor(libraryId, folderPath)`
- `setFolderColor(libraryId, folderPath, color)`
- `removeFolderColor(libraryId, folderPath)`
- `clearLibraryFolderColors(libraryId)`
- `getStatus()`

Static test result:

| Test | Result | Notes |
| --- | --- | --- |
| Library ID / schema / API / failure fallback | Pass | 68 assertions。trim、empty、Unicode、separator、control character、schema、color、dangerous key、partial invalid、read / write failure、reload、future schema fail-closed |
| App Library identity integration | Pass | 8 assertions。initial null、successful load、Store同期、load failure時の既存Library / identity維持 |
| production module import | Pass | 30 / 30。`DisplaySettingsStore.js`を含む |
| circular dependency | Pass | 0件 |
| TreeView line count | Pass | 997行、差分なし |
| Config version | Pass | `1.0.0` |

#### Unit 4 Browser Acceptance Result

| Test item | Windows Chrome | Windows Edge |
| --- | --- | --- |
| `trailbook.uiSettings` / schema version 1 | Pass | Pass |
| root名からLibrary ID生成 | Pass | Pass — Library読込で確認 |
| 日本語root名 | Pass | Not separately recorded |
| 異なるroot名を別Libraryとして識別 | Pass | Pass — Library切り替えで確認 |
| 同名root Folderの同一ID | Pass — 既知制限を確認 | Not separately recorded |
| FileHandle / FolderHandle / GPX内容を保存しない | Pass | Not separately recorded |
| malformed JSON後も起動 | Pass | Pass |
| malformed JSONを設定として採用しない | Pass | Not separately recorded |
| unknown schema version後も起動 | Pass | Not separately recorded |
| unknown versionをversion 1で自動上書きしない | Pass | Not separately recorded |
| storage key削除後も起動 | Pass | Not separately recorded |
| storageなしのsession fallback | Pass | Not separately recorded |
| storage failureでもViewer継続 | Pass | Not separately recorded |
| Library読込成功後のactive ID更新 | Pass | Pass — Library読込で確認 |
| Library切り替え時のactive ID更新 | Pass | Pass |
| Library読込失敗時のLibrary / active ID整合 | Pass | Not separately recorded |
| Library未選択時のactive ID `null` | Pass | Not separately recorded |
| Zoom連動線幅 | Pass | Not separately recorded |
| Track click / highlight | Pass | Pass |
| Tree / Search同期 | Pass | Not separately recorded |
| Folder / root一括 | Pass | Not separately recorded |
| Clear / Library切り替え / Waypoint | Pass | Library切り替え Pass |
| Console errorなし | Pass | Pass |
| storage内容のConsole出力なし | Pass | Not separately recorded |
| 不要なconsole log / warningなし | Pass | Not separately recorded |

Known limitations:

- 同名root Folderは同じLibrary IDとなり、設定が衝突し得る。
- root Folder名変更時は別Libraryとして扱う。
- localStorage削除時は保存済みUI設定がDefaultへ戻る。
- Unit 4時点ではFolder color UIとTrack色適用を実装していない。

Chrome / Edge browser acceptanceと既存Viewer regressionを完了し、Unit 4をCompletedとする。Unit 4完了時点ではUnit 5は未開始だった。

### Unit 5 Folder Color UI, Inheritance, and Selective Restyle

Unit 5 Implementation Status: Completed
Unit 5 Static Test Status: Completed
Unit 5 Browser Acceptance Status: Completed
Unit 5 Status: Completed
Unit 6 Status at Unit 5 completion: Not started

実装内容:

- `FolderColorState`はactive Libraryの明示色、rootを含むnearest ancestor継承、GPX path hash、Config fallbackの順でTrack色を解決する。
- `PathUtils`へparent / join / descendant / GPX parent Folder pathを集約し、TreeMetadataBuilderとFolderColorStateで共有する。
- `FolderColorControl`はMutationObserverでTreeViewのlazy DOMを装飾し、TreeView.jsを変更せずrootとrender済みFolder行へnative buttonを追加する。
- Folder行は`Explicit`、`Inherited`、`Auto`を文字とswatchで区別する。Autoはchecker表示とし、単一色を示さない。session fallback時は`Session only`を併記する。
- `FolderColorDialog`はnative `dialog`、`input type="color"`、Apply、Default、Cancelを持つ。EscapeはCancelと同じで、close後は起点buttonへfocusを戻す。
- Folder color buttonのclick / keydown propagationを止め、checkbox、Folder展開、row keyboard操作と競合させない。
- AppはLibrary load後にFolderColorStateを復元し、初期Track色を解決する。Library切り替えでは新しいLibrary IDとFolder path集合からstateを再構築する。
- 色変更時は変更Folder配下のうち別の明示色で遮られない枝だけを更新する。登録displayのresolved colorとTree / Search projectionを更新し、Mapは表示中の影響Trackだけをrestyleする。
- `LayerManager.updateTrackColor`は既存Polylineを`setStyle`し、selected main / outlineを新色から再計算する。weight、opacity、selection path、Layer数、Bounds、Waypointを維持する。
- GPX再parse、Queue投入、cache更新、Map refocus、Tree / Search再構築を行わない。
- localStorage schema version 1を維持し、Apply、Default、Library別設定、reload、write failure時のsession反映を既存DisplaySettingsStoreへ接続する。

Static test result:

| Test | Result | Notes |
| --- | --- | --- |
| FolderColorState / PathUtils | Pass | 41 assertions。root、own、nearest / deep ancestor、override、Default、hash、Library switch、invalid、session fallback、path |
| LayerManager color update | Pass | 13 assertions。selected main / outline、weight、opacity、Layer、Bounds、Waypoint、hidden path |
| App selective restyle | Pass | 16 assertions。parent変更、explicit child除外、visible限定、Tree / Search projection、Default、no refocus |
| Folder color UI | Pass | 17 assertions。swatch、mode、event isolation、dialog、Apply、Default、Cancel、Escape、focus、ARIA、session表示 |
| Persistence | Pass | 8 assertions。set / reload、Default / reload、Library switch、write failure session fallback |
| production module import | Pass | 34 / 34 |
| circular dependency | Pass | 0件 |
| TreeView line count | Pass | 997行、差分なし |
| Config version | Pass | `1.0.0` |

#### Unit 5 Browser Acceptance Result

Windows Chrome:

| Area | Result | Verified behavior |
| --- | --- | --- |
| Folder color UI | Pass | root / nested Folder swatch、Explicit / Inherited / Auto、Autoの複数色表現、row選択・checkbox・expandとの非競合、keyboard到達、dialog open、Apply、Default、Cancel、Escape、focus復帰、ARIA |
| Color resolution | Pass | root / own explicit color、nearest / deep ancestor inheritance、child override、親変更時のexplicit child維持、Defaultによる親継承またはAuto復帰、既存GPX path hash色、未設定Libraryのv1.0.0色互換 |
| Map restyle | Pass | 表示中Trackだけ即時更新、GPX再parse・Layer再生成・Map refocusなし、Bounds・Waypoint・zoom width・Track click・Map背景解除を維持 |
| Selection / Highlight | Pass | selected mainとoutlineが新色へ追従し、weight、selection path、zoom bucket追従を維持 |
| Persistence | Pass | Apply後保存、reload復元、Library単位の分離、root / child override保存、Default削除、localStorage削除時のAuto復帰、malformed JSON継続、write failure時のsession反映 |
| Console | Pass | error、不要なlog / warningなし |

Windows Edge:

| Check | Result |
| --- | --- |
| root color設定 | Pass |
| child override | Pass |
| Defaultへ戻す | Pass |
| reload復元 | Pass |
| selected Track色更新 | Pass |
| Console error | None |
| 不要なconsole log / warning | None |

806 GPX Library:

| Check | Result |
| --- | --- |
| root色変更 | 実用上問題なし |
| deep Folder色変更 | 実用上問題なし |
| child override | Pass |
| selected Track色変更 | 実用上問題なし |
| UI操作感 | 実用上問題なし |
| 明確な性能回帰 | なし（Pass） |

Known limitations:

- 同名root Folderは同じLibrary IDとなり、色設定が衝突し得る。
- root Folder名を変更すると別Libraryとして扱われる。
- localStorageを削除すると保存済みFolder colorはAutoへ戻る。
- Mobile UIはRelease 1.1 Unit 5の対象外である。

Chrome / Edgeの実ブラウザ受け入れ確認と806 GPX Library確認が完了したため、Unit 5をCompletedとする。Unit 6 Monochrome Map Modeは未開始である。

### Unit 6 Monochrome Map Mode

Unit 6 Implementation Status: Completed
Unit 6 Static Test Status: Completed
Unit 6 Browser Acceptance Status: Completed
Unit 6 Status: Completed
Unit 7 Status at Unit 6 completion: Not started

実装内容:

- Map toolbarへnative selectを追加し、Color / Monochromeのcurrent stateを文字で表示する。初期値はColorで、`aria-label`と標準keyboard操作を持つ。
- `MapView.setMapDisplayMode(mode)` / `getMapDisplayMode()`を追加する。invalid modeはColorへfallbackし、同一modeはno-op、Map未初期化でも安全である。
- Map rootの`map--monochrome` class配下にある`.leaflet-tile-pane img`だけへCSS filterを適用する。
- filter値はCSS custom propertyへ集約し、`grayscale(100%) brightness(108%) contrast(82%)`とする。
- Track Canvas、Waypoint Marker、shadow、tooltip / popup、Leaflet control、attribution、sidebar、Toolbarにはfilterを適用しない。
- tile provider、tile URL、attributionを変更せず、mode変更でtile再取得、Track再描画、Map refocus、`invalidateSize`、zoom / center変更を行わない。
- DisplaySettingsStore schema version 1へLibrary非依存の`global.mapMode`を追加する。`global`がない既存payloadとinvalid valueはColorへfallbackする。
- Store APIは`getMapMode()` / `setMapMode(mode)`とし、write failure時も同じsession内のmodeを維持する。既存librariesとfolderColorsを保持する。
- Appは起動時の復元、`map:display-mode-changed`、Store更新、MapView projectionを調停する。Library切り替えでmodeを変更しない。

Static test result:

| Test | Result | Notes |
| --- | --- | --- |
| DisplaySettingsStore mapMode | Pass | default、Color / Monochrome、same value、schema 1、global保存、reload、old schema、invalid、malformed JSON、unknown version、write failure、Library切り替え、libraries / folderColors維持 |
| MapView / UI / tile filter | Pass | mode API、class、same mode、invalid fallback、Map未初期化、native select、ARIA、event、tile image限定、Track Canvas・Waypoint・attribution非影響 |
| App integration | Pass | 起動時復元、UI変更、Store反映、SelectionState非影響 |
| Total assertions | Pass | 41 assertions |
| production module import | Pass | 34 / 34 |
| missing import | Pass | 0件 |
| circular dependency | Pass | 0件 |
| TreeView line count | Pass | 997行、差分なし |
| Config / schema version | Pass | Config `1.0.0`、schema version `1` |

#### Unit 6 Browser Acceptance Result

Windows Chrome:

| Area | Result | Verified behavior |
| --- | --- | --- |
| Display | Pass | 初期Color、Monochrome、Color復帰、OSM tile限定filter、Track / Folder色、selected highlight、outline、Waypoint、zoom control、attribution、Toolbar / sidebarを維持 |
| Readability | Pass | 地名・道路が読め、淡い色を含むTrack視認性が向上し、背景が強すぎない |
| Map / Viewer operation | Pass | pan、zoom、double-click zoom、tile load、root一括表示、Search、Clear、Library切り替え |
| Persistence | Pass | reload復元、Library切り替え後もmode維持、localStorage削除時Color、malformed JSON時Color、write failure時session維持 |
| Console / Network | Pass | アプリ由来error、不要なlog / warning、tile 404なし。attribution link正常 |

Windows Edge:

| Check | Result |
| --- | --- |
| Color / Monochrome切り替え | Pass |
| OSM tileだけ白黒表示 | Pass |
| Track色維持 | Pass |
| reload復元 | Pass |
| Library切り替え後もmode維持 | Pass |
| Console error | None |

806 GPX Library:

| Check | Result |
| --- | --- |
| Monochrome切り替え | 即時（Pass） |
| Track再描画 | なし（Pass） |
| zoom操作 | 実用上問題なし |
| 広域表示のTrack視認性 | 改善（Pass） |
| 明確な性能回帰 | なし（Pass） |

Known limitations:

- Monochrome Map ModeはCSS filter方式である。
- OpenStreetMap tile providerは従来どおりonline依存である。
- Mobile UIはRelease 1.1 Unit 6の対象外である。

Chrome / Edgeの実ブラウザ受け入れ確認と806 GPX Library確認が完了したため、Unit 6をCompletedとする。Unit 6完了時点ではUnit 7は未開始だった。

### Unit 7 Integrated Acceptance, Performance, Documentation, and Release Finalization

Unit 7 Implementation Status: Completed
Unit 7 Integration Status: Completed
Unit 7 Documentation Status: Completed
Unit 7 Version Status: Completed
Unit 7 Status: Completed

Release 1.1 Completion Status: Ready for final commit and tag

#### Chrome Integrated Acceptance

806 GPX Libraryを使用したWindows Chromeの通し操作結果:

| Area | Verified behavior | Result |
| --- | --- | --- |
| Library | Library選択、root一括表示、Library切り替え | Pass |
| Zoom style | zoom連動Track線幅 | Pass |
| Selection | Map Track click、selected highlight / outline、Map背景click解除、Search selection | Pass |
| Folder color | root色、child override、継承、Default、Auto、保存、復元 | Pass |
| Monochrome | Color / Monochrome切り替え、保存、復元 | Pass |
| Viewer regression | Folder / root一括ON / OFF、Waypoint、OSM attribution | Pass |
| Console | アプリ由来error、不要なlog / warningなし | Pass |

#### Edge Integrated Acceptance

Unit 2〜6で完了したWindows Edge受け入れ結果を統合判定に使用した。

| Area | Result |
| --- | --- |
| zoom連動Track線幅 | Pass |
| Track click / highlight / selection解除 | Pass |
| Folder color / persistence | Pass |
| Color / Monochrome | Pass |
| Library切り替え / Search | Pass |
| Console error | None |

#### 806 GPX Qualitative Performance

Performance classification: **Acceptable**

これは人間による定性的受け入れ結果であり、数値benchmarkと20%比較は実施していない。

| Operation | Result |
| --- | --- |
| root一括表示 | 実用上問題なし |
| zoom bucket変更 / 同一bucket zoom | 実用上問題なし |
| Track click / selection highlight | 実用上問題なし |
| root / deep Folder色変更 | 実用上問題なし |
| selected Track色変更 | 実用上問題なし |
| Monochrome切り替え | 即時 |
| Search / pan / zoom | 実用上問題なし |
| UIが固まる操作 | なし |
| 明確な性能回帰 | なし |

Unit 2の数値baselineは履歴として維持し、将来必要な場合は同じ手順で再測定する。

#### Data Protection Acceptance

- [x] 通常閲覧中にGPX内容と更新日時を変更しない
- [x] `createWritable`を使用しない
- [x] GPXを移動、削除、保存しない
- [x] localStorageにはFolder色とglobal Map modeだけを保存する
- [x] FileHandle、FolderHandle、GPX XML、TrackPoint、geometryを保存しない
- [x] Library切り替えでselection、Folder color projection、display stateを混在させない

#### Release Finalization State

- Version: `1.1.0`
- Unit 1〜7: Completed
- Chrome integration: Completed
- Edge integration: Completed
- 806 GPX qualitative performance: Passed（Acceptable）
- Folder color persistence: Confirmed
- Monochrome persistence: Confirmed
- Mobile UI: Unsupported
- Known limitations: Documented
- final commit: Pending
- tag: Pending
- push: Pending

Release 1.1 finalization時点でRelease 1.2 Shared Library SettingsはFuture Candidateだった。その後Next ReleaseのPlanningへ移行したが、Release 1.1 productionは引き続き設定file書き込みやGoogle Drive API同期を行わない。

### Persistence Schema

Storage key: `trailbook.uiSettings`
Schema version: `1`
Global setting: `global.mapMode`。`color`または`monochrome`、欠落・invalid valueは`color`
Library identity: trim済みroot Folder nameをURL encodingした`root-name:<name>`。空名は`unnamed`
Folder identity: current Library内のrelative path。rootは空文字。

保存失敗、削除、破損、未知versionではDefault色へ戻るかsession内設定だけで継続する。GPXの内容、更新日時、Folder構造へ影響させない。

### Release 1.1 Open Risks

- 同名root Folderは色設定が衝突する。Release 1.1では個人利用の既知制限として受け入れる。
- root Folder名変更後は旧設定を自動移行できない。
- Canvas renderer、hit tolerance、overlap順序はChrome / Edgeで確認済みである。overlapping Trackでは最前面の1件を選択する。
- 806 GPXでTrack click、highlight、zoom bucket変更に明確な性能回帰は確認されていない。
- TreeViewは997行のため、Folder color UIを直接追加して1,000行規則を超えないよう、helperまたはdialog責務を別Viewへ置く。

## Release 1.2 Shared Library Settings

Release 1.2 Status: In progress
Current Release: `1.1.0`
Production Implementation Status: In progress（Unit 4 implementation / static test completed、Browser Acceptance pending）

### Unit Status

| Unit | Scope | Status | Depends on |
| ---: | --- | --- | --- |
| 1 | Scope、Architecture、Decisions、schema、permission / conflict policy、test plan | Completed | Release 1.1 completed baseline |
| 2 | read-only loader、schema validation、Library open時の読込、localStorage fallback | Completed | Unit 1 |
| 3 | readwrite permission、safe writer、explicit save、failure handling | Completed | Unit 2 |
| 4 | localStorage migration、manual reload、conflict resolution UI | Completed | Unit 2、3 |
| 5 | Google Drive Folder、Chrome / Edge、integrated acceptance、documentation、Release finalization | Not started | Unit 2〜4 |

Unit 1 Planning Status: Completed
Unit 1 Production Implementation Status: Not started

### Scope and Data Boundary

- [x] Library root直下の固定名`trailbook.json`を採用
- [x] Release 1.2のshared settingをFolder colorsだけに限定
- [x] root path `""`と`/`区切りrelative Folder pathを採用
- [x] Color / Monochrome等の端末固有設定をlocalStorageへ維持
- [x] FileHandle、FolderHandle、GPX、TrackPoint、geometry、cache、Queueを永続化対象外とする
- [x] GPX write、Folder移動 / 改名、cloud API、background sync、automatic mergeをOut of Scopeとする
- [x] 正式原則を「ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない」とする

### Schema Contract

- File: Library root / `trailbook.json`
- Schema: `{ "schemaVersion": 1, "settings": { "folderColors": { "": "#455A64" } } }`
- Encoding: UTF-8 without BOM
- Newline: LF、final newline required
- Formatting: 2-space indent、stable property order、Folder pathをUnicode code point順にsort
- Color: `#RGB` / `#RRGGBB` inputを大文字`#RRGGBB`へnormalize。alpha、name、`rgb()`はreject
- Validation: arrays、`null`、dangerous keys、control character、backslash、不正separator、`.` / `..` segmentをreject
- Unknown schema / structural field: fail closed。Viewerはfallbackで継続するが通常saveで上書きしない
- Orphan path: preserve、do not apply、do not auto-delete

### Source, Migration, Permission, and Save Contract

- [x] valid supported JSON全体 > missing / unreadable時だけlegacy localStorage > Auto / path hash > Config fallback
- [x] valid JSONのempty map / missing Folder keyへlegacy localStorageを混ぜない
- [x] JSON既存時にlocalStorageで上書きしない
- [x] JSONなし + legacy colorありの場合だけ非blockingな明示migrationを提示
- [x] migration成功後もRelease 1.2ではlocalStorage fallbackを保持
- [x] pickerは`mode: "read"`を維持し、Save時だけreadwrite permissionを確認
- [x] Folder color Applyはdirty化のみ。別の`Libraryへ保存`で書き込む
- [x] permission denied / revoked、write / close failureでもViewerとsession / local fallbackを維持
- [x] read時exact content SHA-256 + `lastModified` + sizeのfingerprintを保持
- [x] save直前に再読込し、external change時は停止してReload / explicit Overwrite / Cancelを提示
- [x] automatic merge、unconditional last-write-wins、独自`.tmp` / `.bak`を初期scopeに含めない
- [x] `createWritable()`、full write、`close()`、close後の再読込一致でsavedとする

### Planned UI

- Shared status: Loaded / Local only / Unsaved / Read-only / Invalid / Conflict / Save failed
- `Libraryへ保存`
- `設定を再読み込み`
- JSON missing時の`現在の色設定をLibraryへ保存`
- Conflict dialog: Reload / Overwrite / Cancel
- text + `aria-live`、native keyboard操作、dialog focus return、disabled reason
- `共有設定を無効化`、Import / Export、Mobile optimizationはRelease 1.2の最小UIへ含めない

### External Folder Sync Contract

- [x] Google Drive / OneDrive同期Folder内のJSONを通常fileとして扱う
- [x] TrailBookはcloud API、sync status、provider metadataを使用しない
- [x] 別端末反映には外部providerの同期完了が必要
- [x] Library open / reselection / page reload / explicit Reloadで再読込
- [x] offline時は端末上の最新同期済みcopyを読む
- [x] polling、visibility auto reload、File System Observerを使用しない

### Static Test Plan

- [ ] valid `trailbook.json`
- [ ] missing file
- [ ] empty file
- [ ] malformed JSON
- [ ] unknown schema
- [ ] unknown structural field
- [ ] partial invalid Folder colors
- [ ] dangerous keys / prototype pollution
- [ ] array / `null`
- [ ] Japanese path
- [ ] root path `""`
- [ ] nested Folder and orphan path
- [ ] stable serialization、UTF-8、LF、final newline
- [ ] JSON precedence、empty JSON、localStorage fallback
- [ ] permission granted / denied / revoked
- [ ] write / close / quota failure
- [ ] read fingerprint、external change、missing-to-created conflict
- [ ] migration、existing JSON no-overwrite
- [ ] no GPX / FileHandle / geometry persistence and no GPX write
- [ ] production module import and circular dependency

### Browser and Integration Test Plan

- [ ] Chrome / Edge: Library without JSON and with valid JSON
- [ ] Folder colors load、root / nested / Japanese path、inheritance / Auto
- [ ] same JSONをChrome / Edgeで再現
- [ ] localStorage migration preview、accept、deny、retry
- [ ] explicit save、reload、Library switch、dirty confirmation
- [ ] external file change、conflict Reload / Overwrite / Cancel
- [ ] malformed / unsupported JSONでもViewer継続
- [ ] Google Drive同期Folder read / write / resync / manual Reload
- [ ] offline時の最新同期済みcopy
- [ ] existing Viewer、Search、selection、Folder bulk、Waypoint、Monochrome regression
- [ ] Console、keyboard、ARIA、focus
- [ ] GPX content / timestamp unchanged、GPXへ`createWritable`なし

### Known Limits and Open Validation

- File System Access APIのpermission persistenceとprovider挙動はbrowser / user grantに依存するため、保存時に毎回照会する。
- fingerprint確認後から`close()`までのexternal write raceを完全には排除できない。
- Google Drive等の同期完了、offline freshness、conflict解消をTrailBookは保証しない。
- orphan pathは自動追従しない。automatic mergeとfield-level mergeは未実装とする。
- Import / Export、backup、exclusive writer、File System ObserverはFuture Candidateとする。
- Unit 2、Unit 3、Unit 4のChrome / Edge / Google Drive実機testはCompleted。Unit 5は未開始である。

### Unit 2 Read-only Loader

Unit 2 Implementation Status: Completed
Unit 2 Static Test Status: Completed
Unit 2 Browser Acceptance Status: Completed
Unit 2 Status: Completed
Unit 3 Status: Completed

#### Implemented Boundary

- [x] `LibrarySettingsRepository.load(rootHandle)`でroot直下の`trailbook.json`だけを`create: false`で読む
- [x] exact file name、file kind、1 MiB上限を検証する
- [x] strict schema version 1、unknown field、dangerous key、path、colorをfail closedで検証する
- [x] root / nested / Japanese / orphan pathをnormalized prototype-free dictionaryへ保持する
- [x] exact bytesからSHA-256、lastModified、sizeを取得する
- [x] fingerprint unavailableでもvalid shared JSONでViewerを継続する
- [x] shared JSON全体 > missing / temporary read failure時だけlegacy > Autoのprecedenceを適用する
- [x] malformed / unsupported / invalid / oversizeでlegacyを混ぜない
- [x] `LibrarySettingsState`へsource、status、dirty false、snapshot、metadata、errorCodeを保持する
- [x] App generation + State requestIdでstale loadを無視する
- [x] FolderColorStateへ採用sourceのexplicit colorsだけをloadする
- [x] write、permission request、migration、save / reload / conflict UIを追加しない

#### Static Results

| Check | Result | Notes |
| --- | --- | --- |
| Shared settings test | Pass | 121 assertions |
| Production module import | Pass | 37 / 37 |
| Missing import target | Pass | 0 |
| Circular dependency | Pass | 0 |
| Config version | Pass | `1.1.0` |
| DisplaySettingsStore schema | Pass | version 1 unchanged |
| TreeView size | Pass | 997 lines |
| App size | Pass | 975 lines |
| GPX write API | Pass | `createWritable` / readwrite permissionなし |

#### Windows Chrome Browser Acceptance

| Area | Result | Confirmed behavior |
| --- | --- | --- |
| Library without JSON | Pass | legacy Folder colorsを反映。legacyなしはAuto。Viewer正常起動 |
| Valid JSON lookup | Pass | Library root直下だけを読込 |
| Valid JSON colors | Pass | root、nested、child overrideを反映 |
| Precedence | Pass | JSONがlegacyより優先。JSONにないFolderへlegacyを混ぜずAuto |
| Selection projection | Pass | selected Track colorとoutlineへ反映 |
| Reload / Library switch | Pass | reload後の反映とLibrary切り替えを確認 |
| Valid empty JSON | Pass | empty `folderColors`はAuto。legacyへfallbackしない |
| Viewer regression | Pass | zoom width、Track click、highlight、Folder color UI、Monochrome、Search、bulk、Waypoint |
| Console | Pass | application error、不要なlog / warningなし |

#### Invalid JSON Acceptance

- [x] malformed JSONでもViewerを継続し、legacy色を混ぜない
- [x] unknown schemaでもViewerを継続し、legacy色を混ぜない
- [x] invalid pathを含むdocument全体をfail closedとする
- [x] partially validなFolder colorだけを採用しない
- [x] invalid JSONを自動修正または書き換えない

#### Google Drive Folder Acceptance

- [x] root直下の`trailbook.json`を読込
- [x] Folder colorsを反映
- [x] Library再選択で外部変更を反映
- [x] offline synced copyを読込
- [x] Console errorなし

#### Windows Edge Browser Acceptance

- [x] Library without JSON
- [x] valid JSON読込とFolder color反映
- [x] malformed JSONでもViewer継続
- [x] Library切り替え
- [x] Track selection / highlight
- [x] Monochrome Map Mode
- [x] Console errorなし

#### Data Protection Acceptance

- [x] `trailbook.json`を作成または更新しない
- [x] `trailbook.json`の更新日時を変更しない
- [x] GPX内容と更新日時を変更しない
- [x] `createWritable`を使用しない
- [x] readwrite permissionを要求しない

#### Unit 2 Known Notes

- orphan Folder pathはsnapshotへ保持するが、current Treeに存在しないため適用しない。
- external変更はLibrary再選択、または将来Unitで追加するReload UIまで自動反映しない。
- Appは975行である。Unit 3のwrite調停はAppへ直接集約せず、helper責務の抽出を優先する。

Chrome / Edge / Google DriveのBrowser Acceptanceが完了したため、Unit 2をCompletedとする。Unit 3もimplementation / static test / Browser AcceptanceまでCompletedである。

### Unit 3 Explicit Save, Write Permission, and Conflict Protection

Unit 3 Implementation Status: Completed
Unit 3 Static Test Status: Completed
Unit 3 Browser Acceptance Status: Completed
Unit 3 Status: Completed
Unit 4 Status: Completed

#### Implemented Boundary

- [x] `LibrarySettingsCoordinator`へload / save調停、State更新、FolderColorState projection、status更新、stale Library guardを抽出
- [x] Folder color Apply / Defaultでshared snapshotをdirty化し、Cancelや通常Viewer操作ではdirty化しない
- [x] Apply / Default時のlegacy localStorage保存を維持し、`trailbook.json`へ自動保存しない
- [x] `Libraryへ保存`の明示操作時だけreadwrite permissionをquery / requestする
- [x] missing fileは明示save時だけ`create: true`で作成し、existing fileは保存直前に再読込する
- [x] baseline / currentのfile existenceとSHA-256 fingerprintを比較し、不一致、invalid file、fingerprint取得不能で保存を停止する
- [x] normalized explicit Folder colorsだけをstable JSONへserializeし、orphan pathを保持する
- [x] `createWritable()`、full write、`close()`後に再読込し、expected fingerprint一致時だけsuccessとする
- [x] permission、create、write、close、verification failureでdirtyなsession色を維持し、Viewerを継続する
- [x] dirtyなLibrary切り替えはnative confirmを必要とし、自動保存しない。保存中はLibrary pickerをdisableする
- [x] stale save resultを新Library Stateへ適用せず、success表示しない
- [x] `LibrarySettingsPanel`でstatus、dirty、saving、saved、permission denied、conflict、failureを文字とlive regionで表示する
- [x] Reload、Overwrite、migration専用UI、Conflict dialog、Import / Export、自動merge、polling、background syncを追加しない
- [x] GPX、Folder構造、Map mode、selection、visible state、Search、geometry、FileHandleをshared JSONへ保存しない

#### Serialization and Write Sequence

1. current Library generationとdirty stateを確認する。
2. `queryPermission({ mode: "readwrite" })`を行い、必要時だけ`requestPermission({ mode: "readwrite" })`を行う。
3. baselineを取得し、current `trailbook.json`を再読込してconflictを判定する。
4. schema normalizerを通したsnapshotをUTF-8、BOMなし、LF、2-space indent、final newline付きでserializeする。
5. expected bytesのSHA-256を計算する。
6. `getFileHandle("trailbook.json", { create: true })`、`createWritable()`、full write、`close()`を行う。
7. Repositoryで再読込し、expected fingerprintと一致した場合だけdirty false / shared-json / loadedへ更新する。

#### Conflict and Failure Result

- baseline missing / current missingだけはcreate可能。current existsなら`conflict`とする。
- baseline exists / current missing、またはfingerprint changedは`conflict`とする。
- fingerprint unavailable / current read failureは`conflict-check-unavailable`として安全側で停止する。
- malformed、unknown schema、invalid structureのexisting fileは`invalid-current-file`として無条件上書きしない。
- permission denied / failed、file create、writable create、write、close、verification failureを区別し、raw JSON、local path、exception detailを利用者向けUIへ出さない。
- fingerprint確認後から`close()`までのexternal write raceは完全には排除できない。post-save verification不一致はsuccessにしないが、exclusive writerとmergeは未実装である。

#### Static Results

| Check | Result | Notes |
| --- | --- | --- |
| Unit 2 read-only regression | Pass | 121 assertions |
| Unit 3 save / conflict / state / coordinator | Pass | 136 assertions |
| Production module import | Pass | 39 / 39 |
| Missing import target | Pass | 0 |
| Circular dependency | Pass | 0 |
| Config version | Pass | `1.1.0` |
| DisplaySettingsStore schema | Pass | version 1 unchanged |
| TreeView size | Pass | 997 lines |
| App size | Pass | 975 lines |
| GPX write | Pass | `createWritable`はLibrary settings Repositoryの`trailbook.json`だけ |

#### Windows Chrome Browser Acceptance

| Area | Result | Confirmed behavior |
| --- | --- | --- |
| JSON missing | Pass | Applyではfileを作成せずUnsaved。明示Saveだけでpermissionを要求し、許可後に作成、Saved表示、reload / reselectionで復元 |
| Existing JSON | Pass | Applyだけでは内容 / timestamp不変。Saveでexplicit colorsだけを更新し、inherited / Autoは保存しない。Default後は該当pathを削除 |
| Serialization | Pass | UTF-8 BOMなし、LF、2-space indent、final newline、stable path ordering、uppercase `#RRGGBB` |
| Permission denied | Pass | Viewer継続、JSON不変、dirty維持、denied表示、retry可能 |
| Conflict | Pass | external editor変更を検出し、保存停止、外部JSON不変、dirty維持、conflict表示 |
| Library switch | Pass | dirty時確認、Cancelで停止、自動保存なし、破棄確認後だけ切り替え、保存中picker disabled |
| Accessibility | Pass | save button keyboard操作、文字status、aria-live、focus異常なし |
| Viewer regression | Pass | zoom width、Track click、highlight / outline、Folder color、Monochrome、Search、bulk、Waypoint |
| Console | Pass | application error、不要なwarning / logなし |

#### Windows Edge Browser Acceptance

- [x] JSON新規作成とexisting JSON更新
- [x] Applyだけでは書き込まない
- [x] permission denyとexternal conflictを安全に処理
- [x] reload後の色復元とLibrary切り替え
- [x] Track selection / highlight、Monochrome、Searchの回帰なし
- [x] Console errorなし

#### Google Drive Folder Acceptance

- [x] `trailbook.json`新規作成と更新
- [x] 外部同期後に別browserで読込
- [x] external変更のconflict検出
- [x] offline synced Folderで保存
- [x] `close()`後のJSON内容が完全
- [x] Console errorなし

#### Unit 3 Data Protection Acceptance

- [x] Folder color ApplyだけではJSON内容 / timestamp不変
- [x] `Libraryへ保存`時だけ`trailbook.json`を変更
- [x] GPX内容 / timestamp不変
- [x] `trailbook.json`以外のfile不変
- [x] Folder作成、GPX移動 / 削除なし
- [x] page unload自動保存とbackground保存なし

#### Unit 3 Known Limits

- Reload / Overwrite / Cancelの本格Conflict UIはUnit 4で扱う。
- automatic merge、polling、background syncは実装しない。
- fingerprint確認後から`close()`までのraceは完全には排除できず、post-write verificationで不一致を検出する。
- Appは975行である。今後のLibrary settings責務をAppへ直接追加せず、helper / coordinator抽出を維持する。

Chrome / Edge / Google DriveのBrowser Acceptanceが完了したため、Unit 3とUnit 4はCompletedである。Unit 5は開始していない。

### Unit 4 Migration, Reload, and Conflict Recovery

Unit 4 Implementation Status: Completed
Unit 4 Static Test Status: Completed
Unit 4 Browser Acceptance Status: Completed
Unit 4 Status: Completed
Unit 5 Status: Not started

#### Implemented Boundary

- [x] missing JSON + legacy explicit Folder colorsの場合だけ非blockingな明示migrationを提示
- [x] migration click前にfile作成とreadwrite permission要求を行わない
- [x] migrationはUnit 3 require-match saveを再利用し、途中でfileが出現した場合はconflictで停止
- [x] migration成功後はshared-json / loaded / dirty falseとし、legacy localStorageを削除しない
- [x] `設定を再読み込み`でRepository load、schema validation、fingerprint、source / statusを更新
- [x] dirty Reloadはnative confirmで破棄 / Cancelを選択し、自動保存しない
- [x] Reload後はold / new explicit Folder pathだけを既存限定restyleへ投影し、GPX再parse、Tree / Search再構築、Map refocusを行わない
- [x] conflict / invalid JSONからReload / 明示Overwrite / Cancelを選ぶ`SettingsConflictDialog`を追加
- [x] 通常saveは`require-match`を維持し、Dialogの明示操作だけ`explicit-overwrite`を使用
- [x] explicit Overwriteでもpermission再確認、current file再読込、full write、close、post-write verificationを実施
- [x] current read failureではOverwriteを停止し、invalid / unknown schemaは明示Overwrite時だけvalid schemaで置換可能
- [x] Overwrite失敗後もdirty / conflictを維持し、通常saveでconflict checkを迂回しない
- [x] conflict後のFolder色編集を許可し、dirty / conflictを維持
- [x] orphan pathをsnapshotとsaveへ保持し、Treeへ架空Folderを作らず、自動削除しない
- [x] saving / migration / reloading中とConflict dialog表示中はLibrary切り替えを停止
- [x] polling、background sync、automatic merge、File System Observer、visibility auto Reload、Import / Exportを追加しない

#### Coordinator / Repository / State API

- Coordinator: `bindEvents()`、`migrate()`、`reload()`、`overwrite()`を追加。既存`load()`、`applyLoad()`、`markDirty()`、`save()`、`canSwitchLibrary()`を維持する。
- Repository: `save()`へ`conflictPolicy: "require-match" | "explicit-overwrite"`を追加。既定は`require-match`である。
- State: `beginReload()`、`applyReload()`、`cancelReload()`、`beginMigration()`、`beginOverwrite()`、`canMigrate()`を追加。source / status / dirty / saveStatusを正本として維持する。
- Panel: status、save、manual Reload、条件付きmigrationを表示する。RepositoryとStateへ直接依存しない。
- Dialog: Reload / Overwrite / Cancel requestとfocus lifecycleだけを担当する。

#### Recovery and Data Protection

- Reloadはfileへ書き込まず、missing時はlegacy-localまたはAutoへ戻る。invalid / read-failedもViewerを停止しない。
- Reloadでroot / inherited / child override / Auto / selected Track色を再投影するが、selection、visibility、Map center / zoom、Monochrome、Waypointを変更しない。
- CancelはState、Folder色、fileを変更しない。Conflict dialogはCancelをdefault focusとし、EscapeをCancelとして扱う。
- Overwrite対象はLibrary rootの`trailbook.json`だけで、GPXと他fileへ`createWritable()`を使用しない。
- fingerprint確認後から`close()`までのraceは完全には排除できず、post-write verification不一致をfailureとする。
- Google Drive / OneDriveの同期完了を検出・保証せず、同期後はmanual Reload、Library再選択、page reloadを利用する。

#### Static Results

| Check | Result | Notes |
| --- | --- | --- |
| Unit 2 read-only regression | Pass | 121 assertions |
| Unit 3 save regression | Pass | 136 assertions |
| Unit 4 migration / reload / recovery | Pass | 103 assertions |
| Production module import | Pass | 40 / 40 |
| Missing import target | Pass | 0 |
| Circular dependency | Pass | 0 |
| Config version | Pass | `1.1.0` |
| DisplaySettingsStore schema | Pass | version 1 unchanged |
| TreeView size | Pass | 997 lines |
| App size | Pass | 974 lines |
| GPX write | Pass | `createWritable`はLibrary settings Repositoryの`trailbook.json`だけ |

#### Windows Chrome Browser Acceptance

| Area | Result | Confirmed behavior |
| --- | --- | --- |
| Migration | Pass | missing JSON + legacy colorsだけで操作を提示し、open時はfile作成・permission要求なし。click時だけ権限を求め、保存・再読込・legacy保持を確認。途中で外部JSONが出現した場合は上書きせずconflictで停止 |
| Manual Reload | Pass | external editorのroot / nested / child overrideを反映。selection、visibility、Map center / zoom、Monochromeを維持し、GPX parse、Tree全再構築、Search index再構築、file作成、permission要求なし |
| Dirty Reload | Pass | dirty時に確認し、CancelではState / 色 / file不変。明示破棄ではfile側を採用し、dirty / conflict / save errorを解除。legacy localStorageは保持 |
| Conflict dialog | Pass | 通常Saveの外部変更検出後に表示。Reload / Overwrite / Cancel / Escape、Cancel初期focus、focus trap、元buttonへのfocus復帰を確認。Overwrite時だけ権限を再確認して保存・verificationを実施 |
| Invalid JSON recovery | Pass | malformed JSONでもViewer継続、legacy色を混ぜずInvalid表示。Reloadと通常Saveはfileを修正せず、明示Overwrite時だけvalid JSONへ置換 |
| Orphan settings | Pass | snapshot、Reload、保存で保持し、架空Tree項目を作らず自動削除しない |
| Accessibility | Pass | keyboard、Enter / Space、aria-live、文字status、focus維持を確認 |
| Viewer regression | Pass | zoom width、Track click、highlight / outline、Folder color、Monochrome、Search、bulk、Waypoint、Library switch |
| Console | Pass | application error、不要なwarning / logなし |

#### Windows Edge Browser Acceptance

- [x] Migrationとmanual Reload
- [x] dirty ReloadのCancel / 明示破棄
- [x] Conflict Reload / Overwrite / Cancel
- [x] invalid JSONの明示Overwrite recovery
- [x] keyboard、Escape、focus復帰
- [x] Track selection / highlight、Monochrome、Searchの回帰なし
- [x] Console errorなし

#### Google Drive Folder Acceptance

- [x] 別browser変更とDrive同期後のmanual Reloadで色を反映
- [x] conflict Reload / Overwrite
- [x] offline synced copyでReload / 保存
- [x] permission deny後もViewerを継続
- [x] `close()`後のverification
- [x] Console errorなし

#### Unit 4 Data Protection Acceptance

- [x] migration click前とmanual Reloadではfileを書き込まない
- [x] 明示Overwrite時だけexisting `trailbook.json`を置換する
- [x] GPX内容 / timestamp不変
- [x] `trailbook.json`以外のfile不変
- [x] Folder作成、GPX移動 / 削除なし
- [x] automatic save、polling、background sync、automatic mergeなし

#### Unit 4 Known Limits

- automatic merge、polling、background sync、File System Observer、visibility auto Reloadは実装しない。
- Google Drive等のprovider同期完了とoffline freshnessはTrailBookが保証しない。
- fingerprint確認後から`close()`までのexternal raceを完全には排除できない。
- Appは974行、TreeViewは997行である。今後も責務追加はhelper / coordinator / dedicated UIへ分離する。

Chrome / Edge / Google DriveのBrowser Acceptanceが完了したため、Unit 4をCompletedとする。Unit 5は開始していない。
