import { initializeAuthGuard, getAuthToken } from './auth-guard.js';
import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

// Game constants - centralized configuration
const GAME_CONSTANTS = {
    BASE_SPEED: 4000,
    MIN_SPEED: 1000,
    BASE_JUMP_DURATION: 1200,
    MIN_JUMP_DURATION: 800,
    SCORE_INCREMENT_INTERVAL: 50,
    COLLISION_CHECK_INTERVAL: 20,
    JUMP_DEBOUNCE_TIME: 100,
    DIFFICULTY_CHECK_TIMEOUT: 10000, // 10 second safety timeout
    SPEED_REDUCTION_PER_1000_SCORE: 400
};

// DOM elements
const playerElement = document.querySelector('.player');
const obstacleElement = document.querySelector('.obstacle');
const scoreElement = document.querySelector('.score-card .score');
const highscoreElement = document.querySelector('.score-card .high-score');
const restartGameElement = document.querySelector('.restart-game');
const gamecontainerElement = document.querySelector('.game-container');
const loadingScreen = document.getElementById('loadingScreen');
const progressBar = document.getElementById('progressBar');
const loadingText = document.getElementById('loadingText');
const gameContainer = document.getElementById('gameContainer');

// Game state variables
const OBSTACLE_SIZE = ['s','m','l'];
let jumping = false;
let gameActive = false;
let gameStartTime = null;
let gameEvents = [];
let score = 0;
let highscore = 0;
let gameDataLoaded = false;
let lastJumpTime = 0; // For jump debouncing

// Game intervals
let collisionInterval;
let scoreInterval;
let changeObstacleInterval;
let pendingTimeoutId = null; // For cleanup

// Difficulty system variables
let currentSpeed = GAME_CONSTANTS.BASE_SPEED; 
let currentJumpDuration = GAME_CONSTANTS.BASE_JUMP_DURATION; 
let currentBackground = 1;
let isBackground2 = false;
let waitingForObstacleCompletion = false;
let pendingDifficultyChange = null;

// Mobile landscape orientation enforcement - ENHANCED SYSTEM
function enforceOrientation() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile && window.innerHeight > window.innerWidth) {
        // Portrait mode on mobile - show orientation message
        showOrientationMessage();
    } else if (isMobile && window.innerHeight <= window.innerWidth) {
        // Landscape mode on mobile - hide orientation message
        hideOrientationMessage();
    }
}

function showOrientationMessage() {
    let orientationMessage = document.getElementById('orientationMessage');
    if (!orientationMessage) {
        orientationMessage = document.createElement('div');
        orientationMessage.id = 'orientationMessage';
        orientationMessage.className = 'orientation-message';
        orientationMessage.innerHTML = `
            <div class="icon">📱</div>
            <h2>Please Rotate Your Device</h2>
            <p>
                This game is optimized for landscape mode.<br>
                Please rotate your device to continue playing.
            </p>
        `;
        document.body.appendChild(orientationMessage);
    }
    orientationMessage.style.display = 'flex';
    
    // Pause game if active
    if (gameActive) {
        pauseGame();
    }
}

function hideOrientationMessage() {
    const orientationMessage = document.getElementById('orientationMessage');
    if (orientationMessage) {
        orientationMessage.style.display = 'none';
    }
    
    // Resume game if it was paused
    resumeGame();
}

function pauseGame() {
    if (!gameActive) return;
    
    if (obstacleElement) {
        obstacleElement.style.animationPlayState = 'paused';
    }
    
    // Pause all intervals without clearing them
    if (collisionInterval) clearInterval(collisionInterval);
    if (scoreInterval) clearInterval(scoreInterval);
}

function resumeGame() {
    if (!gameActive) return;
    
    if (obstacleElement) {
        obstacleElement.style.animationPlayState = 'running';
    }
    
    // Resume intervals
    if (gameActive) {
        collisionDetection();
        countScore();
    }
}

