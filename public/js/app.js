const API_URL = '/api';
let authToken = localStorage.getItem('token');
let currentUser = null;

async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error('Server returned HTML instead of JSON. Please check server logs.');
        }
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Request failed');
        return result;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

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
            
            // Update avatars immediately
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

// ============ USER AVATAR FUNCTIONS ============
function getInitials(name) {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

function updateUserAvatar() {
    const avatarDiv = document.getElementById('userAvatar');
    const userNameSpan = document.getElementById('userName');
    
    if (avatarDiv && currentUser) {
        const initials = getInitials(currentUser.name);
        avatarDiv.textContent = initials;
        
        const colors = ['#667eea', '#48bb78', '#f56565', '#ed8936', '#4299e1', '#9f7aea', '#38b2ac', '#ecc94b'];
        const colorIndex = currentUser.name.length % colors.length;
        avatarDiv.style.background = colors[colorIndex];
    }
    
    if (userNameSpan && currentUser) {
        userNameSpan.textContent = currentUser.name.split(' ')[0];
    }
}

// ============ SEARCH FUNCTIONALITY ============
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
    
    searchInput.removeEventListener('keypress', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    searchIcon.removeEventListener('click', performSearch);
    searchIcon.addEventListener('click', performSearch);
}

// ============ NOTIFICATIONS ============
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
    const navItems = document.querySelectorAll('#userDashboard .nav-item');
    navItems.forEach(item => {
        item.removeEventListener('click', handleUserNavClick);
        item.addEventListener('click', handleUserNavClick);
    });
}

function handleUserNavClick(e) {
    e.preventDefault();
    const page = this.dataset.page;
    
    document.querySelectorAll('#userDashboard .nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    this.classList.add('active');
    
    // Clear search input
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) searchInput.value = '';
    
    if (page === 'overview') loadUserOverview();
    else if (page === 'transactions') loadTransactions();
    else if (page === 'transfer') showTransferModal();
    else if (page === 'beneficiaries') loadBeneficiaries();
    else if (page === 'payments') loadPaymentMethods();
    else if (page === 'budgets') loadBudgets();
    else if (page === 'goals') loadGoals();
    else if (page === 'tickets') loadTickets();
    else if (page === 'profile') loadProfile();
}

