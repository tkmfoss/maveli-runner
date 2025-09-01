import { initializeAuthGuard, clearAuthToken, redirectToLogin } from './auth-guard.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const isAuthenticated = await initializeAuthGuard();
        if (isAuthenticated) {
            setupMainMenu();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

function setupMainMenu() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    } else {
        console.warn('Logout button not found');
    }
    
    const playBtn = document.querySelector('a[href="game.html"]');
    const leaderboardBtn = document.querySelector('a[href="leaderboard.html"]');
    
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            console.log('Navigating to game...');
        });
    }
    
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', (e) => {
            console.log('Navigating to leaderboard...');
        });
    }
}

async function handleLogout() {
    const result = await Swal.fire({
        icon: 'question',
        title: 'Logout Confirmation',
        text: 'Are you sure you want to logout?',
        showCancelButton: true,
        confirmButtonText: 'Yes, logout',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });

    if (result.isConfirmed) {
        clearAuthToken();
        
        await Swal.fire({
            icon: 'success',
            title: 'Logged Out',
            text: 'You have been logged out successfully!',
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false
        });
        
        redirectToLogin();
    }
}