# TrailBook Release Checklist

Version: 1.0.0〜1.5.0 release records
Status: Release 1.0〜1.5 Completed
Baseline: v1.4.0 for Release 1.5

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

Release 1.1 Status: Completed
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

Release 1.1 Completion Status: Completed

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

Release 1.2 Status: Ready for final commit and tag
Current Release: `1.2.0`
Production Implementation Status: Completed

### Unit Status

| Unit | Scope | Status | Depends on |
| ---: | --- | --- | --- |
| 1 | Scope、Architecture、Decisions、schema、permission / conflict policy、test plan | Completed | Release 1.1 completed baseline |
| 2 | read-only loader、schema validation、Library open時の読込、localStorage fallback | Completed | Unit 1 |
| 3 | readwrite permission、safe writer、explicit save、failure handling | Completed | Unit 2 |
| 4 | localStorage migration、manual reload、conflict resolution UI | Completed | Unit 2、3 |
| 5 | Google Drive Folder、Chrome / Edge、integrated acceptance、documentation、Release finalization | Completed | Unit 2〜4 |

Unit 1 Planning Status: Completed
Unit 1 Production Implementation Status: Not applicable（planning unit）
Unit 1 Status: Completed

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

- [x] valid `trailbook.json`
- [x] missing file
- [x] empty file
- [x] malformed JSON
- [x] unknown schema
- [x] unknown structural field
- [x] partial invalid Folder colors
- [x] dangerous keys / prototype pollution
- [x] array / `null`
- [x] Japanese path
- [x] root path `""`
- [x] nested Folder and orphan path
- [x] stable serialization、UTF-8、LF、final newline
- [x] JSON precedence、empty JSON、localStorage fallback
- [x] permission granted / denied / revoked
- [x] write / close / quota failure
- [x] read fingerprint、external change、missing-to-created conflict
- [x] migration、existing JSON no-overwrite
- [x] no GPX / FileHandle / geometry persistence and no GPX write
- [x] production module import and circular dependency

### Browser and Integration Test Plan

- [x] Chrome / Edge: Library without JSON and with valid JSON
- [x] Folder colors load、root / nested / Japanese path、inheritance / Auto
- [x] same JSONをChrome / Edgeで再現
- [x] localStorage migration preview、accept、deny、retry
- [x] explicit save、reload、Library switch、dirty confirmation
- [x] external file change、conflict Reload / Overwrite / Cancel
- [x] malformed / unsupported JSONでもViewer継続
- [x] Google Drive同期Folder read / write / resync / manual Reload
- [x] offline時の最新同期済みcopy
- [x] existing Viewer、Search、selection、Folder bulk、Waypoint、Monochrome regression
- [x] Console、keyboard、ARIA、focus
- [x] GPX content / timestamp unchanged、GPXへ`createWritable`なし

### Known Limits and Open Validation

- File System Access APIのpermission persistenceとprovider挙動はbrowser / user grantに依存するため、保存時に毎回照会する。
- fingerprint確認後から`close()`までのexternal write raceを完全には排除できない。
- Google Drive等の同期完了、offline freshness、conflict解消をTrailBookは保証しない。
- orphan pathは自動追従しない。automatic mergeとfield-level mergeは未実装とする。
- Import / Export、backup、exclusive writer、File System ObserverはFuture Candidateとする。
- Unit 1〜5はCompletedである。Release 1.2はfinal commit / tag待ちである。

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
Unit 5 Status at Unit 4 completion: Not started

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

### Unit 5 Integrated Acceptance and Release Finalization

Unit 5 Implementation Status: Completed
Unit 5 Static Test Status: Completed
Unit 5 Browser Acceptance Status: Completed
Unit 5 Status: Completed

Release 1.2 Unit 1〜5 Status: Completed
Release 1.2 Status: Ready for final commit and tag
Final commit / tag / push: Pending

#### Integrated Browser Acceptance

| Environment | Result | Confirmed behavior |
| --- | --- | --- |
| Windows Chrome | Pass | valid / invalid JSON、legacy fallback、explicit save、permission deny、conflict detection、migration、manual / dirty Reload、Reload / Overwrite / Cancel、invalid JSON recovery、keyboard / ARIA / focus、Viewer regression |
| Windows Edge | Pass | shared JSON load、explicit save、migration、manual Reload、conflict / invalid JSON recovery、keyboard / focus、Viewer regression |
| Google Drive Folder | Pass | shared JSON load、create / update、別browser共有、offline copy、manual Reload、conflict Reload / Overwrite、permission deny、close verification |

統合結果はUnit 2〜4で実施した人間による定性的受け入れを使用する。806 GPX Libraryで既存ViewerとShared Library Settings操作に明確な回帰やUI停止は確認されていない。数値benchmarkと20%比較は実施していない。

#### Final UI Review

- [x] 通常時はcompactなshared status、`Libraryへ保存`、`設定を再読み込み`を中心に表示
- [x] migration、Unsaved、Conflict、Invalid、Permission denied、Save failedは条件付き表示
- [x] 同じ意味のsave buttonを重複表示しない
- [x] 通常状態で長いwarningを常時表示しない
- [x] statusとbuttonを文字で識別でき、iconだけに依存しない
- [x] native keyboard操作、`aria-live`、dialog focus、status更新時のfocus維持
- [x] toolbarを変更せず、Library sidebar内のpanelとして表示

#### Release 1.2 Data Protection

- [x] Folder color Apply / DefaultだけではJSONを書き込まずdirty化だけを行う
- [x] manual Reloadではfileを書き込まない
- [x] explicit Save / Migration / Overwrite時だけ`trailbook.json`を書き込む
- [x] GPX内容 / timestamp、Folder、`trailbook.json`以外のLibrary fileを変更しない
- [x] GPX移動 / 削除 / 保存、Folder作成を行わない
- [x] automatic / debounce / unload / background saveを行わない
- [x] polling、background sync、automatic merge、cloud APIを追加しない
- [x] FileHandle、FolderHandle、GPX XML、TrackPoint、geometryを永続化しない

正式原則は「TrailBookは、ユーザーの明示的な保存操作なしにGPXやLibrary設定ファイルを変更、移動、削除しない。」である。Release 1.2ではGPX editingとGPX保存を実装しない。

#### Final Static Validation

| Check | Result | Notes |
| --- | --- | --- |
| Unit 2 tests | Pass | 121 assertions |
| Unit 3 tests | Pass | 136 assertions |
| Unit 4 tests | Pass | 103 assertions |
| Production module import | Pass | 40 / 40 |
| Missing import target | Pass | 0 |
| Circular dependency | Pass | 0 |
| Unused import | Pass | 0 across 40 production modules |
| App size | Pass | 974 lines |
| TreeView size | Pass | 997 lines |
| Config version | Pass | `1.2.0` |
| DisplaySettingsStore schema | Pass | version 1 unchanged |
| Shared settings schema | Pass | version 1 unchanged |
| Write boundary | Pass | `createWritable` / readwrite permissionはLibrarySettingsRepositoryだけ |
| GPX writer | Pass | none |
| Automatic mechanisms | Pass | automatic save / polling / background sync / automatic mergeなし |
| Markdown | Pass | local links、heading、code fence、tableを確認 |
| Decision IDs | Pass | duplicate 0、0033〜0035 Acceptedを維持 |
| License files | Pass | `LICENSE` / `THIRD_PARTY_NOTICES.md`差分なし |

#### Current Limitations

- GPX editing、GPX保存、Folder rename / move、Import / Exportは未実装
- automatic merge、polling、background sync、cloud APIは未実装
- Google Driveのsync statusを取得できず、外部変更後にmanual Reloadが必要な場合がある
- fingerprint確認後からwriter closeまでの競合raceは完全には排除できず、post-write verificationで不一致を検出する
- Mobile Viewer UXは未対応
- File System Access API対応browser / originを必要とし、permission persistenceを前提にしない
- 大量GPX表示中のWaypoint ONは引き続き性能上の既知制限

Release 1.2はfinal commitとtagを作成できる状態である。commit、tag、pushはこのUnitでは実行しない。

## Release 1.3 Previous View Restoration — Completed

Release Status: Completed

Current Release: `1.3.0`。Release 1.2 Unit 1〜5のCompleted記録、v1.2.0 baseline、shared settings schema version 1を変更しない。

### Unit 1 Preflight

| Check | Result | Notes |
| --- | --- | --- |
| working tree before planning edit | Pass | clean |
| branch / remote | Pass | Unit 2開始時に`main` = `origin/main` = `972bfef` |
| release tag | Pass | production baseline `v1.2.0`は`d441923`。Unit 1 planning commitは`972bfef` |
| Config version | Pass | `1.2.0` |
| production module baseline | Pass | v1.2.0 acceptance record 40 / 40。current graph 40 modules、missing import 0、cycle 0 |
| App / TreeView size | Pass | 974 / 997 lines |
| DisplaySettingsStore / shared schema | Pass | version 1 / version 1 |
| production difference | Pass | Unit 1はdocsだけを変更 |

Current runtime contract: `DisplayState.checked`が表示意図、loading / loaded / error、requestId、Library generationの正本である。`SelectionState`が単一selected pathを管理する。MapViewは`getZoom()`とdefault `resetView()`を持つがcenter snapshot / arbitrary restore APIは持たない。Library切り替えはold Queue / Search / Map / DisplayState / selectionをclearしてshared settingsを投影する。現行sidebarはTreeViewが所有する常時openの`aside`で、open / closed APIはない。

### Unit Status

| Unit | Scope | Status |
| --- | --- | --- |
| 1 | Scope、Architecture、Decisions、schema、identity、restore order、performance / test plan | Completed |
| 2 | ViewStateStore / schema、Map state、desktop sidebar、Reset基盤 | Completed |
| 3 | visible Track restore、existing Queue、bulk coalescing、stale guard | Completed |
| 4 | Previous Library Handle Store / Coordinator、permission UX、自動 / 手動open | Completed |
| 5 | 806 GPX warm restore performance gate、geometry cache | Completed |
| 6 | selected Track restore、Reset UI、error / lifecycle integration | Completed |
| 7 | Chrome / Edge、806 GPX、documentation、Release finalization | Completed |

Production Implementation Status: Completed

### Frozen Planning Scope

- [x] Map center / zoomをLibrary単位でdevice-local保存・復元する
- [x] visible GPX relative path listを保存し、current metadataに存在するpathだけを既存display pipelineへ復元する
- [x] visibleかつloadedなselected TrackだけをSelectionStateへ復元する
- [x] desktop sidebar open / closedを保存・復元する。widthは保存しない
- [x] current Libraryの保存済みprevious view stateだけを消すconfirmation付きResetを提供する
- [x] 最後に正常に開いたDirectoryHandleとcache専用opaque namespaceをIndexedDBへ保存し、localStorage / shared JSONへHandleを書かない
- [x] permission `granted`時の自動openと、`prompt` / `denied`時の`前回のLibraryを開く` / manual pickerを提供する
- [x] `trailbook.json`、GPX、Folder、Leaflet Layer、Queueへview stateを書かない。geometry cacheは5秒gate不達により再生成可能な補助として実装する
- [x] existing Queue concurrency 2、cache上限100、Waypoint初期OFF、Search / Folder bulk契約を維持する

Future: sidebar width、Search query、Tree expanded paths / scroll / focus、stable Library alias。Mobile sidebar、shared view state、browser間同期はRelease 1.3対象外とする。

### Store and Schema Plan

Storage key: `trailbook.viewState`

Schema version: 1（dedicated Store）。`trailbook.uiSettings` schema version 1と`trailbook.json` schema version 1は変更しないため、既存schema 1からのmigrationは実施しない。

```json
{
  "version": 1,
  "libraries": {
    "root-name:GPXLog": {
      "map": { "lat": 35.0123, "lng": 135.6789, "zoom": 11 },
      "visibleTracks": ["car/2026-07-01.gpx"],
      "selectedTrack": "car/2026-07-01.gpx",
      "sidebar": { "open": true }
    }
  }
}
```

Validation gates:

- [x] malformed JSON / unknown schema / invalid top-level / oversize raw dataはStore全体をfail closed
- [x] recognized Library entryはMap、visibleTracks、selectedTrack、sidebarをfield単位でfallback
- [x] pathはroot-relative、`/`、case-sensitive。absolute、backslash、control、empty / `.` / `..` segment、dangerous keyを拒否
- [x] duplicate pathをstable dedupeする。stale pathのcurrent metadata解決はUnit 3で行う
- [x] Map finite / range / zoom、sidebar booleanを検証する。selected-is-visible-and-loadedはUnit 6で検証する
- [x] raw document 1,048,576 bytes、raw `visibleTracks` 5,000件をdefensive capとして固定する
- [x] invalid stored valueを暗黙修復・自動上書きせず、session fallbackでViewerを継続する

### Library Identity Review

| Candidate | Planning Result | Validation |
| --- | --- | --- |
| existing root-name ID | Adopt for Release 1.3 | same name collision、root renameで別ID、move後同名をtest |
| FolderHandle-derived View State ID | Reject | `isSameEntry()`はhandle比較だけ。root-nameのlocalStorage keyを置き換えない |
| Previous DirectoryHandle record | Adopt in planned Unit 4 | IndexedDB structured clone。opaque cache namespaceはshared identityへ流用しない |
| root structure fingerprint | Reject | rename / move / file増減、scan cost、GPX内容hash禁止 |
| user Library alias | Future | UIとshared metadataの別Decisionが必要 |

Known limitation: 同名root Folderは同じdevice-local view stateを共有し得る。Reset UIを回復手段とし、未確認Libraryを対応済みと記載しない。

### Save Timing Plan

