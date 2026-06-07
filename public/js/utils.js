function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function fillDemo(type) {
    console.log('Filling demo credentials for:', type);
    
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    
    if (!emailInput || !passwordInput) {
        console.error('Login form inputs not found');
        return;
    }
    
    if (type === 'user') {
        emailInput.value = 'bsse2480204@szabist.pk';
        passwordInput.value = 'password123';
        console.log('Filled Laiba credentials');
    } else if (type === 'user2') {
        emailInput.value = 'bsse2480221@szabist.pk';
        passwordInput.value = 'password123';
        console.log('Filled Shahla credentials');
    } else if (type === 'admin') {
        emailInput.value = 'admin@digitalwallet.com';
        passwordInput.value = 'password123';
        console.log('Filled Admin credentials');
    }
    
    showToast('Demo credentials filled!', 'success');
    
    // Optional: Auto-submit the form
    // document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

// Toggle password visibility
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('toggle-password')) {
        const input = e.target.parentElement.querySelector('input');
        if (input) {
            if (input.type === 'password') {
                input.type = 'text';
                e.target.classList.remove('fa-eye-slash');
                e.target.classList.add('fa-eye');
            } else {
                input.type = 'password';
                e.target.classList.remove('fa-eye');
                e.target.classList.add('fa-eye-slash');
            }
        }
    }
});

// Make fillDemo available globally
window.fillDemo = fillDemo;