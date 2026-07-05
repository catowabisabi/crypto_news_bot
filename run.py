from dotenv import load_dotenv
import os
import nltk
from threading import Thread, Event
from multiprocessing import Process
import asyncio
import logging
import sys
from datetime import datetime

from news.class_news_fetcher import NewsFetcher
from communication.class_telegram_bot import TelegramBot
from core.class_logging import AppLogger
from core.class_state import state, state_manager

# 初始化日誌配置
applogger = AppLogger()
applogger.setup_logging()

# 載入環境變數
load_dotenv()

# 首次使用需要下载punkt
nltk.download('punkt')

# 獲取新聞類別配置
NEWS_CATEGORY = os.getenv('NEWS_CATEGORY', 'crypto').lower()

from my_var import rss_feed_crypto, rss_feed_stock

# 根據類別選擇配置
if NEWS_CATEGORY == 'stock':
    RSS_FEED = rss_feed_stock
    TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN_STOCK')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY_STOCK')
    TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID_STOCK')
    DATABASE_NAME = os.getenv('DATABASE_NAME_STOCK', 'cato_trading_stock')
    state_manager.set_state("News_Catagory", "Stock")
    FETCH_INTERVAL = 300  # Stock: 5分鐘
else:
    RSS_FEED = rss_feed_crypto
    TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
    DATABASE_NAME = os.getenv('DATABASE_NAME', 'cato_trading_crypto')
    state_manager.set_state("News_Catagory", "Crypto")
    FETCH_INTERVAL = 60   # Crypto: 1分鐘

logging.info(f'應用程序啟動 - 模式: {NEWS_CATEGORY.upper()}')
logging.info(f'資料庫: {DATABASE_NAME}')

os.makedirs("market_news", exist_ok=True)

# 創建新聞獲取器
new_fetcher = NewsFetcher(
    rss_feeds=RSS_FEED,
    bot_token=TELEGRAM_TOKEN,
    chat_id=TELEGRAM_CHAT_ID,
    openai_api_key=OPENAI_API_KEY,
    turn_on_bot_reference=False,
    fetch_interval=FETCH_INTERVAL
)

async def run_fetcher():
    await new_fetcher.fetch_news()

# 是否啟用 Flask Web UI
ENABLE_WEB_UI = os.getenv('ENABLE_WEB_UI', 'false').lower() == 'true'