- [x] Map `moveend`後だけ保存し、pan / zoom中と`zoomend`との二重writeを避ける
- [x] individual / Search checkbox、Folder / root bulk、Clearの完了後にchecked path snapshotを取る
- [x] clearとvisible Track変更をMap / sidebarと同じdebounce queueへ接続する。selectionはUnit 6で接続する
- [x] delayを750msへ固定し、Map / sidebar操作を一つのtimerへcoalesceする
- [x] restore中はsave suspend、Library switch前はold Library pending snapshotをflushする
- [x] unloadだけへ依存せず、background interval、parse完了ごとのwrite、shared JSON writeを行わない
- [x] quota / SecurityErrorでsession memoryへfallbackし、Viewerを停止しない

### Restore Order Plan

1. Library選択、Folder scan、Tree metadata構築
2. shared Folder colors投影とDisplayState file registration
3. current Library view state読込、path解決、generation確認
4. sidebar投影、layout確定、Map size再評価
5. visible Trackを既存DisplayState / GPXDisplayQueueへ投入し、restore中のfitBoundsを抑止
6. 全target terminal後、saved Mapをanimationなしで一回投影。missing / invalidならfitBounds / default
7. visible、loaded、Layer存在のselected Trackだけをsystem restore
8. Tree ancestorsだけをrevealし、focus、scroll、Map pan、Search変更なし
9. UI projection後にsave suspension解除

Map / selection / sidebarの利用者操作はrestore中のsaved投影より優先する。checkbox OFF / Clearは既存requestId invalidationを使用する。Library switchはgenerationでold restoreを無効化する。

### Static Test Plan

- [ ] dedicated schema valid / missing / malformed / unknown / oversize
- [ ] existing DisplaySettingsStore schema 1を読み書きせず、migrationやkey衝突がない
- [ ] partial invalid Map / selection / sidebarとfail-closed visible list
- [ ] valid / invalid / duplicate / stale GPX path、dangerous key、prototype pollution対策
- [ ] selected missing / invisible / loading / error / loaded
- [ ] Library identity、same-name limitation、root rename、Library switch、stale generation
- [ ] Map validation / single setView / restore-event save suppression
- [ ] sidebar default / invalid / toggle / Map invalidateSize / focus
- [ ] debounce、latest snapshot、bulk coalescing、old Library flush、storage failure / session fallback
- [ ] existing Queue only、duplicate enqueue / parse / renderなし、request invalidation
- [ ] Reset current Library only。Map mode、Folder colors、shared JSON、other Library不変
- [ ] production module import、missing import、circular dependency、unused import
- [ ] no GPX / shared JSON write、no Handle in localStorage / shared JSON
- [ ] IndexedDB unavailable / corrupt、permission拒否、stale handle、origin変更でViewerとmanual pickerを継続
- [ ] geometry cache採用時はsource validation、schema、fallback、duplicate parse / render防止、quota failureを検証

### Browser Acceptance Plan

Chrome / Edge:

- [ ] first open without stateはcurrent behavior
- [ ] second openでMap center / zoom、0 / 1 / mixed / all visible Track、selected Track、sidebarを復元
- [ ] root all ON / OFF、individual / Folder / Search checkbox、Clear後のsnapshot
- [ ] selected visible / invisible / missing / parse failure、ancestor reveal、focus / scroll / Map不変
- [ ] restore中のpan / zoom、selection、sidebar、checkbox、Clear、Library switch
- [ ] same-name Library limitationとReset recovery
- [ ] Monochrome、shared Folder colors、Search、Waypoint OFF / ON、Map click / highlight regression
- [ ] reload、storage unavailable / malformed、Console、keyboard、ARIA、body / sidebar scroll
- [ ] GPX / `trailbook.json` content and timestamp不変
- [ ] startup `granted` auto-open、`prompt` / `denied` non-blocking action、manual picker維持、stale handle破棄
- [ ] scheme / host / port変更では保存Handle / cacheを共有しないことを確認

Mobile Viewer UXは既存の非対応 / 未確認結果を維持し、Release 1.3でsidebar drawerやtouch UIを追加しない。

### Performance Acceptance Plan

| Visible targets | Save size | Enqueue / initial response | Restore complete | UI responsiveness | Result |
| ---: | ---: | ---: | ---: | --- | --- |
| 0 | | | | | Pending |
| 1 | | | | | Pending |
| 50 | | | | | Pending |
| 200 | | | | | Pending |
| 806 | | | | | Pending |

- [ ] same PC / browser / origin / 806 GPX Library、Waypoint OFF、最低3回と中央値を可能な範囲で使用
- [ ] browser freeze、操作可能になるまで、Queue active / queued、duplicate parse / render、localStorage write回数を確認
- [ ] restore後pan / zoom、Track click / highlight、Map mode、Folder restyleを定性的評価
- [ ] cache上限100のため806件すべてをwarmと記載しない
- [ ] Waypoint ONの大量Marker既知制限をprevious view restore回帰と混同しない
- [x] baselineとgeometry cache導入後を数値で測定し、推測値を使用しない
- [x] 806前後のwarm restoreはLibrary scan / permission時間を分離し、Waypoint OFF、最低3回の中央値約5秒以内を確認する
- [x] cold初回parseは従来速度を許容し、warmと混同しない
- [x] 既存再parse中央値25秒の不達によりIndexedDB geometry cacheを実装し、導入後中央値3秒を確認する

Initial policyは既存root bulk相当の一括enqueueである。806件で再現可能なUI blockまたは重大回帰がある場合だけ、既存Queueへのchunked enqueueとprogressを検討する。hard limit、200件confirmation、別RestoreQueueは採用しない。約5秒gate不達時のgeometry cacheは既存Queueの正本性を維持し、cache failureを通常parseへfallbackさせる。

### Unit 2 Implementation and Static Result

Unit 1 Status: Completed

Unit 2 Implementation Status: Completed

Unit 2 Static Test Status: Completed

Unit 2 Browser Acceptance Status: Completed

Unit 2 Status: Completed

Unit 3 Status at Unit 2 completion: Not started

Implemented foundation:

- dedicated `trailbook.viewState`、schema `version: 1`
- Library単位のMap center / zoomとdesktop sidebar open / closedの保存・復元
- Toolbarのkeyboard操作可能なSidebar toggleとcurrent Library state Reset
- Map `moveend`とSidebar toggleを共通750ms debounceへ集約
- Library switch前のold Library pending snapshot flush
- restore / programmatic projection中のsave suppression
- invalid / unknown / malformed / oversize storageのfail closedとsession fallback
- raw document 1,048,576 bytes、raw `visibleTracks` 5,000件のdefensive cap

Unit 2は`visibleTracks`と`selectedTrack`をschema上でvalidation・保持するが、runtimeからの収集、Queue投入、selection復元を行わない。visible TrackはUnit 3、selectionはUnit 6の対象である。

Static result:

| Check | Result | Notes |
| --- | --- | --- |
| ViewState schema / Store / Coordinator non-DOM checks | Pass | 24 assertions |
| old Library pending snapshot isolation | Pass | generation切替後もold Library IDでflushし、new Library timerを残さない |
| production module import | Pass | 46 / 46。`main.js`は最小`window.addEventListener` stubで評価 |
| missing relative import | Pass | 0 |
| circular dependency | Pass | 0 |
| App / TreeView size | Pass | 995 / 997 lines。ともに1,000行未満 |
| Config version | Pass | `1.2.0` |
| existing schemas | Pass | DisplaySettingsStore 1 / shared settings 1を変更しない |
| GPX / shared JSON write | Pass | View stateは`localStorage` / session memoryだけを使用 |

Browser用`sample/release/view-state-store-test.html`と`view-state-store-test.js`を作成した。人間によるChrome / Edge Browser AcceptanceでMap / Sidebar / Reset、storage fallback、既存Viewer回帰、keyboard / ARIA、data protectionを確認し、Unit 2をCompletedとする。

#### Unit 2 Browser Acceptance Result

| Check | Result | Notes |
| --- | --- | --- |
| Library初回open | Pass | view stateがない場合は既存default behavior |
| Library再選択後のMap center / zoom | Pass | animationなしで復元し、fit behaviorによる後続上書きなし |
| page reload直後 | Pass | Library未選択のため自動復元せず、同じLibrary再選択時に復元 |
| Sidebar open / closed | Pass | 再選択・reload後に復元。layout、Map center、Tree / Search stateを維持 |
| Save queue / Library switch | Pass | 750ms coalescing、old pending flush、Library間state分離、stale restoreなし |
| Reset | Pass | current Libraryだけを削除し、runtimeと他設定を維持。明示操作後に保存再開 |
| storage fallback | Pass | read / write / quota failureでViewer継続、session fallback、破壊的修復なし |
| Existing Viewer regression | Pass | shared settings、Track selection、Folder color、Monochrome、Search、bulk、Waypointに問題なし |
| Data protection | Pass | `trailbook.viewState`以外、shared JSON、GPX、timestamp、handle、geometryを変更・保存しない |
| visible / selected Track restore | Not implemented as planned | Unit 3 / 6 Scope |

### Open Validation After Unit 4 Browser Acceptance

- selected Track restore（Unit 6）

### Unit 3 Visible Track Restoration

Unit 3 Implementation Status: Completed

Unit 3 Static Test Status: Completed

Unit 3 Browser Acceptance Status: Completed

Unit 3 Status: Completed

Unit 4 Previous Library Restore Status: Completed

Unit 5 Fast Restore Performance Gate Status: Completed — Cache median 3 seconds

Implementation result:

- `DisplayState.checked`からvisible relative pathを収集し、Map / sidebarと同じLibrary snapshotへ保存する
- individual / Search checkbox、Folder / root bulk、Clearを既存750ms debounceへ統合する
- normalized pathをcurrent DisplayStateへ解決し、missing / stale pathを無視する
- restore requestは既存`gpx:display-toggled`と`GPXDisplayQueue`を使用し、Queue concurrency 2を維持する
- Queue全target terminal後にsaved Mapを一回復元し、restore中のsaveと自動refocusを抑止する
- Library generation / restore request IDでstale completionを破棄する
- selected Track restore、progress、chunking、専用Queue、件数limitは追加しない

Static result:

| Check | Result | Notes |
| --- | --- | --- |
| View State Unit 1〜3 test page | Pass | 142 assertions |
| visible Track 0 / 1 / multiple | Pass | empty、single、multiple snapshot / restore |
| stale / duplicate path | Pass | staleを無視し、duplicateを一回だけrestore |
| Folder / root bulk coalescing | Pass | timer 1件、localStorage write 1回 |
| Clear | Pass | `visibleTracks: []`を保存 |
| Library switch / generation | Pass | stale restoreを破棄しcurrent Map / Libraryを維持 |
| Map / Sidebar coexistence | Pass | visible restore完了後にsaved Map、Sidebarを維持 |
| restore中のuser Map操作 | Pass | saved Map投影をskipし、user Mapを完了後に保存 |
| GPXDisplayQueue | Pass | concurrency 2、全request後のidle通知、重複実行なし |
| Unit 2 regression | Pass | Store、Map、Sidebar、Reset、fallbackを含む |
| Browser Acceptance後のstatic revalidation | Pass | 142 assertions、production module 46、missing import 0、cycle 0 |
| App / TreeView size | Pass | 999 / 997 lines |
| Config / schema | Pass | Config `1.2.0`、DisplaySettingsStore 1、shared settings 1 |

Browser Acceptance result:

| Check | Result | Notes |
| --- | --- | --- |
| 少数Track復元 | Pass | 保存済みvisible pathを既存display pipelineへ復元 |
| 807 visibleTracks保存 | Pass | duplicate pathなし |
| 807 Track最終復元 | Pass | duplicate表示とUI停止なし |
| stale path | Pass | 架空項目や復元errorを発生させず無視 |
| Map center / zoom共存 | Pass | visible restore後も保存Mapを維持 |
| Sidebar共存 | Pass | 保存済みopen / closedを維持 |
| qualitative performance | Pass | 通常のcold表示とほぼ同等。warm約5秒の数値判定は未実施 |
| progress UI | Not added as planned | 現時点では不要。Unit 5 Performance Gateと分離 |
| Data protection | Pass | `trailbook.json` / GPXへの書き込みなし |

Unit 3はCompletedである。Unit 5では既存再parse中央値25秒の不達を確認してDecision 0040のIndexedDB geometry cacheを実装し、導入後中央値3秒で約5秒目標をPassした。

### Additional Planning — Previous Library and Fast Restore

Planning Addendum Status: Completed

Production Implementation Status: Previous Library Restore / geometry cache Completed

- [x] previous DirectoryHandleはIndexedDBだけへ保存し、HandleをlocalStorage / shared JSONへ保存しない設計とした
- [x] startupはread permission `granted`時だけ自動openし、`prompt` / `denied`は利用者gestureの`前回のLibraryを開く`へ分離した
- [x] IndexedDB / permission / stale handle failureでもmanual pickerとViewerを継続する
- [x] originはscheme / host / port単位であり、site data削除 / private browsingではrecordを保証しない
- [x] 806前後のwarm restore中央値約5秒をperformance gateとし、cold loadと分離した
- [x] geometry cacheはgate不達時だけ採用し、Library namespace + relative path、parser / cache schema、size、lastModifiedでvalidationする
- [x] cache miss / invalid / failureはexisting Queueへfallbackし、duplicate parse / renderを禁止する
- [x] Unit 3 / 4はBrowser AcceptanceまでCompleted。Unit 5 Performance GateもCompleted

### Unit 4 Previous Library Restore

Unit 4 Implementation Status: Completed

Unit 4 Static Test Status: Completed

