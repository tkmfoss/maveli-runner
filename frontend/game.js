import { initializeAuthGuard, getAuthToken } from './auth-guard.js';
import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

const playerElement = document.querySelector('.player');
const obstacleElement = document.querySelector('.obstacle');
const scoreElement = document.querySelector('.score-card .score')
const highscoreElement = document.querySelector('.score-card .high-score')
const restartGameElement = document.querySelector('.restart-game');
const gamecontainerElement = document.querySelector('.game-container');

const loadingScreen = document.getElementById('loadingScreen');
const progressBar = document.getElementById('progressBar');
const loadingText = document.getElementById('loadingText');
const gameContainer = document.getElementById('gameContainer');

const OBSTACLE_SIZE = ['s','m','l'];
let jumping = false;
let gameActive = false;
let gameStartTime = null;
let gameEvents = [];
let score = 0;
let highscore = 0;
let collisonInterval;
let scoreInterval;
let changeObstacleInteral;

let currentSpeed = 4000; 
let currentJumpDuration = 1200; 
let currentBackground = 1;
let isBackground2 = false;

// Add flag to track if we need to wait for obstacle to complete
let waitingForObstacleCompletion = false;
let pendingDifficultyChange = null;

const BASE_SPEED = 4000;
const MIN_SPEED = 1000;
const BASE_JUMP_DURATION = 1200;
const MIN_JUMP_DURATION = 800;

let gameDataLoaded = false;

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

async function initializeGame() {
    try {
        showLoadingScreen();
        
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

function initGameSession() {
    gameStartTime = Date.now();
    gameEvents = [];
    gameActive = true;

    currentSpeed = BASE_SPEED;
    currentJumpDuration = BASE_JUMP_DURATION;
    currentBackground = 1;
    isBackground2 = false;
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
}

function recordGameEvent(eventType, additionalData = {}) {
    if (!gameActive) return;
    
    gameEvents.push({
        type: eventType,
        timestamp: Date.now() - gameStartTime,
        score: score,
        ...additionalData
    });
}

function jumpListener() {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('click', handleClick);
    
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

function jump() {
    if(jumping || !gameActive) {
        return;
    }
    jumping = true;
    recordGameEvent('jump');
    playerElement.classList.add('jump');
    setTimeout(() => {
        playerElement.classList.remove('jump');
        jumping = false;
    }, currentJumpDuration);
}

function calculateCurrentSpeed(score) {
    const speedReduction = Math.floor(score / 1000) * 400; 
    const newSpeed = Math.max(MIN_SPEED, BASE_SPEED - speedReduction);
    return newSpeed;
}

function calculateJumpDuration(speed) {
    const speedRatio = speed / BASE_SPEED;
    const newJumpDuration = Math.max(MIN_JUMP_DURATION, BASE_JUMP_DURATION * speedRatio);
    return Math.round(newJumpDuration);
}

// Fixed function to handle obstacle completion before speed change
function isObstacleOffScreen() {
    if (!obstacleElement) return true;
    const obstacleRect = obstacleElement.getBoundingClientRect();
    const gameRect = gamecontainerElement.getBoundingClientRect();
    return obstacleRect.right < gameRect.left;
}

function updateGameDifficulty() {
    const newSpeed = calculateCurrentSpeed(score);
    const newJumpDuration = calculateJumpDuration(newSpeed);
    let expectedBackground = currentBackground;
    
    // Calculate expected background for scores 3000+
    if (score >= 3000) {
        expectedBackground = Math.floor((score - 3000) / 1000) % 2 === 0 ? 2 : 1;
    }
    
    const needChange = (newSpeed !== currentSpeed) || (score >= 3000 && expectedBackground !== currentBackground);
    
    if (needChange) {
        if (!waitingForObstacleCompletion) {
            waitingForObstacleCompletion = true;
            pendingDifficultyChange = {
                speed: newSpeed,
                jumpDuration: newJumpDuration,
                background: expectedBackground
            };
            
            // Check periodically if obstacle is off-screen
            const checkObstacle = setInterval(() => {
                if (isObstacleOffScreen() || !gameActive) {
                    clearInterval(checkObstacle);
                    if (gameActive && pendingDifficultyChange) {
                        currentSpeed = pendingDifficultyChange.speed;
                        currentJumpDuration = pendingDifficultyChange.jumpDuration;
                        
                        // Only change background if needed
                        if (pendingDifficultyChange.background !== currentBackground) {
                            changeBackground(pendingDifficultyChange.background);
                        }
                        
                        restartObstacleAnimation();
                        recordGameEvent('difficulty_increase', { 
                            newSpeed: currentSpeed, 
                            newJumpDuration: currentJumpDuration,
                            newBackground: pendingDifficultyChange.background
                        });
                        waitingForObstacleCompletion = false;
                        pendingDifficultyChange = null;
                    }
                }
            }, 50);
        }
    }
}

function restartObstacleAnimation() {
    if (!obstacleElement) return;
    
    // Force reflow to ensure clean animation restart
    obstacleElement.style.animation = 'none';
    obstacleElement.style.left = '100%';
    obstacleElement.offsetHeight; 
    obstacleElement.style.animation = `move ${currentSpeed / 1000}s linear infinite`;
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
        recordGameEvent('background_change', { background: backgroundNumber, obstacleType: 'obstacle2' });
    } else if (backgroundNumber === 1 && isBackground2) {
        isBackground2 = false;
        obstacleElement.classList.remove('obstacle2');
        recordGameEvent('background_change', { background: backgroundNumber, obstacleType: 'obstacle' });
    }
}

function collisionDetection() {
    if (collisonInterval) {
        clearInterval(collisonInterval);
    }
    collisonInterval = setInterval(() => {
        if(isCollision()) {
            recordGameEvent('collision');
            gameActive = false;
            submitGameScore();
            stopGame();
        }
    }, 20)
}

function isCollision() {
    const playerRect = playerElement.getBoundingClientRect();
    const obstacleRect = obstacleElement.getBoundingClientRect();
    
    // Use simpler rectangle collision for better performance and accuracy
    return !(
        playerRect.right < obstacleRect.left + 10 || 
        playerRect.left + 10 > obstacleRect.right || 
        playerRect.bottom < obstacleRect.top + 10 || 
        playerRect.top + 10 > obstacleRect.bottom
    );
}

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
        setScore(score + 1);
        recordGameEvent('score_increment');
    }, 50);
}

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

        const gameData = {
            score: score,
            gameSession: {
                startTime: gameStartTime,
                endTime: Date.now(),
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
            }
        } else {
            console.error('Failed to submit score');
        }
    } catch (error) {
        console.error('Error submitting score:', error);
    }
}

