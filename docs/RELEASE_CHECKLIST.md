# TrailBook Release Checklist

Version: 1.0 planning
Status: Active
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
- [x] Current Releaseは0.9.0
- [x] Release 1.0は作業中
- [x] 対応環境記述は正確
- [x] Mobile結果は正確
- [x] offline範囲と外部通信説明は正確
- [x] GPX read-only方針は正確
- [x] 独自DBを持たない
- [x] TrailBook本体のLICENSEと第三者licenseを分離する
- [x] Leaflet vendor LICENSEを維持する
- [x] OpenStreetMap attributionをcopyright pageへ接続する
- [x] 未実装機能を現在機能として記載しない

## Performance Acceptance

Post-TreeView-split measurement status: Pending — Windows Chrome / EdgeでUnit 2と同じ手順による実ブラウザ再測定が必要。

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

- [ ] Scope、Out of Scope、既知の制限を最終確認した。
- [ ] Config、README、CHANGELOG、ROADMAP、START_HEREをRelease 1.0完了状態へ更新した。
- [ ] version更新前後のtest結果を記録した。
- [ ] working treeとrelease対象fileを確認した。
- [ ] release commitを作成した。
- [ ] annotated tagを作成した。
- [ ] commitとtagをpushした。
- [ ] `main`と`origin/main`およびtagの一致を確認した。

Unit 1 / Unit 2ではRelease Procedureを実行しない。