Unit 4 Browser Acceptance Status: Completed

Unit 4 Status: Completed

Unit 5 Fast Restore Performance Gate Status: Completed — Cache median 3 seconds

Implementation result:

- origin-local IndexedDB `trailbook.runtime` version 1、object store `previousLibrary`、key `last`へ最後に正常に開いたDirectoryHandleとcache専用opaque namespaceを保存する
- startupはread permissionをqueryし、`granted`だけを既存Library load lifecycleへ自動接続する
- `prompt` / `denied`ではstartup permission requestを行わず、native `前回のLibraryを開く` buttonの明示操作時だけread permissionをrequestする
- manual picker成功時はcurrent generationでLibrary apply完了後だけlast Handleを更新する
- stale `NotFoundError`は保存recordを破棄し、IndexedDB / permission / read failureでは通常pickerとViewerを継続する
- Appからsupport、picker、scan、generation、access UI調停を`PreviousLibraryCoordinator`へ抽出し、Map / Sidebar / visible Trackは既存`handleLibraryLoaded()` / `ViewStateCoordinator`を再利用する
- HandleをlocalStorage / `trailbook.json` / Consoleへ保存せず、GPXとshared JSONへ書き込まない

Static result:

| Check | Result | Notes |
| --- | --- | --- |
| View State / Previous Library test page | Pass | 202 assertions |
| Handle save / load / clear | Pass | injected IndexedDB adapter、invalid record discard |
| granted startup auto restore | Pass | query 1回、permission request 0回、existing apply callback |
| prompt / denied | Pass | startup request 0回、明示操作時だけread request |
| stale Handle | Pass | `NotFoundError`でrecord clear、manual picker維持 |
| IndexedDB failure | Pass | load / save failureでViewer loadとmanual pickerをblockしない |
| manual picker / Library switch | Pass | 成功Handleをlast recordへ更新し、latest generationを適用 |
| Existing view restoration regression | Pass | Unit 1〜3 Store / Map / Sidebar / visible Track assertionsを維持 |
| Production module graph | Pass | 48 modules、missing import 0、cycle 0 |
| App / TreeView size | Pass | 914 / 997 lines |
| Config / schema | Pass | Config `1.2.0`、DisplaySettingsStore 1、shared settings 1、View State 1 |
| Data protection static scan | Pass | Previous Library modulesにlocalStorage、`trailbook.json`、`createWritable`、File System readwrite permissionなし |

#### Unit 4 Browser Acceptance Result

| Environment / Check | Result | Notes |
|---|---|---|
| Chrome previous Library auto restore | Pass | 前回正常に開いたLibraryを起動時に復元 |
| Chrome granted permission | Pass | permission promptなしで自動open |
| Chrome prompt / denied permission | Pass | 明示的な「前回のLibraryを開く」操作からだけpermissionを要求 |
| Chrome denied / stale handle fallback | Pass | Viewerを停止せず通常pickerを利用可能 |
| Chrome manual selection lifecycle | Pass | 正常に選択したLibraryを次回起動時の復元対象へ更新 |
| Chrome restoration coexistence | Pass | Map center / zoom、Sidebar、visible Tracks復元と共存 |
| Edge major scenarios | Pass | Chromeと同等の主要項目を確認 |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | localStorage、`trailbook.json`、GPXへの追加書き込みなし |

Unit 4のChrome / Edge Browser AcceptanceはCompletedである。

### Unit 5 Fast Restore Performance Gate

Unit 5 Status: Completed

Unit 5 Baseline Measurement Status: Completed

Unit 5 Geometry Cache Implementation Status: Completed

Unit 5 Geometry Cache Static Test Status: Completed

Unit 5 Geometry Cache Browser Remeasurement Status: Completed

Decision 0040に従い、既存GPX再parse方式を先に実Browserで測定する。測定条件はWaypoint OFF、806前後のprevious visible Tracks、同一PC / browser / origin、最低3回とし、Library scanとpermission時間を除外する。開始境界はLibrary scan完了後、終了境界は全restore対象がloaded / error / cancelledのterminal状態となりLayerが確定した時点である。

| Measurement | Run 1 | Run 2 | Run 3 | Median | Result |
|---|---:|---:|---:|---:|---|
| Previous visible Track warm restore | 24 sec | 25 sec | 25 sec | 25 sec | Fail — 約5秒gate不達 |
| Geometry Cache warm restore | 3 sec | 3 sec | 3 sec | 3 sec | Pass — 約5秒gate達成 |

測定と同時に、UI responsiveness、806 Track表示後のpan / zoom、duplicate parse / render、`trailbook.viewState`へのlocalStorage write回数、Queue concurrency 2、session cache上限100の利用状況を確認する。static testはduplicate path除去、restore対象の一回通知、bulk saveの一回coalescing、Queue concurrency 2とidle判定を保証するが、実GPX read / parse / render時間、UI responsiveness、pan / zoom、memory cache hit数はBrowser測定なしに判定しない。

中央値25秒で不達が再現したため、Library opaque namespace + relative pathをkeyとし、`File.size`、`File.lastModified`、parser / cache schemaで検証する再生成可能cacheを実装した。cacheにはTrack / Waypoint描画用latitude / longitudeだけを保存し、hit時はXML text read / parseを省略する。miss / stale / corrupt / quota / schema mismatchは既存Queue内の通常parseへfallbackする。

Static testではcache hit、namespace分離、source変更、schema mismatch、corrupt geometry、read / quota failure fallback、inflight deduplication、Queue concurrency 2、localStorage bulk write coalescingを確認した。Browser再測定では中央値3秒、UI停止なし、pan / zoom正常、duplicate表示なし、Console errorなしを確認した。baseline中央値25秒から約8倍高速化した。

cache miss / invalid時は既存parseへfallbackし、GPX / `trailbook.json`へ書き込まない。IndexedDB geometry cacheは正本ではなく、削除・再生成可能な派生データとして正式採用する。Unit 5をCompletedとする。

### Unit 6 Selected Track Restore

Unit 6 Implementation Status: Completed

Unit 6 Static Test Status: Completed

Unit 6 Browser Acceptance Status: Completed

Unit 6 Status: Completed

Implementation result:

- `SelectionState`をselectionの唯一の正本として維持し、selected relative pathを既存full view snapshotへ保存する
- visible restoreと既存Queueのterminal後、saved pathが存在、saved visible、checked、loaded、Map layerありの場合だけsystem sourceでselectionを復元する
- stale / invisible / load failure / Layer不在はselectionなしとし、restore中の利用者selectionを優先する
- saved Map投影後にselectionを同期し、Map pan / zoom / fit / refocusを行わない
- Treeは必要なancestorだけを展開し、focus / scrollを強制しない。Search、highlight / outline、`aria-current`は通常selection projectionを再利用する
- Geometry Cache hitと通常parseを区別せず、同じDisplayState loaded条件を使用する
- Reset、Library generation、Previous Library Restore、GPX / `trailbook.json`非書き込み契約を維持する

Static result:

- selected path save / restore、system source、normal projection、Map共存を確認
- Library切り替え前のruntime selection clearがold Libraryの保存selectionを消さないことを確認
- invisible、stale、load failureではselectionを復元しないことを確認
- restore中の利用者selectionがsaved selectionより優先されることを確認
- ancestor revealは有効、Tree focus / scrollは無効、normal highlight projectionを確認

Browser Acceptance result:

| Check | Result | Notes |
|---|---|---|
| selected Track restore | Pass | visible / loaded Trackをsystem sourceで復元 |
| Map movement | Pass | pan / zoom / fit / refocusなし |
| Tree reveal | Pass | 必要なancestorだけ展開 |
| Tree focus / scroll | Pass | 強制移動なし |
| selection projection | Pass | highlight / outline / ARIA正常 |
| invalid restore targets | Pass | invisible / stale / load失敗はselectionなし |
| load source | Pass | Geometry Cache / 通常parseの両方で正常 |
| Library switch | Pass | selection混在なし |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への書き込みなし |

Unit 6のImplementation / Static Test / Browser AcceptanceはCompletedである。

### Unit 7 Integration Acceptance and Release Finalization

Unit 7 Integration Acceptance Status: Completed

Unit 7 Documentation Status: Completed

Unit 7 Static Validation Status: Completed

Unit 7 Status: Completed

Release 1.3 Status: Ready for final commit and tag

既存Unit 2〜6のChrome / Edge Browser AcceptanceをRelease 1.3の統合結果として再確認した。各機能は同じLibrary lifecycle、`DisplayState`、`SelectionState`、`GPXDisplayQueue`、generation guardを使用しており、追加のproduction変更なしで次を満たす。

| Integration check | Result | Evidence |
|---|---|---|
| Previous Library Restore | Pass | Chrome / Edge Unit 4。granted自動open、prompt / denied明示操作、manual picker fallback |
| Map center / zoom、Sidebar、Reset | Pass | Chrome / Edge Unit 2。Library別復元、current LibraryだけのReset |
| Visible Track Restore | Pass | Unit 3。少数と807 visible Tracks、stale path、duplicate表示なし |
| Selected Track Restore | Pass | Unit 6。visible / loadedだけをsystem sourceで復元し、Map移動なし |
| Geometry Cache warm restore | Pass | Unit 5。中央値25秒から3秒、約5秒gate達成 |
| Geometry Cache miss / invalid fallback | Pass | static testで既存parse Queue fallback、schema / source / corrupt / storage failureを確認 |
| permission / stale recovery | Pass | Unit 4。denied / stale HandleでもViewerとmanual pickerを継続 |
| Library isolation | Pass | Unit 2〜4 / 6。pending flush、generation guard、selection / visibility混在なし |
| Data protection | Pass | GPXと`trailbook.json`へのview restoration由来の書き込みなし |

Final static validation:

| Check | Result | Notes |
|---|---|---|
| View State test page | Pass | 262 assertions |
| Production module graph | Pass | 50 / 50 reachable、missing import 0、cycle 0 |
| Config / schemas | Pass | Config `1.3.0`、DisplaySettingsStore 1、shared settings 1、View State 1、geometry cache 1 |
| App / TreeView size | Pass | 919 / 997 lines |
| Markdown | Pass | local link切れ0、code fence不整合0、heading level jump 0 |
| Decision records | Pass | ID 40件、重複0。Decision 0036〜0040はAccepted |
| `git diff --check` | Pass | whitespace errorなし |

追加Browser確認が必要なrelease blockerはない。計画時の件数matrixのうち50 / 200 Trackを個別benchmarkとして再測定していないが、少数、807件、cache hit、通常parseの受け入れで境界を確認済みであり、v1.3.0 finalizationを妨げない。将来数値比較が必要な場合はUnit 5と同じ測定境界を再利用する。

Known limitations:

- previous Library recordとgeometry cacheはorigin-localで、scheme / host / port変更、site data削除、private browsing終了後は利用できない
- root-name Library identityのため、同名root Folderはdevice-local view stateが衝突し得る
- sidebar width、Search query、Tree expanded paths / scroll / focusは復元しない
- Mobile UIは非対応で、大量LibraryのWaypoint ONは重い
- geometry cacheは派生データであり、miss / invalid / quota時は通常parseへfallbackする

## Release 1.4 Library Browsing / Track Discovery

Release Status: Ready for final commit and tag

Current Release: `1.4.0`

Production Implementation Status: Completed

### Proposed Unit Status

| Unit | Scope | Status |
|---|---|---|
| 1 | Planning、Architecture、Decision、date / summary contract、performance / test plan | Completed |
| 2 | Discovery summary、shared derived-data cache、index lifecycle | Completed |
| 3 | Date Tree、Folder / Date browse mode | Completed |
| 4 | Track Info、selected path projection、Sidebar usability、GPX decode / cache invalidation | Completed |
| 5 | Track name / Folder / date range Search・Filter | Completed |
| 6 | Chrome / Edge統合、806 GPX性能、documentation、finalization | Completed |

### Unit 1 Design Checklist

- [x] Date Tree、Track Info、Search / Filterを1つのpath-keyed Discovery Indexへ統合する
- [x] existing Folder Treeとbasic metadata Searchをeager parseなしで維持する
- [x] date source priorityをmetadata.time、first valid TrackPoint.time、File.lastModified、strict original filename dateとする
- [x] 1 GPX 1 summary、複数Track / Segment aggregate、Unknown Dateを定義する
- [x] distance、point count、start / end、duration、elevation min / maxの計算境界を定義する
- [x] Geometry Cacheとsource identity / parser result / inflight requestを共有し、duplicate parseを禁止する
- [x] index buildを明示Discovery操作まで遅延し、queryごとのparseを禁止する
- [x] App.js / TreeView.js 1,000行未満、別Coordinator / View / Serviceへの責務分離をgateとする
- [x] GPX / `trailbook.json` / shared settingsへDiscovery dataを書かない
- [x] Mobile、Track editing、GPX saveをOut of Scopeとする

### Planned Static Tests

- valid / invalid `metadata.time`、first valid TrackPoint time、File.lastModified、filename fallback、Unknown Date
- timezone / local date grouping、invalid calendar date、date range inclusive boundary
- multi-Track / Segment、empty Segment、point count、Segment境界を跨がないdistance
- start / end / duration、partial / missing time、partial / missing elevation
- one path / one summary、duplicate request / parse / cache writeなし
- geometry + summary cache hit、old schema、source change、corrupt / quota / unavailable fallback
- basic Searchはindex buildなし、advanced filterはReady後memory queryだけ
- Date Tree lazy DOM、keyboard、ARIA、activate、individual checkbox、Folder Tree state維持
- selected Track InfoでMap / visibility / selection / focusを変更しない
- partial parse failure、cancel、Library switch、stale generation、old Library result破棄
- production module graph、missing import、cycle、App / TreeView 1,000行未満、`git diff --check`

