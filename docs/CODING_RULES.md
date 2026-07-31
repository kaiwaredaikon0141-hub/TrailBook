\# CODING\_RULES.md



Version : 1.0

Status  : Official

Depends : PROJECT.md

&#x20;          ARCHITECTURE.md



\---



\# Purpose



本書は TrailBook のコーディング規約を定義する。



目的は



・コード品質の統一

・保守性の向上

・AIと人間の共同開発

・長期保守



である。



本規約は

すべてのコードに適用される。



\---



\# Basic Philosophy



コードは



「コンピュータのため」



ではなく



「次に読む人のため」



に書く。



その"次に読む人"には



・未来の自分



・他の開発者



・AI(Codex)



も含まれる。



\---



\# Priority



品質の優先順位



1\. Correctness



2\. Readability



3\. Maintainability



4\. Simplicity



5\. Performance



パフォーマンスのために

可読性を犠牲にしない。



\---



\# File Size



1ファイル



目安



300行以内



500行を超えたら

分割を検討する。



1000行は禁止。



\---



\# Function Size



1関数



目安



30行以内



50行を超えたら

責務を見直す。



\---



\# Single Responsibility



1クラス



1責務



1関数



1処理



を原則とする。



\---



\# Naming



クラス



PascalCase



例



GPXParser



FolderScanner



MapView



\---



変数



camelCase



例



trackList



folderPath



currentLibrary



\---



定数



UPPER\_SNAKE\_CASE



例



MAX\_TRACK\_COUNT



DEFAULT\_ZOOM



\---



Private



先頭に #



例



\#loadFolder()



\---



\# Comments



コメントを書く目的は



"なぜ"



を書くこと。



"何を"



はコードで表現する。



悪い例



// Trackを追加する



良い例



// GPX仕様では重複Waypointを保持するため

// Setは使用しない



\---



\# JSDoc



公開メソッドには



JSDocを書く。



例



/\*\*

&#x20;\* GPXファイルを解析する

&#x20;\*

&#x20;\* @param {File} file

&#x20;\* @returns {Track}

&#x20;\*/



\---



\# Import Order



import



↓



定数



↓



クラス



↓



export



順番を統一する。



\---



\# Constants



Magic Number禁止



悪い例



zoom = 14



良い例



const DEFAULT\_ZOOM = 14



\---



\# Boolean



悪い例



flag



良い例



isLoaded



hasFolder



canSave



shouldRefresh



\---



\# Condition



ネストは浅くする。



悪い



if



&#x20;if



&#x20;  if



良い



Guard Clause



\---



\# Guard Clause



悪い



if(folder){



&#x20;   ...



}



良い



if(!folder){



&#x20;   return;



}



\---



\# Switch



ifが3個以上続くなら



switchを検討する。



\---



\# Loop



forより



for...of



を優先する。



添字が不要なら



forEachでも良い。



\---



\# Async



Promise Chain禁止



悪い



then()



then()



then()



良い



async



await



\---



\# Error Handling



try-catchを書く。



catchは空にしない。



console.errorだけで終わらせない。



\---



\# Logging



console.logは



開発中のみ。



Releaseでは削除。



\---



\# Event



EventBus経由。



UI同士は



直接通信禁止。



\---



\# DOM



document.querySelector



を乱用しない。



ViewがDOMを管理する。



\---



\# CSS



JavaScriptからstyle変更禁止。



class切替を使用する。



\---



\# HTML



id乱用禁止。



class優先。



\---



\# Side Effects



Utilityは



副作用禁止。



\---



\# Global Variables



グローバル変数禁止。



\---



\# Duplication



同じコードが3回出たら



共通化する。



\---



\# Large Class



巨大クラス禁止。



責務が増えたら



分割する。



\---



\# Large Function



巨大関数禁止。



50行を超えたら



分割を検討。



\---



\# Event Names



命名



noun:verb



例



library:loaded



folder:opened



map:updated



track:selected



\---



\# Folder Structure



責務で分ける。



機能で分けない。



悪い例



map/



gps/



toolbar/



良い例



ui/



services/



models/



\---



\# Dependencies



UI



↓



Service



↓



Model



↓



Utility



逆参照禁止。



循環参照禁止。



\---



\# AI Rules



AIは



勝手に



・React



・Vue



・TypeScript



・SQLite



・Node.js



へ変更しない。



\---



AIは



既存設計を尊重する。



設計を変更する場合は



設計書を更新してから行う。



\---



\# Code Review Checklist



□ 責務は一つか



□ 名前は適切か



□ コメントは必要十分か



□ Magic Numberは無いか



□ JSDocはあるか



□ EventBusを使用しているか



□ UIとServiceが混ざっていないか



□ ModelがUIを知らないか



□ Utilityに副作用は無いか



□ 保守しやすいか



\---



\# Golden Rule



読みやすいコードは

速いコードより価値がある。



保守できるコードは

短いコードより価値がある。



設計に従うコードは

賢そうなコードより価値がある。



迷ったら



「半年後の自分が読めるか」



で判断する。



\---



End of Document