// Add orientation change listener
window.addEventListener('orientationchange', () => {
    setTimeout(enforceOrientation, 100); // Small delay for orientation change to complete
});
window.addEventListener('resize', enforceOrientation);

// Loading screen functions
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
        updateLoadingProgress(0, 'Initializing...');
    }
    if (gameContainer) {
        gameContainer.classList.remove('ready');
    }
}

function hideLoadingScreen() {
    if (loadingScreen) {
        updateLoadingProgress(100, 'Ready to play!');
        setTimeout(() => {
            loadingScreen.classList.add('fade-out');
            if (gameContainer) {
                gameContainer.classList.add('ready');
            }
            setTimeout(() => {
                if (gameDataLoaded) {
                    startGame();
                }
            }, 500);
        }, 200);
    }
}

// Game initialization
async function initializeGame() {
    try {
        showLoadingScreen();
        
        // Check orientation first
        enforceOrientation();
        
        updateLoadingProgress(20, 'Checking authentication...');
        const isAuthenticated = await initializeAuthGuard();
        
        updateLoadingProgress(40, 'Loading high score...');
        await loadHighScore();
        
        updateLoadingProgress(60, 'Preparing game assets...');
        await initializeGameElements();
        
        updateLoadingProgress(80, 'Setting up controls...');
        setupEventListeners();
        
        updateLoadingProgress(100, 'Ready to play!');
        gameDataLoaded = true;
        
        setTimeout(() => {
            hideLoadingScreen();
        }, 500);
        
    } catch (error) {
        console.error('Error during initialization:', error);
        updateLoadingProgress(100, 'Error loading game');
        gameDataLoaded = true;
        setTimeout(hideLoadingScreen, 1000);
    }
}

async function initializeGameElements() {
    return new Promise((resolve) => {
        if (!playerElement || !obstacleElement || !scoreElement || !highscoreElement) {
            console.error('Required game elements not found');
            resolve();
            return;
        }
        if (obstacleElement) {
            obstacleElement.style.animation = 'none';
            obstacleElement.style.left = '100%';
        }
        setScore(0);
        
        setTimeout(resolve, 200); 
    });
}

