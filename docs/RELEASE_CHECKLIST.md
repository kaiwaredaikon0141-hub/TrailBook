# TrailBook Release Checklist

Version: 1.0.0 release record / 1.1 planning
Status: Release 1.0 Completed / Release 1.1 Planning
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

Release 1.1 Status: Planning
Unit 1 Status: Completed
Architecture Status: Completed
Decision Status: Completed
Event Contract Status: Completed
Test Plan Status: Completed
Production Implementation Status: In progress — Unit 3 completed、Unit 4 not started
Current production version: `1.0.0`
Planning baseline commit: `29d7db7`

### Unit Plan

| Unit | Scope | Status | Dependency |
| --- | --- | --- | --- |
| 1 | Planning and architecture | Completed | Release 1.0 |
| 2 | TrackStyleService and zoom-based width | Completed | Unit 1 |
| 3 | SelectionState、Map click、highlight | Completed | Unit 2 |
| 4 | UI settings persistence foundation | Pending | Unit 1 |
| 5 | Folder color UI and inheritance | Pending | Unit 3、Unit 4 |
| 6 | Monochrome Map Mode | Pending | Unit 4 |
| 7 | Integrated acceptance、performance、documentation、Release finalization | Pending | Unit 2〜6 |

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
- [ ] Folder明示色、親継承、子override、Default
- [ ] FolderColorStateとDisplaySettingsStoreの責務分離
- [ ] root Folder color
- [ ] path hash fallbackと最終fallback
- [ ] 色未設定Folder配下で既存GPX path hash色が維持される
- [ ] valid `#RRGGBB`とinvalid color
- [ ] schema version 1 read / write
- [ ] corrupted localStorage JSON
- [ ] unknown / future schema version
- [ ] localStorage read / write / quota / security failure
- [ ] root名変更と同名Library collision behavior
- [x] module import — production module 29 / 29（`SelectionState.js`を含む）
- [x] circular dependency — 0件
- [x] EventBus request / changed contract — Unit 3 static test Pass
- [x] SelectionState単一path、clear reason、Library切り替え — Unit 3 static test Pass

### Browser Acceptance Plan

- [x] Map Track click selection — Chrome / Edge Pass
- [x] thin line Canvas tolerance hit area — tolerance 6で実用上問題なし
- [x] Tree selection synchronization — Chrome Pass
- [x] Search result selection synchronization — Chrome Pass
- [ ] selected highlightが元Folder色を維持する
- [x] Map背景click deselect — Chrome / Edge Pass
- [ ] hidden selected Trackのselection解除
- [x] ClearとLibrary switch — Unit 3 Chrome Pass
- [ ] parse failure後にselectionが残らない
- [ ] Tree / Search originだけが既存refocusを行う
- [ ] Map origin selectionでviewportが動かない
- [x] overlapping Trackのtopmost selection — 最前面の1件を選択
- [x] Track上のdouble-click zoom — Chrome Pass
- [ ] Folder color Apply
- [ ] parent inheritance、child override、root inheritance
- [ ] Defaultへ戻す、Cancel、Escape、focus return
- [ ] reload後のFolder色復元
- [ ] root Folder名変更時はDefault
- [ ] 同名Libraryが設定を共有する既知制限
- [ ] localStorage unavailableでもsession操作継続
- [x] zoom bucket内でrestyleなし — Chrome browser acceptance Pass
- [x] zoom bucket境界で表示中Trackだけrestyle — Chrome / Edge browser acceptance Pass
- [ ] Folder色変更で対象配下だけrestyle
- [ ] keyboard accessibility、ARIA、色以外の状態説明
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
- [ ] Folder色変更時の更新対象が対象Folder配下だけであることを確認する
- [ ] outlineが選択中GPXだけに存在することを確認する
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
Unit 4 Status: Not started

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

### Unit 6 Candidate — Monochrome Map Mode

- 背景OSM tileだけをグレースケール化し、Track、Waypoint、UIにはfilterを掛けない。
- tile providerとOpenStreetMap attributionを維持する。
- Color / Monochromeを切り替え可能とし、初期値はColorとする。
- CSS filter方式を第一候補とする。
- localStorage保存はUnit 4のFolder color persistence基盤と共用できる。
- Mobile対応は対象外であり、Unit 2では実装しない。

### Persistence Schema

Storage key: `trailbook.uiSettings`
Schema version: `1`
Library identity: exact root Folder nameから`root-name:<name>`
Folder identity: current Library内のrelative path。rootは空文字。

保存失敗、削除、破損、未知versionではDefault色へ戻るかsession内設定だけで継続する。GPXの内容、更新日時、Folder構造へ影響させない。

### Release 1.1 Open Risks

- 同名root Folderは色設定が衝突する。Release 1.1では個人利用の既知制限として受け入れる。
- root Folder名変更後は旧設定を自動移行できない。
- Canvas renderer、hit tolerance、overlap順序はChrome / Edgeで確認済みである。overlapping Trackでは最前面の1件を選択する。
- 806 GPXでTrack click、highlight、zoom bucket変更に明確な性能回帰は確認されていない。
- TreeViewは997行のため、Folder color UIを直接追加して1,000行規則を超えないよう、helperまたはdialog責務を別Viewへ置く。
