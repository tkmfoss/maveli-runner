import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;
const PROTECTED_PAGES = ['mainmenu.html', 'game.html', 'leaderboard.html'];
const PUBLIC_ONLY_PAGES = ['index.html'];

function getCurrentPageName() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function isProtectedPage(pageName = getCurrentPageName()) {
    return PROTECTED_PAGES.includes(pageName);
}

function isPublicOnlyPage(pageName = getCurrentPageName()) {
    return PUBLIC_ONLY_PAGES.includes(pageName);
}

function getAuthToken() {
    return localStorage.getItem('authToken');
}

async function verifyToken(token) {
    if (!token) return false;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification failed:', error);
        return false;
    }
}



function clearAuthToken() {
    localStorage.removeItem('authToken');
}

function redirectToLogin() {
    window.location.href = 'index.html';
}

function redirectToMainMenu() {
    window.location.href = 'mainmenu.html';
}

async function authGuard() {
    const currentPage = getCurrentPageName();
    const token = getAuthToken();
    
    if (isProtectedPage(currentPage)) {
        if (!token) {
            redirectToLogin();
            return false;
        }
        const isValidToken = await verifyToken(token);
        if (!isValidToken) {
            clearAuthToken();
            redirectToLogin();
            return false;
        }
        return true;
    }
    
    if (isPublicOnlyPage(currentPage) && token) {
        const isValidToken = await verifyToken(token);
        if (isValidToken) {
            redirectToMainMenu();
            return false;
        } else {
            clearAuthToken();
        }
    }
    
    return true;
}

async function initializeAuthGuard() {
    return await authGuard();
}

export {
    authGuard,
    initializeAuthGuard,
    getAuthToken,
    verifyToken,
    clearAuthToken,
    redirectToLogin,
    redirectToMainMenu,
    isProtectedPage,
    isPublicOnlyPage
};