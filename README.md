# ワードウルフ オンライン - セットアップガイド

## 🚀 Firebase セットアップ（無料）

### 1. Firebaseプロジェクトを作成

1. https://console.firebase.google.com/ にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例：word-wolf-game）
4. Google アナリティクスは不要なのでオフにしてOK
5. 「プロジェクトを作成」をクリック

### 2. Realtime Databaseを有効化

1. 左メニューから「構築」→「Realtime Database」を選択
2. 「データベースを作成」をクリック
3. ロケーションは「asia-southeast1（シンガポール）」を推奨
4. セキュリティルールは「テストモードで開始」を選択
5. 「有効にする」をクリック

### 3. セキュリティルールを設定

データベース画面で「ルール」タブを開き、以下をコピペ：

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        ".indexOn": ["createdAt"]
      }
    }
  }
}
```

「公開」ボタンを押して保存。

### 4. Firebase設定を取得

1. プロジェクトの設定（⚙️アイコン）→「プロジェクトの設定」
2. 下にスクロールして「マイアプリ」セクションを見つける
3. 「</>」（ウェブ）アイコンをクリック
4. アプリのニックネームを入力（例：word-wolf-web）
5. 「Firebase Hosting」はチェック不要
6. 「アプリを登録」をクリック
7. 表示されるfirebaseConfigの値をコピー

### 5. index.htmlを編集

`index.html`を開いて、以下の部分を見つけます：

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

コピーした設定値に置き換えます。例：

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyAbc123...",
    authDomain: "word-wolf-game.firebaseapp.com",
    databaseURL: "https://word-wolf-game-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "word-wolf-game",
    storageBucket: "word-wolf-game.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123..."
};
```

## 📤 デプロイ方法

### オプション1：Firebase Hosting（推奨・無料）

1. Node.jsをインストール（https://nodejs.org/）
2. コマンドラインで：
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# プロジェクトを選択
# public directoryは「.」を入力
# single-page appは「No」
firebase deploy
```

3. デプロイ完了後、表示されるURLでアクセス可能！

### オプション2：GitHub Pages

1. GitHubでリポジトリを作成
2. `index.html`をアップロード
3. Settings → Pages → Sourceを「main」ブランチに設定
4. `https://yourusername.github.io/repo-name/` でアクセス可能！

### オプション3：ローカルテスト

`index.html`をブラウザで直接開くだけ！（Firefoxは動作しない可能性あり、Chromeを推奨）

## 🎮 使い方

1. ホストが「ルーム作成」で部屋を作る
2. 4文字のルームコードが表示される
3. 友達が「ルーム参加」でコードを入力
4. 最低3人集まったらホストが「ゲーム開始」
5. 各プレイヤーが自分のスマホでお題を確認
6. みんなで話し合い
7. 投票してウルフを見つける！

## 🎉 完成！

これでオンラインで友達とワードウルフが遊べます！
