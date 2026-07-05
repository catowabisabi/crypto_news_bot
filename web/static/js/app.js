const API_BASE = '/api';
let currentCategory = 'all';
let currentPage = 1;
let perPage = 20;
let allNews = [];
let favorites = [];
let currentNewsItem = null;
let statusInterval = null;

const newsList = document.getElementById('news-list');
const tabs = document.querySelectorAll('.nav-tabs-custom .tab');
const bottomNav = document.querySelectorAll('.bottom-nav-custom .nav-btn');

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadNews();
    await loadFavorites();
    await loadStatus();
    initEventListeners();
    startAutoRefresh();
    startStatusPolling();
});

function initEventListeners() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            currentPage = 1;
            loadNews();
        });
    });

    document.getElementById('btn-open-link')?.addEventListener('click', () => {
        if (currentNewsItem && currentNewsItem.連結) {
            window.open(currentNewsItem.連結, '_blank');
        }
    });

    document.getElementById('btn-toggle-favorite')?.addEventListener('click', () => {
        toggleFavorite(currentNewsItem);
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
    document.getElementById('btn-save-chat-id')?.addEventListener('click', saveChatId);
}

async function loadStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            document.getElementById('status-chat-id').textContent = data.chatId || '—';

            const healthEl = document.getElementById('status-health-text');
            healthEl.textContent = data.health === 'Healthy' ? 'Healthy' : 'Error';
            healthEl.style.color = data.health === 'Healthy' ? 'var(--bull)' : 'var(--bear)';

            const dot = document.getElementById('status-dot');
            const botText = document.getElementById('status-bot-text');
            if (data.botIsOn) {
                dot.classList.remove('off');
                botText.textContent = '● BOT ON';
                botText.style.color = 'var(--bull)';
            } else {
                dot.classList.add('off');
                botText.textContent = '● BOT OFF';
                botText.style.color = 'var(--sub)';
            }

            if (data.chatId) {
                document.getElementById('setting-chat-id').value = data.chatId;
            }
        }
    } catch (error) {
        console.error('Failed to load status:', error);
    }
}

function startStatusPolling() {
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(loadStatus, 30000);
}

async function loadNews() {
    newsList.innerHTML = '<div style="color:var(--sub);font-size:13px;text-align:center;padding:40px 0;">載入中...</div>';
    try {
        const response = await fetch(`${API_BASE}/news?category=${currentCategory}&page=${currentPage}&per_page=${perPage}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.success) {
            allNews = result.data;
            renderNews(allNews);
            updateTicker(allNews);
        } else {
            throw new Error(result.error || 'Failed');
        }
    } catch (error) {
        console.error('Failed to load news:', error);
        newsList.innerHTML = '<div style="color:var(--bear);font-size:13px;text-align:center;padding:40px 0;">載入失敗</div>';
    }
}

function updateTicker(news) {
    if (!news || news.length === 0) return;
    const symbols = ['BTC','ETH','SOL','NVDA','TSLA','AAPL','MSFT','META','DOGE','XRP'];
    const pairs = symbols.slice(0, 5);
    const track = document.getElementById('ticker-track');
    let html = '';
    pairs.forEach(sym => {
        const item = news.find(n => {
            const text = (n.中文標題 || '') + (n.英文標題 || '') + (n.建議 || '');
            return text.toLowerCase().includes(sym.toLowerCase());
        });
        const sentiment = item ? getSentimentClass(item.建議) : '';
        const cls = sentiment === 'positive' ? 'up' : sentiment === 'negative' ? 'down' : 'up';
        const icon = cls === 'up' ? '▲ 看好' : '▼ 看淡';
        html += `<span>${sym} <span class="${cls}">${icon}</span></span>`;
    });
    // Duplicate for seamless scroll
    track.innerHTML = html + html;
}

async function loadFavorites() {
    try {
        const response = await fetch(`${API_BASE}/favorites`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.success) favorites = result.data || [];
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
}

function loadFavoritesToView() {
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector('.nav-tabs-custom .tab[data-category="favorites"]')?.classList.add('active');
    const favNews = favorites.map(f => f.news_data).filter(Boolean);
    renderNews(favNews);
}

function renderNews(news) {
    if (!news || news.length === 0) {
        newsList.innerHTML = '';
        const dl = document.getElementById('desktop-news-list');
        if (dl) dl.innerHTML = '';
        return;
    }

    const isDesktop = window.innerWidth >= 768;

    // Mobile card HTML generator
    const mobileHtml = news.map((item, index) => {
        const isFavorited = favorites.some(f => JSON.stringify(f.news_data) === JSON.stringify(item));
        const sentimentClass = getSentimentClass(item.建議);
        const sentimentText = getSentimentText(item.建議);
        const sentimentIcon = sentimentClass === 'positive' ? '▲' : sentimentClass === 'negative' ? '▼' : '—';
        const summary = item.中文摘要 || item.中文總結 || item.建議 || '';
        const shortSummary = summary.length > 100 ? summary.substring(0, 100) + '…' : summary;
        const favIcon = isFavorited ? '★' : '☆';

        return `
            <div class="news-card ${sentimentClass}" data-index="${index}">
                <div class="news-card-header">
                    <span class="source">${item.作者 || '新聞來源'}</span>
                    <span>${formatDate(item.發佈時間)}</span>
                </div>
                <div class="news-title">${item.中文標題 || item.英文標題 || '無標題'}</div>
                <div class="news-summary">${shortSummary}</div>
                <div class="news-footer">
                    <span class="sentiment-badge ${sentimentClass}">${sentimentText} ${sentimentIcon}</span>
                    <div class="card-actions">
                        <button class="action-btn ${isFavorited ? 'active' : ''}"
                                onclick="event.stopPropagation(); toggleFavorite(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            ${favIcon}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    newsList.innerHTML = mobileHtml;

    // Desktop: grid layout
    const desktopList = document.getElementById('desktop-news-list');
    if (desktopList) {
        desktopList.innerHTML = mobileHtml;
    }

    // Attach click handlers (mobile only has #news-list)
    document.querySelectorAll('#news-list .news-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            openNewsDetail(index);
        });
    });

    // Desktop click handlers
    if (desktopList) {
        document.querySelectorAll('#desktop-news-list .news-card').forEach(card => {
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.index);
                openNewsDetail(index);
            });
        });
    }
}