function setupEventListeners() {
    const resetBtn = document.getElementById("btn-reset");
    const menuBtn = document.getElementById("btn-main-menu");
    
    if (resetBtn) {
        resetBtn.addEventListener("click", restartgame);
    }
    
    if (menuBtn) {
        menuBtn.addEventListener("click", mainmenu);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

// Game session management - SIMPLIFIED TO 2 EVENTS
function initGameSession() {
    gameStartTime = Date.now();
    gameEvents = [];
    gameActive = true;
    // Reset difficulty settings
    currentSpeed = GAME_CONSTANTS.BASE_SPEED;
    currentJumpDuration = GAME_CONSTANTS.BASE_JUMP_DURATION;
    currentBackground = 1;
    isBackground2 = false;
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
    lastJumpTime = 0;
    
    // Clear any pending timeouts
    if (pendingTimeoutId) {
        clearTimeout(pendingTimeoutId);
        pendingTimeoutId = null;
    }
}

// SIMPLIFIED: Only record start and collision events
function recordGameEvent(eventType, additionalData = {}) {
    if (!gameActive && eventType !== 'collision') return;
    
    // Only record these 2 event types
    if (eventType !== 'game_start' && eventType !== 'collision') {
        return;
    }
    
    const relativeTimestamp = Date.now() - gameStartTime;
    
    gameEvents.push({
        type: eventType,
        timestamp: relativeTimestamp,
        score: score,
        ...additionalData
    });
    
    console.log('Event recorded:', eventType, 'at', relativeTimestamp, 'ms');
}

// Enhanced input handling with debouncing
function jumpListener() {
    // Remove existing listeners to prevent duplicates
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('click', handleClick);
    
    // Add new listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('click', handleClick);
}

function handleKeyDown(event) {
    if(event.key === ' '|| event.key === 'ArrowUp') {
        event.preventDefault();
        jump();
    }
}

function handleTouchStart(event) {
    if (!gameActive) return;
    
    const target = event.target;
    const isModalVisible = restartGameElement && restartGameElement.classList.contains('show');
    const isModalButton = target.closest('.restart-game .btn-reset-game') || 
                         target.closest('.restart-game .btn-main-menu-game') ||
                         target.closest('.restart-game');
    
    if (isModalVisible && isModalButton) {
        return;
    }
    
    // Check if target is within game container
    const isGameArea = target.closest('.game-container');
    if (!isGameArea) {
        return; // Don't prevent default for elements outside game area
    }
    
    if (target.tagName === 'INPUT' || 
        target.tagName === 'BUTTON' || 
        target.tagName === 'SELECT' || 
        target.tagName === 'TEXTAREA' ||
        target.closest('.modal') ||
        target.closest('form')) {
        return;
    }
    
    event.preventDefault();
    jump();
}

function handleClick(event) {
    if (!gameActive) return;
    
    const target = event.target;
    
    const isModalVisible = restartGameElement && restartGameElement.classList.contains('show');
    const isModalButton = target.closest('.restart-game .btn-reset-game') || 
                         target.closest('.restart-game .btn-main-menu-game') ||
                         target.closest('.restart-game');
    
    if (isModalVisible && isModalButton) {
        return;
    }
    
    // Check if target is within game container
    const isGameArea = target.closest('.game-container');
    if (!isGameArea) {
        return; // Don't prevent default for elements outside game area
    }
    
    if (target.tagName === 'INPUT' || 
        target.tagName === 'BUTTON' || 
        target.tagName === 'SELECT' || 
        target.tagName === 'TEXTAREA' ||
        target.closest('.modal') ||
        target.closest('form')) {
        return;
    }
    
    event.preventDefault();
    jump();
}

// Enhanced jump function with debouncing
function jump() {
    if(jumping || !gameActive) {
        return;
    }
    
    // Debounce rapid jumps
    const currentTime = Date.now();
    if (currentTime - lastJumpTime < GAME_CONSTANTS.JUMP_DEBOUNCE_TIME) {
        return;
    }
    lastJumpTime = currentTime;
    
    jumping = true;
    // No jump event recording in simplified system
    playerElement.classList.add('jump');
    
    setTimeout(() => {
        if (playerElement) { // Check element still exists
            playerElement.classList.remove('jump');
        }
        jumping = false;
    }, currentJumpDuration);
}

// Difficulty calculation functions
function calculateCurrentSpeed(score) {
    const speedReduction = Math.floor(score / 1000) * GAME_CONSTANTS.SPEED_REDUCTION_PER_1000_SCORE; 
    const newSpeed = Math.max(GAME_CONSTANTS.MIN_SPEED, GAME_CONSTANTS.BASE_SPEED - speedReduction);
    return newSpeed;
}

function calculateJumpDuration(speed) {
    const speedRatio = speed / GAME_CONSTANTS.BASE_SPEED;
    const newJumpDuration = Math.max(GAME_CONSTANTS.MIN_JUMP_DURATION, GAME_CONSTANTS.BASE_JUMP_DURATION * speedRatio);
    return Math.round(newJumpDuration);
}

function isObstacleOffScreen() {
    if (!obstacleElement || !gamecontainerElement) return true;
    const obstacleRect = obstacleElement.getBoundingClientRect();
    const gameRect = gamecontainerElement.getBoundingClientRect();
    return obstacleRect.right < gameRect.left;
}

// Enhanced difficulty update with timeout safety
function updateGameDifficulty() {
    const newSpeed = calculateCurrentSpeed(score);
    const newJumpDuration = calculateJumpDuration(newSpeed);
    let expectedBackground = currentBackground;
    
    if (score >= 3000) {
        expectedBackground = Math.floor((score - 3000) / 1000) % 2 === 0 ? 2 : 1;
    }
    
    const needChange = (newSpeed !== currentSpeed) || (score >= 3000 && expectedBackground !== currentBackground);
    
    if (needChange && !waitingForObstacleCompletion) {
        waitingForObstacleCompletion = true;
        pendingDifficultyChange = {
            speed: newSpeed,
            jumpDuration: newJumpDuration,
            background: expectedBackground
        };
        
        // Add safety timeout to prevent infinite waiting
        const timeoutId = setTimeout(() => {
            console.warn('Difficulty change timeout - forcing update');
            if (gameActive && pendingDifficultyChange) {
                applyDifficultyChange();
            }
        }, GAME_CONSTANTS.DIFFICULTY_CHECK_TIMEOUT);
        
        const checkObstacle = setInterval(() => {
            if (isObstacleOffScreen() || !gameActive) {
                clearInterval(checkObstacle);
                clearTimeout(timeoutId);
                if (gameActive && pendingDifficultyChange) {
                    applyDifficultyChange();
                }
            }
        }, 50);
    }
}

function applyDifficultyChange() {
    if (!pendingDifficultyChange) return;
    
    currentSpeed = pendingDifficultyChange.speed;
    currentJumpDuration = pendingDifficultyChange.jumpDuration;
    
    if (pendingDifficultyChange.background !== currentBackground) {
        changeBackground(pendingDifficultyChange.background);
    }
    
    restartObstacleAnimation();
    restartObstacleInterval(); // Restart with new speed
    
    // No difficulty event recording in simplified system
    
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
}

function restartObstacleAnimation() {
    if (!obstacleElement) return;
    
    obstacleElement.style.animation = 'none';
    obstacleElement.style.left = '100%';
    obstacleElement.offsetHeight; // Force reflow
    obstacleElement.style.animation = `move ${currentSpeed / 1000}s linear infinite`;
}

function restartObstacleInterval() {
    if (changeObstacleInterval) {
        clearInterval(changeObstacleInterval);
    }
    
    // Use current speed for interval timing
    changeObstacleInterval = setInterval(() => {
        const obstacleSize = randomObstacleSize();
        
        if (isBackground2) {
            obstacleElement.className = `obstacle obstacle2 obstacle-${obstacleSize}`;
        } else {
            obstacleElement.className = `obstacle obstacle-${obstacleSize}`;
        }
        
        // No obstacle change event recording in simplified system
    }, currentSpeed); // Dynamic interval based on current speed
}

function changeBackground(backgroundNumber) {
    currentBackground = backgroundNumber;
    const backgroundImage = backgroundNumber === 2 ? 'background2.webp' : 'background1.png';
    
    gamecontainerElement.style.transition = 'background-image 0.5s ease-in-out';
    gamecontainerElement.style.backgroundImage = `url('./assets/${backgroundImage}')`;
    gamecontainerElement.style.backgroundSize = 'cover';
    gamecontainerElement.style.backgroundPosition = 'center';
    
    if (backgroundNumber === 2 && !isBackground2) {
        isBackground2 = true;
        obstacleElement.classList.add('obstacle2');
        // No background change event recording in simplified system
    } else if (backgroundNumber === 1 && isBackground2) {
        isBackground2 = false;
        obstacleElement.classList.remove('obstacle2');
        // No background change event recording in simplified system
    }
}

// Collision detection
function collisionDetection() {
    if (collisionInterval) {
        clearInterval(collisionInterval);
    }
    collisionInterval = setInterval(() => {
        if(isCollision()) {
            recordGameEvent('collision'); // Only collision event recorded
            gameActive = false;
            submitGameScore();
            stopGame();
        }
    }, GAME_CONSTANTS.COLLISION_CHECK_INTERVAL);
}

function isCollision() {
    const playerRect = playerElement.getBoundingClientRect();
    const obstacleRect = obstacleElement.getBoundingClientRect();
    
    const polygonPoints = [
        {
            x: obstacleRect.left + (obstacleRect.width * 0.20), 
            y: obstacleRect.top + (obstacleRect.height * 0.00)  
        },
        {
            x: obstacleRect.left + (obstacleRect.width * 0.80), 
            y: obstacleRect.top + (obstacleRect.height * 0.20)  
        },
        {
            x: obstacleRect.left + (obstacleRect.width * 1.00), 
            y: obstacleRect.top + (obstacleRect.height * 1.00)  
        },
        {
            x: obstacleRect.left + (obstacleRect.width * 0.00), 
            y: obstacleRect.top + (obstacleRect.height * 1.00)  
        }
    ];
    
    const playerPoints = [
        { x: playerRect.left + playerRect.width * 0.2, y: playerRect.bottom - 8 }, 
        { x: playerRect.right - playerRect.width * 0.2, y: playerRect.bottom - 8 }, 
        { x: playerRect.left + playerRect.width * 0.5, y: playerRect.top + playerRect.height * 0.8 }, 
        { x: playerRect.left + playerRect.width * 0.5, y: playerRect.top + 5 } 
    ];
    
    return playerPoints.some(point => isPointInPolygon(point, polygonPoints));
}

function isPointInPolygon(point, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
            (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
            inside = !inside;
        }
    }
    
    return inside;
}

// Score management
function setScore(newScore) {
    score = newScore;
    if (scoreElement) {
        scoreElement.innerHTML = score;
    }
    if (gameActive) {
        updateGameDifficulty();
    }
}

function countScore() {
    if (scoreInterval) {
        clearInterval(scoreInterval);
    }
    
    scoreInterval = setInterval(() => {
        if (!gameActive) return;
        setScore(score + 1);
        // No score increment event recording in simplified system
    }, GAME_CONSTANTS.SCORE_INCREMENT_INTERVAL);
}

// High score management
async function loadHighScore() {
    try {
        const token = getAuthToken();
        if (!token) {
            highscore = 0;
            if (highscoreElement) {
                highscoreElement.innerText = highscore;
            }
            return;
        }
        
        const response = await fetch(`${BACKEND_URL}/api/userscore`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            highscore = data.score || 0;
            if (highscoreElement) {
                highscoreElement.innerText = highscore;
            }
        } else {
            console.error('Failed to load high score');
            highscore = 0;
            if (highscoreElement) {
                highscoreElement.innerText = highscore;
            }
        }
    } catch (error) {
        console.error('Error loading high score:', error);
        highscore = 0;
        if (highscoreElement) {
            highscoreElement.innerText = highscore;
        }
    }
}

async function submitGameScore() {
    try {
        const token = getAuthToken();
        if (!token) {
            console.log('No auth token found, score not saved');
            return;
        }
        
        if (score <= highscore) {
            console.log('Score not higher than current high score');
            return;
        }
        
        if (!gameStartTime || !gameEvents || gameEvents.length !== 2) {
            console.error('Invalid game session data - need exactly 2 events');
            return;
        }
        
        console.log('Submitting simplified game session:', {
            score: score,
            duration: Date.now() - gameStartTime,
            eventsCount: gameEvents.length,
            events: gameEvents
        });
        
        const gameData = {
            score: score,
            gameSession: {
                startTime: new Date(gameStartTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - gameStartTime,
                events: gameEvents,
                finalScore: score,
                eventCount: gameEvents.length,
                maxSpeed: currentSpeed,
                backgroundsReached: currentBackground
            }
        };
        
        const response = await fetch(`${BACKEND_URL}/api/scoreupdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameData)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                highscore = score;
                if (highscoreElement) {
                    highscoreElement.innerText = highscore;
                }
                console.log('New high score saved!');
            } else {
                console.log('Score not saved:', data.message);
            }
        } else {
            const errorData = await response.json();
            console.error('Failed to submit score:', errorData);
        }
    } catch (error) {
        console.error('Error submitting score:', error);
    }
}

// Obstacle management
function randomObstacleSize() {
    const index = Math.floor(Math.random() * OBSTACLE_SIZE.length);
    return OBSTACLE_SIZE[index];
}

function randomObstacle() {
    const obstacleSize = randomObstacleSize();
    
    if (isBackground2) {
        obstacleElement.className = `obstacle obstacle2 obstacle-${obstacleSize}`;
    } else {
        obstacleElement.className = `obstacle obstacle-${obstacleSize}`;
    }
    
    // No obstacle change event recording in simplified system
    restartObstacleInterval(); // Start the dynamic interval system
}

// Game control
function stopGame() {
    gameActive = false;
    
    // Clear all intervals and timeouts
    if (collisionInterval) clearInterval(collisionInterval);
    if (scoreInterval) clearInterval(scoreInterval);
    if (changeObstacleInterval) clearInterval(changeObstacleInterval);
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    
    // Remove event listeners
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('click', handleClick);
    
    // Stop animations
    if (obstacleElement) {
        obstacleElement.style.animationPlayState = 'paused';
        obstacleElement.classList.add('stop');
    }
    
    // Show game over modal
    if (restartGameElement) restartGameElement.classList.add('show');
    if (gamecontainerElement) gamecontainerElement.classList.add('stop');
    if (playerElement) playerElement.classList.add('stop');
    
    // Reset difficulty state
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
    pendingTimeoutId = null;
    
    console.log('Game stopped. Final score:', score, 'Events recorded:', gameEvents.length);
}

function restartgame() {
    // Soft reset instead of page reload
    showLoadingScreen();
    updateLoadingProgress(50, 'Restarting game...');
    
    // Clear all intervals and timeouts
    if (collisionInterval) clearInterval(collisionInterval);
    if (scoreInterval) clearInterval(scoreInterval);
    if (changeObstacleInterval) clearInterval(changeObstacleInterval);
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    
    // Reset game state
    gameActive = false;
    jumping = false;
    score = 0;
    lastJumpTime = 0;
    gameStartTime = null;
    gameEvents = [];
    
    // Reset UI elements
    if (restartGameElement) restartGameElement.classList.remove('show');
    if (gamecontainerElement) {
        gamecontainerElement.classList.remove('stop');
        gamecontainerElement.style.backgroundImage = `url('./assets/background1.png')`;
    }
    if (playerElement) playerElement.classList.remove('stop', 'jump');
    if (obstacleElement) {
        obstacleElement.className = 'obstacle';
        obstacleElement.style.animation = 'none';
        obstacleElement.style.left = '100%';
        obstacleElement.classList.remove('stop');
    }
    
    // Reset game variables
    currentSpeed = GAME_CONSTANTS.BASE_SPEED;
    currentJumpDuration = GAME_CONSTANTS.BASE_JUMP_DURATION;
    currentBackground = 1;
    isBackground2 = false;
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
    
    setTimeout(() => {
        setScore(0);
        hideLoadingScreen();
    }, 800);
}

function mainmenu() {
    window.location.href = "mainmenu.html";
}

function startGame() {
    if (!gameDataLoaded) {
        console.log('Game data not loaded yet, cannot start game');
        return;
    }
    
    try {
        console.log('Starting simplified game...');
        
        initGameSession();
        
        if (obstacleElement) {
            obstacleElement.style.animation = `move ${currentSpeed / 1000}s linear infinite`;
        }
        
        jumpListener();
        collisionDetection();
        countScore();
        randomObstacle();
        
        recordGameEvent('game_start'); // Only start event recorded
        
        console.log('Game started successfully!');
        
    } catch (error) {
        console.error('Error starting game:', error);
    }
}