# AI Agent Development Rules (TapTalk Mobile)

## 🚨 絶対厳守ルール (Critical Rules)
1. **既存コードの無断削除・破壊の禁止**
   - 既存の機能（タブ切り替え、音声読み上げ、お休み文章自動生成、LocalStorage連携など）を勝手に削ったり、未実装状態に戻さないこと。
   - 指示された機能追加・修正のみを該当箇所へ適用（部分差分適用）すること。

2. **マルチファイル構成の維持**
   - 本プロジェクトは `index.html`, `style.css`, `script.js` の3ファイルで構成される Single Page Application (SPA) です。
   - 1つのファイルに全コードをまとめたり、ファイル構造を変更しないこと。

3. **ドキュメントの参照**
   - 常にプロジェクト直下の `CONTEXT.md` および `REQUIREMENTS.md` を参照し、そこに定義された仕様・制約事項（Pure Vanilla JS、iOS対策、2列グリッド等）を遵守すること。

4. **安全な実装**
   - 外部ライブラリや外部フレームワーク（React, Vue, Tailwind, Bootstrap等）は一切導入しないこと。
   - クラス名や既存のDOM IDを変更する場合は、HTML/CSS/JS間での整合性を必ず保つこと。