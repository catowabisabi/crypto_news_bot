const API_BASE = '/api';
let currentCategory = 'all';
let currentPage = 1;
let perPage = 20;
let allNews = [];
let favorites = [];
let currentNewsItem = null;
let statusInterval = null;

let newsModal, settingsModal, errorToast, successToast;

const newsList = document.getElementById('news-list');
const tabs = document.querySelectorAll('[data-category]');
const bottomNav = document.querySelectorAll('[data-page]');
const conflictAlert = document.getElementById('conflict-alert');

document.addEventListener('DOMContentLoaded', async () => {
    newsModal = new bootstrap.Modal(document.getElementById('news-modal'));
    settingsModal = new bootstrap.Modal(document.getElementById('settings-modal'));
    errorToast = new bootstrap.Toast(document.getElementById('error-toast'));
    successToast = new bootstrap.Toast(document.getElementById('success-toast'));

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

    bottomNav.forEach(item => {
        item.addEventListener('click', () => {
            bottomNav.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const page = item.dataset.page;

            if (page === 'settings') {
                settingsModal.show();
            } else if (page === 'favorites') {
                currentCategory = 'favorites';
                loadFavoritesToView();
            } else {
                currentCategory = 'all';
                loadNews();
            }
        });
    });

    document.getElementById('modal-close')?.addEventListener('click', () => newsModal.hide());
    document.getElementById('settings-close')?.addEventListener('click', () => settingsModal.hide());

    document.getElementById('btn-open-link')?.addEventListener('click', () => {
        if (currentNewsItem && currentNewsItem.連結) {
            window.open(currentNewsItem.連結, '_blank');
        }
    });

    document.getElementById('btn-toggle-favorite')?.addEventListener('click', () => {
        toggleFavorite(currentNewsItem);
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        loadNews();
        loadStatus();
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        settingsModal.show();
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);

    document.getElementById('btn-save-chat-id')?.addEventListener('click', saveChatId);

    document.getElementById('btn-dismiss-conflict')?.addEventListener('click', () => {
        conflictAlert.classList.add('d-none');
    });

    document.getElementById('news-modal')?.addEventListener('hidden.bs.modal', () => {
        currentNewsItem = null;
    });
}

async function loadStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            document.getElementById('status-chat-id').textContent = data.chatId || '-';

            const healthBadge = document.getElementById('status-health');
            if (data.health === 'Healthy') {
                healthBadge.className = 'badge bg-success';
                healthBadge.textContent = 'Healthy';
            } else {
                healthBadge.className = 'badge bg-danger';
                healthBadge.textContent = 'Error';
            }

            const botBadge = document.getElementById('status-bot');
            if (data.botIsOn) {
                botBadge.className = 'badge bg-success';
                botBadge.textContent = 'ON';
            } else {
                botBadge.className = 'badge bg-secondary';
                botBadge.textContent = 'OFF';
            }

            if (data.chatId) {
                document.getElementById('setting-chat-id').value = data.chatId;
            }

            if (data.hasConflict) {
                conflictAlert.classList.remove('d-none');
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
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/news?category=${currentCategory}&page=${currentPage}&per_page=${perPage}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            allNews = result.data;
            renderNews(allNews);
        } else {
            throw new Error(result.error || 'Failed to load news');
        }
    } catch (error) {
        console.error('Failed to load news:', error);
        showError('載入失敗: ' + error.message);
        newsList.innerHTML = `
            <div class="col-12 empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>載入失敗，請稍後重試</p>
            </div>
        `;
    } finally {
        showLoading(false);
    }
}

