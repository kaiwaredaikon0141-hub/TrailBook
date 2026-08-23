# GitHub Pages deployment

TrailBookは`src/`の静的ファイルをGitHub Pagesへ配置できます。公開artifactでは`src/`の内容がsite rootになるため、Pages URLへ`/src/`を付ける必要はありません。

## Repository setup

1. GitHub repositoryの **Settings → Pages** でSourceを **GitHub Actions** に設定します。
2. **Settings → Secrets and variables → Actions** で次のRepository Secretsを登録します。
   - `TRAILBOOK_GOOGLE_OAUTH_CLIENT_ID`
   - `TRAILBOOK_GOOGLE_API_KEY`
   - `TRAILBOOK_GOOGLE_PICKER_APP_ID`
3. `main`へpushするか、Actions画面から **Deploy TrailBook to GitHub Pages** を手動実行します。
4. `https://USERNAME.github.io/REPOSITORY/`を開き、TrailBookが起動することを確認します。

Secretsが未設定でもViewerは起動しますが、Google Drive直接接続は利用できません。実credentialはsource、workflow、logへ記録しません。localhost開発用の`src/trailbook.local-config.js`はGit管理対象外です。

## Google Cloud setup

1. OAuth 2.0 Web ClientのAuthorized JavaScript originsへPagesのHTTPS originを追加します。originにpathは含めません。
   - 例: `https://USERNAME.github.io`
   - repository名はAuthorized JavaScript originへ含めません。
2. API KeyのWebsite restrictionsには実際のPages URL配下を許可します。
   - 例: `https://USERNAME.github.io/REPOSITORY/*`
3. API KeyのAPI restrictionsでGoogle Drive APIとGoogle Picker APIの利用条件を維持します。

## PWA / offline app shell

Release 1.8 Unit 1以降、Pages artifactにはrelative `start_url` / `scope`のManifest、PWA icon、Service Workerが含まれます。AndroidではPagesのHTTPS URLを開き、browserのinstall操作からTrailBookをstandalone appとして追加できます。

Service Workerが保存するのはTrailBook本体のHTML、CSS、production JavaScript modules、Leaflet vendor assets、Manifest、iconだけです。offlineでもViewer UIと既存device-local stateは起動できますが、未取得のmap tile、Google Drive API、OAuth、GPX本文をService Workerから利用することはできません。Service Workerはこれらをcacheしません。

Pages deploy時はartifact内の`trailbook.build.js`とService Workerへdeploy commitの先頭8文字を埋め込みます。Library sidebar最下部の`TrailBook v... · ...`で実行中buildを確認できます。app-shell cache名もbuildごとに変わり、新Service Worker activate時は旧TrailBook app-shell cacheだけを削除します。更新中の画面を強制reloadせず、次回起動または通常reloadで新buildへ切り替えます。

localhost / `127.0.0.1`ではService Workerを登録せず、既存TrailBook registrationと`trailbook-app-shell-*` cacheだけを自動解除します。GitHub Pagesでは従来どおりService Workerとoffline app shellを利用します。

## Browser acceptance

スマートフォンからPagesのHTTPS URLを開き、PWA install、standalone起動、offline app-shell起動、Google Drive login、Folder選択、GPS現在地、Follow、走行中モード、Screen Wake Lockを確認します。GeolocationとWake Lockの対応状況・permissionはbrowserと端末に依存します。
