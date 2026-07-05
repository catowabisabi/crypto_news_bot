# 新聞摘要助手 (News Summary Bot)

合併版的加密貨幣與股票新聞摘要機械人，支援 Telegram Bot 和 Web UI。

## 項目結構

```
Merged_News_Bot/
├── run.py                      # 主入口
├── class_*.py                  # 核心類別
├── web/                        # Web UI
│   ├── templates/index.html    # 主頁面
│   └── static/                 # 靜態資源
│       ├── css/style.css       # 樣式
│       ├── js/app.js           # JavaScript
│       ├── sw.js               # Service Worker (PWA)
│       └── manifest.json       # PWA 清單
├── docs/                       # 文件
│   └── FIREBASE_SETUP.md      # Firebase 設置指南
├── img/                        # 圖片資源
│   └── screenshots/           # 截圖
├── Utilities/                  # 工具腳本
├── archive/                    # 原始版本歸檔
│   ├── original_crypto_v1/     # 原始加密貨幣版本
│   └── original_stock_v1/     # 原始股票版本
└── requirements.txt           # Python 依賴
```

## 快速開始

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 配置環境變數

複製 `.env.example` 為 `.env` 並填入你的設定：

```env
# OpenAI API
OPENAI_API_KEY=sk-xxx
OPENAI_API_KEY_STOCK=sk-xxx

# Telegram Bots
TELEGRAM_TOKEN=xxx
TELEGRAM_TOKEN_STOCK=xxx
TELEGRAM_CHAT_ID=xxx
TELEGRAM_CHAT_ID_STOCK=xxx

# MongoDB
MONGODB_CONNECTION_STRING=mongodb+srv://...

# News Category (crypto 或 stock)
NEWS_CATEGORY=crypto

# Web UI
ENABLE_WEB_UI=true
WEB_UI_PORT=5000

# Firebase (可選)
FIREBASE_CREDENTIALS_PATH=firebase-credentials.json
```

### 3. 啟動

```bash
# Telegram Bot only
python run.py

# Telegram + Web UI
ENABLE_WEB_UI=true python run.py

# 股票模式
NEWS_CATEGORY=stock python run.py
```

## 功能

### Telegram Bot
- `/start` - 開始
- `/help` - 幫助
- `/start_bot` - 開始自動抓取新聞
- `/stop_bot` - 停止抓取
- `/model 3/4` - 切換 GPT 模型

### Web UI
- PWA 支援 - 可加到主畫面
- 推送通知 - Firebase FCM
- 收藏功能 - 收藏有價值的文章
- 設定 - 自定義偏好

## 環境變數說明

| 變數 | 說明 | 預設值 |
|------|------|--------|
| NEWS_CATEGORY | 新聞類別 | crypto |
| ENABLE_WEB_UI | 啟用 Web UI | false |
| WEB_UI_PORT | Web 端口 | 5000 |
| FIREBASE_CREDENTIALS_PATH | Firebase 憑證路徑 | - |

## Firebase 設置

詳見 docs/FIREBASE_SETUP.md