### Planned Browser and Performance Gates

- Chrome / Edge、empty / 1 / normal / approximately 806 GPX Library
- Folder Library openとbasic SearchにRelease 1.3から明確な回帰がない
- 806前後のwarm Discovery Index中央値約5秒以内、最低3回、Waypoint OFF
- cold index中もFolder Tree、Map pan / zoom、Search、Cancelが操作可能
- Date TreeとFolder Treeの切替、selection / checkbox同期、Library switch
- Track Infoの値を既知GPX fixtureまたは人間確認可能なreferenceと照合する
- GPX / `trailbook.json`の内容とtimestamp不変、Console error / unnecessary logなし

### Planning Risks

- current Geometry Cache schemaはmetadata / time / elevation summaryを持たず、schema更新後の初回indexは再parseが必要
- browser local timezone変更でDate Tree groupが変わり得る
- File.lastModifiedが利用可能な通常環境ではfilename fallbackが使われる機会は少ない
- 806 GPX cold indexは時間がかかるため、progress / cancelとUI responsivenessを実測する必要がある
- SearchView、App.js、TreeView.jsへ責務を集中させるとfile size gateを超えるため、新規Coordinator / Viewを優先する

### Unit 2 Library Discovery Index Foundation

Unit 2 Implementation Status: Completed

Unit 2 Static Test Status: Completed

Unit 2 Browser Acceptance Status: Completed

Unit 2 Status: Completed

Unit 3 Status: Completed

Implementation result:

- 1 GPX relative pathにつき1 immutable `TrackDiscoveryEntry`を生成する
- date priority、Unknown Date、display name、Track name dedupe、point / time / duration / Segment内distance / elevation / File identityをcompact summaryへ集約する
- Geometry Cache schema version 2へsummaryを追加し、同一parse resultからgeometryとsummaryを一回だけ生成する
- `GPXGeometryLoader`のdisplay / summary要求を同じpath inflight bundleでdeduplicateする
- `LibraryDiscoveryIndexService`は明示`build()`までidleで、concurrency 2、duplicate path排除、progress、partial failure継続、cancel / generation guardを持つ
- invalid GPXはerror status entryへfallbackし、他GPXのindexを継続する
- App / TreeView、Date Tree、Track Info、Filter UIは変更または実装しない

Static result:

| Check | Result | Notes |
|---|---|---|
| Discovery Index test | Pass | 70 assertions。date priority、calendar validation、metrics、cache、lazy build、partial failure、generation、806 entry contract |
| View State / Geometry Cache regression | Pass | 263 assertions |
| Shared settings read / save / recovery | Pass | 121 / 136 / 103 assertions |
| Production modules | Pass | 53 modules、missing import 0、cycle 0。52 modulesはmainからreachable、Index ServiceはUnit 2で意図的にUI未接続 |
| File size | Pass | App 919、TreeView 997、Entry 162、Summary Builder 229、Index Service 199 lines |
| Config / schema | Pass | Config `1.3.0`、Geometry Cache 2、parser 1、DisplaySettingsStore 1、shared settings 1、View State 1 |
| Data protection | Pass | new production filesに`createWritable`、readwrite permission、GPX / `trailbook.json` writeなし |
| `git diff --check` | Pass | whitespace errorなし |

#### Unit 2 Browser Acceptance Result

約806 GPX、Waypoint OFFで、明示Build開始から全entry ready / error確定までを最低3回測定した。coldとvalid cached summaryを使うwarmを分離し、static testの実行時間はBrowser性能値に使用していない。

| Measurement | Run 1 | Run 2 | Run 3 | Median | Result |
|---|---:|---:|---:|---:|---|
| Cold Discovery Index build | 21 sec | 22 sec | 20 sec | 21 sec | Pass — 初回buildの非blocking結果 |
| Warm Discovery Index build | 3 sec | 3 sec | 3 sec | 3 sec | Pass — 約5秒目標達成 |

| Browser check | Result | Notes |
|---|---|---|
| cache hit | Pass | valid cached summaryを利用 |
| duplicate parse | Pass | 発生なし |
| UI responsiveness | Pass | build中のUI停止なし |
| Map pan / zoom | Pass | 正常 |
| Cancel | Pass | 正常 |
| Library switch | Pass | 旧Library結果の混在なし |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への書き込みなし |

Cold中央値21秒は初回buildの記録であり、UIをblockしないためUnit 2のblocking issueとしない。warm中央値3秒でperformance gateをPassし、Unit 2のImplementation / Static Test / Browser AcceptanceをCompletedとする。

### Unit 3 Date Tree

Unit 3 Implementation Status: Completed

Unit 3 Static Test Status: Completed

Unit 3 Browser Acceptance Status: Completed

Unit 3 Status: Completed

Unit 4 Status: In Progress

Track Alpha Blending Implementation Status: Completed

Track Alpha Blending Static Test Status: Completed

Track Alpha Blending Browser Acceptance Status: Completed

Track Alpha Blending Status: Completed

Implementation result:

- `DateTreeBuilder`がlocal calendarの年 / 月 / 日、Unknown Dateを構築し、新しい順とstable Track sortを保証する
- `DateTreeView`はtop-level groupだけを初期DOMへ生成し、月 / 日 / Trackを段階的にlazy renderする
- `TrackDiscoveryCoordinator`がFolder / Date mode、Date表示時だけのIndex build、progress / Cancel、Library generationを担当する
- Date Track activate / checkboxは既存selection / display EventBusへ接続し、DisplayState / SelectionStateを正本としてFolder Treeと同期する
- year / month / day group checkboxはDiscovery Index descendantをDisplayState.checkedで集約し、既存bulk event 1回でlazy未展開Trackを含めてON / OFFする
- bulk中のDate DOM同期はmicrotaskへcoalesceし、既存ViewStateCoordinatorの750ms save queueを維持する
- `trailbook.discoveryView` schema version 1はFolder / Date modeだけをdevice-localに保存する
- Track Alpha Blendingは`TrackStyleService`の通常opacityを0.55へ集約し、selected main 1.0、outline 0.95、Track color、Waypoint、zoom weightを維持する
- Track Infoとadvanced Filterは実装しない

Static result:

| Check | Result | Notes |
|---|---|---|
| Date Tree test | Pass | 53 assertions。date grouping / sort、Unknown、806-entry lazy DOM、activate、individual / year-month-day bulk checkbox、tri-state、single bulk event、Map refocus suppression、selection preservation、keyboard / ARIA、selection / checked / Track Info同期、summary再loadなし、mode storage、lazy Index build、Library clear |
| Track Alpha Blending test | Pass | 19 assertions。normal opacity 0.55、zoom 8 / 9 / 12 / 15 weight、color不変、selected opacity 1.0、outline opacity 0.95 / non-interactive、fallback一貫性 |
| Discovery Index regression | Pass | 70 assertions |
| View State / Geometry Cache regression | Pass | 263 assertions |
| Shared settings read / save / recovery | Pass | 121 / 136 / 103 assertions |
| Production modules | Pass | 58 / 58 main reachable、missing import 0、cycle 0 |
| File size | Pass | App 973、TreeView 997、DateTreeView 514、Coordinator 225、Visibility Index 81 lines |
| Data protection | Pass | GPX / `trailbook.json` write、readwrite permission、`createWritable`追加なし |
| `git diff --check` | Pass | whitespace errorなし |

#### Unit 3 Date Tree Browser Acceptance Result

| Browser check | Result | Notes |
|---|---|---|
| Folder / Date切替 | Pass | 切替だけではMapと表示状態を変更しない |
| Discovery Index開始条件 | Pass | Date表示時だけbuild開始 |
| 年 / 月 / 日 / Track階層 | Pass | Unknown Dateは末尾、日付は新しい順 |
| lazy DOM | Pass | 未展開Trackを一括生成しない |
| Track selection | Pass | Folder Tree、Mapの既存selectionと同期 |
| 年 / 月 / 日bulk ON / OFF | Pass | checked / unchecked / indeterminateを反映 |
| lazy未展開Trackのbulk | Pass | Discovery Index descendant全件を対象 |
| Folder Tree visibility同期 | Pass | DisplayStateを共通の正本として維持 |
| selection / Map | Pass | selectionとMap center / zoomを維持 |
| discovery view mode | Pass | device-local設定を保持 |
| 約807 GPX | Pass | UI停止なし、localStorage writeの異常増加なし |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への書き込みなし |

#### Track Alpha Blending Browser Acceptance Result

通常Track opacity 0.55を正式採用する。Date TreeのBrowser AcceptanceとUnit 3全体もCompletedである。

| Browser check | Result | Notes |
|---|---|---|
| 異色Track重複 | Pass | 通常alpha合成で混色して表示 |
| 同色Track重複 | Pass | 重複部分を濃く表示 |
| selected Track / outline | Pass | selected opacity 1.0、outline正常 |
| zoom変更 | Pass | bucket変更後もnormal opacity 0.55を維持 |
| Folder / Date切替 | Pass | 表示入口に依存せず同じstyleを維持 |
| Monochrome Map | Pass | 背景tile filterと共存 |
| Waypoint | Pass | opacity変更の影響なし |
| 約807 Track性能 | Pass | 明確な性能回帰なし |
| Console | Pass | アプリ由来errorなし |

Unit 3 Date TreeのImplementation / Static Test / Browser AcceptanceはCompletedである。Unit 4 Track Infoへ進み、Search / FilterはNot startedのまま維持する。

### Unit 4 Track Info

Unit 4 Implementation Status: Completed

Unit 4 Static Test Status: Completed

Unit 4 Track Info Browser Acceptance Status: Completed

Unit 4 Sidebar Usability Browser Acceptance Status: Completed

Unit 4 GPX Encoding Browser Acceptance Status: Completed

Unit 4 Status: Completed

Unit 5 Status at Unit 4 completion: Not started

Implementation result:

- `TrackInfoView`はsidebar内の常設read-only panelとしてempty / loading / ready / partial failure / unavailableを文字で表示する
- `TrackInfoCoordinator`は`selection:changed`から最新pathだけを投影し、Library generationとrequest IDでstale resultを破棄する
- `LibraryDiscoveryIndexService.loadEntry()`は既存entryを即時再利用し、未構築pathだけをshared loaderへ要求する。同一path requestをdeduplicateし、full Index buildを開始しない
- Folder / Date / Search / Mapのselection originに依存せずSelectionState eventを共用し、Map pan / zoom / fit、visibility、selection自体を変更しない
- distanceはm / km、durationは時間 / 分 / 秒、elevationはm、日時はbrowser locale、欠損値は`—`、root Folderは`Library root`で表示する
- error summaryでは判明している名前 / Folder / date sourceだけを維持し、未取得metricsは`—`とする
- Sidebar shellは固定control、独立scrollするFolder / Date Track list、下部固定Track Infoへ分ける。Track Infoが高すぎる場合はpanel内部だけをscrollする
- desktopの`SidebarResizeHandle`は220〜520px、default 260pxでpointer / keyboard resizeを提供し、drag終了時にMap layoutを再評価する。幅はLibrary単位のoptional `sidebar.width`として既存view-state save queueへ統合する
- desktopの`TrackInfoResizeHandle`はTrack list / Track Info境界を上下resizeし、Track Info 120〜420px、default 220px、Track list最小100pxを維持する。高さはoptional `sidebar.trackInfoHeight`として同じsave queueへ統合する
- `GPXLoader`はBOM / XML declarationをbyte列から判定し、UTF-8、UTF-16、Shift_JIS / Windows-31J aliasをparse前にdecodeする。unsupported / 判定不能時はnon-fatal UTF-8 fallbackでViewerを継続する
- Geometry Cache schema version 3と`textDecoderSchemaVersion: 1`でschema 2およびdecode markerのない過渡的schema 3 summaryを該当path単位でinvalidにし、既存parse fallbackから正しいgeometry / Discovery summaryを再生成する。DB全体clearは行わない

Static result:

| Check | Result | Notes |
|---|---|---|
| Track Info / GPX decode test | Pass | 50 assertions。Track Info 44項目に加え、UTF-8 / UTF-16 BOM、Windows-31J、宣言なしShift_JIS、unsupported declaration fallback、decoded summary projection |
| Date Tree integration | Pass | 57 assertions。selection eventからTrack Info同期、準備済みsummaryの再loadなし、Sidebar shell / list scroll / fixed Track Info構造を含む |
| Track Alpha Blending regression | Pass | 19 assertions |
| Discovery Index regression | Pass | 73 assertions。cache missのshared GPX decode path、cache / decoder schema markerを含む |
| View State / Geometry Cache regression | Pass | 312 assertions。optional Sidebar width / Track Info height、pointer / keyboard / ARIAに加え、schema 2の実loader fallback、record単位delete、schema 3再保存、decode marker欠落recordのinvalid化を含む |
| Shared settings read / save / recovery | Pass | 121 / 136 / 103 assertions |
| Production modules | Pass | 62 / 62 main reachable、missing import 0、cycle 0 |
| File size | Pass | App 983、TreeView 997、TrackInfoCoordinator 103、TrackInfoView 188、SidebarResizeHandle 185、TrackInfoResizeHandle 184、GPXLoader 114、Index Service 262 lines |
| Data protection | Pass | GPX / `trailbook.json` write、readwrite permission、`createWritable`追加なし |
| `git diff --check` | Pass | whitespace errorなし |

#### Unit 4 Track Info Browser Acceptance Result

Track Infoの表示内容は人間によるBrowser AcceptanceでPassした。全fieldと人間向けformat、欠損表示を含むread-only表示を採用する。selectionとMapの既存契約は変更しない。

