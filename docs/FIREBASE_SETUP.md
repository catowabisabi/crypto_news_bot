# Firebase 設置指南

## 1. 創建 Firebase 項目

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「創建項目」
3. 輸入項目名稱，點擊「繼續」
4. 關閉 Google Analytics（可選），點擊「創建項目」

## 2. 啟用 Cloud Messaging

1. 在左側菜單點擊「成長」→「Cloud Messaging」
2. 點擊「開始使用」
3. 如果有彈窗，點擊「將 Firebase SDK 添加到您的應用」並完成設置

## 3. 創建 Web 應用

1. 點擊「項目設置」（齒輪圖標）
2. 滾動到「您的應用」部分
3. 點擊「Web」圖標 (</>)）
4. 輸入應用暱稱，點擊「註冊應用」
5. 複製顯示的 Firebase 配置資訊

## 4. 生成私鑰（用於 Server）

1. 在「項目設置」中，點擊「服務帳戶」標籤
2. 點擊「生成新的私鑰」
3. 確認後下載 JSON 文件
4. 將文件重命名為 `firebase-credentials.json`
5. 將文件放到專案根目錄

## 5. 獲取 FCM Server Key

1. 在 Firebase Console 中，前往「項目設置」→「Cloud Messaging」
2. 複製「服務帳戶密鑰」中的密鑰（也可從下載的 JSON 文件中獲取）

## 6. 設置 Flutter/React Native App

### Flutter
```dart
// pubspec.yaml
dependencies:
  firebase_core: latest_version
  firebase_messaging: latest_version
```

### React Native
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

## 7. 配置環境變數

在 `.env` 文件中：

```env
FIREBASE_CREDENTIALS_PATH=firebase-credentials.json
```

## 8. 測試推送

運行應用後，當有新新聞時，應該會收到推送通知。

## 故障排除

### 推送通知不工作？
1. 確認 `firebase-credentials.json` 存在且格式正確
2. 確認 FCM tokens 已正確註冊到 `fcm_tokens.json`
3. 檢查伺服器日誌是否有錯誤

### App 收不到通知？
1. 確認 App 已授予通知權限
2. 確認使用的是正確的 FCM token
3. 在 Firebase Console 中使用「發送測試消息」功能
