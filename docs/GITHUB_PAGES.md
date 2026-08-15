# GitHub Pages deployment

TrailBookは`src/`の静的ファイルをGitHub Pagesへ配置できます。公開artifactでは`src/`の内容がsite rootになるため、Pages URLへ`/src/`を付ける必要はありません。

## Repository setup

1. GitHub repositoryの **Settings → Pages** でSourceを **GitHub Actions** に設定します。
2. **Settings → Secrets and variables → Actions** で次のRepository Secretsを登録します。
   - `TRAILBOOK_GOOGLE_OAUTH_CLIENT_ID`
   - `TRAILBOOK_GOOGLE_API_KEY`
   - `TRAILBOOK_GOOGLE_PICKER_APP_ID`
3. `main`へpushするか、Actions画面から **Deploy TrailBook to GitHub Pages** を手動実行します。
4. `https://USERNAME.github.io/REPOSITORY/` を開き、TrailBookが起動することを確認します。

Secretsが未設定の場合もViewerは起動しますが、Google Driveボタンは無効になります。実credentialはsource、workflow、logへ記録しません。localhost開発用の`src/trailbook.local-config.js`もGit管理対象外です。

## Google Cloud setup

1. OAuth 2.0 Web ClientのAuthorized JavaScript originsへPagesのHTTPS originを追加します。originにはpathを含めません。
   - 例: `https://USERNAME.github.io`
   - repository名はAuthorized JavaScript originへ含めません。
2. API KeyのWebsite restrictionsには実際のPages URL配下を許可します。
   - 例: `https://USERNAME.github.io/REPOSITORY/*`
3. API KeyのAPI restrictionsでGoogle Drive APIとGoogle Picker APIの利用条件を維持します。

## Browser acceptance

スマートフォンからPagesのHTTPS URLを開き、Google Drive login、Folder選択、GPS現在地、Follow、走行中モード、Screen Wake Lockを確認します。GeolocationやWake Lockの対応状況・permissionはbrowserと端末に依存します。

GitHub Pages設定、Google Cloud origin登録、実端末確認はdeployment後に手動で行います。PWA、service worker、install対応は含みません。