#### Unit 4 Sidebar Usability Completion Scope

Unit 4 completion approvalによりStatusをCompletedとする。以下の実装契約は維持するが、この依頼では個別のSidebar browser resultは新規提示されていない。

- Track listだけがscrollし、Track InfoがSidebar下部へ固定されること
- Track Infoが利用可能高を超えた場合にpanel内部をscrollできること
- Chrome / Edge desktopでpointer drag、220 / 520px境界、Map追従、drag終了時の`invalidateSize`を確認すること
- keyboardのArrow Left / Right、Home / End、separator ARIA、focus、drag中の誤selection抑止を確認すること
- widthのLibrary別保存 / 復元、Sidebar open / closed、Map center / zoom、selection、visibilityとの共存を確認すること
- Mobile / coarse pointerでresize handleを表示しないこと
- Track list / Track Info境界の上下drag、120 / 420px境界、Track list最小高、Info内部scrollを確認すること
- Arrow Up / Down、Home / End、horizontal separator ARIA、高さのLibrary別保存 / 復元を確認すること

#### Unit 4 GPX Encoding Browser Acceptance Result

- 旧cache相当recordから手動clearなしで該当GPXだけを再parseし、文字化けTrack名が正常表示されることをPassした
- schema 2 entryとdecoder markerのないschema 3 entryを使用せず、他GPX cacheを維持することをPassした
- Folder / Date / Track Infoで同じ正しい名前を表示し、Console errorがないことをPassした
- GPX / `trailbook.json`への書き込みがないことをPassした

Track Info表示内容、Sidebar usability、GPX decode / cache invalidationのBrowser AcceptanceはCompletedである。Unit 4をCompletedとし、Search / FilterはNot startedのまま維持する。

### Unit 5 Search / Filter

Unit 5 Implementation Status: Completed

Unit 5 Static Test Definition Status: Completed

Unit 5 Static Validation Status: Completed

Unit 5 Static Test Page Execution Status: Not run in the local Codex environment — Browser Acceptance completed; non-blocking

Unit 5 Browser Acceptance Status: Completed

Unit 5 Status: Completed

Unit 6 Status: Completed

Implementation result:

- 既存Search欄へTrack / Folder path text、From / To、Clearを追加し、150ms debounceを共用する
- filter明示入力時だけ`LibraryDiscoveryIndexService.build()`を開始し、ready後は`DiscoveryFilterService`のmemory queryだけを行う
- textはNFKC / case-insensitiveでdisplay name、全Track name、relative Folder pathを検索する。dateはlocal calendarのinclusive rangeで、date指定時はUnknown Dateを除外する
- `FolderTreeFilterProjection`はmatching pathと祖先FolderだけをTreeViewのlazy DOMへ投影し、Date Treeは同じmatching entry集合を年 / 月 / 日へ投影する
- 最大100件のSearch resultとtotal count、activate、checkbox、Arrow Up / Down、Home / End、Enter、Escape、Space、ARIA live regionを維持する
- filter自体はDisplayState.checked、SelectionState、Map visibility、center / zoomを変更しない。Clearは両Treeを全entryへ戻す
- filterはLibrary ID別device-local `trailbook.discoveryView` schema 1へ保存し、別Libraryへ混在させない。FileHandle、summary、geometry、GPX XMLは保存しない
- AppはSearch result activate / checkboxの既存event接続だけを維持し、filter / Index / projection責務は`TrackDiscoveryCoordinator`へ置く

Static result:

| Check | Result | Notes |
|---|---|---|
| Search / Filter test definition | Added | 29 assertions。NFKC、case-insensitive、日本語、Track name / Folder path、Unknown Date、inclusive / reversed date、0 / 100 / 806件、Library別state、lazy Folder projection、Index reuse、visibility不変、Clear、150ms debounce、broken Track name fallback |
| Test page execution | Not run / Non-blocking | local Codex環境ではDOM test pageを実行していない。人間によるBrowser Acceptanceと静的検証はCompleted |
| Production module graph | Pass | 65 modules、missing import 0、cycle 0 |
| File size | Pass | App 954、TreeView 997 lines |
| Data protection | Pass | Unit 5追加fileにGPX / `trailbook.json` write、readwrite permission、`createWritable`なし |
| `git diff --check` | Pass | whitespace errorなし |

#### Unit 5 Browser Acceptance Result

| Browser check | Result | Notes |
|---|---|---|
| Track名 / Folder path検索 | Pass | 両対象を同じDiscovery Indexから検索 |
| 日本語 / case-insensitive / NFKC | Pass | 正規化済みqueryで一致 |
| Fromのみ / Toのみ / From〜To | Pass | 境界日を含むinclusive date range |
| Unknown Date | Pass | date range指定時は除外、text only時は対象 |
| Folder / Date Tree結果 | Pass | 同じ候補集合とancestor projectionを使用 |
| result上限 / total count | Pass | 最大100件表示と総一致件数を維持 |
| Clear | Pass | 全件表示へ復帰 |
| Library別filter state | Pass | Library間でfilter stateを混在させない |
| selection / visibility | Pass | filter前後で状態を維持 |
| Map center / zoom | Pass | filter操作による変更なし |
| 約807 GPX | Pass | UI停止なし |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への書き込みなし |

Unit 5のImplementationとBrowser AcceptanceはCompletedである。DOM static test pageはlocal Codex環境では未実行だが、test定義を維持し、静的検証と人間によるBrowser Acceptanceを完了したためrelease gateを妨げない。

#### Broken Internal Track Name Fallback

- 原因はdecode / Parser後の非empty Track nameにU+FFFDが含まれていても、`TrackSummaryBuilder`が正常なfilenameより優先していたこと
- usable metadata name、最初のusable Track name、relative path由来filenameの共通priorityを採用する
- 空、U+FFFD、C0 / DEL制御文字を含む内部名は`trackNames`と`displayName`候補から除外する
- Search result、Date Tree、Track Infoは補正済みの同一Discovery entryを使用し、View単位の文字列補正を行わない
- schema 3は維持し、broken cached summaryだけをrecord単位で削除して再parse / 再保存する。他GPX cacheとDB全体は維持する
- static fixtureへdecode XML → GPXParser → summary filename fallback、mixed valid / broken Track name、Search label、cache path単位invalid化を追加した
- current test definitionsはDiscovery Index 82 assertions、Track Info / decode 54 assertions、Search / Filter 29 assertions。DOM test pageはlocal Codex環境では未実行だが、Unit 5 Browser Acceptance完了後のnon-blocking確認項目として定義を維持する
- Browser Acceptance Status: Completed / Accepted

| Browser check | Result | Notes |
|---|---|---|
| Search表示名 | Pass | filename fallbackを表示 |
| Track Info表示名 | Pass | Searchと同じDiscovery entry |
| Date Tree表示名 | Pass | Search / Track Infoと一致 |
| broken Track name検索除外 | Pass | U+FFFDを含む内部名をindex対象外とした |
| filename fallback | Pass | relative path由来filenameを採用 |
| cache recovery | Pass | 手動clear不要。該当GPXだけを再生成し、他GPX cacheを維持 |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への書き込みなし |

文字化けfallback修正はAcceptedである。残りのtext / date / combined filter確認もPassしたため、Unit 5全体をCompletedとする。

### Unit 6 Integration Acceptance and Release Finalization

Unit 6 Integration Acceptance Status: Completed

Unit 6 Documentation Status: Completed

Unit 6 Static Validation Status: Completed

Unit 6 Status: Completed

Release 1.4 Status: Ready for final commit and tag

既存のChrome / Edge Browser Acceptance結果をRelease 1.4全体として統合した。新しいBrowser自動操作や同条件の数値再測定は行わず、各Unitで記録済みの人間確認を正本とする。

| Integrated check | Result | Notes |
|---|---|---|
| Library Discovery Index | Pass | 1 GPX 1 entry、partial failure、cancel、generation guard |
| Folder / Date切替 | Pass | Date表示時だけIndex build、Tree切替でMap状態不変 |
| 年 / 月 / 日bulk visibility | Pass | lazy未展開Trackを含みDisplayStateと同期 |
| selection / visibility同期 | Pass | Folder / Date / Search / Mapで既存Stateを正本として維持 |
| Search / Filter結果同期 | Pass | text、Folder path、NFKC、日本語、inclusive date range、ancestor projection |
| Track Info | Pass | selection変更で更新し、欠損値とpartial summaryを安全に表示 |
| Track Alpha Blending | Pass | normal 0.55、selected 1.0、outline / zoom / Monochrome / Waypoint維持 |
| Sidebar horizontal resize | Pass | Library別width復元、open / close、Map center維持 |
| Track List / Track Info vertical resize | Pass | Library別height復元、両領域の最小高と内部scroll維持 |
| GPX encoding decode | Pass | UTF-8 / UTF-16 BOM / Shift_JIS / Windows-31Jとsafe fallback |
| broken Track.name fallback | Pass | Search / Date / Track Infoでfilenameへ統一fallback |
| Geometry Cache連携 | Pass | schema / decoder marker不一致は該当GPXだけ再生成、通常parse fallback |
| Previous Library / View State共存 | Pass | Map、Sidebar、visible / selected Trackを混在なく復元 |
| Library切り替え | Pass | Index、filter、resize、selection、visibilityをLibrary間で混在させない |
| Map / duplicate処理 | Pass | pan / zoom正常、duplicate parse / renderなし |
| Console | Pass | Browser Acceptanceでアプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への意図しない書き込みなし |

Performance:

- 約806 GPX warm Discovery Indexは3秒、3秒、3秒、中央値3秒で約5秒目標をPassした。
- cold Discovery Index中央値21秒は初回buildのnon-blocking結果として維持する。
- 約807 visible Track warm restoreはRelease 1.3の3秒中央値をaccepted baselineとして維持し、Release 1.4の各Browser Acceptanceで明確な回帰、UI停止、duplicate parse / renderを確認していない。Unit 6では同条件の数値再測定を繰り返していない。

Static finalization:

| Check | Result | Notes |
|---|---|---|
| Config version | Pass | `1.4.0` |
| Existing static records | Pass | Discovery Index、Date Tree、Track Alpha、Track Info / decode、view state、shared settingsの記録済みassertionsを維持 |
| Search / Filter static definition | Completed / Not rerun | 29 assertions定義。人間Browser AcceptanceはCompleted |
| Production module graph | Pass | 65 / 65 reachable、missing import 0、cycle 0 |
| File size | Pass | App 954、TreeView 997 lines |
| Decision | Pass | Decision 0041〜0044はAccepted、ID重複なし |
| Data protection | Pass | GPX / `trailbook.json`への意図しない書き込みなし |
| `git diff --check` | Pass | whitespace errorなし |

Release blockerはない。Mobile UI、大量LibraryでのWaypoint ON、local timezoneによるDate group差、origin-local state / cache、同名root Library identity衝突は既知制限として維持する。v1.4.0はfinal commit / tag可能である。

## Release 1.5 Safe GPX Editing / Track Simplification — Completed

Release Status: Ready for final commit and tag

Current Release: `1.5.0`

Production Implementation Status: Completed

### Unit Status

| Unit | Scope | Status |
|---|---|---|
| 1 | Planning、Architecture、Decision、data protection、algorithm / serializer / test contract | Completed |
| 2 | Immutable editing source、working copy、session、command history、serializer round-trip | Completed |
| 3 | Ramer–Douglas–Peucker、metrics、large Track performance、Undo / Redo core | Completed |
| 4 | Editor panel、Before / After preview、point preview、Done / Cancel、keyboard / ARIA | Completed |
| 5 | Original Backup + In-place Save、permission、Backup / source verification、reserved Folder、targeted refresh | Completed |
| 6 | Chrome / Edge integration、large GPX performance、data protection、documentation、finalization | Completed |

### Unit 1 Design Checklist

- [x] 単一GPX、immutable source XML、memory working copy、1 active sessionを定義した
- [x] Viewer Model、DisplayState、SelectionState、LayerManager、Geometry Cacheを編集正本にしない
- [x] Segment単位Ramer–Douglas–Peuckerを第一候補とし、Visvalingam–Whyatt / radial / uniformを比較した
- [x] meter tolerance、sourceからのpreview、point count、reduction、distance delta、max deviationを定義した
- [x] retained point属性、time、elevation、extensionsとTrack / Segment / Waypoint構造の保持方針を定義した
- [x] source DOM cloneから除外`trkpt`だけをremoveするserializer境界を定義した
- [x] UTF-8 BOMなし、LF、XML declaration、final newlineとsemantic verificationを定義した
- [x] initial original-byte Backup、検証後のsame-path save、Backup overwrite / delete禁止をDecision 0046で定義した
- [x] explicit action時だけのreadwrite permission、source fingerprint、write / close / verification failureを定義した
- [x] command history、Undo / Redo、Cancel、save済みstateとの分離を定義した
- [x] Save成功前はLibrary / cache / Index不変、成功後だけsame pathをtargeted refreshする
- [x] App.js / TreeView.js 1,000行未満とCoordinator / Service / Repository / View分離をgateとした
- [x] Mobile、point / range edit、split / join、Waypoint edit、Backup overwrite / delete、autosaveをOut of Scopeとした

### Planned Static Tests