function randomObstacleSize() {
    const index = Math.floor(Math.random() * (OBSTACLE_SIZE.length));
    return OBSTACLE_SIZE[index];
}

function randomObstacle() {
    if (changeObstacleInteral) {
        clearInterval(changeObstacleInteral);
    }

    changeObstacleInteral = setInterval(() => {
        const obstacleSize = randomObstacleSize();
        
        if (isBackground2) {
            obstacleElement.className = `obstacle obstacle2 obstacle-${obstacleSize}`;
        } else {
            obstacleElement.className = `obstacle obstacle-${obstacleSize}`;
        }
        
        recordGameEvent('obstacle_change', { 
            size: obstacleSize, 
            background: currentBackground,
            obstacleType: isBackground2 ? 'obstacle2' : 'obstacle'
        });
    }, 4000)
}

function stopGame() {
    gameActive = false;
    if (collisonInterval) clearInterval(collisonInterval);
    if (scoreInterval) clearInterval(scoreInterval);
    if (changeObstacleInteral) clearInterval(changeObstacleInteral);
    
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('click', handleClick);
    
    if (obstacleElement) {
        obstacleElement.style.animationPlayState = 'paused';
        obstacleElement.classList.add('stop');
    }
    
    if (restartGameElement) restartGameElement.classList.add('show');
    if (gamecontainerElement) gamecontainerElement.classList.add('stop');
    if (playerElement) playerElement.classList.add('stop');
}

function restartgame() {
    showLoadingScreen();
    updateLoadingProgress(50, 'Restarting game...');
    
    setTimeout(() => {
        location.reload();
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
        console.log('Starting game...');
        
        initGameSession();
        
        if (obstacleElement) {
            obstacleElement.style.animation = `move ${currentSpeed / 1000}s linear infinite`;
        }
        
        jumpListener();
        collisionDetection();
        countScore();
        randomObstacle();
        
        recordGameEvent('game_start');
        
        console.log('Game started successfully!');
        
    } catch (error) {
        console.error('Error starting game:', error);
    }
}