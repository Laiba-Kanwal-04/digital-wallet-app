let balanceChart = null;
let spendingChart = null;
let categoryChart = null;

function createBalanceChart(data) {
    const ctx = document.getElementById('balanceChart')?.getContext('2d');
    if (!ctx) return;
    
    if (balanceChart) balanceChart.destroy();
    
    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Balance Trend',
                data: data.balances || [0, 0, 0, 0],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Balance: $${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value; } } } }
        }
    });
}

function createCategoryChart(data) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    if (categoryChart) categoryChart.destroy();
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.categories || [],
            datasets: [{
                data: data.amounts || [],
                backgroundColor: ['#667eea', '#48bb78', '#f56565', '#ed8936', '#4299e1', '#9f7aea'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createVolumeChart(data) {
    const ctx = document.getElementById('volumeChart')?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates || [],
            datasets: [{
                label: 'Transaction Volume',
                data: data.income || [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value; } } } }
        }
    });
}

function createUserDistributionChart(data) {
    const ctx = document.getElementById('userDistributionChart')?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Active Users', 'Inactive Users', 'Suspended'],
            datasets: [{
                data: [data.active || 0, data.inactive || 0, data.suspended || 0],
                backgroundColor: ['#48bb78', '#a0aec0', '#f56565'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}