// ============ PAYMENT METHODS (NEW) ============
async function loadPaymentMethods() {
    showLoading();
    try {
        const methods = await apiCall('/users/payment-methods');
        
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">💳 Payment Methods</h3>
                <button onclick="window.showAddPaymentModal()" class="btn-primary" style="margin-bottom: 20px;">
                    <i class="fas fa-plus"></i> Add Payment Method
                </button>
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
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
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
                <div class="form-group">
                    <label>Card Brand</label>
                    <select id="paymentBrand" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="amex">American Express</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Last 4 Digits</label>
                    <input type="text" id="paymentLast4" placeholder="1234" maxlength="4" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="paymentDefault"> Set as default</label>
                </div>
                <div class="form-actions">
                    <button class="btn-cancel" onclick="window.closePaymentModal()">Cancel</button>
                    <button class="btn-submit" onclick="window.addPaymentMethod()">Add Card</button>
                </div>
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
    const modal = document.getElementById('paymentModal');
    if (modal) modal.remove();
}

// ============ BUDGETS (NEW) ============
async function loadBudgets() {
    showLoading();
    try {
        // Load categories for dropdown
        let categories = [];
        try {
            const catResponse = await apiCall('/users/categories');
            categories = catResponse;
        } catch (e) {
            console.log('Categories not loaded:', e);
        }
        
        const budgets = await apiCall('/users/budgets');
        
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">📊 Monthly Budgets</h3>
                <button onclick="window.showAddBudgetModal()" class="btn-primary" style="margin-bottom: 20px;">
                    <i class="fas fa-plus"></i> Set Budget
                </button>
                ${budgets.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No budgets set yet. Create your first budget!</div>' :
                    budgets.map(b => {
                        const percentage = Math.min((b.spent / b.amount) * 100, 100);
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
                                            <span>Spent: $${b.spent.toFixed(2)}</span>
                                            <span>Budget: $${b.amount.toFixed(2)}</span>
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
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
        hideLoading();
    } catch (error) {
        console.error('Error loading budgets:', error);
        showToast('Failed to load budgets: ' + error.message, 'error');
        hideLoading();
    }
}

function showAddBudgetModal() {
    // Load categories for dropdown
    fetch(`${API_URL}/users/categories`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(categories => {
        const modalHtml = `
            <div class="form-modal" id="budgetModal">
                <div class="form-container">
                    <h3><i class="fas fa-chart-pie"></i> Set Monthly Budget</h3>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="budgetCategory" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount ($)</label>
                        <input type="number" id="budgetAmount" placeholder="Enter amount" step="0.01" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    </div>
                    <div class="form-actions">
                        <button class="btn-cancel" onclick="window.closeBudgetModal()">Cancel</button>
                        <button class="btn-submit" onclick="window.addBudget()">Set Budget</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    })
    .catch(() => {
        showToast('Failed to load categories', 'error');
    });
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
    const modal = document.getElementById('budgetModal');
    if (modal) modal.remove();
}

// ============ GOALS (NEW) ============
async function loadGoals() {
    showLoading();
    try {
        const goals = await apiCall('/users/goals');
        
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">🎯 Financial Goals</h3>
                <button onclick="window.showAddGoalModal()" class="btn-primary" style="margin-bottom: 20px;">
                    <i class="fas fa-plus"></i> New Goal
                </button>
                ${goals.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No goals set yet. Start saving today!</div>' :
                    goals.map(g => {
                        const percentage = Math.min((g.current_amount / g.target_amount) * 100, 100);
                        return `
                            <div class="transaction-item" style="${g.status === 'completed' ? 'border-left: 4px solid #48bb78;' : ''}">
                                <div class="transaction-icon"><i class="fas fa-bullseye"></i></div>
                                <div class="transaction-details" style="flex:1;">
                                    <div class="transaction-title">${escapeHtml(g.name)} 
                                        <span style="font-size: 12px; background: ${g.status === 'completed' ? '#48bb78' : '#ed8936'}; color: white; padding: 2px 10px; border-radius: 12px;">
                                            ${g.status}
                                        </span>
                                    </div>
                                    <div style="margin: 8px 0;">
                                        <div style="background: #edf2f7; height: 8px; border-radius: 4px; overflow: hidden;">
                                            <div style="height: 100%; width: ${percentage}%; background: #667eea; border-radius: 4px; transition: width 0.3s;"></div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                                            <span>$${g.current_amount.toFixed(2)} saved</span>
                                            <span>Target: $${g.target_amount.toFixed(2)}</span>
                                            <span>${percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    ${g.deadline ? `<div style="font-size: 12px; color: #718096;">📅 Deadline: ${new Date(g.deadline).toLocaleDateString()}</div>` : ''}
                                    <div style="margin-top: 10px; display: flex; gap: 10px;">
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
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
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
                <div class="form-group">
                    <label>Goal Name</label>
                    <input type="text" id="goalName" placeholder="e.g., Vacation Fund" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                </div>
                <div class="form-group">
                    <label>Target Amount ($)</label>
                    <input type="number" id="goalTarget" placeholder="Enter amount" step="0.01" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                </div>
                <div class="form-group">
                    <label>Deadline (optional)</label>
                    <input type="date" id="goalDeadline" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                </div>
                <div class="form-actions">
                    <button class="btn-cancel" onclick="window.closeGoalModal()">Cancel</button>
                    <button class="btn-submit" onclick="window.createGoal()">Create Goal</button>
                </div>
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
    const modal = document.getElementById('goalModal');
    if (modal) modal.remove();
}

// ============ SUPPORT TICKETS (NEW) ============
async function loadTickets() {
    showLoading();
    try {
        const tickets = await apiCall('/users/tickets');
        
        const html = `
            <div class="transactions-list">
                <h3 style="margin-bottom: 20px;">🎫 Support Tickets</h3>
                <button onclick="window.showAddTicketModal()" class="btn-primary" style="margin-bottom: 20px;">
                    <i class="fas fa-plus"></i> New Ticket
                </button>
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
                                    <span style="background: ${t.status === 'open' ? '#fefcbf' : t.status === 'resolved' ? '#c6f6d5' : '#edf2f7'}; padding: 2px 10px; border-radius: 12px; font-size: 12px;">
                                        ${t.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
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
                <div class="form-group">
                    <label>Subject</label>
                    <input type="text" id="ticketSubject" placeholder="Brief subject" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                </div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="ticketMessage" placeholder="Describe your issue..." rows="4" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn-cancel" onclick="window.closeTicketModal()">Cancel</button>
                    <button class="btn-submit" onclick="window.createTicket()">Submit</button>
                </div>
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
    const modal = document.getElementById('ticketModal');
    if (modal) modal.remove();
}

// ============ BENEFICIARY FUNCTIONS ============
async function loadBeneficiaries() {
    showLoading();
    try {
        const beneficiaries = await apiCall('/users/beneficiaries');
        const html = `<div class="transactions-list"><h3>My Beneficiaries</h3>
            ${beneficiaries.length === 0 ? '<div style="text-align: center; padding: 40px;">No beneficiaries added yet. Send money to someone to add them as beneficiary.</div>' : 
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
            `).join('')}
            <button onclick="window.showAddBeneficiary()" class="btn-primary" style="margin-top: 20px;"><i class="fas fa-plus"></i> Add Beneficiary</button>
        </div>`;
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
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
    const nameInput = document.getElementById('beneficiaryName');
    const emailInput = document.getElementById('beneficiaryEmail');
    
    if (!nameInput || !emailInput) return;
    
    const name = nameInput.value;
    const email = emailInput.value;
    
    if (!name || !email) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    showLoading();
    try {
        await apiCall('/users/beneficiaries', 'POST', { 
            beneficiary_name: name, 
            beneficiary_email: email,
            is_favorite: false 
        });
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
    const modal = document.getElementById('beneficiaryModal');
    if (modal) modal.remove();
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
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.innerHTML = html;
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

// ============ ADMIN FUNCTIONS ============
async function showAdminDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    const adminNameSpan = document.getElementById('adminName');
    if (adminNameSpan) adminNameSpan.innerHTML = `<i class="fas fa-shield-alt"></i> ${currentUser.name.split(' ')[0]}`;
    await loadAdminOverview();
    setupAdminNavigation();
}

function setupAdminNavigation() {
    const adminNavItems = document.querySelectorAll('#adminDashboard [data-admin-page]');
    adminNavItems.forEach(item => {
        item.removeEventListener('click', handleAdminNavClick);
        item.addEventListener('click', handleAdminNavClick);
    });
}

function handleAdminNavClick(e) {
    e.preventDefault();
    const page = this.dataset.adminPage;
    
    document.querySelectorAll('#adminDashboard [data-admin-page]').forEach(nav => {
        nav.classList.remove('active');
    });
    this.classList.add('active');
    
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) searchInput.value = '';
    
    if (page === 'overview') loadAdminOverview();
    else if (page === 'users') loadAdminUsers();
    else if (page === 'transactions') loadAdminTransactions();
    else if (page === 'analytics') loadAdminAnalytics();
}

async function loadAdminOverview() {
    showLoading();
    try {
        const stats = await apiCall('/admin/stats');
        
        const html = `
            <div class="admin-overview">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Users</h3>
                            <div class="stat-value">${stats.summary.total_users}</div>
                            <small>🟢 ${stats.summary.active_users} active</small>
                        </div>
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Transactions</h3>
                            <div class="stat-value">${stats.summary.total_transactions.toLocaleString()}</div>
                            <small>📊 All time</small>
                        </div>
                        <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Volume</h3>
                            <div class="stat-value">${formatCurrency(stats.summary.total_volume)}</div>
                            <small>💰 All transactions</small>
                        </div>
                        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Balance</h3>
                            <div class="stat-value">${formatCurrency(stats.summary.total_balance)}</div>
                            <small>💎 Across all users</small>
                        </div>
                        <div class="stat-icon"><i class="fas fa-wallet"></i></div>
                    </div>
                </div>
                <div class="stats-grid" style="margin-top: 20px;">
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Blocked Users</h3>
                            <div class="stat-value">${stats.summary.blocked_users}</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-ban"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Active Rate</h3>
                            <div class="stat-value">${stats.summary.total_users > 0 ? Math.round((stats.summary.active_users / stats.summary.total_users) * 100) : 0}%</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-chart-simple"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Avg Transaction</h3>
                            <div class="stat-value">${stats.summary.total_transactions > 0 ? formatCurrency(stats.summary.total_volume / stats.summary.total_transactions) : '$0'}</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-calculator"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>System Health</h3>
                            <div class="stat-value">🟢 Online</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-heartbeat"></i></div>
                    </div>
                </div>
            </div>
        `;
        
        const adminContent = document.getElementById('adminContent');
        if (adminContent) adminContent.innerHTML = html;
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
        console.log('Fetching users from API...');
        
        const response = await fetch(`${API_URL}/admin/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expired. Please login again.', 'error');
                logout();
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const users = await response.json();
        console.log('Users received:', users);
        
        if (!users || users.length === 0) {
            const html = `<div class="transactions-list"><h3 style="margin-bottom: 20px;">User Management</h3>
                <div style="text-align: center; padding: 40px;">No regular users found.</div>
            </div>`;
            const adminContent = document.getElementById('adminContent');
            if (adminContent) adminContent.innerHTML = html;
            hideLoading();
            return;
        }
        
        const html = `
            <div class="user-management">
                <h3 style="margin-bottom: 20px;">User Management</h3>
                <div class="users-grid">
                    ${users.map(user => `
                        <div class="user-card" style="background: white; border-radius: 15px; padding: 20px; margin-bottom: 15px; cursor: pointer;" onclick="viewUserDetails(${user.id})">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <i class="fas fa-user-circle" style="font-size: 40px; color: #667eea;"></i>
                                        <div>
                                            <h4 style="margin: 0;">${escapeHtml(user.name)}</h4>
                                            <p style="margin: 5px 0; color: #718096;">${escapeHtml(user.email)}</p>
                                        </div>
                                    </div>
                                    <div style="margin-top: 10px;">
                                        <span style="background: ${user.status === 'active' ? '#48bb78' : '#f56565'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                                            ${user.status === 'active' ? '🟢 Active' : '🔴 Blocked'}
                                        </span>
                                        <span style="margin-left: 10px; font-weight: bold;">Balance: ${formatCurrency(user.balance)}</span>
                                    </div>
                                </div>
                                <div>
                                    <i class="fas fa-chevron-right" style="color: #a0aec0;"></i>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        const adminContent = document.getElementById('adminContent');
        if (adminContent) adminContent.innerHTML = html;
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
        
        let filteredTransactions = transactions;
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filteredTransactions = transactions.filter(t => {
                return (t.sender_name && t.sender_name.toLowerCase().includes(term)) ||
                       (t.recipient_name && t.recipient_name.toLowerCase().includes(term)) ||
                       (t.type && t.type.toLowerCase().includes(term)) ||
                       (t.description && t.description.toLowerCase().includes(term)) ||
                       (t.reference && t.reference.toLowerCase().includes(term));
            });
        }
        
        const html = `
            <div class="transactions-list">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="margin: 0;">All Transactions</h3>
                    ${searchTerm ? 
                        `<div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px;">
                                <i class="fas fa-search"></i> Results for: "${escapeHtml(searchTerm)}"
                            </span>
                            <button onclick="window.loadAdminTransactions()" style="background: #a0aec0; padding: 5px 15px; border: none; border-radius: 8px; color: white; cursor: pointer;">
                                Clear
                            </button>
                        </div>` : ''
                    }
                </div>
                ${filteredTransactions.length === 0 ? 
                    `<div style="text-align: center; padding: 60px 20px;">
                        <i class="fas fa-search" style="font-size: 48px; color: #a0aec0; margin-bottom: 20px;"></i>
                        <p style="color: #a0aec0;">No transactions found matching "${escapeHtml(searchTerm)}"</p>
                    </div>` :
                    filteredTransactions.map(t => `
                        <div class="transaction-item">
                            <div>
                                <strong style="text-transform: uppercase;">${t.type}</strong><br>
                                Amount: ${formatCurrency(t.amount)}<br>
                                Sender: ${escapeHtml(t.sender_name || 'N/A')}<br>
                                Recipient: ${escapeHtml(t.recipient_name || 'N/A')}<br>
                                ${t.description ? `Note: ${escapeHtml(t.description)}` : ''}
                                <div style="font-size: 10px; color: #a0aec0; margin-top: 5px;">Ref: ${t.reference}</div>
                            </div>
                            <div>${new Date(t.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        const adminContent = document.getElementById('adminContent');
        if (adminContent) adminContent.innerHTML = html;
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
        
        console.log('Full Stats Response:', stats);
        console.log('Daily Activity:', stats.daily_activity);
        console.log('Monthly Summary:', stats.monthly_summary);
        console.log('Type Distribution:', stats.type_distribution);
        
        const html = `
            <div class="analytics-dashboard">
                <h2 style="margin-bottom: 20px; color: white;"><i class="fas fa-chart-line"></i> Analytics Dashboard</h2>
                <p style="color: white; margin-bottom: 30px;">Comprehensive insights and statistics for the entire Digital Wallet platform</p>
                
                <!-- Row 1: Line Chart and Pie Chart -->
                <div class="charts-grid">
                    <div class="chart-card">
                        <h3><i class="fas fa-chart-line"></i> Daily Activity (Last 30 Days)</h3>
                        <canvas id="dailyActivityChart" style="max-height: 300px; width: 100%;"></canvas>
                    </div>
                    <div class="chart-card">
                        <h3><i class="fas fa-chart-pie"></i> Transaction Distribution</h3>
                        <canvas id="typeDistributionChart" style="max-height: 300px; width: 100%;"></canvas>
                    </div>
                </div>
                
                <!-- Row 2: Bar Chart -->
                <div class="charts-grid">
                    <div class="chart-card">
                        <h3><i class="fas fa-chart-bar"></i> Monthly Volume Trend</h3>
                        <canvas id="monthlyVolumeChart" style="max-height: 300px; width: 100%;"></canvas>
                    </div>
                </div>
                
                <!-- Stats Cards -->
                <div class="stats-grid" style="margin-top: 20px;">
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Users</h3>
                            <div class="stat-value">${stats.summary?.total_users || 0}</div>
                            <small>${stats.summary?.active_users || 0} active</small>
                        </div>
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Transactions</h3>
                            <div class="stat-value">${stats.summary?.total_transactions || 0}</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Volume</h3>
                            <div class="stat-value">${formatCurrency(stats.summary?.total_volume || 0)}</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>Total Balance</h3>
                            <div class="stat-value">${formatCurrency(stats.summary?.total_balance || 0)}</div>
                        </div>
                        <div class="stat-icon"><i class="fas fa-wallet"></i></div>
                    </div>
                </div>
            </div>
        `;
        
        const adminContent = document.getElementById('adminContent');
        if (adminContent) adminContent.innerHTML = html;
        
        // ============ 1. LINE CHART: Daily Activity ============
        const dailyCtx = document.getElementById('dailyActivityChart')?.getContext('2d');
        if (dailyCtx && stats.daily_activity && stats.daily_activity.length > 0) {
            const dates = stats.daily_activity.map(d => {
                const date = new Date(d.date);
                return `${date.getMonth()+1}/${date.getDate()}`;
            }).reverse();
            const amounts = stats.daily_activity.map(d => parseFloat(d.total)).reverse();
            
            new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Transaction Volume ($)',
                        data: amounts,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#667eea',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } }
                }
            });
        } else if (dailyCtx) {
            dailyCtx.fillStyle = '#f0f0f0';
            dailyCtx.fillRect(0, 0, dailyCtx.canvas.width, dailyCtx.canvas.height);
            dailyCtx.fillStyle = '#666';
            dailyCtx.font = '14px Arial';
            dailyCtx.textAlign = 'center';
            dailyCtx.fillText('No daily activity data available', dailyCtx.canvas.width / 2, dailyCtx.canvas.height / 2);
        }
        
        // ============ 2. PIE CHART: Transaction Distribution ============
        const pieCtx = document.getElementById('typeDistributionChart')?.getContext('2d');
        if (pieCtx && stats.type_distribution && stats.type_distribution.length > 0) {
            const labels = stats.type_distribution.map(t => t.type.toUpperCase());
            const counts = stats.type_distribution.map(t => parseInt(t.count));
            
            new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: ['#48bb78', '#f56565', '#ed8936', '#4299e1'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        } else if (pieCtx) {
            pieCtx.fillStyle = '#f0f0f0';
            pieCtx.fillRect(0, 0, pieCtx.canvas.width, pieCtx.canvas.height);
            pieCtx.fillStyle = '#666';
            pieCtx.font = '14px Arial';
            pieCtx.textAlign = 'center';
            pieCtx.fillText('No transaction type data available', pieCtx.canvas.width / 2, pieCtx.canvas.height / 2);
        }
        
        // ============ 3. BAR CHART: Monthly Volume Trend ============
        const monthlyCtx = document.getElementById('monthlyVolumeChart')?.getContext('2d');
        if (monthlyCtx && stats.monthly_summary && stats.monthly_summary.length > 0) {
            const months = stats.monthly_summary.map(m => {
                const [year, month] = m.month.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1);
                return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }).reverse();
            
            const deposits = stats.monthly_summary.map(m => parseFloat(m.total_deposits)).reverse();
            const withdrawals = stats.monthly_summary.map(m => parseFloat(m.total_withdrawals)).reverse();
            
            new Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        { label: 'Deposits', data: deposits, backgroundColor: '#48bb78', borderRadius: 5 },
                        { label: 'Withdrawals', data: withdrawals, backgroundColor: '#f56565', borderRadius: 5 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { callback: v => '$' + v.toLocaleString() } 
                        }
                    }
                }
            });
        } else if (monthlyCtx) {
            // Fallback: Create sample data for demo if no real data exists
            const sampleMonths = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
            const sampleDeposits = [5000, 6000, 5500, 7000, 6500, 8000];
            const sampleWithdrawals = [3000, 3500, 4000, 3800, 4200, 4500];
            
            monthlyCtx.fillStyle = '#fff8f0';
            monthlyCtx.fillRect(0, 0, monthlyCtx.canvas.width, monthlyCtx.canvas.height);
            monthlyCtx.fillStyle = '#666';
            monthlyCtx.font = '14px Arial';
            monthlyCtx.textAlign = 'center';
            monthlyCtx.fillText('No monthly data available. Add transactions to see charts.', monthlyCtx.canvas.width / 2, monthlyCtx.canvas.height / 2);
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Failed to load analytics: ' + error.message, 'error');
        hideLoading();
    }
}

async function viewUserDetails(userId) {
    showLoading();
    try {
        const userData = await apiCall(`/admin/users/${userId}`);
        
        // Calculate spending categories for this specific user
        const categories = {
            'Food': 0, 'Shopping': 0, 'Bills': 0, 'Entertainment': 0, 'Other': 0
        };
        
        // Calculate monthly spending for Bar Chart
        const monthlySpending = {};
        userData.transactions.forEach(t => {
            if (t.type === 'sent') {
                const date = new Date(t.created_at);
                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                
                if (!monthlySpending[monthKey]) {
                    monthlySpending[monthKey] = { name: monthName, amount: 0 };
                }
                monthlySpending[monthKey].amount += parseFloat(t.amount);
                
                // Category breakdown
                const desc = (t.description || '').toLowerCase();
                if (desc.includes('food') || desc.includes('restaurant') || desc.includes('dinner') || desc.includes('lunch')) {
                    categories['Food'] += parseFloat(t.amount);
                } else if (desc.includes('shopping') || desc.includes('amazon') || desc.includes('store')) {
                    categories['Shopping'] += parseFloat(t.amount);
                } else if (desc.includes('bill') || desc.includes('electric') || desc.includes('water')) {
                    categories['Bills'] += parseFloat(t.amount);
                } else if (desc.includes('movie') || desc.includes('netflix') || desc.includes('game')) {
                    categories['Entertainment'] += parseFloat(t.amount);
                } else {
                    categories['Other'] += parseFloat(t.amount);
                }
            }
        });
        
        // Sort months chronologically and get last 6 months
        const sortedMonths = Object.values(monthlySpending).sort((a, b) => {
            const dateA = new Date(a.name);
            const dateB = new Date(b.name);
            return dateA - dateB;
        }).slice(-6);
        
        const monthlyLabels = sortedMonths.map(m => m.name);
        const monthlyAmounts = sortedMonths.map(m => m.amount);
        
        // Prepare data for user's transaction volume chart (last 7 days)
        const last7Days = [];
        const dailyVolumes = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toLocaleDateString());
            const dayTransactions = userData.transactions.filter(t => 
                new Date(t.created_at).toDateString() === date.toDateString()
            );
            const dayVolume = dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
            dailyVolumes.push(dayVolume);
        }
        
        const chartCategories = Object.keys(categories).filter(cat => categories[cat] > 0);
        const chartAmounts = chartCategories.map(cat => categories[cat]);
        const hasSpending = chartCategories.length > 0;
        const hasMonthlyData = monthlyAmounts.length > 0;
        
        const html = `
            <div style="margin-bottom: 20px;">
                <button onclick="window.loadAdminUsers()" class="btn-primary" style="padding: 10px 24px; width: auto;">
                    <i class="fas fa-arrow-left"></i> Back to Users
                </button>
            </div>
            
            <!-- User Info Card -->
            <div class="wallet-card" style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 20px;">
                    <div>
                        <h2 style="color: white; margin: 0;">${escapeHtml(userData.user.name)}</h2>
                        <p style="color: rgba(255,255,255,0.9); margin: 5px 0;">${escapeHtml(userData.user.email)}</p>
                        <p style="color: rgba(255,255,255,0.8); font-size: 14px;">Member since: ${new Date(userData.user.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <div style="font-size: 14px; margin-bottom: 8px;">Account Status</div>
                        <select id="userStatus" onchange="window.updateUserStatus(${userId})" style="padding: 10px 15px; border-radius: 10px;">
                            <option value="active" ${userData.user.status === 'active' ? 'selected' : ''}>🟢 Active</option>
                            <option value="blocked" ${userData.user.status === 'blocked' ? 'selected' : ''}>🔴 Blocked</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- User Stats Cards -->
            <div class="stats-grid" style="margin-bottom: 25px;">
                <div class="stat-card">
                    <div class="stat-info">
                        <h3>Balance</h3>
                        <div class="stat-value">${formatCurrency(userData.user.balance)}</div>
                    </div>
                    <div class="stat-icon"><i class="fas fa-wallet"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <h3>Total Sent</h3>
                        <div class="stat-value">${formatCurrency(userData.stats.total_sent)}</div>
                    </div>
                    <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <h3>Total Received</h3>
                        <div class="stat-value">${formatCurrency(userData.stats.total_received)}</div>
                    </div>
                    <div class="stat-icon"><i class="fas fa-arrow-down"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <h3>Transactions</h3>
                        <div class="stat-value">${userData.stats.total_transactions}</div>
                    </div>
                    <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
                </div>
            </div>
            
            <!-- User Charts Row 1 -->
            <div class="charts-grid" style="margin-bottom: 25px;">
                <div class="chart-card">
                    <h3><i class="fas fa-chart-pie"></i> ${escapeHtml(userData.user.name)}'s Spending by Category</h3>
                    ${hasSpending ? '<canvas id="userCategoryChart" style="max-height: 300px;"></canvas>' : '<div style="text-align: center; padding: 40px; color: #a0aec0;">No spending data yet</div>'}
                </div>
                <div class="chart-card">
                    <h3><i class="fas fa-chart-line"></i> ${escapeHtml(userData.user.name)}'s Daily Activity (Last 7 Days)</h3>
                    <canvas id="userTransactionChart" style="max-height: 300px;"></canvas>
                </div>
            </div>
            
            <!-- User Charts Row 2 - BAR CHART -->
            <div class="charts-grid" style="margin-bottom: 25px;">
                <div class="chart-card">
                    <h3><i class="fas fa-chart-bar"></i> ${escapeHtml(userData.user.name)}'s Monthly Spending Trend</h3>
                    ${hasMonthlyData ? '<canvas id="userMonthlyBarChart" style="max-height: 300px;"></canvas>' : '<div style="text-align: center; padding: 40px; color: #a0aec0;">No monthly spending data yet</div>'}
                </div>
            </div>
            
            <!-- Edit User Form -->
            <div class="form-container" style="margin-bottom: 25px;">
                <h3><i class="fas fa-edit"></i> Edit User Information</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-field"><label>Name</label><input type="text" id="editName" value="${escapeHtml(userData.user.name)}"></div>
                    <div class="form-field"><label>Email</label><input type="email" id="editEmail" value="${escapeHtml(userData.user.email)}"></div>
                    <div class="form-field"><label>Phone</label><input type="tel" id="editPhone" value="${escapeHtml(userData.profile.phone || '')}"></div>
                    <div class="form-field"><label>Balance</label><input type="number" id="editBalance" value="${userData.user.balance}" step="0.01"></div>
                    <div class="form-field"><label>Address</label><input type="text" id="editAddress" value="${escapeHtml(userData.profile.address || '')}"></div>
                    <div class="form-field"><label>City</label><input type="text" id="editCity" value="${escapeHtml(userData.profile.city || '')}"></div>
                </div>
                <button onclick="window.updateUserInfo(${userId})" class="btn-primary" style="margin-top: 15px;">Save Changes</button>
            </div>
            
            <!-- Generate Statement -->
            <div class="statement-generator" style="background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 20px; padding: 25px; margin-bottom: 25px; color: white;">
                <h3><i class="fas fa-file-alt"></i> Generate Account Statement</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: end;">
                    <div><label>Start Date</label><input type="date" id="statementStartDate" style="width: 100%; padding: 10px; border-radius: 8px; border: none;"></div>
                    <div><label>End Date</label><input type="date" id="statementEndDate" style="width: 100%; padding: 10px; border-radius: 8px; border: none;"></div>
                    <button onclick="window.generateStatement(${userId})" style="background: white; color: #667eea; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;">Generate</button>
                </div>
            </div>
            
            <!-- User Transactions -->
            <div class="transactions-list">
                <h3>Transaction History</h3>
                ${userData.transactions.length === 0 ? 
                    '<div style="text-align: center; padding: 40px; color: #a0aec0;">No transactions found</div>' :
                    userData.transactions.map(t => `
                        <div class="transaction-item">
                            <div><strong>${t.type.toUpperCase()}</strong><br>${formatCurrency(t.amount)}<br>${t.description || ''}</div>
                            <div>${new Date(t.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        const adminContent = document.getElementById('adminContent');
        if (adminContent) adminContent.innerHTML = html;
        
        // ============ 1. Create User's Spending Category Chart (Doughnut) ============
        if (hasSpending) {
            const ctx = document.getElementById('userCategoryChart')?.getContext('2d');
            if (ctx) {
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: chartCategories,
                        datasets: [{
                            data: chartAmounts,
                            backgroundColor: ['#667eea', '#48bb78', '#f56565', '#ed8936', '#4299e1', '#9f7aea'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.raw;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${context.label}: $${value.toFixed(2)} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
        
        // ============ 2. Create User's Daily Volume Chart (Line) ============
        const volumeCtx = document.getElementById('userTransactionChart')?.getContext('2d');
        if (volumeCtx) {
            new Chart(volumeCtx, {
                type: 'line',
                data: {
                    labels: last7Days,
                    datasets: [{
                        label: 'Transaction Volume ($)',
                        data: dailyVolumes,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#667eea',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Volume: $${context.raw.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: function(value) { return '$' + value.toLocaleString(); } }
                        }
                    }
                }
            });
        }
        
        // ============ 3. Create User's Monthly Spending Bar Chart ============
        if (hasMonthlyData) {
            const barCtx = document.getElementById('userMonthlyBarChart')?.getContext('2d');
            if (barCtx) {
                new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: monthlyLabels,
                        datasets: [{
                            label: 'Spending Amount ($)',
                            data: monthlyAmounts,
                            backgroundColor: '#ed8936',
                            borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return `Spent: $${context.raw.toLocaleString()}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'Amount ($)' },
                                ticks: { callback: function(value) { return '$' + value.toLocaleString(); } }
                            },
                            x: { title: { display: true, text: 'Month' } }
                        }
                    }
                });
            }
        }
        
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
    const statusSelect = document.getElementById('userStatus');
    if (!statusSelect) return;
    
    const status = statusSelect.value;
    
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
        
        const statementHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Account Statement - ${statement.user.name}</title>
                <style>
                    body { font-family: Arial; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 15px; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #667eea; color: white; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Digital Wallet - Account Statement</h1>
                    <h2>${statement.user.name}</h2>
                    <p>Email: ${statement.user.email}</p>
                    <p>Period: ${startDate || 'Start'} to ${endDate || 'Present'}</p>
                </div>
                <div class="summary">
                    <div><h3>Total Sent</h3><p>${formatCurrency(statement.summary.total_sent)}</p></div>
                    <div><h3>Total Received</h3><p>${formatCurrency(statement.summary.total_received)}</p></div>
                    <div><h3>Total Deposits</h3><p>${formatCurrency(statement.summary.total_deposits)}</p></div>
                    <div><h3>Total Withdrawals</h3><p>${formatCurrency(statement.summary.total_withdrawals)}</p></div>
                </div>
                <h3>Transaction Details</h3>
                <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></td></thead>
                    <tbody>
                        ${statement.transactions.map(t => `
                            <tr>
                                <td>${new Date(t.created_at).toLocaleString()}</td>
                                <td>${t.type.toUpperCase()}</td>
                                <td>${t.description || '-'}</td>
                                <td>${t.type === 'sent' || t.type === 'withdraw' ? '-' : '+'}${formatCurrency(t.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Statement</button>
            </body>
            </html>
        `;
        
        const newWindow = window.open();
        newWindow.document.write(statementHtml);
        newWindow.document.close();
        showToast('Statement generated successfully!', 'success');
    } catch (error) {
        showToast('Failed to generate statement: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function updateUserBalance(userId) {
    const balanceInput = document.getElementById(`balance_${userId}`);
    if (!balanceInput) return;
    
    const newBalance = parseFloat(balanceInput.value);
    if (isNaN(newBalance)) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    showLoading();
    try {
        await apiCall(`/admin/users/${userId}/balance`, 'PUT', { balance: newBalance });
        showToast('Balance updated successfully!', 'success');
        await loadAdminUsers();
    } catch (error) {
        showToast('Failed to update balance: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    showLoading();
    try {
        await apiCall(`/admin/users/${userId}`, 'DELETE');
        showToast('User deleted successfully', 'success');
        await loadAdminUsers();
    } catch (error) {
        showToast('Failed to delete user: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============ HELPER FUNCTIONS ============
function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '$0.00';
    return '$' + parseFloat(amount).toFixed(2);
}

function formatDateShort(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function logout() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    
    // Hide both dashboards
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');
    const authSection = document.getElementById('authSection');
    
    if (userDashboard) userDashboard.style.display = 'none';
    if (adminDashboard) adminDashboard.style.display = 'none';
    if (authSection) {
        authSection.style.display = 'flex';
        authSection.style.justifyContent = 'center';
        authSection.style.alignItems = 'center';
        authSection.style.minHeight = '100vh';
    }
    
    // Reset forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    
    // Reset to login tab
    const loginTab = document.querySelector('[data-tab="login"]');
    if (loginTab) loginTab.click();
    
    showToast('Logged out successfully', 'success');
}

// ============ GLOBAL EXPORTS ============
window.showDepositModal = showDepositModal;
window.showWithdrawModal = showWithdrawModal;
window.showTransferModal = showTransferModal;
window.loadTransactions = loadTransactions;
window.loadAdminTransactions = loadAdminTransactions;
window.processDeposit = processDeposit;
window.processWithdraw = processWithdraw;
window.processTransfer = processTransfer;
window.closeModal = closeModal;
window.logout = logout;
window.updateUserBalance = updateUserBalance;
window.deleteUser = deleteUser;
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

// NEW EXPORTS FOR NEW FEATURES
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

// Tab switching for auth
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const forms = document.querySelectorAll('.auth-form');
        forms.forEach(form => form.classList.remove('active'));
        const activeForm = document.getElementById(`${tab}Form`);
        if (activeForm) activeForm.classList.add('active');
    });
});

// Form submissions
const loginFormElement = document.getElementById('loginForm');
const registerFormElement = document.getElementById('registerForm');
if (loginFormElement) loginFormElement.addEventListener('submit', login);
if (registerFormElement) registerFormElement.addEventListener('submit', register);