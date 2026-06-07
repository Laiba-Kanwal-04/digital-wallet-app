const API_URL = 'http://localhost:5000/api';
let token = localStorage.getItem('token');
let currentUser = null;

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || 'Request failed');
    }
    
    return result;
}

// UI Functions
function showTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const btns = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
}

// Authentication
async function login(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const data = await apiCall('/users/login', 'POST', { email, password });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        
        if (currentUser.role === 'admin') {
            showAdminDashboard();
        } else {
            showUserDashboard();
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function register(event) {
    event.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        const data = await apiCall('/users/register', 'POST', { name, email, password });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        showUserDashboard();
        alert('Registration successful! You received $100 bonus!');
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

// User Dashboard
async function showUserDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('userDashboard').style.display = 'block';
    
    // Load user data
    const profile = await apiCall('/users/profile');
    document.getElementById('userName').innerText = profile.name;
    document.getElementById('balance').innerText = profile.balance.toFixed(2);
}

function showDeposit() {
    document.getElementById('forms').innerHTML = `
        <div class="form-popup">
            <h3>Deposit Money</h3>
            <input type="number" id="depositAmount" placeholder="Amount">
            <input type="text" id="depositDesc" placeholder="Description">
            <button onclick="processDeposit()">Deposit</button>
            <button onclick="closeForm()">Cancel</button>
        </div>
    `;
}

async function processDeposit() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const description = document.getElementById('depositDesc').value;
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    try {
        const result = await apiCall('/transactions/deposit', 'POST', { amount, description });
        document.getElementById('balance').innerText = result.new_balance.toFixed(2);
        alert('Deposit successful!');
        closeForm();
    } catch (error) {
        alert('Deposit failed: ' + error.message);
    }
}

function showWithdraw() {
    document.getElementById('forms').innerHTML = `
        <div class="form-popup">
            <h3>Withdraw Money</h3>
            <input type="number" id="withdrawAmount" placeholder="Amount">
            <input type="text" id="withdrawDesc" placeholder="Description">
            <button onclick="processWithdraw()">Withdraw</button>
            <button onclick="closeForm()">Cancel</button>
        </div>
    `;
}

async function processWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const description = document.getElementById('withdrawDesc').value;
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    try {
        const result = await apiCall('/transactions/withdraw', 'POST', { amount, description });
        document.getElementById('balance').innerText = result.new_balance.toFixed(2);
        alert('Withdrawal successful!');
        closeForm();
    } catch (error) {
        alert('Withdrawal failed: ' + error.message);
    }
}

function showTransfer() {
    document.getElementById('forms').innerHTML = `
        <div class="form-popup">
            <h3>Transfer Money</h3>
            <input type="email" id="transferEmail" placeholder="Recipient Email">
            <input type="number" id="transferAmount" placeholder="Amount">
            <input type="text" id="transferDesc" placeholder="Description">
            <button onclick="processTransfer()">Transfer</button>
            <button onclick="closeForm()">Cancel</button>
        </div>
    `;
}

async function processTransfer() {
    const recipient_email = document.getElementById('transferEmail').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const description = document.getElementById('transferDesc').value;
    
    if (!recipient_email || !amount || amount <= 0) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        const result = await apiCall('/transactions/transfer', 'POST', { recipient_email, amount, description });
        document.getElementById('balance').innerText = result.new_balance.toFixed(2);
        alert(result.message);
        closeForm();
    } catch (error) {
        alert('Transfer failed: ' + error.message);
    }
}

async function showHistory() {
    try {
        const transactions = await apiCall('/transactions/history');
        
        document.getElementById('history').innerHTML = `
            <div class="form-popup">
                <h3>Transaction History</h3>
                ${transactions.map(t => `
                    <div class="transaction ${t.type === 'deposit' ? 'credit' : 'debit'}">
                        <strong>${t.type.toUpperCase()}</strong><br>
                        Amount: $${t.amount}<br>
                        ${t.counterparty ? `Counterparty: ${t.counterparty}<br>` : ''}
                        ${t.description ? `Note: ${t.description}<br>` : ''}
                        Date: ${new Date(t.created_at).toLocaleString()}
                    </div>
                `).join('')}
                <button onclick="closeForm()">Close</button>
            </div>
        `;
    } catch (error) {
        alert('Failed to load history');
    }
}

// Admin Dashboard
async function showAdminDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    // Load admin stats
    const stats = await apiCall('/admin/stats');
    displayStats(stats);
    showUsers(); // Show users by default
}

