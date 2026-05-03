# kterm コード署名セットアップガイド

CI でコード署名付きビルドを行うための証明書取得・GitHub Secrets登録手順。

---

## 1. Apple Developer Program（macOS署名）

### 1-1. 加入
- https://developer.apple.com/programs/ から登録（年額 $99）
- 承認まで数日かかる場合あり

### 1-2. Developer ID Application 証明書を作成
1. https://developer.apple.com/account/resources/certificates/add
2. **Developer ID Application** を選択 → Create
3.画面の指示に従いキーチェーンアクセスで CSR を生成→アップロード
4. 証明書（.cer）をダウンロード → ダブルクリックでキーチェーンに登録

### 1-3. .p12 を書き出す
1. キーチェーンアクセスを開く
2. 作成した「Developer ID Application」証明書を右クリック
3. 「"..."を書き出す」→ .p12 形式で保存（パスワード設定）

### 1-4. App用パスワードを作成（公証用）
1. https://appleid.apple.com にサインイン
2. サインインとセキュリティ → アプリ用パスワード
3. パスワードを生成（例: ラベル「GitHub Actions」）

### 1-5. 値を取得

```bash
# .p12 を Base64 エンコード
base64 -i DeveloperID.p12 | pbcopy

# 署名ID を確認（キーチェーンの証明書名）
# 例: "Developer ID Application: Your Name (ABCDE12345)"
```

### 1-6. GitHub Secrets に登録

| Secret名 | 値 |
|-----------|-----|
| `APPLE_CERTIFICATE` | Base64エンコードした .p12 の中身 |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 のパスワード |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAM_ID)` |
| `APPLE_ID` | Apple ID のメールアドレス |
| `APPLE_PASSWORD` | 1-4 で生成したアプリ用パスワード |
| `APPLE_TEAM_ID` | 10桁のチームID（Developer Portalで確認） |
| `KEYCHAIN_PASSWORD` | 任意のパスワード（CI用キーチェーンのパスワード） |

登録先: https://github.com/KumaBase/kterm/settings/secrets/actions

---

## 2. Windows コード署名証明書

### 2-1. 証明書を購入
推奨プロバイダー:

| プロバイダー | 標準 | EV |
|-------------|------|-----|
| [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing) | ~$85/年 | - |
| [DigiCert](https://www.digicert.com/signing/code-signing-certificates) | ~$474/年 | ~$680/年 |
| [SSL.com](https://www.ssl.com/certificates/code-signing/) | ~$79/年 | ~$299/年 |

> **標準 vs EV**: EV証明書はSmartScreen警告が即座に解除される。標準はアプリの評判が上がると解除される。

### 2-2. 証明書を .pfx で受け取る
- プロバイダーの手順に従い .pfx 形式で書き出し

### 2-3. GitHub Secrets に登録

```bash
# .pfx を Base64 エンコード
base64 -i codesign.pfx | pbcopy
```

| Secret名 | 値 |
|-----------|-----|
| `WINDOWS_CERTIFICATE` | Base64エンコードした .pfx の中身 |
| `WINDOWS_CERTIFICATE_PASSWORD` | .pfx のパスワード |

---

## 3. 確認

Secrets登録後、新しいタグをpushしてCIを実行:

```bash
git tag v0.2.0
git push origin v0.2.0
```

- macOS: 署名 + 公証（notarization）付き .dmg
- Windows: 署名付き .msi / .exe
- Linux: .deb / .AppImage（署名不要）

---

## 補足: Secrets未登録時の動作

Secrets が未設定の場合、証明書インポートステップはスキップされ、署名なしビルドが実行されます（現在の動作と同じ）。
