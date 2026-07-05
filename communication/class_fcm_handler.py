"""
Firebase Cloud Messaging (FCM) 整合模塊
用於推送新聞通知到手機 App
"""

import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Firebase Admin SDK - 延遲初始化
_firebase_initialized = False
_app = None
_messaging = None


def init_firebase():
    """初始化 Firebase Admin SDK"""
    global _firebase_initialized, _app, _messaging

    if _firebase_initialized:
        return True

    firebase_creds_path = os.getenv('FIREBASE_CREDENTIALS_PATH')

    if not firebase_creds_path:
        logger.warning('FIREBASE_CREDENTIALS_PATH 未設置，跳過 Firebase 初始化')
        return False

    if not os.path.exists(firebase_creds_path):
        logger.warning(f'Firebase 憑證檔案不存在: {firebase_creds_path}')
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        cred = credentials.Certificate(firebase_creds_path)
        _app = firebase_admin.initialize_app(cred)
        _messaging = messaging
        _firebase_initialized = True
        logger.info('Firebase Admin SDK 初始化成功')
        return True
    except Exception as e:
        logger.error(f'Firebase 初始化失敗: {e}')
        return False


def send_notification(title, body, data=None):
    """
    發送 FCM 推送通知到所有已註冊的設備

    Args:
        title: 通知標題
        body: 通知內容
        data: 額外的自定義數據

    Returns:
        bool: 是否成功發送
    """
    if not init_firebase():
        logger.warning('Firebase 未初始化，無法發送通知')
        return False

    tokens_file = 'fcm_tokens.json'

    if not os.path.exists(tokens_file):
        logger.warning('沒有 FCM tokens，跳過通知')
        return False

    try:
        import json
        with open(tokens_file, 'r', encoding='utf-8') as f:
            tokens = json.load(f)

        if not tokens:
            logger.warning('FCM tokens 列表為空')
            return False

        # 構建消息
        message = _messaging.MulticastMessage(
            notification=_messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            tokens=tokens,
        )

        # 發送
        response = _messaging.send_multicast(message)

        logger.info(f'FCM 推送完成: {response.success_count} 成功, {response.failure_count} 失敗')

        # 清理無效的 tokens
        if response.failure_count > 0:
            cleanup_failed_tokens(response, tokens)

        return response.success_count > 0

    except Exception as e:
        logger.error(f'FCM 推送失敗: {e}')
        return False


def send_news_notification(news_item, category="Crypto"):
    """
    發送新聞通知

    Args:
        news_item: 新聞數據字典
        category: 新聞分類 (Crypto/Stock)
    """
    title = news_item.get('中文標題') or news_item.get('英文標題', '新新聞')

    # 生成摘要預覽
    summary = news_item.get('中文摘要') or news_item.get('建議', '') or ''
    body = summary[:100] + '...' if len(summary) > 100 else summary

    if not body:
        body = f'點擊查看完整新聞摘要'

    data = {
        'type': 'news',
        'news_id': news_item.get('連結', ''),
        'url': news_item.get('連結', ''),
        'category': category,
        'timestamp': datetime.now().isoformat()
    }

    return send_notification(
        title=f'📰 {title}',
        body=body,
        data=data
    )


def register_token(token):
    """
    註冊設備 FCM token

    Args:
        token: FCM 設備 token

    Returns:
        bool: 是否成功註冊
    """
    if not token:
        return False

    try:
        import json
        tokens_file = 'fcm_tokens.json'
        tokens = []

        if os.path.exists(tokens_file):
            with open(tokens_file, 'r', encoding='utf-8') as f:
                tokens = json.load(f)

        if token not in tokens:
            tokens.append(token)
            with open(tokens_file, 'w', encoding='utf-8') as f:
                json.dump(tokens, f, ensure_ascii=False, indent=2)
            logger.info(f'FCM token 已註冊: {token[:20]}...')

        return True

    except Exception as e:
        logger.error(f'FCM token 註冊失敗: {e}')
        return False


def unregister_token(token):
    """
    註銷設備 FCM token
    """
    if not token:
        return

    try:
        import json
        tokens_file = 'fcm_tokens.json'

        if not os.path.exists(tokens_file):
            return

        with open(tokens_file, 'r', encoding='utf-8') as f:
            tokens = json.load(f)

        if token in tokens:
            tokens.remove(token)
            with open(tokens_file, 'w', encoding='utf-8') as f:
                json.dump(tokens, f, ensure_ascii=False, indent=2)
            logger.info(f'FCM token 已註銷: {token[:20]}...')

    except Exception as e:
        logger.error(f'FCM token 註銷失敗: {e}')


def cleanup_failed_tokens(response, tokens):
    """清理發送失敗的 tokens"""
    try:
        import json
        tokens_file = 'fcm_tokens.json'

        # 找出失敗的 tokens
        failed_tokens = []
        for idx, result in enumerate(response.results):
            if result.error:
                failed_tokens.append(tokens[idx])

        # 移除失敗的 tokens
        if failed_tokens:
            valid_tokens = [t for t in tokens if t not in failed_tokens]
            with open(tokens_file, 'w', encoding='utf-8') as f:
                json.dump(valid_tokens, f, ensure_ascii=False, indent=2)
            logger.info(f'已清理 {len(failed_tokens)} 個無效 FCM tokens')

    except Exception as e:
        logger.error(f'清理 FCM tokens 失敗: {e}')


def get_token_count():
    """獲取已註冊的 token 數量"""
    try:
        import json
        tokens_file = 'fcm_tokens.json'

        if not os.path.exists(tokens_file):
            return 0

        with open(tokens_file, 'r', encoding='utf-8') as f:
            tokens = json.load(f)

        return len(tokens)

    except Exception as e:
        logger.error(f'獲取 token 數量失敗: {e}')
        return 0