function displayStats(stats) {
    document.getElementById('adminContent').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Users</h3>
                <div class="stat-value">${stats.summary.total_users}</div>
            </div>
            <div class="stat-card">
                <h3>Total Transactions</h3>
                <div class="stat-value">${stats.summary.total_transactions}</div>
            </div>
            <div class="stat-card">
                <h3>Total Volume</h3>
                <div class="stat-value">$${stats.summary.total_volume.toFixed(2)}</div>
            </div>
        </div>
    `;
}

async function showUsers() {
    const users = await apiCall('/admin/users');
    
    document.getElementById('adminContent').innerHTML = `
        <h3>All Users</h3>
        ${users.map(user => `
            <div class="user-card">
                <div>
                    <strong>${user.name}</strong><br>
                    Email: ${user.email}<br>
                    Balance: $${user.balance.toFixed(2)}<br>
                    Role: ${user.role}
                </div>
                <div>
                    <input type="number" id="balance_${user.id}" placeholder="New Balance" step="0.01">
                    <button onclick="updateBalance(${user.id})">Update</button>
                    <button onclick="deleteUser(${user.id})" style="background:#f56565">Delete</button>
                </div>
            </div>
        `).join('')}
    `;
}

async function updateBalance(userId) {
    const newBalance = parseFloat(document.getElementById(`balance_${userId}`).value);
    
    if (isNaN(newBalance)) {
        alert('Please enter a valid amount');
        return;
    }
    
    try {
        await apiCall(`/admin/users/${userId}/balance`, 'PUT', { balance: newBalance });
        alert('Balance updated successfully!');
        showUsers(); // Refresh
    } catch (error) {
        alert('Failed to update balance');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        await apiCall(`/admin/users/${userId}`, 'DELETE');
        alert('User deleted successfully');
        showUsers(); // Refresh
    } catch (error) {
        alert('Failed to delete user');
    }
}

async function showAnalytics() {
    const stats = await apiCall('/admin/stats');
    
    document.getElementById('adminContent').innerHTML = `
        <h3>Analytics Dashboard</h3>
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Users</h3>
                <div class="stat-value">${stats.summary.total_users}</div>
            </div>
            <div class="stat-card">
                <h3>Total Transactions</h3>
                <div class="stat-value">${stats.summary.total_transactions}</div>
            </div>
            <div class="stat-card">
                <h3>Total Volume</h3>
                <div class="stat-value">$${stats.summary.total_volume.toFixed(2)}</div>
            </div>
        </div>
        
        <div class="chart-container">
            <canvas id="transactionChart"></canvas>
        </div>
        
        <div class="chart-container">
            <canvas id="topUsersChart"></canvas>
        </div>
        
        <div class="chart-container">
            <canvas id="typeChart"></canvas>
        </div>
    `;
    
    // Create charts
    const ctx1 = document.getElementById('transactionChart').getContext('2d');
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: stats.recent_transactions.map(t => t.date).reverse(),
            datasets: [{
                label: 'Transaction Volume ($)',
                data: stats.recent_transactions.map(t => t.total).reverse(),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        }
    });
    
    const ctx2 = document.getElementById('topUsersChart').getContext('2d');
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: stats.top_users.map(u => u.name),
            datasets: [{
                label: 'Balance ($)',
                data: stats.top_users.map(u => u.balance),
                backgroundColor: '#48bb78'
            }]
        }
    });
    
    const ctx3 = document.getElementById('typeChart').getContext('2d');
    new Chart(ctx3, {
        type: 'pie',
        data: {
            labels: stats.type_distribution.map(t => t.type),
            datasets: [{
                data: stats.type_distribution.map(t => t.count),
                backgroundColor: ['#667eea', '#48bb78', '#f56565', '#ed8936']
            }]
        }
    });
}

async function showTransactions() {
    const transactions = await apiCall('/admin/transactions');
    
    document.getElementById('adminContent').innerHTML = `
        <h3>All Transactions</h3>
        ${transactions.map(t => `
            <div class="transaction">
                <strong>${t.type.toUpperCase()}</strong><br>
                Amount: $${t.amount}<br>
                Sender: ${t.sender_name || 'N/A'}<br>
                Recipient: ${t.recipient_name || 'N/A'}<br>
                Date: ${new Date(t.created_at).toLocaleString()}
            </div>
        `).join('')}
    `;
}

function closeForm() {
    document.getElementById('forms').innerHTML = '';
    document.getElementById('history').innerHTML = '';
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('loginForm').reset();
}

// Check if user is logged in
if (token) {
    // Try to get profile to determine if token is valid
    apiCall('/users/profile').then(profile => {
        currentUser = profile;
        if (profile.role === 'admin') {
            showAdminDashboard();
        } else {
            showUserDashboard();
        }
    }).catch(() => {
        localStorage.removeItem('token');
        token = null;
        showTab('login');
    });
} else {
    showTab('login');
}