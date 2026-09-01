# Japanese Selection Explainer

Webページ上で選択した文章を、Gemini AIが日本語で解説・要約するChrome拡張機能です。

## 主な機能

- 選択した文章を日本語で解説
- 「かんたん」「詳しく」「要約」の3モード
- ローディング表示
- モードの連続切り替え
- 解説ボックスの画面端調整
- Render上のバックエンド経由でGemini APIと通信

## 使用技術

- JavaScript
- Chrome Extensions Manifest V3
- Node.js
- Gemini API
- Render
- Git / GitHub

## システム構成

Chrome Extension  
↓  
Render Backend  
↓  
Gemini API

## 工夫した点

- Gemini APIキーを拡張機能側に直接埋め込まず、バックエンドで管理
- ユーザーが選択した文章だけを送信する設計
- 3つのモードごとにGeminiへの指示を変更
- エラー表示やローディングUIを実装

## 苦労した点

- content.js と background.js の通信
- ローカルサーバーからRenderへの移行
- Git/GitHubの初期設定
- Chrome Web Store向けの権限・プライバシー対応

## 今後の改善

- レート制限の追加
- UIのさらなる改善
- より多様な言語での仕様
- より詳細なエラー処理