- source XML / parsed Track / DOM TrackPoint mapping、namespace、GPX 1.0 / 1.1
- empty / 1 / 2 / multiple / large point Segment、multiple Track / Segment
- tolerance invalid / boundary / repeated preview、first / last point retention
- high latitude、antimeridian、duplicate coordinate、iterative stack
- point count、reduction ratio、Segment内distance、distance delta、max deviation
- retained `ele` / `time` / extensions、Waypoint / route / metadata / unknown extensions preservation
- UTF-8 / UTF-16 / Windows-31J sourceからUTF-8 no-BOM / LF output、lossy decode save rejection
- Apply、Undo、Redo、history limit、Cancel、source immutability
- existing / invalid Backup、reserved Folder、permission deny、source fingerprint conflict
- Backup / source write、close、verification failure、retry
- Save前のTree / cache / Index不変、Save成功後のsame path 1回置換、source cache invalidation
- Library switch / page leave dirty confirmation、saving中guard
- production module graph、missing import、cycle、App / TreeView 1,000行未満、`git diff --check`

### Browser Acceptance Plan

- Chrome / Edge、readwrite permission granted / prompt / denied
- Before / After / Both、Map pan / zoom、normal Track / selection / Waypoint / Monochrome回帰
- point count、reduction、distance / shape差を既知fixtureと比較
- Apply、Undo / Redo、Cancelで元表示へ完全復帰
- 初回Backup作成、2回目以降のBackup維持、permission / failure表示、keyboard / ARIA / focus return
- Save成功後だけ同じGPX pathのFolder / Date / Search / Track Infoが更新される
- Backup成功前のsource GPX内容 / timestampと、`trailbook.json`、Folder色、view stateが不変
- large point GPXでpreview UIが応答し、必要ならWorker gateを判断する

### Open Risks and Human Decisions

- meter distance実装をlatitude-aware local projectionとgeodesic計算のどちらで確定するか
- tolerance range / default / presetsを実GPXで調整する必要がある
- XMLSerializerによるformatting差を受け入れ、semantic preservationをDone Definitionとするか
- Original Backup + In-place SaveをDecision 0046で確定した
- source更新後のverification failureでは検証済みBackupの復旧場所を案内する
- full Library rescanを避け、same-path targeted refreshを採用した
- large Trackでmain-thread 200 ms超が再現した場合のWeb Worker導入判断

### Definition of Done Draft

- 保存前は元GPXを変更せず、単一GPXをmemory working copyで軽量化・previewできる
- Segment境界、retained attributes、Waypoint / extensionsをsemanticに保持する
- point / distance / shape metricsを確認してApply、Undo / Redo、Cancelできる
- explicit Saveだけが、検証済みoriginal Backupを確保した後に同じsource pathへ編集結果を書く
- Backup failure時はsource不変とし、source更新後のfailureではBackupを保持し、success verification後だけLibraryへ反映する
- Chrome / Edge、data protection、large GPX performance、static / integration testsをPassする
- App.js / TreeView.jsは1,000行未満、docs / implementation / Decisionが一致する

### Unit 2 Editing Core

Unit 1 Status: Completed

Unit 2 Implementation Status: Completed

Unit 2 Static Test Definition Status: Completed

Unit 2 Static Test Execution Status: Completed

Unit 2 Browser Acceptance Status: Completed through Unit 4 / 6 integration

Unit 2 Status: Completed

Unit 3 Status: Completed

Implementation result:

- source FileHandleを1回readし、元XML、relative path、filename、size / lastModified fingerprintをimmutable sourceへ保持する
- private source DOMは外部へ公開せず、`cloneDocument()`が毎回独立cloneを返す
- DOM / Parser mappingはTrack / Segment / TrackPointのdocument order、count、latitude / longitude完全一致を要求する
- working stateはsource shapeと同じretained-point boolean maskで、source XML / DOM / Parser Modelをmutateしない
- Applyでchanged maskだけをhistoryへ追加し、Undo / Redo、branch truncate、上限20、Cancel clearを実装する
- serializerはsource DOM cloneから除外`trkpt`だけをremoveし、retained pointのattributes、time、elevation、extensionsを保持する
- Track / Segment境界、Waypoint、route、metadata、root / Track / Segment unknown extensionsをclone上で維持する
- U+FFFDを含むlossy decode、XML / GPX parse failure、DOM mapping mismatchをsave不可reasonとして返す
- UTF-8 BOMなし、LF、XML declaration、final newlineへ正規化し、構造 / retained countを再検証する
- `createWritable`、readwrite permission、GPX write、Geometry Cache / Discovery Index / Tree / App接続を追加しない

Static test definition:

| Check | Status | Notes |
|---|---|---|
| Source mapping / fingerprint / immutability | Defined | Track / Segment / points、clone isolation、single read |
| Session / history | Defined | changed Apply、Undo / Redo、branch、limit、Cancel、inactive guard |
| Serializer preservation | Defined | Segment、Waypoint、route、metadata / unknown extensions、retained attributes / children |
| Output policy | Defined | UTF-8 declaration、no BOM、LF、single final newline |
| Blocked sources | Defined | U+FFFD lossy decode、invalid pointによるDOM mapping mismatch |
| Data protection | Pass by inspection | write API、cache / Index / Tree integrationなし |

Static test page: `sample/release/editing-core-test.html`。66 assertionsをPassした。immutable source、Session、history、serializerのBrowser integrationはUnit 4〜6でCompletedである。

### Unit 3 Track Simplification

Unit 3 Implementation Status: Completed

Unit 3 Static Test Definition Status: Completed

Unit 3 Static Test Execution Status: Completed

Unit 3 Browser Acceptance Status: Completed through Unit 4 / 6 integration

Unit 3 Status: Completed

Implementation result:

- Segment-local iterative Ramer–Douglas–Peuckerを実装し、先頭 / 末尾、0〜2 point、Track / Segment境界、元point順を維持する
- invalid coordinateは保持してvalid runを分断し、その前後をshortcutまたはdistanceで接続しない
- latitude-aware local projectionによるpoint-to-segment距離とHaversine path distanceをmeter単位で使用し、antimeridian longitude deltaを正規化する
- source / retained / removed point count、reduction ratio、source / simplified distance、signed / absolute distance difference、actual max deviation、invalid countをSegment / Track / 全体で集計する
- tolerance変更はpreviewを置換するだけでhistoryへ入れず、Apply時だけ既存retained mask commandへ確定する。同一結果Applyはhistoryを増やさず、Undo / Redo / Cancelはpreviewを破棄する
- 既定4,096 point-distance評価ごとのcooperative yield、AbortSignal、Segment progress callbackを持つ。pointごとの不要なPromise生成は行わない
- point objectとtime / elevation / extensionsを変更せず、GPX write、preview UI、Geometry Cache、Discovery Index、Tree、Appへの接続を追加しない

Static test definition:

| Check | Status | Notes |
|---|---|---|
| 0 / 1 / 2 point、first / last、order | Defined | Segment shapeとendpoint retention |
| Segment / Track independence | Defined | multiple Track / Segmentと全体集計 |
| tolerance / iterative RDP | Defined | strict / relaxed corner fixture |
| meter geometry | Defined | latitude-aware、high latitude、antimeridian |
| metrics | Defined | point、reduction、distance、delta、max deviation |
| invalid coordinate | Defined | retained boundary、finite metrics、Viewer非停止 |
| preview / Apply / Undo / Redo / Cancel | Defined | preview historyなし、same Apply dedupe |
| async work | Defined | cooperative yield、AbortSignal、progress |
| source attributes / data protection | Pass by inspection | maskだけを生成しsource / GPX / cache / Indexを変更しない |

Static test page: `sample/release/track-simplification-test.html`。58 assertionsをPassした。Unit 4 / 6のBrowser Acceptanceでpreview、Apply、Undo / Redo、Cancel、Map応答性を確認した。専用の数値long-task benchmarkは実施していない。

### Unit 4 Editor UI and Preview

Unit 4 Implementation Status: Completed

Unit 4 Static Test Definition Status: Completed

Unit 4 Static Test Execution Status: Completed

Unit 4 Browser Acceptance Status: Completed

Unit 4 Status: Completed

Implementation result:

- selected GPX 1件だけを明示`編集`操作からsource load / Sessionへ接続し、別selectionを暗黙にEditor targetへ採用しない
- tolerance入力は150 ms debounceし、新preview開始前に前requestをAbortする。stale requestId / Sessionの結果は採用しない
- native progressとpolite live statusでsource load、Segment progress、preview完了、invalid tolerance / failureを文字表示する
- Beforeはneutral dashed、Afterはsolid orangeの別pane / LayerGroupで、Bothを含め文字legendから識別する。preview Polylineはnon-interactiveでnormal LayerManagerへ登録しない
- preview modeとcandidate更新はMap fit、center / zoom、DisplayState、SelectionState、Waypoint、normal Layerを変更しない
- tolerance変更はhistoryへ入れず、Applyだけがworking maskを確定する。Undo / Redoはworking maskをAfter Layerとmetricsへ再投影する
- Cancelはpending timer / AbortController、preview Layer、Session preview / working mask / historyを破棄し、sidebar / Map selection interactionと通常Viewer表示を復元する
- 編集中はsidebarを`inert`、Map Track / background selectionをdisabledとし、Map pan / zoomは維持する
- Save As、readwrite permission、GPX / `trailbook.json` write、draft Geometry Cache / Discovery Index更新を追加しない

Browser Acceptance pre-fix:

- After modeで専用Before Layerはremoveされていたが、背後のnormal Viewer Trackが残るためsourceも見える不具合を確認した
- 対象normal Track / outline presentationをediting中だけ一時removeし、Before / After / Bothを専用Layerだけで構成する。DisplayState / Layer entry / Waypointは変更せずDone / Cancelで復帰する
- point preview Off / Before / After / Bothをline modeと独立して追加した。既定Off、Before固定半径4 px、After固定半径5.5 px、共有Canvas renderer、mode要求時だけのCircleMarker遅延生成とする
- Applyはworking mask確定のみ、Doneは1件のsession-memory draftを保持して通常Viewerへ戻る、Cancelはdraft / historyを破棄する意味へ分離した
- Done draftは同じLibrary / relative pathでresumeできるが、永続化せず、page reload、Library変更、別GPX Edit開始で破棄する。Unit 5 Save As前はnormal Viewer / cache / Indexへ投影しない
- Browser AcceptanceでDone後にselection rootの`inert`とPanelのEdit対象が確実に復帰せず、Map / Sidebar Track clickとEdit操作が不能になり得る問題を確認した。unlock時に`inert` / `aria-disabled`属性を明示除去し、Map selection interaction、対象Track / outline、既存Polyline click handlerを復帰させ、draft pathをPanelへ明示して`編集を再開`を有効化する
- 再試験でDone後もMap Track clickが不能になる問題を確認した。guard stateやPolyline listenerではなく、高z-indexの編集専用Canvas paneがLayer remove後も通常Track Canvasのpointer targetを遮ることが原因だった。全編集paneを`pointer-events: none`とし、preview描画は維持しながらMap / normal Trackへpointer eventを透過する。guard active / inactive、通常Track interactive / click listener、lock class / inert / aria / cursor / pointer style解除をstatic testで固定する

Final Browser Acceptance:

| Check | Result | Notes |
|---|---|---|
| Done後Track hover / click | Pass | normal Track interactionへ復帰 |
| Map background click | Pass | selection clear経路正常 |
| Map pan / zoom | Pass | editing終了後も正常 |
| Sidebar Track selection | Pass | interaction guard解除を確認 |
| Edit resume | Pass | session-memory draftを同一Trackで復元 |
| Point preview size | Pass | Before 4 px、After 5.5 pxを採用 |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | GPX / `trailbook.json`への書き込みなし |

Static test definition:

| Check | Status | Notes |
|---|---|---|
| explicit single-GPX start | Defined | selected path / FileHandle、single active Session |
| async preview / progress | Defined | initial preview、Segment progress、metrics projection |
| Abort / stale result | Defined | new tolerance abort、Cancel後result rejection |
| Apply / Undo / Redo / Cancel | Defined | existing Session history、full cleanup / unlock |
| Preview Layer ownership | Defined | separate panes / groups、non-interactive、clear |
| Before / After distinction | Defined | dashed neutral / solid orange / text legend |
| After source suppression | Defined | normal Trackを一時remove、state維持、終了時復帰 |
| Point preview | Defined | Off / Before / After / Both、Before 4 px / After 5.5 px、lazy Canvas markers |
| Done / Cancel semantics | Defined | memory draft / resumeとfull discardを分離 |
| invalid coordinate | Defined | Leafletへnon-finite coordinateを渡さない |
| selection guard | Defined | sidebar inert、Map selection event suppression |
| accessibility | Defined | native controls、status / live、progress name、disabled state |
| data protection | Pass by inspection | write API、cache / Index / normal Layer mutationなし |

Static test page: `sample/release/editing-preview-test.html`。117 assertionsをPassした。上記の人間による最終Browser AcceptanceもCompletedである。

### Unit 5 Save As — Historical Acceptance Superseded by Decision 0046

Unit 5 Save As Implementation Status: Completed

Unit 5 Save As Static Test Status: Completed

Unit 5 Save As Browser Acceptance Status: Historical only — not acceptance for the revised save policy

Unit 5 Save As Status: Superseded

Unit 6 Integration / Finalization Status: Superseded; rerun after revised Unit 5 Browser Acceptance

Implementation result:

