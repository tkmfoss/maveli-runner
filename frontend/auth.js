import { initializeAuthGuard } from './auth-guard.js';
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

    toSignup.addEventListener("click", () => {
        loginForm.style.display = "none";
        signupForm.style.display = "block";
    });
    
    toLogin.addEventListener("click", () => {
        signupForm.style.display = "none";
        loginForm.style.display = "block";
    });

    loginForm.addEventListener("submit", handleLogin);
    signupForm.addEventListener("submit", handleSignup);
}

async function signup(username, email, pass) {
    if (!username || !email || !pass) {
        throw new Error("All fields are required");
    }
    
    const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, pass }),
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Signup failed");
    }
    return data.user;
}

async function login(email, password) {
    if (!email || !password) {
        throw new Error("Email and password are required");
    }
    
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Login failed");
    }

    if (data.token) {
        sessionStorage.setItem("authToken", data.token);
    }

    return data;
}

async function handleSignup(event) {
    event.preventDefault();
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    try {
        submitButton.textContent = "Signing up...";
        submitButton.disabled = true;
        
        const username = document.getElementById("signupUsername").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const pass = document.getElementById("signupPassword").value;

        const user = await signup(username, email, pass);
        
        await Swal.fire({
            icon: 'success',
            title: 'Signup Successful!',
            text: `Please verify your email from the mail to login`,
            confirmButtonText: 'Continue',
            timer: 3000,
            timerProgressBar: true
        });
        
        event.target.reset();
        document.getElementById("signupForm").style.display = "none";
        document.getElementById("loginForm").style.display = "block";
        
    } catch (err) {
        await Swal.fire({
            icon: 'error',
            title: 'Signup Failed',
            text: err.message,
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
        submitButton.textContent = "Logging in...";
        submitButton.disabled = true;
        
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        const user = await login(email, password);
        
        await Swal.fire({
            icon: 'success',
            title: 'Login Successful!',
            text: `Welcome back, ${user.username}!`,
            confirmButtonText: 'Continue',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
        });
        
        document.getElementById("authModal").classList.remove("active");
        window.location.href = "mainmenu.html";
        
    } catch (err) {
        await Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: err.message,
            confirmButtonText: 'Try Again'
        });
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}