async function loadFavorites() {
    try {
        const response = await fetch(`${API_BASE}/favorites`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.success) {
            favorites = result.data || [];
        }
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
}

function loadFavoritesToView() {
    const favNews = favorites.map(f => f.news_data).filter(Boolean);
    renderNews(favNews);
}

function renderNews(news) {
    if (!news || news.length === 0) {
        newsList.innerHTML = `
            <div class="col-12 empty-state">
                <div class="empty-state-icon">📭</div>
                <p>暫時沒有新聞</p>
            </div>
        `;
        return;
    }

    newsList.innerHTML = news.map((item, index) => {
        const isFavorited = favorites.some(f => JSON.stringify(f.news_data) === JSON.stringify(item));
        const sentimentClass = getSentimentClass(item.建議);
        const summary = item.中文摘要 || item.中文總結 || item.建議 || '';
        const shortSummary = summary.length > 120 ? summary.substring(0, 120) + '...' : summary;

        return `
            <div class="col-12 col-md-6 col-lg-4">
                <article class="news-card" data-index="${index}">
                    <div class="news-card-header">
                        <span class="news-source">${item.作者 || '新聞來源'}</span>
                        <span class="news-date">${formatDate(item.發佈時間)}</span>
                    </div>
                    <h3 class="news-title">${item.中文標題 || item.英文標題 || '無標題'}</h3>
                    <p class="news-summary">${shortSummary}</p>
                    <div class="news-footer">
                        <span class="sentiment-badge ${sentimentClass}">${getSentimentText(item.建議)}</span>
                        <div class="card-actions">
                            <button class="action-btn ${isFavorited ? 'favorited' : ''}"
                                    onclick="event.stopPropagation(); toggleFavorite(${JSON.stringify(item).replace(/"/g, '&quot;')})"
                                    title="${isFavorited ? '取消收藏' : '收藏'}">
                                ${isFavorited ? '⭐' : '☆'}
                            </button>
                        </div>
                    </div>
                </article>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.news-card').forEach((card) => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            openNewsDetail(index);
        });
    });
}

function openNewsDetail(index) {
    const news = currentCategory === 'favorites'
        ? (favorites[index]?.news_data || allNews[index])
        : allNews[index];

    if (!news) return;

    currentNewsItem = news;

    document.getElementById('modal-source').textContent = news.作者 || '新聞來源';
    document.getElementById('modal-source').className = 'badge bg-primary mb-1';
    document.getElementById('modal-date').textContent = formatDate(news.發佈時間);
    document.getElementById('modal-title').textContent = news.中文標題 || news.英文標題;

    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div class="mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-card-text me-2"></i>摘要</h6>
            <p class="text-break">${news.中文摘要 || news.英文摘要 || '無摘要'}</p>
        </div>
        <div class="mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-lightbulb me-2"></i>分析與建議</h6>
            <p class="text-break">${news.中文總結 || news.建議 || '無分析'}</p>
        </div>
        ${news.中文內容 ? `
        <div class="mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-file-text me-2"></i>內容</h6>
            <p class="text-break">${news.中文內容}</p>
        </div>
        ` : ''}
    `;

    const isFavorited = favorites.some(f =>
        JSON.stringify(f.news_data) === JSON.stringify(news)
    );
    const favBtn = document.getElementById('btn-toggle-favorite');
    favBtn.innerHTML = `<i class="bi bi-star me-1"></i>${isFavorited ? '已收藏' : '收藏'}`;

    newsModal.show();
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
            showSuccess('已移除收藏');
        } else {
            const response = await fetch(`${API_BASE}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    news_id: Date.now(),
                    news_data: news
                })
            });
            if (!response.ok) throw new Error('Add failed');
            showSuccess('已加入收藏');
        }

        await loadFavorites();

        if (currentCategory === 'favorites') {
            loadFavoritesToView();
        }
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        showError('操作失敗');
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
            document.getElementById('setting-per-page').value = settings.perPage || 20;

            if (settings.chatId) {
                document.getElementById('setting-chat-id').value = settings.chatId;
            }

            perPage = settings.perPage || 20;
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
        perPage: parseInt(document.getElementById('setting-per-page').value),
        chatId: document.getElementById('setting-chat-id').value
    };

    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('HTTP error');

        perPage = settings.perPage;
        loadNews();
        settingsModal.hide();
        showSuccess('設定已儲存');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showError('儲存失敗');
    }
}

async function saveChatId() {
    const chatId = document.getElementById('setting-chat-id').value.trim();

    if (!chatId) {
        showError('請輸入 Chat ID');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/settings/chat-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Update failed');
        }

        showSuccess('Chat ID 已更新');
        loadStatus();
    } catch (error) {
        console.error('Failed to update Chat ID:', error);
        showError('更新失敗: ' + error.message);
    }
}

function startAutoRefresh() {
    setInterval(() => {
        if (currentCategory !== 'favorites' && !settingsModal._element.classList.contains('show')) {
            loadNews();
        }
    }, 60000);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        newsList.innerHTML = `
            <div class="col-12 text-center py-5" id="loading">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-3 text-muted">載入中...</p>
            </div>
        `;
    }
}

function showError(message) {
    document.getElementById('error-toast-body').textContent = message;
    errorToast.show();
}

function showSuccess(message) {
    document.getElementById('success-toast-body').textContent = message;
    successToast.show();
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
    if (!advice) return 'sentiment-neutral';
    const text = advice.toLowerCase();
    if (text.includes('買') || text.includes('漲') || text.includes('好') || text.includes('正面')) {
        return 'sentiment-positive';
    }
    if (text.includes('賣') || text.includes('跌') || text.includes('壞') || text.includes('負面') || text.includes('風險')) {
        return 'sentiment-negative';
    }
    return 'sentiment-neutral';
}

function getSentimentText(advice) {
    if (!advice) return '中性';
    const text = advice.toLowerCase();
    if (text.includes('買') || text.includes('漲') || text.includes('好') || text.includes('正面')) {
        return '看好';
    }
    if (text.includes('賣') || text.includes('跌') || text.includes('壞') || text.includes('負面') || text.includes('風險')) {
        return '看淡';
    }
    return '中性';
}

window.toggleFavorite = toggleFavorite;