- 明示Save As clickだけからreadwrite permissionをquery / requestし、source Folderへ新規`.gpx`を作成する
- default filenameは`<source-stem>-simplified.gpx`。invalid / reserved name、source自身、case-insensitive existing targetを拒否し、Overwriteと自動suffixを提供しない
- immutable source DOM cloneへworking maskを適用する既存Serializerを使用し、UTF-8 BOMなし、LF、XML declaration、single final newlineでbyte writeする
- close後にtargetを再読込し、encoding / XML parse、version / namespace、Waypoint / route、Track / Segment、retained point countを検証する。成功前はLibraryへ投影しない
- verification成功後だけnew FileHandleをsource parent Folder modelへ追加し、Tree / DisplayState / Discovery Indexへnew pathを1回反映する。source cache、selection、visibility、Map center / zoomを維持する
- permission deny / Cancel、collision、source変更、write / close / verification failureではworking Sessionとcurrent Libraryを維持する。write開始後の失敗ではtarget fileが残る可能性をstatusへ明示する
- save成功後もactive Sessionを維持し、Doneで保存済みまたは以後変更済みのsession-memory draftとして通常Viewerへ戻れる。Cancel semanticsは変更しない

Static validation:

| Check | Result | Notes |
|---|---|---|
| Editing Core | Pass | 66 assertions |
| Track Simplification | Pass | 58 assertions |
| Editor Preview / lifecycle | Pass | 117 assertions |
| Save As / verification / refresh | Pass | 53 assertions |
| Browser Acceptance | Completed | 人間による実ブラウザ確認で全項目Pass |

Browser Acceptance result:

| Check | Result | Notes |
|---|---|---|
| Simplify / Apply / Save As | Pass | working resultを明示操作で保存 |
| Default filename | Pass | `<source-name>-simplified.gpx` |
| Source protection | Pass | 元GPX不変、source自身への上書きを拒否 |
| New simplified GPX | Pass | 新規fileを作成しTrailBookで正常読込 |
| Saved structure | Pass | retained point数が一致し、Track / Segment構造は正常 |
| Track Info | Pass | 保存後の新規GPX情報を正常表示 |
| Collision | Pass | 既存filenameとの衝突を拒否 |
| Permission denial | Pass | fileを作成せずViewerとdraftを維持 |
| Library refresh | Pass | 保存成功後だけ新規pathを追加し、Treeへ反映 |
| Discovery integration | Pass | Date Tree / Search / Discovery Indexと整合 |
| Existing viewer state | Pass | source cache / selection / visibility / Map viewを維持 |
| Automatic projection | Pass | 新規GPXを自動表示・自動選択しない |
| Save failure | Pass | draftを維持 |
| Console | Pass | アプリ由来errorなし |
| Data protection | Pass | `trailbook.json`へ書き込まず、元GPXも変更しない |

このBrowser Acceptanceは旧Save As実装の履歴として保持する。Decision 0046のOriginal Backup + In-place Saveの受け入れには流用せず、現行Statusは後述のRevised Unit 5記録を正本とする。

### Unit 6 Integration Acceptance and Release Finalization — Historical Finalization Superseded by Decision 0046

Unit 6 Integration Acceptance Status: Superseded historical record

Unit 6 Documentation Status: Superseded

Unit 6 Static Validation Status: Superseded

Unit 6 Status: Superseded historical record

Release 1.5 Status: Superseded historical finalization record

既存Unit 4 / 5の人間によるBrowser Acceptanceを統合し、次をRelease 1.5の受け入れ結果とする。

| Integration check | Result | Evidence |
|---|---|---|
| Editing Core / source protection | Pass | immutable source、retained mask、Cancel、元GPX不変 |
| RDP / metrics / history | Pass | Segment-local RDP、Apply、Undo / Redo、同一Apply dedupe |
| Line / point preview | Pass | Before / After / Both、point Off / Before / After / Both、normal Layer分離 |
| Done / draft / resume | Pass | Viewer interaction完全復帰、同一Trackのsession-memory draft復元 |
| Cancel | Pass | Session、preview、history、draftを完全破棄 |
| Save As / verification | Pass | 明示操作、新規file、collision / source拒否、close後read-back validation |
| Targeted Library refresh | Pass | 成功後だけTree / Date / Search / Discovery / Track Infoへ1回追加 |
| Existing Viewer state | Pass | source cache、selection、visibility、Map center / zoomを維持 |
| Failure recovery | Pass | permission deny、collision、save failureでViewer継続とdraft維持 |
| Duplicate protection | Pass | duplicate entry / renderなし。source cacheを維持し新規pathだけ通常pipelineへ接続 |
| Data protection | Pass | 元GPX不変、`trailbook.json`への意図しない書き込みなし |
| Console | Pass | Browser Acceptanceでアプリ由来errorなし |

Performance acceptance:

- async previewはAbortSignal、cooperative yield、progressを維持する。
- Unit 4 Browser Acceptanceでpreview中とDone後のMap pan / zoom、Cancel応答性、Viewer interactionをPassした。
- Unit 5のtargeted refreshでfull Library rescanを行わず、既存cache / visibility / Map viewを維持した。
- 明確な性能回帰はBrowser Acceptanceで確認されていない。専用の数値benchmarkは実施していない。

Final static validation:

| Check | Result | Notes |
|---|---|---|
| Editing Core | Pass | 66 assertions |
| Track Simplification | Pass | 58 assertions |
| Editor Preview / lifecycle | Pass | 117 assertions |
| Save As / verification / refresh | Pass | 53 assertions |
| Production module graph | Pass | 全production module reachable、missing import / cycleなし |
| App / TreeView size gate | Pass | 各1,000行未満 |
| Config version | Historical | 旧finalization時点の`1.5.0`。Decision 0046採用後は`1.4.0`へ戻した |
| Decision 0045 | Historical | save boundaryはDecision 0046によりsuperseded |
| `git diff --check` | Pass | whitespace errorなし |

Known limitations / future candidates:

- point移動、point追加、point削除、区間削除
- Track / Segment分割・結合
- sourceまたはexisting GPXへのOverwrite
- session-memory draftの永続化
- Mobile editor / Mobile Viewer UX
- 大量LibraryでWaypoint ON時の既存性能制限

この旧finalization記録はDecision 0046によりsupersededされた。現行の受け入れとfinalizationは後述のRevised Unit 5記録を正本とする。

### Revised Unit 5 Original Backup + In-place Save

Unit 5 Revised Implementation Status: Completed

Unit 5 Revised Static Test Status: Completed

Unit 5 Revised Browser Acceptance Status: Completed

Unit 5 Revised Status: Completed

Unit 6 Status: Completed

- 初回の明示`保存`は`TrailBook_Backup/<source filename>`へimmutable original bytesを書き、read-back bytes / fingerprint / GPX mappingの確認後だけsource pathを更新する
- 既存Backupは上書き・削除せず、2回目以降はsourceだけを更新する。invalid / partial Backupはfail closedとする
- `TrailBook_Backup`はcase-insensitive reserved Folderで、任意階層のscanから除外する。Tree / Date / Search / Discovery / Geometry Cache / GPX件数へ含めない
- permission deny、Backup create / write / verification failureではsource不変。source write / edited verification failureではBackupを保持して復旧場所を通知する
- 成功後はsame pathのDisplayState cacheとDiscovery summaryだけをinvalid化し、visible Trackだけ既存Queueでreloadする。visibility / selection / Map viewを維持し、duplicate entryを作らない
- Config versionは`1.5.0`。Release 1.5 Unit 1〜6はCompletedで、final commit / tag対象である

| Revised static check | Result | Notes |
|---|---|---|
| Editing Core | Pass | 68 assertions。immutable source bytesのcopy isolationを含む |
| Track Simplification | Pass | 58 assertions |
| Editor Preview / lifecycle | Pass | 117 assertions。保存成功後のsame-path rebaseを含む |
| Original Backup / in-place save / reserved scan / refresh | Pass | 46 assertions |
| Discovery same-path replacement | Pass | 85 assertions |
| Production module graph | Pass | 81 / 81 reachable、missing import 0、cycle 0 |
| App / TreeView size gate | Pass | `App.js` 954行、`TreeView.js` 997行 |
| Browser Acceptance | Completed | Original Backup、in-place source更新、reserved scan除外、same-path refreshを人間が確認 |

### Unit 6 Integration Acceptance and Release Finalization

Unit 6 Integration Acceptance Status: Completed

Unit 6 Documentation Status: Completed

Unit 6 Static Validation Status: Completed

Unit 6 Status: Completed

Release 1.5 Status: Ready for final commit and tag

- Unit 1〜5のBrowser Acceptanceを統合し、Editing Core、RDP preview、Apply / Undo / Redo、Done / draft resume、Cancel、Original Backup + In-place Save、verification、same-path refreshをAcceptedとする
- permission deny、Backup failure、source write / verification failureでViewerを継続し、Backup成功前にsourceを変更しない境界を維持する
- `TrailBook_Backup`を通常Libraryから除外し、GPX、`trailbook.json`、Library stateへ意図しない書き込みを行わない
- point move / add / delete、interval delete、split / merge、autosave、Mobile editing、batch simplification、whole-Track movement、date correction、filename date organizationはRelease 1.5対象外である

## Release 1.6 — Completed

Current Release: `1.6.0`

### Unit Status

- Unit 1 Date Tree year / month / Track: Completed
- Unit 2 Track Date Correction: Completed
- Unit 3 Date-based Filename Rename / Backup Index / Track name sync: Completed
- Unit 4 Track Translation / Date mode Selection Sync: Completed
- Unit 5 OSM / GSI Standard Base Map: Completed
- Unit 6 Batch Simplification: Completed
- Unit 7 Integration Acceptance / Release Finalization: Completed

Unit 1〜6 Browser Acceptance Status: Completed

Unit 7 Static Validation Status: Completed

Unit 7 Status: Completed

Release 1.6 Status: Ready for final commit and tag

### Accepted Behavior

- Date Treeは`年 → 月 → Track`で日nodeを生成せず、既存resolvedDate順とUnknown Dateを維持する
- Date Correctionは全有効`trkpt/time`を同一offsetでshiftし、既存`metadata/time`だけを同offsetで更新する。Undo / Redo / draftへ統合する
- Date-based filename renameはcollision suffixとBackup association indexを使用し、single Track GPXのTrack nameを確定basenameへ同期する。Backup originalをrenameしない
- Track Translationは全Track Pointへ同一offsetを適用し、lat / lonだけを変更する。Waypoint / routeは変更しない
- Date modeはMap selectionから必要な年 / 月を展開して同一pathのTrack nodeへ同期する
- Base MapはOpenStreetMapと国土地理院標準地図だけを提供し、device-local preferenceとして復元する。旧`gsi-pale`はOSMへfallbackする
- Batch Simplificationは選択Folder配下またはLibrary全体を解析後に明示実行し、0削減fileを変更せず、sequential処理、file単位failure継続、安全なfile境界Cancelを維持する
- Original Backup + In-place Edited GPX、明示保存、verification、reserved Folder除外を維持する

### Out of Scope

- point個別move / add / delete、interval delete、split / merge、autosave
- Mobile Viewer / Mobile editing、GPS current-position tracking、wake lock
- Google Maps、白地図scan、historical trace

### Unit 7 Static Validation

| Test | Result |
|---|---:|
| Date Tree | 67 assertions Pass |
| Editing Core | 68 assertions Pass |
| Track Simplification | 58 assertions Pass |
| Track Date Correction | 20 assertions Pass |
| Filename Rename / Backup Index / Track name sync | 30 assertions Pass |
| Editor Preview / lifecycle | 138 assertions Pass |
| Track Translation | 23 assertions Pass |
| Backup / in-place save | 49 assertions Pass |
| Discovery / same-path refresh | 85 assertions Pass |
| Base Map | 17 assertions Pass |
| Batch Simplification | 22 assertions Pass |
| Production modules | 87 / 87 import and main reachable |
| Missing import / circular dependency | 0 / 0 |
| App.js / TreeView.js | 954 / 997 lines |

## Release 1.7 — Completed

Current Release: `1.7.0`

### Unit Status

- Unit 1 Mobile Viewer Foundation / responsive layout: Completed
- Unit 2 GPS Current Position / Follow: Completed
- Unit 3 Google Drive Library Reader / Geometry Cache / cold-load concurrency: Completed
- Unit 4 Driving Mode / Screen Wake Lock: Completed
- Unit 5 GitHub Pages HTTPS deployment / runtime config: Completed
- Unit 6 Mobile UI acceptance / Library Open UI / Release Finalization: Completed

Unit 1〜5 Browser Acceptance Status: Completed

Unit 6 Static Validation Status: Completed

Unit 6 Status: Completed

Release 1.7 Status: Ready for final commit and tag

### Accepted Behavior

- MobileはMap-first responsive layout、overlay Sidebar、bottom-sheet Track Info、44px touch target、safe areaを使用し、desktop layoutと同じSelectionState / DisplayState / Tree / Mapを共有する
- GPSは1つのwatch、current marker、accuracy circle、Followをsession memoryで管理し、manual dragでFollowだけを解除する
- Driving ModeはGPS / Follow / Screen Wake Lockを明示操作で開始し、unsupported / rejectでもViewerとGPSを継続する
- Google Drive Readerは`drive.readonly`、Picker、recursive metadata scan、read-only virtual Library、lazy GPX loadを使用し、tokenを永続化しない
- Drive Geometry Cache hitはmedia download / parseを行わず、cold missだけを最大4並列で処理する
- GitHub Pages artifact rootは`src/`内容で、runtime Google configはActions secretsからartifact内だけに生成する
- Library Open UIは端末 / Filesを主導線、Google Drive API Readerを補助的な直接接続とし、一時Mobile Drive診断panel / hook / CSSは削除した

### Known Limitations

- Geometry CacheがないGoogle Drive大量Libraryの初回visible GPX表示はnetwork-boundで重い
- offline map、Mobile editing、GPS track recording、heading-up、PWA / service workerは未実装
- File System Access、Geolocation、Wake Lockの対応とpermissionはbrowser / OSに依存する

### Unit 6 Static Validation