if ENABLE_WEB_UI:
    from flask import Flask, jsonify, request, render_template
    from flask_cors import CORS
    import firebase_admin
    from firebase_admin import credentials, messaging
    import json

    # Flask App
    app = Flask(__name__, template_folder='web/templates', static_folder='web/static')
    CORS(app)

    # Firebase Admin SDK
    firebase_creds_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
    if firebase_creds_path and os.path.exists(firebase_creds_path):
        cred = credentials.Certificate(firebase_creds_path)
        firebase_admin.initialize_app(cred)
        logging.info('Firebase Admin SDK 已初始化')
    else:
        logging.warning('Firebase 憑證未配置，推送通知將不可用')

    # ========== API Routes ==========

    @app.route('/')
    def index():
        """首頁"""
        return render_template('index.html', category=NEWS_CATEGORY)

    @app.route('/api/news')
    def get_news():
        """獲取新聞列表"""
        from data.class_CSV_news_handler import CSVNewsHandler
        csv_handler = CSVNewsHandler()
        news_data = csv_handler.get_existing_news()

        # 按時間倒序
        news_data.reverse()

        # 支持分頁
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        category = request.args.get('category', 'all')

        # 過濾分類 — 用關鍵詞匹配中英文標題
        if category == 'crypto':
            keywords = ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'stablecoin', 'blockchain', 'defi', 'trading', 'coin', 'token', 'exchange', 'wallet', 'miner', 'nft', 'web3', 'solana', 'ripple', 'xrp', 'dogecoin', 'memecoin', 'vasp', 'metaverse']
            news_data = [n for n in news_data if any(kw in (n.get('中文標題','') + ' ' + n.get('英文標題','')).lower() for kw in keywords)]
        elif category == 'stock':
            keywords = ['stock', 'market', 'shares', 'trading', 'nasdaq', 'dow', 's&p', 'ftse', 'nikkei', 'hang seng', 'sensex', '收盘', '开盘', '股价', '股市', '股息', '指数', 'ipo', 'earnings', 'revenue', 'quarterly', '上市公司']
            news_data = [n for n in news_data if any(kw in (n.get('中文標題','') + ' ' + n.get('英文標題','')).lower() for kw in keywords)]

        # 分頁
        start = (page - 1) * per_page
        end = start + per_page
        paginated = news_data[start:end]

        return jsonify({
            'success': True,
            'data': paginated,
            'total': len(news_data),
            'page': page,
            'per_page': per_page
        })

    @app.route('/api/news/<int:news_id>')
    def get_news_detail(news_id):
        """獲取單條新聞詳情"""
        from data.class_CSV_news_handler import CSVNewsHandler
        csv_handler = CSVNewsHandler()
        news_data = csv_handler.get_existing_news()

        if 0 <= news_id < len(news_data):
            return jsonify({
                'success': True,
                'data': news_data[news_id]
            })
        return jsonify({'success': False, 'error': 'News not found'}), 404

    @app.route('/api/favorites', methods=['GET', 'POST', 'DELETE'])
    def favorites():
        """收藏功能"""
        favorites_file = 'favorites.json'
        favorites = []

        if os.path.exists(favorites_file):
            with open(favorites_file, 'r', encoding='utf-8') as f:
                favorites = json.load(f)

        if request.method == 'GET':
            return jsonify({'success': True, 'data': favorites})

        elif request.method == 'POST':
            data = request.json or {}
            news_id = data.get('news_id')
            news_data = data.get('news_data')

            # 檢查是否已收藏
            if not any(f.get('news_id') == news_id for f in favorites):
                favorites.append({
                    'news_id': news_id,
                    'news_data': news_data,
                    'saved_at': str(datetime.now())
                })
                with open(favorites_file, 'w', encoding='utf-8') as f:
                    json.dump(favorites, f, ensure_ascii=False, indent=2)
                return jsonify({'success': True, 'message': 'Added to favorites'})
            return jsonify({'success': True, 'message': 'Already in favorites'})

        elif request.method == 'DELETE':
            data = request.json or {}
            news_id = data.get('news_id')
            favorites = [f for f in favorites if f.get('news_id') != news_id]
            with open(favorites_file, 'w', encoding='utf-8') as f:
                json.dump(favorites, f, ensure_ascii=False, indent=2)
            return jsonify({'success': True, 'message': 'Removed from favorites'})

    @app.route('/api/settings', methods=['GET', 'POST'])
    def settings():
        """用戶設置"""
        settings_file = 'user_settings.json'

        if request.method == 'GET':
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    return jsonify({'success': True, 'data': json.load(f)})
            return jsonify({'success': True, 'data': {}})

        elif request.method == 'POST':
            data = request.json
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return jsonify({'success': True, 'message': 'Settings saved'})

    @app.route('/api/status')
    def get_status():
        """獲取系統狀態"""
        try:
            # 獲取 Bot 狀態
            bot_is_on = state_manager.get_state('Bot is ON')
            fetching_news = state_manager.get_state('Fetching News')

            # 檢查衝突錯誤（Bot is ON 但沒有在 fetching）
            has_conflict = bot_is_on and not fetching_news

            # 獲取 Chat ID
            chat_id = TELEGRAM_CHAT_ID

            # 檢查 CSV 目錄是否有新聞
            from data.class_CSV_news_handler import CSVNewsHandler
            csv_handler = CSVNewsHandler()
            csv_files = csv_handler.get_csv_file_paths(1)
            has_news = any(os.path.isfile(f) for f in csv_files)

            # 嘗試讀取最新一條新聞的時間
            latest_news_time = None
            try:
                existing_news = csv_handler.get_existing_news()
                if existing_news:
                    latest_news = existing_news[-1]
                    latest_news_time = latest_news.get('發佈時間', None)
            except:
                pass

            return jsonify({
                'success': True,
                'data': {
                    'botIsOn': bool(bot_is_on),
                    'fetchingNews': bool(fetching_news),
                    'hasConflict': bool(has_conflict),
                    'chatId': chat_id,
                    'newsCategory': NEWS_CATEGORY.upper(),
                    'hasNews': has_news,
                    'latestNewsTime': latest_news_time,
                    'health': 'Healthy' if (bot_is_on or not fetching_news) else 'Error'
                }
            })
        except Exception as e:
            logging.error(f"Status API error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/settings/chat-id', methods=['POST'])
    def update_chat_id():
        """更新 Telegram Chat ID"""
        try:
            data = request.json
            new_chat_id = data.get('chatId')

            if not new_chat_id:
                return jsonify({'success': False, 'error': 'Chat ID is required'}), 400

            # 驗證 Chat ID 格式
            if not new_chat_id.startswith('-'):
                return jsonify({'success': False, 'error': 'Invalid Chat ID format'}), 400

            # 讀取現有 .env 檔案
            env_path = '.env'
            env_vars = {}

            if os.path.exists(env_path):
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and '=' in line and not line.startswith('#'):
                            key, value = line.split('=', 1)
                            env_vars[key] = value

            # 更新 Chat ID（根據當前 category 決定更新哪個）
            if NEWS_CATEGORY == 'stock':
                env_vars['TELEGRAM_CHAT_ID_STOCK'] = new_chat_id
            else:
                env_vars['TELEGRAM_CHAT_ID'] = new_chat_id

            # 寫回 .env 檔案
            with open(env_path, 'w', encoding='utf-8') as f:
                for key, value in env_vars.items():
                    f.write(f"{key}={value}\n")

            # 同時更新 user_settings.json
            settings_file = 'user_settings.json'
            settings = {}
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    settings = json.load(f)

            settings['chatId'] = new_chat_id

            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)

            return jsonify({'success': True, 'message': f'Chat ID updated to {new_chat_id}'})

        except Exception as e:
            logging.error(f"Update Chat ID error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/fcm/register', methods=['POST'])
    def register_fcm():
        """註冊 FCM 設備 token"""
        data = request.json
        fcm_token = data.get('fcm_token')

        if not fcm_token:
            return jsonify({'success': False, 'error': 'FCM token required'}), 400

        tokens_file = 'fcm_tokens.json'
        tokens = []

        if os.path.exists(tokens_file):
            with open(tokens_file, 'r', encoding='utf-8') as f:
                tokens = json.load(f)

        if fcm_token not in tokens:
            tokens.append(fcm_token)
            with open(tokens_file, 'w', encoding='utf-8') as f:
                json.dump(tokens, f, ensure_ascii=False)

        return jsonify({'success': True, 'message': 'FCM token registered'})

    def send_fcm_notification(title, body, data=None):
        """發送 FCM 推送通知"""
        if not firebase_creds_path or not os.path.exists(firebase_creds_path):
            logging.warning('Firebase 未配置，跳過推送')
            return False

        try:
            tokens_file = 'fcm_tokens.json'
            if not os.path.exists(tokens_file):
                logging.warning('沒有 FCM tokens')
                return False

            with open(tokens_file, 'r', encoding='utf-8') as f:
                tokens = json.load(f)

            if not tokens:
                return False

            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                tokens=tokens,
            )

            response = messaging.send_multicast(message)
            logging.info(f'FCM 推送完成: {response.success_count} 成功, {response.failure_count} 失敗')
            return True
        except Exception as e:
            logging.error(f'FCM 推送失敗: {e}')
            return False

    # 導出 send_fcm_notification 供其他模塊調用
    new_fetcher.set_fcm_sender(send_fcm_notification)

    def run_flask():
        port = int(os.getenv('WEB_UI_PORT', 5000))
        app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)

    # 創建 Telegram Bot
    telegram_bot = TelegramBot(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, OPENAI_API_KEY)
    telegram_bot.set_callback(run_fetcher)

    # Flask runs in subprocess so Telegram can use main thread
    flask_process = Process(target=run_flask, daemon=True)
    flask_process.start()
    logging.info(f'Web UI 已啟動: http://0.0.0.0:{os.getenv("WEB_UI_PORT", 5000)}')

    logging.info('Telegram Bot 已啟動')
    telegram_bot.main()

else:
    # 僅運行 Telegram Bot 模式
    telegram_bot = TelegramBot(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, OPENAI_API_KEY)
    telegram_bot.set_callback(run_fetcher)
    asyncio.run(telegram_bot.main())
