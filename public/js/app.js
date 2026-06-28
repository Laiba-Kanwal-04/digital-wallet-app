const API_URL = '/api';
let authToken = localStorage.getItem('token');
let currentUser = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '$0.00';
    return '$' + parseFloat(amount).toFixed(2);
}

function formatDateShort(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getInitials(name) {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) { console.log('Toast:', message); return; }
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ============================================
// API CALL
// ============================================

async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error('Server returned HTML instead of JSON.');
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Request failed');
        return result;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, checking auth token...');
    checkAuthAndLoad();
    setupGlobalSearch();
});

async function checkAuthAndLoad() {
    if (authToken) {
        try {
            const profile = await apiCall('/users/profile');
            currentUser = profile;
            hideLoading();
            updateUserAvatar();
            if (profile.role === 'admin') {
                await showAdminDashboard();
            } else {
                await showUserDashboard();
            }
        } catch (error) {
            console.error('Auth failed:', error);
            localStorage.removeItem('token');
            authToken = null;
            currentUser = null;
            hideLoading();
            showAuthSection();
        }
    } else {
        hideLoading();
        showAuthSection();
    }
}

function showAuthSection() {
    const authSection = document.getElementById('authSection');
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');
    if (authSection) {
        authSection.style.display = 'flex';
        authSection.style.justifyContent = 'center';
        authSection.style.alignItems = 'center';
        authSection.style.minHeight = '100vh';
    }
    if (userDashboard) userDashboard.style.display = 'none';
    if (adminDashboard) adminDashboard.style.display = 'none';
}

async function login(event) {
    event.preventDefault();
    showLoading();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        const data = await apiCall('/users/login', 'POST', { email, password });
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', authToken);
        showToast(`Welcome back, ${currentUser.name}!`, 'success');
        hideLoading();
        if (currentUser.role === 'admin') {
            await showAdminDashboard();
        } else {
            await showUserDashboard();
        }
    } catch (error) {
        console.error('Login error:', error);
        hideLoading();
        showToast('Login failed: ' + error.message, 'error');
    }
}