| Test | Result |
|---|---:|
| Mobile Viewer | 34 assertions Pass |
| GPS Current Position / Follow | 23 assertions Pass |
| Driving Mode / Screen Wake Lock | 20 assertions Pass |
| Google Drive Reader / Geometry Cache / 4 concurrency | 106 assertions Pass |
| Folder / Date Tree | 67 assertions Pass |
| Discovery / Geometry Cache integration | 85 assertions Pass |
| Search / Filter | 28 assertions Pass |
| Track Info | 53 assertions Pass |
| Editor Core / filename / preview / save | 68 / 30 / 138 / 49 assertions Pass |
| Track Simplification / Date Correction / Translation | 58 / 20 / 23 assertions Pass |
| Batch Simplification | 22 assertions Pass |
| Base Map | 17 assertions Pass |
| Shared Library Settings regression | 121 / 136 / 103 assertions Pass |
| Track Alpha Blending | 19 assertions Pass |
| View State / Geometry Cache / Previous Library | 312 assertions Pass |
| Production modules | 96 / 96 import and main reachable |
| Missing import / circular dependency | 0 / 0 |
| App.js / TreeView.js | 954 / 995 lines |

## Release 1.8 — In Progress

Current production version: `1.7.0`

### Unit 1 — PWA Foundation

- Implementation Status: Completed
- Static Test Status: Completed
- Browser Acceptance Status: Pending
- Unit 1 Status: Browser Acceptance Pending

Accepted implementation scope:

- relative `start_url` / `scope`のWeb App Manifestと192 / 512px icon
- standalone表示用theme / Apple mobile metadata
- version付きTrailBook app-shell cacheと旧TrailBook cacheだけのcleanup
- index、CSS、全production module、Leaflet vendor asset、Manifest、iconのprecache
- Google API / OAuth response、map tile、GPXをService Worker cache対象外として維持
- HTTPS / localhostだけのService Worker登録と、登録失敗時の通常Web継続
- GitHub Pages repository subpath互換をrelative URLで維持

Static validation:

- PWA foundation: 44 assertions Pass
- actual offline reload: Pass（113 app-shell entries、UI / CSS / JS / Leaflet起動）
- Mobile Viewer regression: 34 assertions Pass
- GPS regression: 23 assertions Pass
- Driving Mode regression: 20 assertions Pass
- Google Drive regression: 106 assertions Pass

### Unit 3 Track Point Editing — Single Point Move

- Implementation Status: Completed
- Static Test Status: Completed
- Browser Acceptance Status: Pending
- Unit 3 Status: Browser Acceptance Pending

Implemented scope:

- source document-order Track / Segment / Point indexをpoint identityとして保持
- source座標系のpoint overrideとwhole-Track translationを同一Session / history / preview / serializerで合成
- After pointのCanvas hit target、選択marker、project / unproject drag、1 drag = 1 command
- Undo / Redo / Cancel / Done draft / resumeと既存simplification / date / filename / translation historyの共存
- immutable source DOM cloneの対象`trkpt` lat / lonだけを明示Saveで更新
- drag frameでは選択pointと対応Segment lineだけを更新し、3,050 point testでrendererを共有

Static validation:

- Track Point Editing: 52 assertions Pass
- Editor Preview / lifecycle: 148 assertions Pass
- Editing Core: 68 assertions Pass
- Track Simplification: 58 assertions Pass
- Track Date Correction: 20 assertions Pass
- Filename Rename: 30 assertions Pass
- Track Translation: 23 assertions Pass
- Save / Backup: 49 assertions Pass
- Mobile Viewer: 49 assertions Pass (portrait / landscape)
- Desktop layout: 42 assertions Pass
- PWA: 59 assertions Pass (99 production modules precached)
- Production modules: 99 / 99 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass
- Browser Acceptance: Pending

### Unit 4 Track Point Add / Delete

- Implementation Status: Completed
- Static Test Status: Pending browser runner
- Browser Acceptance Status: Pending
- Unit 4 Status: Browser Acceptance Pending

Implemented scope:

- source point deletionをsource identityのdraft setとして保持し、effective Segmentが2点未満になる操作を拒否
- added pointはsession unique `addedPointId`、Track / Segment identity、明示`insertionPosition`、source座標系lat / lonとして保持
- edgeから15px以内の単一点追加、追加point自動選択、existing / added point drag、source / added point削除
- move / delete / add / simplification / translationを同一history、After preview、Serializerへ合成。added pointはsimplification対象外で常にretain
- clone-original-DOMへlat / lonだけの`trkpt`をnamespace維持で挿入し、masked / deleted source pointを除外して既存Backup + in-place save / verificationを利用
- point add hit targetはSegmentごとのwide Polyline、point overlayは共有Canvas rendererを使用し、DOM markerを生成しない

Static validation:

- Track Point Mutation test定義: add / delete / ordering / history / serializer / preview / 3,050 pointを収録
- Browser test runner: Pending（実行失敗扱いにしない）
- Production module graph、missing import、cycle、line count、`git diff --check`は最終検証で確定する

- Production modules: 97 / 97 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass

Out of scope:

- GPX完全offline化
- map tile offline cache
- Google Drive offline access
- PWA update UI、forced reload、service workerによるcredential保存

### Unit 2 — Previous Library / Track Display Auto Restore

- Implementation Status: Completed
- Static Test Status: Completed
- Browser Acceptance Status: Pending
- Unit 2 Status: Browser Acceptance Pending

Accepted implementation scope:

- persisted DirectoryHandle + granted read permissionはPickerなしで既存Library load lifecycleへ接続
- promptは起動時にpermission requestせず、「前回のライブラリを開く」の明示操作だけで既存Handleへrequest
- denied / invalid Handle / provider failureはViewerを停止せず通常の端末Library openへfallback
- Tree render、DisplayState file登録、Discovery準備完了後にView State restoreを開始
- visible relative pathは既存Display Queue、selected Trackはvisible load完了後の既存SelectionState経路で復元
- view stateなしでは全Trackを自動表示しない
- Library identity、Geometry Cache、PWA app-shell、Google Drive直接接続の既存仕様を維持
- Mobile Leaflet zoom controlはRelease 1.8 Mobile Map Controlsで60px高の横並びへ更新し、desktop寸法は維持

Static validation:

- View State / Previous Library / Geometry Cache: 316 assertions Pass
- Mobile Viewer: 35 assertions Pass
- PWA foundation: 44 assertions Pass
- GPS regression: 23 assertions Pass
- Driving Mode regression: 20 assertions Pass
- Google Drive regression: 106 assertions Pass
- Production modules: 97 / 97 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass

Browser Acceptance pending:

- Android PWA standaloneでgranted Handleの自動Library / visible Track / selected Track復元
- Android Files / Google Drive provider Handleのprompt、denied、offline fallback
- 1122 visible Track時のGeometry Cache warm restore体感
- Mobile portrait / landscapeの横並びzoom rowとLibrary / Map toggle control非重複

### PWA Update Visibility Improvement

- Implementation Status: Completed
- Static Test Status: Completed
- Browser Acceptance Status: Pending

Accepted implementation scope:

- Library sidebar最下部へ`Config.version`とruntime build IDを補助表示
- localhostは`local`、Pages artifactはdeploy commit SHA先頭8文字を表示
- Pages deploy時にcredential runtime configとは別の`trailbook.build.js`を生成
- 同じbuild IDをService Workerへ埋め込み、deployごとにTrailBook app-shell cache名を更新
- 新Service Worker activate時は旧TrailBook app-shell cacheだけを削除し、強制reloadは行わない
- Mobile Leaflet zoom rowのCSSがPages artifactへ含まれることを維持

Static validation:

- PWA foundation / build visibility: 59 assertions Pass
- Pages artifact build / cache / mobile zoom simulation: Pass
- Mobile Viewer: 35 assertions Pass
- GPS regression: 23 assertions Pass
- Driving Mode regression: 20 assertions Pass
- Google Drive regression: 106 assertions Pass
- View State / Previous Library regression: 316 assertions Pass
- Production modules: 98 / 98 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass

### Unit 2 Mobile Map Controls UX Cleanup

- MobileではLeaflet標準zoom controlをCSSだけで60px高の横並び`− / ＋`へ投影し、既存Leaflet zoom機能とDesktop縦型controlを維持する
- 背景地図とColor / Monochromeは48px inline SVG toggleで既存`map:base-map-changed` / `map:display-mode-changed`へ接続し、既存view state / display settingsを維持する
- Mobileでは従来のMap toolbarを非表示とし、Waypoint toggle / 表示Clearはsidebar固定control内のcompactな「表示」sectionへ移す
- Driving Modeではzoom、Base Map、Color / Monochrome、GPS Follow、走行中終了を維持し、Library toolbar / sidebarは従来どおり非表示とする
- DesktopではBackground / Map mode select、Waypoint、Clear、Leaflet縦型zoomを変更しない

Static validation:

- Mobile Viewer: 48 assertions Pass（portrait / landscape）、Desktop layout: 41 assertions Pass
- Base Map / Mobile display controls: 24 assertions Pass
- View State / Previous Library: 332 assertions Pass
- PWA: 59 assertions Pass
- GPS regression: 23 assertions Pass
- Driving Mode regression: 20 assertions Pass
- Google Drive regression: 106 assertions Pass
- Production modules: 98 / 98 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass

#### Mobile Library Change Disclosure Regression Fix 2

- Library open success hides only the duplicate primary open action.
- The compact `ライブラリを変更` disclosure remains available after restore.
- Primary-action visibility and change-library visibility use separate DOM containers.
- Restore failure continues to expose both the recovery action and change disclosure.

Static validation:

- View State / Previous Library: 350 assertions Pass
- Mobile Viewer: 49 assertions Pass (portrait / landscape)
- Desktop layout: 42 assertions Pass
- PWA: 59 assertions Pass
- Production modules: 98 / 98 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass

#### Mobile Library Open Action Regression Fix

- Library未openでPrevious Handleが`granted` / `prompt`なら「前回のライブラリを開く」、`denied` / no Handle / invalidなら「端末からライブラリを開く」を常に主操作として表示する
- granted auto restoreのapply失敗、provider read失敗、switch不可ではPrevious主操作へ戻し、statusだけで操作不能な状態を残さない
- auto restore成功後は重複主操作を隠すが、「ライブラリを変更」disclosureとPrevious Library statusは維持する
- 「ライブラリを変更」の展開先は端末open / Google Drive直接接続の既存補助導線を維持する

Static validation:

- View State / Previous Library: 346 assertions Pass
- Mobile Viewer: 48 assertions Pass（portrait / landscape）、Desktop layout: 41 assertions Pass
- PWA: 59 assertions Pass

### Unit 2 Android PWA Previous Library Restore Diagnostic

- Implementation Status: Completed
- Static Test Status: Completed
- Android Browser Re-test Status: Pending

Confirmed path and diagnostics:

- 「端末からライブラリを開く」は`showDirectoryPicker({ mode: "read" })`だけを使用し、`webkitdirectory` / input files fallbackは実装していない
- AndroidでLibrary scanが成功した場合、処理対象は`FileSystemDirectoryHandle`であり、Library apply後に既存IndexedDB Storeへ保存を試みる
- Library panelへ`Previous Library: saved / granted|prompt|denied`、`no persistent handle`、`invalid`、`unsupported`だけを表示し、Handle名 / pathを表示しない
- Store save failureはViewerを停止せず、IndexedDB unavailableなら`unsupported`、永続Handleなしなら`no persistent handle`を表示する
- startup Coordinatorは既存App initializeから実行し、保存Handleのpermissionが`granted`なら自動open、`prompt`なら明示button、`denied`なら通常openへfallbackする
- BuildInfoはfeature coordinator初期化より先にsidebarへ追加し、Mobile sidebarの通常flow最下部へ縮小されないfooterとして表示する

Static validation:

- View State / Previous Library: 332 assertions Pass
- Mobile Viewer: 46 assertions Pass（portrait / landscape）、Desktop layout: 39 assertions Pass
- PWA: 59 assertions Pass
- GPS regression: 23 assertions Pass
- Driving Mode regression: 20 assertions Pass
- Google Drive regression: 106 assertions Pass
- Production modules: 98 / 98 reachable
- Missing import / circular dependency: 0 / 0
- App.js / TreeView.js: 954 / 995 lines
- `git diff --check`: Pass

### Unit 2 Mobile Library UX Cleanup

- Mobile Map上のLibrary controlはinline SVGのicon-only buttonとし、48px touch target、`aria-label` / `title`「ライブラリ」、Leaflet zoom controlとの余白を維持する
- Previous Handleが`prompt`なら「前回のライブラリを開く」を主操作とし、Handleがない、invalid、deniedの場合は「端末からライブラリを開く」を主操作とする
- 「ライブラリを変更」は初期状態で閉じたcompact disclosureとし、展開時だけ端末 / Files / Google Drive経由とGoogle Drive API直接接続を表示する
- BuildInfoはsidebarのTree scroll領域外に置き、sidebar全体をscrollすると最下部で`TrailBook v1.7.0 · <build>`を確認できる。短いlandscapeでもTreeと重ねない
- Previous Library restore、DirectoryHandle persistence、Drive Reader、Geometry Cache、PWA、GPS / Driving Modeのlifecycleは変更しない

Static validation:

- Mobile Viewer: 46 assertions Pass（portrait / landscape）、Desktop layout: 39 assertions Pass
- View State / Previous Library: 332 assertions Pass
- PWA: 59 assertions Pass
- GPS regression: 23 assertions Pass
- Driving Mode regression: 20 assertions Pass
- Google Drive regression: 106 assertions Pass
