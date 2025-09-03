import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;
const PROTECTED_PAGES = ['mainmenu.html', 'game.html', 'leaderboard.html'];
const PUBLIC_ONLY_PAGES = ['index.html'];

const StorageHelper = {
  setToken(token) {
    try {
      localStorage.setItem('authToken', token);
      return true;
    } catch (error) {
      console.warn('localStorage failed, using sessionStorage:', error.message);
      try {
        sessionStorage.setItem('authToken', token);
        return true;
      } catch (sessionError) {
        console.error('Both storage methods failed:', sessionError);
        return false;
      }
    }
  },
  
  getToken() {
    try {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    } catch (error) {
      console.warn('Storage access failed:', error);
      try {
        return sessionStorage.getItem('authToken');
      } catch (sessionError) {
        console.error('Session storage also failed:', sessionError);
        return null;
      }
    }
  },
  
  removeToken() {
    try {
      localStorage.removeItem('authToken');
    } catch (error) {
      console.warn('localStorage removal failed:', error);
    }
    try {
      sessionStorage.removeItem('authToken');
    } catch (error) {
      console.warn('sessionStorage removal failed:', error);
    }
  },
  
  cleanup() {
    const keysToTry = ['authToken', 'userProfile', 'tempData'];
    keysToTry.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (error) {

      }
    });
  }
};

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
    return StorageHelper.getToken();
}

async function verifyToken(token, retryCount = 0) {
    if (!token) {
        console.log('No token provided for verification');
        return false;
    }
    
    const maxRetries = 3;
    
    try {
        console.log(`Verifying token (attempt ${retryCount + 1})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        
        const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Token verification successful');
            
            if (data.username) {
                try {
                    localStorage.setItem('username', data.username);
                } catch (error) {

                }
            }
            
            return true;
        } else if (response.status === 401) {
            console.log('Token is invalid or expired');
            return false;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Token verification error:', error.message);
        
        if (retryCount < maxRetries && 
            (error.name === 'AbortError' || 
             error.message.includes('fetch') || 
             error.message.includes('network') ||
             error.message.includes('timeout'))) {
            
            console.log(`Retrying verification in ${(retryCount + 1) * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
            
            return verifyToken(token, retryCount + 1);
        }
        
        return false;
    }
}

function clearAuthToken() {
    console.log('Clearing authentication token');
    StorageHelper.removeToken();
    
    try {
        localStorage.removeItem('username');
        sessionStorage.removeItem('username');
    } catch (error) {
        
    }
}

function redirectToLogin() {
    if (getCurrentPageName() === 'index.html') {
        return; 
    }
    
    console.log('Redirecting to login page');
    window.location.href = 'index.html';
}

function redirectToMainMenu() {
    if (getCurrentPageName() === 'mainmenu.html') {
        return; 
    }
    
    console.log('Redirecting to main menu');
    window.location.href = 'mainmenu.html';
}

async function authGuard() {
    const currentPage = getCurrentPageName();
    const token = getAuthToken();
    
    console.log(`Auth guard check: page=${currentPage}, hasToken=${!!token}`);
    
    if (isProtectedPage(currentPage)) {
        if (!token) {
            console.log('No token found, redirecting to login');
            redirectToLogin();
            return false;
        }
        
        console.log('Verifying token for protected page...');
        const isValid = await verifyToken(token);
        
        if (!isValid) {
            console.log('Token invalid, clearing and redirecting to login');
            clearAuthToken();
            redirectToLogin();
            return false;
        }
        
        console.log('Token valid, access granted');
        return true;
    }
    
    if (isPublicOnlyPage(currentPage) && token) {
        console.log('On public page with token, checking validity...');
        const isValid = await verifyToken(token);
        
        if (isValid) {
            console.log('Valid token on public page, redirecting to main menu');
            redirectToMainMenu();
            return false;
        } else {
            console.log('Invalid token found, clearing it');
            clearAuthToken();
        }
    }
    
    return true;
}

async function initializeAuthGuard() {
    try {
        console.log('Initializing auth guard...');
        
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        if (isFirefox) {
            console.log('Firefox detected, performing cleanup check');
            
            try {
                const testKey = '__test__';
                localStorage.setItem(testKey, 'test');
                const retrieved = localStorage.getItem(testKey);
                localStorage.removeItem(testKey);
                
                if (retrieved !== 'test') {
                    console.warn('localStorage not functioning properly, cleaning up');
                    StorageHelper.cleanup();
                }
            } catch (error) {
                console.warn('localStorage test failed:', error.message);
                StorageHelper.cleanup();
            }
        }
        
        const result = await authGuard();
        console.log('Auth guard initialization complete:', result);
        return result;
        
    } catch (error) {
        console.error('Auth guard initialization error:', error);
        
        clearAuthToken();
        
        if (isProtectedPage()) {
            redirectToLogin();
            return false;
        }
        
        return true;
    }
}

function checkFirefoxCompatibility() {
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    
    if (isFirefox) {
        console.log('Firefox browser detected - applying compatibility measures');
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'authToken' && !e.newValue && isProtectedPage()) {
                console.log('Auth token removed in another tab, redirecting...');
                setTimeout(() => redirectToLogin(), 100);
            }
        });
        
        window.addEventListener('error', (e) => {
            if (e.message && e.message.includes('quota')) {
                console.warn('Storage quota exceeded, cleaning up');
                StorageHelper.cleanup();
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('load', checkFirefoxCompatibility);
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
    isPublicOnlyPage,
    StorageHelper
};