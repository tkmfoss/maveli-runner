import { initializeAuthGuard, clearAuthToken, redirectToLogin } from './auth-guard.js';
import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

const loadingScreen = document.getElementById('loadingScreen');
const progressBar = document.getElementById('progressBar');
const loadingText = document.getElementById('loadingText');
const mainContent = document.getElementById('mainContent');

function updateLoadingProgress(progress, text) {
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function showLoadingScreen() {
    if (loadingScreen) {
        loadingScreen.classList.remove('fade-out');
        updateLoadingProgress(0, 'Loading...');
    }
    if (mainContent) {
        mainContent.classList.remove('ready');
    }
}

function hideLoadingScreen() {
    if (loadingScreen) {
        updateLoadingProgress(100, 'Ready!');
        setTimeout(() => {
            loadingScreen.classList.add('fade-out');
            if (mainContent) {
                mainContent.classList.add('ready');
            }
        }, 200);
    }
}

async function simulateLoadingWithProgress() {
    const steps = [
        { progress: 25, text: 'Checking authentication...', duration: 400 },
        { progress: 50, text: 'Connecting to server...', duration: 500 },
        { progress: 75, text: 'Fetching leaderboard data...', duration: 600 },
        { progress: 100, text: 'Ready!', duration: 200 }
    ];

    for (const step of steps) {
        updateLoadingProgress(step.progress, step.text);
        await new Promise(resolve => setTimeout(resolve, step.duration));
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoadingScreen();
        
        const loadingProgressPromise = simulateLoadingWithProgress();
        
        const isAuthenticated = await initializeAuthGuard();
        if (isAuthenticated) {
            await fetchLeaderboard();
            setupLogout();
        }
        
        await loadingProgressPromise;
        
        setTimeout(() => {
            hideLoadingScreen();
        }, 300);
        
    } catch (error) {
        console.error('Error during initialization:', error);
        updateLoadingProgress(100, 'Error loading leaderboard');
        setTimeout(hideLoadingScreen, 1000);
    }
});

async function fetchLeaderboard() {
    console.log("Backend URL used:", BACKEND_URL);

    try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        } 
        const data = await response.json();

        if (data.error) {
            console.error("Backend error:", data.error);
            return;
        }

        const leaderboardTable = document.querySelector("#leaderboard");
        if (!leaderboardTable) {
            console.error("Leaderboard table element not found");
            return;
        }

        leaderboardTable.innerHTML = "";

        if (data.leaderboard && Array.isArray(data.leaderboard)) {
            data.leaderboard.forEach(({ rank, player, score }) => {
                const row = document.createElement("tr");

                const rankCell = document.createElement("td");
                rankCell.textContent = rank || 'N/A';
                row.appendChild(rankCell);

                const playerCell = document.createElement("td");
                playerCell.textContent = player || 'Anonymous';
                row.appendChild(playerCell);

                const scoreCell = document.createElement("td");
                scoreCell.textContent = score || 0;
                row.appendChild(scoreCell);

                leaderboardTable.appendChild(row);
            });
        } else {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 3;
            cell.textContent = "No scores available";
            cell.style.textAlign = "center";
            row.appendChild(cell);
            leaderboardTable.appendChild(row);
        }
        
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        
        const leaderboardTable = document.querySelector("#leaderboard");
        if (leaderboardTable) {
            leaderboardTable.innerHTML = "";
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 3;
            cell.textContent = "Error loading leaderboard";
            cell.style.textAlign = "center";
            cell.style.color = "red";
            row.appendChild(cell);
            leaderboardTable.appendChild(row);
        }
    }
}

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    } else {
        console.warn('Logout button not found');
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