async function register(event) {
    event.preventDefault();
    showLoading();
    const userData = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        phone: document.getElementById('regPhone').value
    };
    try {
        const data = await apiCall('/users/register', 'POST', userData);
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', authToken);
        showToast('Registration successful! You received $100 bonus!', 'success');
        hideLoading();
        await showUserDashboard();
    } catch (error) {
        hideLoading();
        showToast('Registration failed: ' + error.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
    const authSection = document.getElementById('authSection');
    if (authSection) {
        authSection.style.display = 'flex';
        authSection.style.justifyContent = 'center';
        authSection.style.alignItems = 'center';
        authSection.style.minHeight = '100vh';
    }
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    document.querySelector('[data-tab="login"]')?.click();
    showToast('Logged out successfully', 'success');
}

function updateUserAvatar() {
    const avatarDiv = document.getElementById('userAvatar');
    const userNameSpan = document.getElementById('userName');
    if (avatarDiv && currentUser) {
        const initials = getInitials(currentUser.name);
        avatarDiv.textContent = initials;
        const colors = ['#667eea', '#48bb78', '#f56565', '#ed8936', '#4299e1', '#9f7aea', '#38b2ac', '#ecc94b'];
        avatarDiv.style.background = colors[currentUser.name.length % colors.length];
    }
    if (userNameSpan && currentUser) {
        userNameSpan.textContent = currentUser.name.split(' ')[0];
    }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

function setupGlobalSearch() {
    const searchContainer = document.querySelector('.header-search');
    if (!searchContainer) return;
    let searchInput = searchContainer.querySelector('input');
    let searchIcon = searchContainer.querySelector('.fa-search');
    if (!searchInput) {
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search transactions...';
        searchContainer.appendChild(searchInput);
    }
    if (!searchIcon) {
        searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search';
        searchContainer.insertBefore(searchIcon, searchInput);
    }
    searchIcon.style.cursor = 'pointer';
    const performSearch = () => {
        const searchTerm = searchInput.value;
        if (document.getElementById('userDashboard').style.display === 'flex') {
            const activePage = document.querySelector('#userDashboard .nav-item.active')?.dataset.page;
            if (activePage === 'transactions') {
                loadTransactions(searchTerm);
            } else {
                showToast('Search is available in Transactions page', 'info');
            }
        } else if (document.getElementById('adminDashboard').style.display === 'flex') {
            const activePage = document.querySelector('#adminDashboard [data-admin-page].active')?.dataset.adminPage;
            if (activePage === 'transactions') {
                loadAdminTransactions(searchTerm);
            } else {
                showToast('Search is available in All Transactions page', 'info');
            }
        }
    };
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    searchIcon.addEventListener('click', performSearch);
}

// ============================================
// NOTIFICATIONS
// ============================================

async function loadNotifications() {
    try {
        const notifications = await apiCall('/users/notifications');
        const unreadCount = notifications.filter(n => !n.is_read).length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        }
        window.notifications = notifications;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function toggleNotifications() {
    if (!window.notifications || window.notifications.length === 0) {
        showToast('No notifications', 'info');
        return;
    }
    const modalHtml = `
        <div class="form-modal" id="notificationsModal">
            <div class="form-container" style="max-width: 500px; max-height: 500px; overflow-y: auto;">
                <h3><i class="fas fa-bell"></i> Notifications</h3>
                ${window.notifications.map(n => `
                    <div class="notification-item" style="padding: 12px; border-bottom: 1px solid #e2e8f0; background: ${n.is_read ? '#f7fafc' : 'white'};">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <p style="margin: 0; ${!n.is_read ? 'font-weight: 600;' : ''}">${escapeHtml(n.message)}</p>
                                <small style="color: #a0aec0;">${new Date(n.created_at).toLocaleString()}</small>
                            </div>
                            ${!n.is_read ? `<button onclick="window.markNotificationRead(${n.id})" style="background: #667eea; border: none; padding: 5px 12px; border-radius: 5px; color: white; cursor: pointer; font-size: 12px;">Mark Read</button>` : '<i class="fas fa-check-circle" style="color: #48bb78;"></i>'}
                        </div>
                    </div>
                `).join('')}
                <div class="form-actions" style="margin-top: 15px;">
                    <button class="btn-cancel" onclick="window.closeModal()">Close</button>
                    <button class="btn-primary" onclick="window.markAllRead()">Mark All Read</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function markNotificationRead(id) {
    try {
        await apiCall(`/users/notifications/${id}/read`, 'PUT');
        await loadNotifications();
        closeModal();
        showToast('Notification marked as read', 'success');
    } catch (error) {
        showToast('Failed to mark as read', 'error');
    }
}

async function markAllRead() {
    try {
        for (const n of window.notifications) {
            if (!n.is_read) {
                await apiCall(`/users/notifications/${n.id}/read`, 'PUT');
            }
        }
        await loadNotifications();
        closeModal();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        showToast('Failed to mark all as read', 'error');
    }
}

// ============================================
// TRANSACTION MODALS
// ============================================

function showDepositModal() {
    const modalHtml = `
        <div class="form-modal" id="transactionModal">
            <div class="form-container">
                <h3><i class="fas fa-plus-circle"></i> Deposit Money</h3>
                <div class="form-group"><label>Amount ($)</label><input type="number" id="depositAmount" placeholder="Enter amount" step="0.01" autofocus></div>
                <div class="form-group"><label>Description (optional)</label><input type="text" id="depositDesc" placeholder="e.g., Salary deposit"></div>
                <div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">Cancel</button><button class="btn-submit" onclick="window.processDeposit()">Deposit</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showWithdrawModal() {
    const modalHtml = `
        <div class="form-modal" id="transactionModal">
            <div class="form-container">
                <h3><i class="fas fa-minus-circle"></i> Withdraw Money</h3>
                <div class="form-group"><label>Amount ($)</label><input type="number" id="withdrawAmount" placeholder="Enter amount" step="0.01" autofocus></div>
                <div class="form-group"><label>Description (optional)</label><input type="text" id="withdrawDesc" placeholder="e.g., ATM withdrawal"></div>
                <div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">Cancel</button><button class="btn-submit" onclick="window.processWithdraw()">Withdraw</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showTransferModal() {
    fetch(`${API_URL}/users/beneficiaries`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(beneficiaries => {
        const beneficiaryOptions = beneficiaries.map(b => 
            `<option value="${b.beneficiary_email}">${b.beneficiary_name} (${b.beneficiary_email})</option>`
        ).join('');
        const modalHtml = `
            <div class="form-modal" id="transactionModal">
                <div class="form-container">
                    <h3><i class="fas fa-paper-plane"></i> Send Money</h3>
                    <div class="form-group">
                        <label>Select Beneficiary</label>
                        <select id="transferBeneficiary" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <option value="">-- Select Beneficiary --</option>
                            ${beneficiaryOptions}
                            <option value="other">-- Enter New Email --</option>
                        </select>
                    </div>
                    <div class="form-group" id="manualEmailGroup" style="display:none;">
                        <label>Recipient Email</label>
                        <input type="email" id="transferEmail" placeholder="recipient@example.com" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    </div>
                    <div class="form-group"><label>Amount ($)</label><input type="number" id="transferAmount" placeholder="Enter amount" step="0.01" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                    <div class="form-group"><label>Category</label>
                        <select id="transferCategory" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <option value="Food">Food</option><option value="Shopping">Shopping</option><option value="Bills">Bills</option>
                            <option value="Entertainment">Entertainment</option><option value="Transport">Transport</option>
                            <option value="Healthcare">Healthcare</option><option value="Education">Education</option><option value="Others">Others</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Description (optional)</label><input type="text" id="transferDesc" placeholder="e.g., Dinner payment" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                    <div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">Cancel</button><button class="btn-submit" onclick="window.processTransfer()">Send</button></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('transferBeneficiary').addEventListener('change', function() {
            const manualGroup = document.getElementById('manualEmailGroup');
            if (this.value === 'other') {
                manualGroup.style.display = 'block';
                document.getElementById('transferEmail').required = true;
            } else {
                manualGroup.style.display = 'none';
                document.getElementById('transferEmail').required = false;
                document.getElementById('transferEmail').value = this.value;
            }
        });
    })
    .catch(() => {
        // Fallback modal without beneficiaries
        const modalHtml = `
            <div class="form-modal" id="transactionModal">
                <div class="form-container">
                    <h3><i class="fas fa-paper-plane"></i> Send Money</h3>
                    <div class="form-group"><label>Recipient Email</label><input type="email" id="transferEmail" placeholder="recipient@example.com" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                    <div class="form-group"><label>Amount ($)</label><input type="number" id="transferAmount" placeholder="Enter amount" step="0.01" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                    <div class="form-group"><label>Category</label>
                        <select id="transferCategory" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <option value="Food">Food</option><option value="Shopping">Shopping</option><option value="Bills">Bills</option>
                            <option value="Entertainment">Entertainment</option><option value="Transport">Transport</option>
                            <option value="Healthcare">Healthcare</option><option value="Education">Education</option><option value="Others">Others</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Description (optional)</label><input type="text" id="transferDesc" placeholder="e.g., Dinner payment" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                    <div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">Cancel</button><button class="btn-submit" onclick="window.processTransfer()">Send</button></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    });
}

async function processDeposit() {
    const amountInput = document.getElementById('depositAmount');
    if (!amountInput) return;
    const amount = parseFloat(amountInput.value);
    const description = document.getElementById('depositDesc')?.value || '';
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/transactions/deposit', 'POST', { amount, description });
        showToast(`Deposited $${amount.toFixed(2)} successfully!`, 'success');
        closeModal();
        await loadUserOverview();
        await loadNotifications();
    } catch (error) {
        showToast('Deposit failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function processWithdraw() {
    const amountInput = document.getElementById('withdrawAmount');
    if (!amountInput) return;
    const amount = parseFloat(amountInput.value);
    const description = document.getElementById('withdrawDesc')?.value || '';
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/transactions/withdraw', 'POST', { amount, description });
        showToast(`Withdrew $${amount.toFixed(2)} successfully!`, 'success');
        closeModal();
        await loadUserOverview();
        await loadNotifications();
    } catch (error) {
        showToast('Withdrawal failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function processTransfer() {
    const emailInput = document.getElementById('transferEmail');
    const amountInput = document.getElementById('transferAmount');
    if (!emailInput || !amountInput) return;
    const recipient_email = emailInput.value;
    const amount = parseFloat(amountInput.value);
    const description = document.getElementById('transferDesc')?.value || '';
    const category = document.getElementById('transferCategory')?.value || 'Others';
    if (!recipient_email || !amount || amount <= 0) {
        showToast('Please fill all fields correctly', 'error');
        return;
    }
    showLoading();
    try {
        const result = await apiCall('/transactions/transfer', 'POST', { recipient_email, amount, description, category });
        showToast(result.message, 'success');
        closeModal();
        await loadUserOverview();
        await loadNotifications();
    } catch (error) {
        showToast('Transfer failed: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeModal() {
    document.querySelectorAll('.form-modal').forEach(el => el.remove());
}

// ============================================
// USER DASHBOARD
// ============================================

async function showUserDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('userDashboard').style.display = 'flex';
    updateUserAvatar();
    await loadUserOverview();
    setupUserNavigation();
    await loadNotifications();
}

function setupUserNavigation() {
    document.querySelectorAll('#userDashboard .nav-item').forEach(item => {
        item.removeEventListener('click', handleUserNavClick);
        item.addEventListener('click', handleUserNavClick);
    });
}

function handleUserNavClick(e) {
    e.preventDefault();
    const page = this.dataset.page;
    document.querySelectorAll('#userDashboard .nav-item').forEach(nav => nav.classList.remove('active'));
    this.classList.add('active');
    document.querySelector('.header-search input').value = '';
    const pages = {
        'overview': loadUserOverview,
        'transactions': loadTransactions,
        'transfer': showTransferModal,
        'beneficiaries': loadBeneficiaries,
        'payments': loadPaymentMethods,
        'budgets': loadBudgets,
        'goals': loadGoals,
        'tickets': loadTickets,
        'profile': loadProfile
    };
    if (pages[page]) pages[page]();
}

async function loadUserOverview() {
    showLoading();
    try {
        const profile = await apiCall('/users/profile');
        const transactions = await apiCall('/transactions/history');
        
        const uniqueTransactions = [];
        const seenRefs = new Set();
        for (const t of transactions) {
            if (!seenRefs.has(t.reference)) {
                seenRefs.add(t.reference);
                uniqueTransactions.push(t);
            }
        }
        
        const totalSent = uniqueTransactions
            .filter(t => t.type === 'sent')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
            
        const totalReceived = uniqueTransactions
            .filter(t => t.type === 'received')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        // Categories for pie chart
        const categories = {
            'Food': 0,
            'Shopping': 0,
            'Bills': 0,
            'Entertainment': 0,
            'Transport': 0,
            'Healthcare': 0,
            'Education': 0,
            'Others': 0
        };
        
        const categoryKeywords = {
            'Food': ['food', 'restaurant', 'dinner', 'lunch', 'meal', 'cafe', 'coffee'],
            'Shopping': ['shopping', 'amazon', 'store', 'buy', 'purchase', 'mall', 'cloth'],
            'Bills': ['bill', 'electric', 'water', 'utility', 'gas', 'phone', 'internet'],
            'Entertainment': ['movie', 'netflix', 'game', 'spotify', 'music', 'cinema', 'concert'],
            'Transport': ['uber', 'taxi', 'fuel', 'petrol', 'bus', 'train', 'car'],
            'Healthcare': ['doctor', 'hospital', 'medicine', 'pharmacy', 'clinic'],
            'Education': ['course', 'book', 'university', 'college', 'tution']
        };
        
        // Include both 'sent' and 'withdraw' for spending categories
        uniqueTransactions.forEach(t => {
            if (t.type === 'sent' || t.type === 'withdraw') {
                const desc = (t.description || '').toLowerCase();
                let matched = false;
                
                for (const [category, keywords] of Object.entries(categoryKeywords)) {
                    if (keywords.some(k => desc.includes(k))) {
                        categories[category] += parseFloat(t.amount);
                        matched = true;
                        break;
                    }
                }
                
                if (!matched) {
                    categories['Others'] += parseFloat(t.amount);
                }
            }
        });
        
        // Prepare chart data - ONLY categories with spending > 0
        const chartCategories = [];
        const chartAmounts = [];
        const chartColors = [];
        
        const colorMap = {
            'Food': '#48bb78',
            'Shopping': '#f56565',
            'Bills': '#ed8936',
            'Entertainment': '#4299e1',
            'Transport': '#9f7aea',
            'Healthcare': '#e53e3e',
            'Education': '#38b2ac',
            'Others': '#a0aec0'
        };
        
        Object.keys(categories).forEach(key => {
            if (categories[key] > 0) {
                chartCategories.push(key);
                chartAmounts.push(categories[key]);
                chartColors.push(colorMap[key] || '#a0aec0');
            }
        });
        
        const hasSpending = chartCategories.length > 0;
        
        const html = `
            <div class="wallet-card">
                <div class="wallet-header">
                    <div><h3>Total Balance</h3><div class="wallet-balance">${formatCurrency(profile.balance)}</div></div>
                    <i class="fas fa-credit-card" style="font-size: 48px; opacity: 0.3;"></i>
                </div>
                <div class="wallet-address">Wallet ID: ${profile.id}</div>
            </div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-info"><h3>Total Sent</h3><div class="stat-value">${formatCurrency(totalSent)}</div></div><div class="stat-icon"><i class="fas fa-arrow-up"></i></div></div>
                <div class="stat-card"><div class="stat-info"><h3>Total Received</h3><div class="stat-value">${formatCurrency(totalReceived)}</div></div><div class="stat-icon"><i class="fas fa-arrow-down"></i></div></div>
                <div class="stat-card"><div class="stat-info"><h3>Total Transactions</h3><div class="stat-value">${uniqueTransactions.length}</div></div><div class="stat-icon"><i class="fas fa-exchange-alt"></i></div></div>
            </div>
            <div class="action-buttons">
                <button class="action-btn" onclick="window.showDepositModal()"><i class="fas fa-plus-circle"></i><span>Deposit</span></button>
                <button class="action-btn" onclick="window.showWithdrawModal()"><i class="fas fa-minus-circle"></i><span>Withdraw</span></button>
                <button class="action-btn" onclick="window.showTransferModal()"><i class="fas fa-paper-plane"></i><span>Send</span></button>
                <button class="action-btn" onclick="window.loadTransactions()"><i class="fas fa-history"></i><span>History</span></button>
            </div>
            <div class="charts-grid">
                <div class="chart-card">
                    <h3>Spending by Category</h3>
                    ${hasSpending ? '<canvas id="categoryChart" style="max-height: 300px; width: 100%;"></canvas>' : '<div style="text-align: center; padding: 40px; color: #a0aec0;">No spending data yet. Make some transactions!</div>'}
                </div>
                <div class="chart-card">
                    <h3>Balance Trend</h3>
                    <canvas id="balanceChart" style="max-height: 300px; width: 100%;"></canvas>
                </div>
            </div>
        `;
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
        
        // ✅ FIX: Create charts with proper data
        // Give a small delay for the DOM to render
        setTimeout(() => {
            // Create Category Chart (Pie)
            if (hasSpending && typeof createCategoryChart === 'function') {
                console.log('Creating category chart with:', { categories: chartCategories, amounts: chartAmounts });
                createCategoryChart({
                    categories: chartCategories,
                    amounts: chartAmounts
                });
            } else if (hasSpending) {
                console.warn('createCategoryChart function not found!');
                // Fallback - create chart directly
                const canvas = document.getElementById('categoryChart');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: chartCategories,
                            datasets: [{
                                data: chartAmounts,
                                backgroundColor: ['#667eea', '#48bb78', '#f56565', '#ed8936', '#4299e1', '#9f7aea', '#e53e3e', '#a0aec0'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: { position: 'bottom' },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                            const percentage = ((context.raw / total) * 100).toFixed(1);
                                            return context.label + ': $' + context.raw.toFixed(2) + ' (' + percentage + '%)';
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
            
            // Create Balance Chart (Line)
            if (typeof createBalanceChart === 'function') {
                let runningBalance = 0;
                const balanceHistory = [];
                const dateLabels = [];
                const sortedTransactions = [...uniqueTransactions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                
                let startBalance = profile.balance;
                sortedTransactions.forEach(t => {
                    if (t.type === 'sent' || t.type === 'withdraw') {
                        startBalance += parseFloat(t.amount);
                    } else if (t.type === 'received' || t.type === 'deposit') {
                        startBalance -= parseFloat(t.amount);
                    }
                });
                
                runningBalance = startBalance;
                
                if (sortedTransactions.length === 0) {
                    balanceHistory.push(profile.balance);
                    dateLabels.push('Today');
                } else {
                    sortedTransactions.forEach(t => {
                        if (t.type === 'sent' || t.type === 'withdraw') {
                            runningBalance -= parseFloat(t.amount);
                        } else if (t.type === 'received' || t.type === 'deposit') {
                            runningBalance += parseFloat(t.amount);
                        }
                        balanceHistory.push(runningBalance);
                        dateLabels.push(formatDateShort(t.created_at));
                    });
                }
                
                console.log('Creating balance chart with:', { labels: dateLabels, balances: balanceHistory });
                createBalanceChart({
                    labels: dateLabels,
                    balances: balanceHistory
                });
            } else {
                console.warn('createBalanceChart function not found!');
            }
        }, 100); // Small delay for DOM render
        
        hideLoading();
    } catch (error) {
        console.error('Error loading overview:', error);
        showToast('Failed to load dashboard: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================
// TRANSACTIONS HISTORY
// ============================================

async function loadTransactions(searchTerm = '') {
    showLoading();
    try {
        const transactions = await apiCall('/transactions/history');
        let filtered = transactions;
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filtered = transactions.filter(t => 
                (t.counterparty && t.counterparty.toLowerCase().includes(term)) ||
                (t.description && t.description.toLowerCase().includes(term)) ||
                t.type.toLowerCase().includes(term) ||
                (t.reference && t.reference.toLowerCase().includes(term))
            );
        }
        const unique = [];
        const seen = new Set();
        filtered.forEach(t => {
            if (!seen.has(t.reference)) { seen.add(t.reference); unique.push(t); }
        });
        if (unique.length === 0) {
            document.getElementById('dashboardContent').innerHTML = `
                <div class="transactions-list">
                    <h3 style="margin-bottom: 20px;">Transaction History</h3>
                    ${searchTerm ? 
                        `<div style="text-align: center; padding: 60px 20px;">
                            <i class="fas fa-search" style="font-size: 48px; color: #a0aec0; margin-bottom: 20px;"></i>
                            <p style="color: #a0aec0;">No transactions found matching "${escapeHtml(searchTerm)}"</p>
                            <button onclick="window.loadTransactions()" class="btn-primary" style="margin-top: 20px; width: auto; padding: 10px 20px;">Clear Search</button>
                        </div>` :
                        `<div style="text-align: center; padding: 60px 20px;">
                            <i class="fas fa-exchange-alt" style="font-size: 48px; color: #a0aec0; margin-bottom: 20px;"></i>
                            <p style="color: #a0aec0;">No transactions yet</p>
                        </div>`
                    }
                </div>
            `;
            hideLoading();
            return;
        }
        const html = `
            <div class="transactions-list">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="margin: 0;">Transaction History</h3>
                    ${searchTerm ? 
                        `<div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px;">
                                <i class="fas fa-search"></i> Results for: "${escapeHtml(searchTerm)}"
                            </span>
                            <button onclick="window.loadTransactions()" class="btn-primary" style="padding: 5px 15px; width: auto; background: #a0aec0;">Clear</button>
                        </div>` : ''
                    }
                </div>
                ${unique.map(t => {
                    let icon = 'exchange-alt', title = '', colorClass = '', amountDisplay = '';
                    if (t.type === 'deposit') { icon = 'arrow-down'; title = 'Deposit'; colorClass = 'credit'; amountDisplay = `+${formatCurrency(t.amount)}`; }
                    else if (t.type === 'withdraw') { icon = 'arrow-up'; title = 'Withdrawal'; colorClass = 'debit'; amountDisplay = `-${formatCurrency(t.amount)}`; }
                    else if (t.type === 'sent') { icon = 'paper-plane'; title = `Sent to ${t.counterparty || 'Unknown'}`; colorClass = 'debit'; amountDisplay = `-${formatCurrency(t.amount)}`; }
                    else if (t.type === 'received') { icon = 'gift'; title = `Received from ${t.counterparty || 'Unknown'}`; colorClass = 'credit'; amountDisplay = `+${formatCurrency(t.amount)}`; }
                    return `
                        <div class="transaction-item">
                            <div class="transaction-icon"><i class="fas fa-${icon}"></i></div>
                            <div class="transaction-details">
                                <div class="transaction-title">${escapeHtml(title)}</div>
                                <div class="transaction-date">${new Date(t.created_at).toLocaleString()}</div>
                                ${t.description ? `<div class="transaction-date">📝 ${escapeHtml(t.description)}</div>` : ''}
                            </div>
                            <div class="transaction-amount ${colorClass}">${amountDisplay}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Failed to load transactions: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================
// PAYMENT METHODS
// ============================================

async function loadPaymentMethods() {
    showLoading();
    try {
        const methods = await apiCall('/users/payment-methods');
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">💳 Payment Methods</h3>
                <button onclick="window.showAddPaymentModal()" class="btn-primary" style="margin-bottom: 20px;"><i class="fas fa-plus"></i> Add Payment Method</button>
                ${methods.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No payment methods saved yet.</div>' :
                    methods.map(m => `
                        <div class="transaction-item" style="${m.is_default ? 'border-left: 4px solid #667eea;' : ''}">
                            <div class="transaction-icon"><i class="fas fa-credit-card"></i></div>
                            <div class="transaction-details">
                                <div class="transaction-title">${m.card_brand.toUpperCase()} •••• ${m.card_last4}</div>
                                <div class="transaction-date">Added ${new Date(m.created_at).toLocaleDateString()}</div>
                                ${m.is_default ? '<span style="background: #667eea; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px;">Default</span>' : ''}
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading payment methods:', error);
        showToast('Failed to load payment methods: ' + error.message, 'error');
        hideLoading();
    }
}

function showAddPaymentModal() {
    const modalHtml = `
        <div class="form-modal" id="paymentModal">
            <div class="form-container">
                <h3><i class="fas fa-credit-card"></i> Add Payment Method</h3>
                <div class="form-group"><label>Card Brand</label>
                    <select id="paymentBrand" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">American Express</option>
                    </select>
                </div>
                <div class="form-group"><label>Last 4 Digits</label><input type="text" id="paymentLast4" placeholder="1234" maxlength="4" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                <div class="form-group"><label><input type="checkbox" id="paymentDefault"> Set as default</label></div>
                <div class="form-actions"><button class="btn-cancel" onclick="window.closePaymentModal()">Cancel</button><button class="btn-submit" onclick="window.addPaymentMethod()">Add Card</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function addPaymentMethod() {
    const card_brand = document.getElementById('paymentBrand')?.value;
    const card_last4 = document.getElementById('paymentLast4')?.value;
    const is_default = document.getElementById('paymentDefault')?.checked || false;
    if (!card_last4 || card_last4.length !== 4 || !/^\d{4}$/.test(card_last4)) {
        showToast('Please enter valid last 4 digits', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/users/payment-methods', 'POST', { card_brand, card_last4, is_default });
        showToast('Payment method added successfully!', 'success');
        closePaymentModal();
        await loadPaymentMethods();
    } catch (error) {
        showToast('Failed to add payment method: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closePaymentModal() {
    document.getElementById('paymentModal')?.remove();
}

// ============================================
// BUDGETS
// ============================================

async function loadBudgets() {
    showLoading();
    try {
        const budgets = await apiCall('/users/budgets');
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">📊 Monthly Budgets</h3>
                <button onclick="window.showAddBudgetModal()" class="btn-primary" style="margin-bottom: 20px;"><i class="fas fa-plus"></i> Set Budget</button>
                ${!budgets || budgets.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No budgets set yet.</div>' :
                    budgets.map(b => {
                        const spent = parseFloat(b.spent) || 0;
                        const amount = parseFloat(b.amount) || 1;
                        const percentage = Math.min((spent / amount) * 100, 100);
                        const color = percentage > 90 ? '#e53e3e' : percentage > 70 ? '#ed8936' : '#48bb78';
                        return `
                            <div class="transaction-item">
                                <div class="transaction-icon"><i class="fas ${b.icon || 'fa-tag'}"></i></div>
                                <div class="transaction-details" style="flex:1;">
                                    <div class="transaction-title">${escapeHtml(b.category_name)}</div>
                                    <div style="margin: 8px 0;">
                                        <div style="background: #edf2f7; height: 8px; border-radius: 4px; overflow: hidden;">
                                            <div style="height: 100%; width: ${percentage}%; background: ${color}; border-radius: 4px; transition: width 0.3s;"></div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                                            <span>Spent: $${spent.toFixed(2)}</span>
                                            <span>Budget: $${amount.toFixed(2)}</span>
                                            <span style="color: ${color};">${percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading budgets:', error);
        showToast('Failed to load budgets: ' + error.message, 'error');
        hideLoading();
    }
}

function showAddBudgetModal() {
    fetch('/api/users/categories', { headers: { 'Authorization': `Bearer ${authToken}` } })
    .then(res => res.json())
    .then(categories => {
        const modalHtml = `
            <div class="form-modal" id="budgetModal">
                <div class="form-container">
                    <h3><i class="fas fa-chart-pie"></i> Set Monthly Budget</h3>
                    <div class="form-group"><label>Category</label>
                        <select id="budgetCategory" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Amount ($)</label><input type="number" id="budgetAmount" placeholder="Enter amount" step="0.01" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                    <div class="form-actions"><button class="btn-cancel" onclick="window.closeBudgetModal()">Cancel</button><button class="btn-submit" onclick="window.addBudget()">Set Budget</button></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    })
    .catch(() => showToast('Failed to load categories', 'error'));
}

async function addBudget() {
    const category_name = document.getElementById('budgetCategory')?.value;
    const amount = parseFloat(document.getElementById('budgetAmount')?.value);
    if (!category_name || !amount || amount <= 0) {
        showToast('Please fill all fields correctly', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/users/budgets', 'POST', { category_name, amount });
        showToast('Budget set successfully!', 'success');
        closeBudgetModal();
        await loadBudgets();
    } catch (error) {
        showToast('Failed to set budget: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeBudgetModal() {
    document.getElementById('budgetModal')?.remove();
}

// ============================================
// GOALS
// ============================================

async function loadGoals() {
    showLoading();
    try {
        const goals = await apiCall('/users/goals');
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">🎯 Financial Goals</h3>
                <button onclick="window.showAddGoalModal()" class="btn-primary" style="margin-bottom: 20px;"><i class="fas fa-plus"></i> New Goal</button>
                ${!goals || goals.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No goals set yet.</div>' :
                    goals.map(g => {
                        const current = parseFloat(g.current_amount) || 0;
                        const target = parseFloat(g.target_amount) || 1;
                        const percentage = Math.min((current / target) * 100, 100);
                        return `
                            <div class="transaction-item" style="${g.status === 'completed' ? 'border-left: 4px solid #48bb78;' : ''}">
                                <div class="transaction-icon"><i class="fas fa-bullseye"></i></div>
                                <div class="transaction-details" style="flex:1;">
                                    <div class="transaction-title">${escapeHtml(g.name)} 
                                        <span style="font-size: 12px; background: ${g.status === 'completed' ? '#48bb78' : '#ed8936'}; color: white; padding: 2px 10px; border-radius: 12px;">${g.status || 'active'}</span>
                                    </div>
                                    <div style="margin: 8px 0;">
                                        <div style="background: #edf2f7; height: 8px; border-radius: 4px; overflow: hidden;">
                                            <div style="height: 100%; width: ${percentage}%; background: #667eea; border-radius: 4px; transition: width 0.3s;"></div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                                            <span>$${current.toFixed(2)} saved</span>
                                            <span>Target: $${target.toFixed(2)}</span>
                                            <span>${percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    ${g.deadline ? `<div style="font-size: 12px; color: #718096;">📅 Deadline: ${new Date(g.deadline).toLocaleDateString()}</div>` : ''}
                                    <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                                        <input type="number" id="goalProgress_${g.id}" placeholder="Add amount" step="0.01" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; width: 150px;">
                                        <button onclick="window.updateGoalProgress(${g.id})" class="btn-primary" style="padding: 6px 15px; width: auto;">Update</button>
                                        <button onclick="window.deleteGoal(${g.id})" style="background: #f56565; border: none; padding: 6px 15px; border-radius: 6px; color: white; cursor: pointer;">Delete</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading goals:', error);
        showToast('Failed to load goals: ' + error.message, 'error');
        hideLoading();
    }
}

function showAddGoalModal() {
    const modalHtml = `
        <div class="form-modal" id="goalModal">
            <div class="form-container">
                <h3><i class="fas fa-bullseye"></i> Create Financial Goal</h3>
                <div class="form-group"><label>Goal Name</label><input type="text" id="goalName" placeholder="e.g., Vacation Fund" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                <div class="form-group"><label>Target Amount ($)</label><input type="number" id="goalTarget" placeholder="Enter amount" step="0.01" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                <div class="form-group"><label>Deadline (optional)</label><input type="date" id="goalDeadline" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                <div class="form-actions"><button class="btn-cancel" onclick="window.closeGoalModal()">Cancel</button><button class="btn-submit" onclick="window.createGoal()">Create Goal</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function createGoal() {
    const name = document.getElementById('goalName')?.value;
    const target_amount = parseFloat(document.getElementById('goalTarget')?.value);
    const deadline = document.getElementById('goalDeadline')?.value || null;
    if (!name || !target_amount || target_amount <= 0) {
        showToast('Please fill all fields correctly', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/users/goals', 'POST', { name, target_amount, deadline });
        showToast('Goal created successfully!', 'success');
        closeGoalModal();
        await loadGoals();
    } catch (error) {
        showToast('Failed to create goal: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function updateGoalProgress(goalId) {
    const input = document.getElementById(`goalProgress_${goalId}`);
    if (!input) return;
    const current_amount = parseFloat(input.value);
    if (!current_amount || current_amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall(`/users/goals/${goalId}/progress`, 'PUT', { current_amount });
        showToast('Progress updated!', 'success');
        input.value = '';
        await loadGoals();
    } catch (error) {
        showToast('Failed to update progress: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Delete this goal?')) return;
    showLoading();
    try {
        await apiCall(`/users/goals/${goalId}`, 'DELETE');
        showToast('Goal deleted!', 'success');
        await loadGoals();
    } catch (error) {
        showToast('Failed to delete goal: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeGoalModal() {
    document.getElementById('goalModal')?.remove();
}

// ============================================
// SUPPORT TICKETS (USER)
// ============================================

async function loadTickets() {
    showLoading();
    try {
        const tickets = await apiCall('/users/tickets');
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">🎫 Support Tickets</h3>
                <button onclick="window.showAddTicketModal()" class="btn-primary" style="margin-bottom: 20px;"><i class="fas fa-plus"></i> New Ticket</button>
                ${tickets.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No support tickets yet.</div>' :
                    tickets.map(t => `
                        <div class="transaction-item" style="border-left: 4px solid ${t.status === 'open' ? '#ed8936' : t.status === 'resolved' ? '#48bb78' : '#a0aec0'};">
                            <div class="transaction-icon"><i class="fas fa-life-ring"></i></div>
                            <div class="transaction-details">
                                <div class="transaction-title">#${t.id} - ${escapeHtml(t.subject)}</div>
                                <div class="transaction-date">${new Date(t.created_at).toLocaleString()}</div>
                                <div style="margin-top: 8px;">${escapeHtml(t.message)}</div>
                                <div style="margin-top: 5px;">
                                    <span style="background: ${t.status === 'open' ? '#fefcbf' : t.status === 'resolved' ? '#c6f6d5' : '#edf2f7'}; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${t.status}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading tickets:', error);
        showToast('Failed to load tickets: ' + error.message, 'error');
        hideLoading();
    }
}

function showAddTicketModal() {
    const modalHtml = `
        <div class="form-modal" id="ticketModal">
            <div class="form-container">
                <h3><i class="fas fa-life-ring"></i> Create Support Ticket</h3>
                <div class="form-group"><label>Subject</label><input type="text" id="ticketSubject" placeholder="Brief subject" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>
                <div class="form-group"><label>Message</label><textarea id="ticketMessage" placeholder="Describe your issue..." rows="4" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></textarea></div>
                <div class="form-actions"><button class="btn-cancel" onclick="window.closeTicketModal()">Cancel</button><button class="btn-submit" onclick="window.createTicket()">Submit</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function createTicket() {
    const subject = document.getElementById('ticketSubject')?.value;
    const message = document.getElementById('ticketMessage')?.value;
    if (!subject || !message) {
        showToast('Please fill all fields', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/users/tickets', 'POST', { subject, message });
        showToast('Ticket created successfully!', 'success');
        closeTicketModal();
        await loadTickets();
    } catch (error) {
        showToast('Failed to create ticket: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeTicketModal() {
    document.getElementById('ticketModal')?.remove();
}

// ============================================
// BENEFICIARIES
// ============================================

async function loadBeneficiaries() {
    showLoading();
    try {
        const beneficiaries = await apiCall('/users/beneficiaries');
        const html = `
            <div class="transactions-list">
                <h3>My Beneficiaries</h3>
                ${beneficiaries.length === 0 ? 
                    '<div style="text-align: center; padding: 40px;">No beneficiaries added yet.</div>' :
                    beneficiaries.map(b => `
                        <div class="transaction-item">
                            <div class="transaction-icon"><i class="fas fa-user-friends"></i></div>
                            <div class="transaction-details">
                                <div class="transaction-title">${escapeHtml(b.beneficiary_name)}</div>
                                <div class="transaction-date">${escapeHtml(b.beneficiary_email)}</div>
                                ${b.is_favorite ? '<div class="transaction-date">⭐ Favorite</div>' : ''}
                            </div>
                            <button onclick="window.deleteBeneficiary(${b.id})" style="background:#f56565; border: none; padding: 8px 15px; border-radius: 8px; color: white; cursor: pointer;">Remove</button>
                        </div>
                    `).join('')
                }
                <button onclick="window.showAddBeneficiary()" class="btn-primary" style="margin-top: 20px;"><i class="fas fa-plus"></i> Add Beneficiary</button>
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading beneficiaries:', error);
        showToast('Failed to load beneficiaries: ' + error.message, 'error');
        hideLoading();
    }
}

function showAddBeneficiary() {
    const modalHtml = `
        <div class="form-modal" id="beneficiaryModal">
            <div class="form-container">
                <h3><i class="fas fa-user-plus"></i> Add Beneficiary</h3>
                <div class="form-group"><label>Name</label><input type="text" id="beneficiaryName" placeholder="Full name"></div>
                <div class="form-group"><label>Email</label><input type="email" id="beneficiaryEmail" placeholder="Email address"></div>
                <div class="form-actions"><button class="btn-cancel" onclick="window.closeBeneficiaryModal()">Cancel</button><button class="btn-submit" onclick="window.addBeneficiary()">Add</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function addBeneficiary() {
    const name = document.getElementById('beneficiaryName')?.value;
    const email = document.getElementById('beneficiaryEmail')?.value;
    if (!name || !email) {
        showToast('Please fill all fields', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall('/users/beneficiaries', 'POST', { beneficiary_name: name, beneficiary_email: email, is_favorite: false });
        showToast('Beneficiary added successfully!', 'success');
        closeBeneficiaryModal();
        await loadBeneficiaries();
    } catch (error) {
        showToast('Failed to add beneficiary: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeBeneficiaryModal() {
    document.getElementById('beneficiaryModal')?.remove();
}

async function deleteBeneficiary(id) {
    if (!confirm('Remove this beneficiary?')) return;
    showLoading();
    try {
        await apiCall(`/users/beneficiaries/${id}`, 'DELETE');
        showToast('Beneficiary removed', 'success');
        await loadBeneficiaries();
    } catch (error) {
        showToast('Failed to remove beneficiary: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// PROFILE
// ============================================

async function loadProfile() {
    showLoading();
    try {
        const profile = await apiCall('/users/profile');
        const html = `
            <div class="form-container" style="margin: 0 auto; max-width: 500px;">
                <h3><i class="fas fa-user-circle"></i> My Profile</h3>
                <div class="form-group"><label>Name</label><input type="text" id="profileName" value="${escapeHtml(profile.name)}" class="form-control"></div>
                <div class="form-group"><label>Email</label><input type="email" id="profileEmail" value="${escapeHtml(profile.email)}" disabled class="form-control"></div>
                <div class="form-group"><label>Phone</label><input type="tel" id="profilePhone" value="${escapeHtml(profile.phone || '')}" placeholder="Phone number" class="form-control"></div>
                <div class="form-group"><label>Address</label><input type="text" id="profileAddress" value="${escapeHtml(profile.address || '')}" placeholder="Address" class="form-control"></div>
                <div class="form-group"><label>City</label><input type="text" id="profileCity" value="${escapeHtml(profile.city || '')}" placeholder="City" class="form-control"></div>
                <div class="form-group"><label>Country</label><input type="text" id="profileCountry" value="${escapeHtml(profile.country || '')}" placeholder="Country" class="form-control"></div>
                <button onclick="window.updateProfile()" class="btn-primary">Update Profile</button>
            </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Failed to load profile: ' + error.message, 'error');
        hideLoading();
    }
}

async function updateProfile() {
    const data = {
        phone: document.getElementById('profilePhone')?.value || '',
        address: document.getElementById('profileAddress')?.value || '',
        city: document.getElementById('profileCity')?.value || '',
        country: document.getElementById('profileCountry')?.value || ''
    };
    showLoading();
    try {
        await apiCall('/users/profile', 'PUT', data);
        showToast('Profile updated successfully!', 'success');
        await loadProfile();
    } catch (error) {
        showToast('Failed to update profile: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

async function showAdminDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    document.getElementById('adminName').innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUser.name.split(' ')[0]}`;
    await loadAdminOverview();
    setupAdminNavigation();
}

function setupAdminNavigation() {
    document.querySelectorAll('#adminDashboard [data-admin-page]').forEach(item => {
        item.removeEventListener('click', handleAdminNavClick);
        item.addEventListener('click', handleAdminNavClick);
    });
}

function handleAdminNavClick(e) {
    e.preventDefault();
    const page = this.dataset.adminPage;
    document.querySelectorAll('#adminDashboard [data-admin-page]').forEach(nav => nav.classList.remove('active'));
    this.classList.add('active');
    document.querySelector('.header-search input').value = '';
    const pages = {
        'overview': loadAdminOverview,
        'users': loadAdminUsers,
        'transactions': loadAdminTransactions,
        'analytics': loadAdminAnalytics,
        'tickets': loadAdminTickets
    };
    if (pages[page]) pages[page]();
}

async function loadAdminOverview() {
    showLoading();
    try {
        const stats = await apiCall('/admin/stats');
        const html = `
            <div class="admin-overview">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-info"><h3>Total Users</h3><div class="stat-value">${stats.summary.total_users}</div><small>🟢 ${stats.summary.active_users} active</small></div><div class="stat-icon"><i class="fas fa-users"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Total Transactions</h3><div class="stat-value">${stats.summary.total_transactions.toLocaleString()}</div><small>📊 All time</small></div><div class="stat-icon"><i class="fas fa-exchange-alt"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Total Volume</h3><div class="stat-value">${formatCurrency(stats.summary.total_volume)}</div><small>💰 All transactions</small></div><div class="stat-icon"><i class="fas fa-chart-line"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Total Balance</h3><div class="stat-value">${formatCurrency(stats.summary.total_balance)}</div><small>💎 Across all users</small></div><div class="stat-icon"><i class="fas fa-wallet"></i></div></div>
                </div>
                <div class="stats-grid" style="margin-top: 20px;">
                    <div class="stat-card"><div class="stat-info"><h3>Blocked Users</h3><div class="stat-value">${stats.summary.blocked_users}</div></div><div class="stat-icon"><i class="fas fa-ban"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Active Rate</h3><div class="stat-value">${stats.summary.total_users > 0 ? Math.round((stats.summary.active_users / stats.summary.total_users) * 100) : 0}%</div></div><div class="stat-icon"><i class="fas fa-chart-simple"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Avg Transaction</h3><div class="stat-value">${stats.summary.total_transactions > 0 ? formatCurrency(stats.summary.total_volume / stats.summary.total_transactions) : '$0'}</div></div><div class="stat-icon"><i class="fas fa-calculator"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>System Health</h3><div class="stat-value">🟢 Online</div></div><div class="stat-icon"><i class="fas fa-heartbeat"></i></div></div>
                </div>
            </div>
        `;
        document.getElementById('adminContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showToast('Failed to load admin dashboard: ' + error.message, 'error');
        hideLoading();
    }
}

async function loadAdminUsers() {
    showLoading();
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Failed to load users');
        const users = await response.json();
        if (!users || users.length === 0) {
            document.getElementById('adminContent').innerHTML = `<div class="transactions-list"><h3>User Management</h3><div style="text-align:center;padding:40px;">No users found.</div></div>`;
            hideLoading();
            return;
        }
        const html = `
            <div class="user-management">
                <h3 style="margin-bottom:20px;">User Management</h3>
                ${users.map(user => `
                    <div class="user-card" style="background:white;border-radius:15px;padding:20px;margin-bottom:15px;cursor:pointer;" onclick="viewUserDetails(${user.id})">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <i class="fas fa-user-circle" style="font-size:40px;color:#667eea;"></i>
                                    <div>
                                        <h4 style="margin:0;">${escapeHtml(user.name)}</h4>
                                        <p style="margin:5px 0;color:#718096;">${escapeHtml(user.email)}</p>
                                    </div>
                                </div>
                                <div style="margin-top:10px;">
                                    <span style="background:${user.status === 'active' ? '#48bb78' : '#f56565'};color:white;padding:3px 10px;border-radius:12px;font-size:12px;">${user.status === 'active' ? '🟢 Active' : '🔴 Blocked'}</span>
                                    <span style="margin-left:10px;font-weight:bold;">Balance: ${formatCurrency(user.balance)}</span>
                                </div>
                            </div>
                            <div><i class="fas fa-chevron-right" style="color:#a0aec0;"></i></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('adminContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users: ' + error.message, 'error');
        hideLoading();
    }
}

async function loadAdminTransactions(searchTerm = '') {
    showLoading();
    try {
        const transactions = await apiCall('/admin/transactions');
        let filtered = transactions;
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filtered = transactions.filter(t => 
                (t.sender_name && t.sender_name.toLowerCase().includes(term)) ||
                (t.recipient_name && t.recipient_name.toLowerCase().includes(term)) ||
                (t.type && t.type.toLowerCase().includes(term)) ||
                (t.description && t.description.toLowerCase().includes(term))
            );
        }
        const html = `
            <div class="transactions-list">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
                    <h3 style="margin:0;">All Transactions</h3>
                    ${searchTerm ? `<div><span style="background:#667eea;color:white;padding:5px 12px;border-radius:20px;font-size:12px;"><i class="fas fa-search"></i> Results for: "${escapeHtml(searchTerm)}"</span><button onclick="window.loadAdminTransactions()" style="background:#a0aec0;padding:5px 15px;border:none;border-radius:8px;color:white;cursor:pointer;margin-left:10px;">Clear</button></div>` : ''}
                </div>
                ${filtered.length === 0 ? 
                    `<div style="text-align:center;padding:60px 20px;"><i class="fas fa-search" style="font-size:48px;color:#a0aec0;margin-bottom:20px;"></i><p style="color:#a0aec0;">No transactions found</p></div>` :
                    filtered.map(t => `
                        <div class="transaction-item">
                            <div><strong style="text-transform:uppercase;">${t.type}</strong><br>Amount: ${formatCurrency(t.amount)}<br>Sender: ${escapeHtml(t.sender_name || 'N/A')}<br>Recipient: ${escapeHtml(t.recipient_name || 'N/A')}${t.description ? `<br>Note: ${escapeHtml(t.description)}` : ''}<div style="font-size:10px;color:#a0aec0;margin-top:5px;">Ref: ${t.reference}</div></div>
                            <div>${new Date(t.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        document.getElementById('adminContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Failed to load transactions: ' + error.message, 'error');
        hideLoading();
    }
}

async function loadAdminAnalytics() {
    showLoading();
    try {
        const stats = await apiCall('/admin/stats');
        const html = `
            <div class="analytics-dashboard">
                <h2 style="margin-bottom:20px;color:white;"><i class="fas fa-chart-line"></i> Analytics Dashboard</h2>
                <div class="charts-grid">
                    <div class="chart-card"><h3><i class="fas fa-chart-line"></i> Daily Activity</h3><canvas id="dailyActivityChart" style="max-height:300px;"></canvas></div>
                    <div class="chart-card"><h3><i class="fas fa-chart-pie"></i> Transaction Distribution</h3><canvas id="typeDistributionChart" style="max-height:300px;"></canvas></div>
                </div>
                <div class="charts-grid">
                    <div class="chart-card"><h3><i class="fas fa-chart-bar"></i> Monthly Volume Trend</h3><canvas id="monthlyVolumeChart" style="max-height:300px;"></canvas></div>
                </div>
                <div class="stats-grid" style="margin-top:20px;">
                    <div class="stat-card"><div class="stat-info"><h3>Total Users</h3><div class="stat-value">${stats.summary?.total_users || 0}</div><small>${stats.summary?.active_users || 0} active</small></div><div class="stat-icon"><i class="fas fa-users"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Total Transactions</h3><div class="stat-value">${stats.summary?.total_transactions || 0}</div></div><div class="stat-icon"><i class="fas fa-exchange-alt"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Total Volume</h3><div class="stat-value">${formatCurrency(stats.summary?.total_volume || 0)}</div></div><div class="stat-icon"><i class="fas fa-chart-line"></i></div></div>
                    <div class="stat-card"><div class="stat-info"><h3>Total Balance</h3><div class="stat-value">${formatCurrency(stats.summary?.total_balance || 0)}</div></div><div class="stat-icon"><i class="fas fa-wallet"></i></div></div>
                </div>
            </div>
        `;
        document.getElementById('adminContent').innerHTML = html;
        
        // Charts
        const dailyCtx = document.getElementById('dailyActivityChart')?.getContext('2d');
        if (dailyCtx && stats.daily_activity?.length > 0) {
            const dates = stats.daily_activity.map(d => new Date(d.date).toLocaleDateString()).reverse();
            const amounts = stats.daily_activity.map(d => parseFloat(d.total)).reverse();
            new Chart(dailyCtx, { type: 'line', data: { labels: dates, datasets: [{ label: 'Volume ($)', data: amounts, borderColor: '#667eea', tension: 0.4, fill: true }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } } } });
        }
        const pieCtx = document.getElementById('typeDistributionChart')?.getContext('2d');
        if (pieCtx && stats.type_distribution?.length > 0) {
            new Chart(pieCtx, { type: 'doughnut', data: { labels: stats.type_distribution.map(t => t.type.toUpperCase()), datasets: [{ data: stats.type_distribution.map(t => parseInt(t.count)), backgroundColor: ['#48bb78', '#f56565', '#ed8936', '#4299e1'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
        }
        const monthlyCtx = document.getElementById('monthlyVolumeChart')?.getContext('2d');
        if (monthlyCtx && stats.monthly_summary?.length > 0) {
            const months = stats.monthly_summary.map(m => { const [y, mo] = m.month.split('-'); return new Date(parseInt(y), parseInt(mo)-1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }).reverse();
            const deposits = stats.monthly_summary.map(m => parseFloat(m.total_deposits)).reverse();
            const withdrawals = stats.monthly_summary.map(m => parseFloat(m.total_withdrawals)).reverse();
            new Chart(monthlyCtx, { type: 'bar', data: { labels: months, datasets: [{ label: 'Deposits', data: deposits, backgroundColor: '#48bb78' }, { label: 'Withdrawals', data: withdrawals, backgroundColor: '#f56565' }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } } } });
        }
        hideLoading();
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Failed to load analytics: ' + error.message, 'error');
        hideLoading();
    }
}

// ============================================
// ADMIN SUPPORT TICKETS
// ============================================

async function loadAdminTickets() {
    showLoading();
    try {
        const response = await fetch('/api/admin/tickets', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Failed to load tickets');
        const tickets = await response.json();
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom:20px;">🎫 Support Tickets</h3>
                ${tickets.length === 0 ? 
                    '<div style="text-align:center;padding:40px;color:#a0aec0;">No support tickets yet.</div>' :
                    tickets.map(t => `
                        <div class="ticket-item ${t.status}" style="background:white;padding:16px;border-radius:10px;margin-bottom:12px;border-left:4px solid ${t.status === 'open' ? '#ed8936' : t.status === 'in_progress' ? '#4299e1' : t.status === 'resolved' ? '#48bb78' : '#a0aec0'};">
                            <div style="display:flex;justify-content:space-between;align-items:start;">
                                <div>
                                    <h4 style="margin:0;">#${t.id} - ${escapeHtml(t.subject)}</h4>
                                    <small>From: ${escapeHtml(t.user_name)} (${escapeHtml(t.user_email)})</small>
                                    <p style="margin:8px 0;">${escapeHtml(t.message)}</p>
                                    <small>${new Date(t.created_at).toLocaleString()}</small>
                                </div>
                                <div style="text-align:right;">
                                    <span style="background:${t.status === 'open' ? '#fefcbf' : t.status === 'in_progress' ? '#bee3f8' : t.status === 'resolved' ? '#c6f6d5' : '#edf2f7'};padding:2px 10px;border-radius:12px;font-size:12px;">${t.status}</span>
                                    <div style="margin-top:8px;">
                                        <select id="ticketStatus_${t.id}" style="padding:4px 8px;border-radius:4px;border:1px solid #e2e8f0;">
                                            <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                                            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                            <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>Closed</option>
                                        </select>
                                        <button onclick="window.updateTicketStatus(${t.id})" style="background:#667eea;border:none;padding:4px 12px;border-radius:4px;color:white;cursor:pointer;">Update</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        document.getElementById('adminContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading tickets:', error);
        showToast('Failed to load tickets: ' + error.message, 'error');
        hideLoading();
    }
}

async function updateTicketStatus(ticketId) {
    const select = document.getElementById(`ticketStatus_${ticketId}`);
    if (!select) return;
    const status = select.value;
    showLoading();
    try {
        const response = await fetch(`/api/admin/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error('Failed to update ticket');
        showToast('Ticket status updated!', 'success');
        await loadAdminTickets();
    } catch (error) {
        showToast('Failed to update ticket: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// USER DETAILS (Admin)
// ============================================

async function viewUserDetails(userId) {
    showLoading();
    try {
        const userData = await apiCall(`/admin/users/${userId}`);
        const html = `
            <div style="margin-bottom:20px;"><button onclick="window.loadAdminUsers()" class="btn-primary" style="padding:10px 24px;width:auto;"><i class="fas fa-arrow-left"></i> Back to Users</button></div>
            <div class="wallet-card" style="margin-bottom:25px;">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:20px;">
                    <div><h2 style="color:white;margin:0;">${escapeHtml(userData.user.name)}</h2><p style="color:rgba(255,255,255,0.9);margin:5px 0;">${escapeHtml(userData.user.email)}</p><p style="color:rgba(255,255,255,0.8);font-size:14px;">Member since: ${new Date(userData.user.created_at).toLocaleDateString()}</p></div>
                    <div><div style="font-size:14px;margin-bottom:8px;">Account Status</div>
                        <select id="userStatus" onchange="window.updateUserStatus(${userId})" style="padding:10px 15px;border-radius:10px;">
                            <option value="active" ${userData.user.status === 'active' ? 'selected' : ''}>🟢 Active</option>
                            <option value="blocked" ${userData.user.status === 'blocked' ? 'selected' : ''}>🔴 Blocked</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="stats-grid" style="margin-bottom:25px;">
                <div class="stat-card"><div class="stat-info"><h3>Balance</h3><div class="stat-value">${formatCurrency(userData.user.balance)}</div></div><div class="stat-icon"><i class="fas fa-wallet"></i></div></div>
                <div class="stat-card"><div class="stat-info"><h3>Total Sent</h3><div class="stat-value">${formatCurrency(userData.stats.total_sent)}</div></div><div class="stat-icon"><i class="fas fa-arrow-up"></i></div></div>
                <div class="stat-card"><div class="stat-info"><h3>Total Received</h3><div class="stat-value">${formatCurrency(userData.stats.total_received)}</div></div><div class="stat-icon"><i class="fas fa-arrow-down"></i></div></div>
                <div class="stat-card"><div class="stat-info"><h3>Transactions</h3><div class="stat-value">${userData.stats.total_transactions}</div></div><div class="stat-icon"><i class="fas fa-exchange-alt"></i></div></div>
            </div>
            <div class="form-container" style="margin-bottom:25px;">
                <h3><i class="fas fa-edit"></i> Edit User Information</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    <div><label>Name</label><input type="text" id="editName" value="${escapeHtml(userData.user.name)}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e2e8f0;"></div>
                    <div><label>Email</label><input type="email" id="editEmail" value="${escapeHtml(userData.user.email)}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e2e8f0;"></div>
                    <div><label>Phone</label><input type="tel" id="editPhone" value="${escapeHtml(userData.profile.phone || '')}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e2e8f0;"></div>
                    <div><label>Balance</label><input type="number" id="editBalance" value="${userData.user.balance}" step="0.01" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e2e8f0;"></div>
                    <div><label>Address</label><input type="text" id="editAddress" value="${escapeHtml(userData.profile.address || '')}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e2e8f0;"></div>
                    <div><label>City</label><input type="text" id="editCity" value="${escapeHtml(userData.profile.city || '')}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #e2e8f0;"></div>
                </div>
                <button onclick="window.updateUserInfo(${userId})" class="btn-primary" style="margin-top:15px;">Save Changes</button>
            </div>
            <div class="transactions-list"><h3>Transaction History</h3>
                ${userData.transactions.length === 0 ? '<div style="text-align:center;padding:40px;color:#a0aec0;">No transactions found</div>' :
                    userData.transactions.map(t => `
                        <div class="transaction-item">
                            <div><strong>${t.type.toUpperCase()}</strong><br>${formatCurrency(t.amount)}<br>${t.description || ''}</div>
                            <div>${new Date(t.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        document.getElementById('adminContent').innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error viewing user details:', error);
        showToast('Failed to load user details: ' + error.message, 'error');
        hideLoading();
    }
}

async function updateUserInfo(userId) {
    const userData = {
        name: document.getElementById('editName')?.value,
        email: document.getElementById('editEmail')?.value,
        phone: document.getElementById('editPhone')?.value,
        address: document.getElementById('editAddress')?.value,
        city: document.getElementById('editCity')?.value,
        balance: parseFloat(document.getElementById('editBalance')?.value)
    };
    if (!userData.name || !userData.email) {
        showToast('Name and email are required', 'error');
        return;
    }
    showLoading();
    try {
        await apiCall(`/admin/users/${userId}`, 'PUT', userData);
        showToast('User information updated successfully!', 'success');
        await viewUserDetails(userId);
    } catch (error) {
        showToast('Failed to update user: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function updateUserStatus(userId) {
    const status = document.getElementById('userStatus')?.value;
    if (!status) return;
    showLoading();
    try {
        await apiCall(`/admin/users/${userId}/status`, 'PUT', { status });
        showToast(`User ${status === 'active' ? 'enabled' : 'blocked'} successfully!`, 'success');
        await viewUserDetails(userId);
    } catch (error) {
        showToast('Failed to update status: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function generateStatement(userId) {
    const startDate = document.getElementById('statementStartDate')?.value;
    const endDate = document.getElementById('statementEndDate')?.value;
    showLoading();
    try {
        let url = `/admin/users/${userId}/statement`;
        const params = [];
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        if (params.length > 0) url += '?' + params.join('&');
        const statement = await apiCall(url);
        const newWindow = window.open();
        newWindow.document.write(`
            <html><head><title>Account Statement</title>
            <style>body{font-family:Arial;padding:40px;} .header{text-align:center;margin-bottom:30px;} .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:30px;} table{width:100%;border-collapse:collapse;} th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd;} th{background:#667eea;color:white;} @media print{button{display:none;}}</style>
            </head><body>
            <div class="header"><h1>Digital Wallet - Account Statement</h1><h2>${statement.user.name}</h2><p>Email: ${statement.user.email}</p><p>Period: ${startDate || 'Start'} to ${endDate || 'Present'}</p></div>
            <div class="summary"><div><h3>Total Sent</h3><p>${formatCurrency(statement.summary.total_sent)}</p></div><div><h3>Total Received</h3><p>${formatCurrency(statement.summary.total_received)}</p></div><div><h3>Total Deposits</h3><p>${formatCurrency(statement.summary.total_deposits)}</p></div><div><h3>Total Withdrawals</h3><p>${formatCurrency(statement.summary.total_withdrawals)}</p></div></div>
            <h3>Transaction Details</h3>
            <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead><tbody>
                ${statement.transactions.map(t => `<tr><td>${new Date(t.created_at).toLocaleString()}</td><td>${t.type.toUpperCase()}</td><td>${t.description || '-'}</td><td>${t.type === 'sent' || t.type === 'withdraw' ? '-' : '+'}${formatCurrency(t.amount)}</td></tr>`).join('')}
            </tbody></table>
            <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#667eea;color:white;border:none;border-radius:5px;cursor:pointer;">Print Statement</button>
            </body></html>
        `);
        newWindow.document.close();
        showToast('Statement generated successfully!', 'success');
    } catch (error) {
        showToast('Failed to generate statement: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// TAB SWITCHING & FORM SUBMISSIONS
// ============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(`${tab}Form`)?.classList.add('active');
    });
});

document.getElementById('loginForm')?.addEventListener('submit', login);
document.getElementById('registerForm')?.addEventListener('submit', register);

// ============================================
// GLOBAL EXPORTS
// ============================================

window.showDepositModal = showDepositModal;
window.showWithdrawModal = showWithdrawModal;
window.showTransferModal = showTransferModal;
window.processDeposit = processDeposit;
window.processWithdraw = processWithdraw;
window.processTransfer = processTransfer;
window.closeModal = closeModal;
window.logout = logout;
window.loadTransactions = loadTransactions;
window.loadAdminTransactions = loadAdminTransactions;
window.loadBeneficiaries = loadBeneficiaries;
window.loadProfile = loadProfile;
window.updateProfile = updateProfile;
window.deleteBeneficiary = deleteBeneficiary;
window.showAddBeneficiary = showAddBeneficiary;
window.addBeneficiary = addBeneficiary;
window.closeBeneficiaryModal = closeBeneficiaryModal;
window.viewUserDetails = viewUserDetails;
window.updateUserInfo = updateUserInfo;
window.updateUserStatus = updateUserStatus;
window.generateStatement = generateStatement;
window.toggleNotifications = toggleNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllRead = markAllRead;
window.getInitials = getInitials;

// New features exports
window.loadPaymentMethods = loadPaymentMethods;
window.showAddPaymentModal = showAddPaymentModal;
window.addPaymentMethod = addPaymentMethod;
window.closePaymentModal = closePaymentModal;
window.loadBudgets = loadBudgets;
window.showAddBudgetModal = showAddBudgetModal;
window.addBudget = addBudget;
window.closeBudgetModal = closeBudgetModal;
window.loadGoals = loadGoals;
window.showAddGoalModal = showAddGoalModal;
window.createGoal = createGoal;
window.updateGoalProgress = updateGoalProgress;
window.deleteGoal = deleteGoal;
window.closeGoalModal = closeGoalModal;
window.loadTickets = loadTickets;
window.showAddTicketModal = showAddTicketModal;
window.createTicket = createTicket;
window.closeTicketModal = closeTicketModal;

// Admin tickets exports
window.loadAdminTickets = loadAdminTickets;
window.updateTicketStatus = updateTicketStatus;