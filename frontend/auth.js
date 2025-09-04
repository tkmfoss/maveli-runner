import { initializeAuthGuard, StorageHelper } from './auth-guard.js';
import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const canAccessPage = await initializeAuthGuard();
        if (canAccessPage) {
            setupAuthenticationForms();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        setupAuthenticationForms();
    }
});

function setupAuthenticationForms() {
    const modal = document.getElementById("authModal");
    const openBtn = document.getElementById("openModal");
    const closeBtn = document.getElementById("closeModal");

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const toSignup = document.getElementById("toSignup");
    const toLogin = document.getElementById("toLogin");

    if (!modal || !openBtn || !closeBtn || !loginForm || !signupForm || !toSignup || !toLogin) {
        console.error("Required DOM elements not found");
        return;
    }

    openBtn.addEventListener("click", () => modal.classList.add("active"));
    closeBtn.addEventListener("click", () => modal.classList.remove("active"));
    
    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.classList.remove("active");
        }
    });

    toSignup.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.style.display = "none";
        signupForm.style.display = "block";
    });
    
    toLogin.addEventListener("click", (e) => {
        e.preventDefault();
        signupForm.style.display = "none";
        loginForm.style.display = "block";
    });

    loginForm.addEventListener("submit", handleLogin);
    signupForm.addEventListener("submit", handleSignup);
    
    const usernameInput = document.getElementById("signupUsername");
    if (usernameInput) {
        let timeoutId;
        usernameInput.addEventListener("input", (e) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => checkUsernameAvailability(e.target.value), 500);
        });
    }
}

async function checkUsernameAvailability(username) {
    if (!username || username.trim().length < 3) {
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/check-username/${encodeURIComponent(username.trim())}`, {
            method: "GET",
            headers: { 
                "Accept": "application/json"
            }
        });
        
        const data = await response.json();
        const usernameInput = document.getElementById("signupUsername");
        
        if (response.ok) {
            if (!data.available) {
                usernameInput.style.borderColor = "#e74c3c";
                showUsernameError("Username already exists. Please choose a different one.");
            } else {
                usernameInput.style.borderColor = "#27ae60";
                hideUsernameError();
            }
        }
    } catch (error) {
        console.error('Error checking username availability:', error);
    }
}

function showUsernameError(message) {
    let errorElement = document.getElementById("username-error");
    if (!errorElement) {
        errorElement = document.createElement("div");
        errorElement.id = "username-error";
        errorElement.style.color = "#e74c3c";
        errorElement.style.fontSize = "12px";
        errorElement.style.marginTop = "5px";
        
        const usernameInput = document.getElementById("signupUsername");
        usernameInput.parentNode.insertBefore(errorElement, usernameInput.nextSibling);
    }
    errorElement.textContent = message;
}

function hideUsernameError() {
    const errorElement = document.getElementById("username-error");
    if (errorElement) {
        errorElement.remove();
    }
}

function validateInputs(username, email, password, isSignup = true) {
    const errors = [];
    
    if (isSignup && (!username || username.trim().length < 3)) {
        errors.push("Username must be at least 3 characters long");
    }
    
    if (isSignup && username && !/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
        errors.push("Username can only contain letters, numbers, underscores, and hyphens");
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Please enter a valid email address");
    }
    
    if (!password || password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    }
    
    return errors;
}

async function signup(username, email, pass) {
    const validationErrors = validateInputs(username, email, pass, true);
    if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('. '));
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                username: username.trim(), 
                email: email.trim().toLowerCase(), 
                pass 
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Signup failed with status ${response.status}`);
        }
        
        return data.user;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error("Request timed out. Please check your connection and try again.");
        }
        
        throw error;
    }
}

async function login(email, password) {
    const validationErrors = validateInputs(null, email, password, false);
    if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('. '));
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                email: email.trim().toLowerCase(), 
                password 
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Login failed with status ${response.status}`);
        }

        if (data.token) {
            const tokenStored = StorageHelper.setToken(data.token);
            
            if (!tokenStored) {
                console.warn('Failed to store auth token locally');
            }
            
            if (data.username) {
                try {
                    localStorage.setItem('username', data.username);
                } catch (error) {
                }
            }
        }

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error("Request timed out. Please check your connection and try again.");
        }
        
        throw error;
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    try {
        submitButton.textContent = "Creating account...";
        submitButton.disabled = true;
        
        const username = document.getElementById("signupUsername").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const pass = document.getElementById("signupPassword").value;

        await signup(username, email, pass);
        
        await Swal.fire({
            icon: 'success',
            title: 'Account Created Successfully!',
            html: `<div style="background-color: #fff3cd; color: #856404; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #ffc107;">
                    <strong>Important:</strong> Please check your email and click the verification link to complete your registration.
                   </div>`,
            confirmButtonText: 'Continue to Login',
            timer: 8000,
            timerProgressBar: true
        });

        event.target.reset();
        document.getElementById("signupForm").style.display = "none";
        document.getElementById("loginForm").style.display = "block";
        
        document.getElementById("loginEmail").value = email;
        
        const usernameInput = document.getElementById("signupUsername");
        usernameInput.style.borderColor = "";
        hideUsernameError();
        
    } catch (err) {
        console.error('Signup error:', err);
        
        let errorTitle = 'Signup Failed';
        let errorMessage = err.message;
        
        if (err.message.includes('Username already exists')) {
            errorTitle = 'Username Not Available';
            errorMessage = 'This username is already taken. Please choose a different username.';
            
            const usernameInput = document.getElementById("signupUsername");
            usernameInput.style.borderColor = "#e74c3c";
            usernameInput.focus();
        }
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            text: errorMessage,
            confirmButtonText: 'Try Again'
        });
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    try {
        submitButton.textContent = "Signing in...";
        submitButton.disabled = true;
        
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        const result = await login(email, password);
        
        await Swal.fire({
            icon: 'success',
            title: 'Welcome Back!',
            text: `Successfully logged in as ${result.username}`,
            confirmButtonText: 'Continue',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
        });
        
        document.getElementById("authModal").classList.remove("active");
        
        setTimeout(() => {
            window.location.href = "mainmenu.html";
        }, 500);
        
    } catch (err) {
        console.error('Login error:', err);
        
        let errorMessage = err.message;
        
        if (err.message.includes('verify your email')) {
            errorMessage = 'Please verify your email address before logging in.';
        } else if (err.message.includes('Invalid email or password')) {
            errorMessage = 'Invalid email or password. Please try again.';
        }
        
        await Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: errorMessage,
            confirmButtonText: 'Try Again'
        });
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

window.addEventListener('online', () => {
    console.log('Connection restored');
});

window.addEventListener('offline', () => {
    console.log('Connection lost');
    Swal.fire({
        icon: 'warning',
        title: 'Connection Lost',
        text: 'Please check your internet connection and try again.',
        confirmButtonText: 'OK'
    });
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const token = StorageHelper.getToken();
        if (!token && (window.location.pathname.includes('mainmenu') || 
                      window.location.pathname.includes('game') || 
                      window.location.pathname.includes('leaderboard'))) {
            console.log('No token found on protected page after visibility change');
            window.location.href = 'index.html';
        }
    }
});