function openNewsDetail(index) {
    const news = currentCategory === 'favorites'
        ? (favorites[index]?.news_data || allNews[index])
        : allNews[index];

    if (!news) return;
    currentNewsItem = news;

    document.getElementById('modal-source').textContent = news.作者 || '新聞來源';
    document.getElementById('modal-date').textContent = formatDate(news.發佈時間);
    document.getElementById('modal-title').textContent = news.中文標題 || news.英文標題;

    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <p style="margin-bottom:12px;">${news.中文摘要 || news.英文摘要 || '無摘要'}</p>
        ${news.中文總結 || news.建議 ? `<p><strong style="color:var(--gold);font-size:12px;">分析:</strong> ${news.中文總結 || news.建議}</p>` : ''}
        ${news.中文內容 ? `<p style="margin-top:12px;font-size:12.5px;color:var(--sub);">${news.中文內容}</p>` : ''}
    `;

    const isFavorited = favorites.some(f =>
        JSON.stringify(f.news_data) === JSON.stringify(news)
    );
    document.getElementById('btn-toggle-favorite').textContent = isFavorited ? '★ 已收藏' : '★ 收藏';
    document.getElementById('btn-toggle-favorite').style.color = isFavorited ? 'var(--bull)' : 'var(--gold)';

    document.getElementById('news-modal-overlay').classList.add('show');
}

async function toggleFavorite(news) {
    if (!news) return;

    const isFavorited = favorites.some(f =>
        JSON.stringify(f.news_data) === JSON.stringify(news)
    );

    try {
        if (isFavorited) {
            const favItem = favorites.find(f => JSON.stringify(f.news_data) === JSON.stringify(news));
            const response = await fetch(`${API_BASE}/favorites`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ news_id: favItem?.news_id || Date.now() })
            });
            if (!response.ok) throw new Error('Delete failed');
            showToast('已移除收藏', 'success');
        } else {
            const response = await fetch(`${API_BASE}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ news_id: Date.now(), news_data: news })
            });
            if (!response.ok) throw new Error('Add failed');
            showToast('已加入收藏', 'success');
        }

        await loadFavorites();

        if (currentCategory === 'favorites') {
            loadFavoritesToView();
        } else {
            renderNews(allNews);
        }
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        showToast('操作失敗', 'error');
    }
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (!response.ok) throw new Error('HTTP error');
        const result = await response.json();

        if (result.success && result.data) {
            const settings = result.data;
            document.getElementById('setting-push').checked = settings.pushEnabled !== false;
            document.getElementById('setting-quiet-start').value = settings.quietStart || '22:00';
            document.getElementById('setting-quiet-end').value = settings.quietEnd || '08:00';
            if (settings.chatId) {
                document.getElementById('setting-chat-id').value = settings.chatId;
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings() {
    const settings = {
        pushEnabled: document.getElementById('setting-push').checked,
        quietStart: document.getElementById('setting-quiet-start').value,
        quietEnd: document.getElementById('setting-quiet-end').value,
        perPage: perPage,
        chatId: document.getElementById('setting-chat-id').value
    };

    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error('HTTP error');
        showToast('設定已儲存', 'success');
        document.getElementById('settings-modal-overlay').classList.remove('show');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showToast('儲存失敗', 'error');
    }
}

async function saveChatId() {
    const chatId = document.getElementById('setting-chat-id').value.trim();
    if (!chatId) {
        showToast('請輸入 Chat ID', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/settings/chat-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Update failed');
        showToast('Chat ID 已更新', 'success');
        loadStatus();
    } catch (error) {
        console.error('Failed to update Chat ID:', error);
        showToast('更新失敗: ' + error.message, 'error');
    }
}

function startAutoRefresh() {
    setInterval(() => {
        if (currentCategory !== 'favorites') {
            loadNews();
        }
    }, 60000);
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast-msg');
    toast.textContent = msg;
    toast.className = 'toast-msg show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '剛剛';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
        return date.toLocaleDateString('zh-TW');
    } catch {
        return dateStr;
    }
}

function getSentimentClass(advice) {
    if (!advice) return 'neutral';
    const text = advice.toLowerCase();
    if (text.includes('買') || text.includes('漲') || text.includes('好') || text.includes('正面') || text.includes('看好')) {
        return 'positive';
    }
    if (text.includes('賣') || text.includes('跌') || text.includes('壞') || text.includes('負面') || text.includes('風險') || text.includes('看淡')) {
        return 'negative';
    }
    return 'neutral';
}

function getSentimentText(advice) {
    if (!advice) return '中性';
    const text = advice.toLowerCase();
    if (text.includes('買') || text.includes('漲') || text.includes('好') || text.includes('正面') || text.includes('看好')) {
        return '看好';
    }
    if (text.includes('賣') || text.includes('跌') || text.includes('壞') || text.includes('負面') || text.includes('風險') || text.includes('看淡')) {
        return '看淡';
    }
    return '中性';
}

window.toggleFavorite = toggleFavorite;
