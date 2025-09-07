import{ initializeAuthGuard, getAuthToken } from './auth-guard.js';
import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

const GAME_CONSTANTS = {
    BASE_SPEED: 4000,
    MIN_SPEED: 1000, 
    BASE_JUMP_DURATION: 1200,
    MIN_JUMP_DURATION: 800,
    SCORE_INCREMENT_INTERVAL: 50,
    COLLISION_CHECK_INTERVAL: 20,
    JUMP_DEBOUNCE_TIME: 100,
    DIFFICULTY_CHECK_TIMEOUT: 10000,
    SPEED_REDUCTION_PER_500_SCORE: 500 
};

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

const OBSTACLE_SIZE = ['s','m','l'];
let jumping = false;
let gameActive = false;
let gameStartTime = null;
let gameEvents = [];
let score = 0;
let highscore = 0;
let gameDataLoaded = false;
let lastJumpTime = 0;

let gameSessionKey = null; 

let collisionInterval;
let scoreInterval;
let changeObstacleInterval;
let pendingTimeoutId = null;

let currentSpeed = GAME_CONSTANTS.BASE_SPEED; 
let currentJumpDuration = GAME_CONSTANTS.BASE_JUMP_DURATION; 
let currentBackground = 1;
let isBackground2 = false;
let waitingForObstacleCompletion = false;
let pendingDifficultyChange = null;

function enforceOrientation() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile && window.innerHeight > window.innerWidth) {
        showOrientationMessage();
    } else if (isMobile && window.innerHeight <= window.innerWidth) {
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
    
    if (gameActive) {
        pauseGame();
    }
}

function hideOrientationMessage() {
    const orientationMessage = document.getElementById('orientationMessage');
    if (orientationMessage) {
        orientationMessage.style.display = 'none';
    }
    
    resumeGame();
}

function pauseGame() {
    if (!gameActive) return;
    
    if (obstacleElement) {
        obstacleElement.style.animationPlayState = 'paused';
    }
    
    if (collisionInterval) clearInterval(collisionInterval);
    if (scoreInterval) clearInterval(scoreInterval);
}

function resumeGame() {
    if (!gameActive) return;
    
    if (obstacleElement) {
        obstacleElement.style.animationPlayState = 'running';
    }
    
    if (gameActive) {
        collisionDetection();
        countScore();
    }
}

window.addEventListener('orientationchange', () => {
    setTimeout(enforceOrientation, 100);
});
window.addEventListener('resize', enforceOrientation);

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
        
        enforceOrientation();
        
        updateLoadingProgress(20, 'Checking authentication...');
        const isAuthenticated = await initializeAuthGuard();
        
        if (!isAuthenticated) {
            throw new Error('Authentication failed');
        }
        
        updateLoadingProgress(40, 'Loading high score...');
        await loadHighScore();
        
        updateLoadingProgress(60, 'Creating anti-cheat session...');
        let sessionCreated = false;
        let retries = 3;
        while (retries > 0 && !sessionCreated) {
            sessionCreated = await createGameSession();
            if (!sessionCreated) {
                retries--;
                console.warn(`Session creation failed, retries left: ${retries}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
        
        if (!sessionCreated) {
            throw new Error('Failed to create anti-cheat session after retries');
        }
        
        updateLoadingProgress(80, 'Preparing game assets...');
        await initializeGameElements();
        
        updateLoadingProgress(90, 'Setting up controls...');
        setupEventListeners();
        
        updateLoadingProgress(100, 'Ready to play!');
        gameDataLoaded = true;
        
        setTimeout(() => {
            hideLoadingScreen();
        }, 500);
        
    } catch (error) {
        console.error('Game initialization error:', error);
        updateLoadingProgress(100, 'Error loading game');
        
        setTimeout(() => {
            alert('Failed to load the game. Please refresh the page and try again.');
        }, 1000);
    }
}

async function createGameSession() {
    try {
        const token = getAuthToken();
        if (!token) {
            console.error('No authentication token available');
            throw new Error('No authentication token');
        }

        console.log('Creating game session with token:', token.substring(0, 20) + '...'); // Log partial token for security
        const response = await fetch(`${BACKEND_URL}/api/create-session`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Session created successfully:', { sessionKey: data.sessionKey });
            gameSessionKey = data.sessionKey;
            return true;
        } else {
            const errorData = await response.json();
            console.error('Failed to create session:', errorData);
            alert('Failed to create game session. Please refresh and try again.');
            return false;
        }
    } catch (error) {
        console.error('Session creation error:', error);
        alert('Connection error. Please check your internet and try again.');
        return false;
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
    
    currentSpeed = GAME_CONSTANTS.BASE_SPEED;
    currentJumpDuration = GAME_CONSTANTS.BASE_JUMP_DURATION;
    currentBackground = 1;
    isBackground2 = false;
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
    lastJumpTime = 0;
    
    if (pendingTimeoutId) {
        clearTimeout(pendingTimeoutId);
        pendingTimeoutId = null;
    }
}

function recordGameEvent(eventType, additionalData = {}) {
    if (!gameActive && eventType !== 'collision' && eventType !== 'game_over') return;
    
    const relativeTimestamp = Date.now() - gameStartTime;
    
    const eventData = {
        type: eventType,
        timestamp: relativeTimestamp,
        score: score,
        difficulty: {
            speed: currentSpeed,
            jumpDuration: currentJumpDuration,
            background: currentBackground
        },
        gameTime: relativeTimestamp,
        ...additionalData
    };
    
    gameEvents.push(eventData);
    
    if (gameEvents.length > 100000000000) {
        gameEvents = gameEvents.slice(-400); 
    }
    
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
    
    const isGameArea = target.closest('.game-container');
    if (!isGameArea) {
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
    
    const isGameArea = target.closest('.game-container');
    if (!isGameArea) {
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
    
    const currentTime = Date.now();
    if (currentTime - lastJumpTime < GAME_CONSTANTS.JUMP_DEBOUNCE_TIME) {
        return;
    }
    lastJumpTime = currentTime;
    
    jumping = true;
    
    recordGameEvent('jump', {
        jumpHeight: currentJumpDuration,
        reactionTime: currentTime - (lastObstacleSpawn || gameStartTime)
    });
    
    playerElement.classList.add('jump');
    
    setTimeout(() => {
        if (playerElement) {
            playerElement.classList.remove('jump');
        }
        jumping = false;
    }, currentJumpDuration);
}

let lastObstacleSpawn = Date.now();

function calculateCurrentSpeed(score) {
    const speedReduction = Math.floor(score / 500) * GAME_CONSTANTS.SPEED_REDUCTION_PER_500_SCORE; 
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

function getObstacleDistance() {
    if (!obstacleElement || !gamecontainerElement) return 1000;
    const obstacleRect = obstacleElement.getBoundingClientRect();
    const gameRect = gamecontainerElement.getBoundingClientRect();
    return obstacleRect.left - gameRect.left;
}

function updateGameDifficulty() {
    const newSpeed = calculateCurrentSpeed(score);
    const newJumpDuration = calculateJumpDuration(newSpeed);
    let expectedBackground = currentBackground;
    
    if (score >= 1000) {
        expectedBackground = Math.floor(score / 1000) % 2 === 1 ? 2 : 1;
    }
    
    const needChange = (newSpeed !== currentSpeed) || (score >= 1000 && expectedBackground !== currentBackground);
    
    if (needChange && !waitingForObstacleCompletion) {
        const obstacleDistance = getObstacleDistance();
        
        if (jumping) {
            return;
        }
        
        if (obstacleDistance > 0 && obstacleDistance < 250) {
            return;
        }
        
        waitingForObstacleCompletion = true;
        pendingDifficultyChange = {
            speed: newSpeed,
            jumpDuration: newJumpDuration,
            background: expectedBackground
        };
        
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
    
    console.log('Applying smooth difficulty change...', {
        oldSpeed: currentSpeed,
        newSpeed: pendingDifficultyChange.speed,
        oldBackground: currentBackground,
        newBackground: pendingDifficultyChange.background
    });
    
    const oldSpeed = currentSpeed;
    const oldBackground = currentBackground;
    
    currentSpeed = pendingDifficultyChange.speed;
    currentJumpDuration = pendingDifficultyChange.jumpDuration;
    
    if (pendingDifficultyChange.background !== currentBackground) {
        changeBackground(pendingDifficultyChange.background);
    }
    
    restartObstacleAnimation();
    restartObstacleInterval();
    
    recordGameEvent('difficulty_change', {
        oldSpeed,
        newSpeed: currentSpeed,
        oldBackground,
        newBackground: currentBackground,
        scoreWhenChanged: score
    });
    
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
}

function restartObstacleAnimation() {
    if (!obstacleElement) return;
    
    const obstacleDistance = getObstacleDistance();
    
    if (obstacleDistance > 0 && obstacleDistance < 400) {
        
        const waitForCompletion = setInterval(() => {
            if (isObstacleOffScreen() || !gameActive) {
                clearInterval(waitForCompletion);
                if (gameActive) {
                    applyNewObstacleSpeed();
                }
            }
        }, 50);
        return;
    }
    
    applyNewObstacleSpeed();
}

function applyNewObstacleSpeed() {
    if (!obstacleElement) return;
    
    obstacleElement.style.animation = 'none';
    obstacleElement.style.left = '100%';
    obstacleElement.offsetHeight; 
    obstacleElement.style.animation = `move ${currentSpeed / 1000}s linear infinite`;
    
}

function restartObstacleInterval() {
    if (changeObstacleInterval) {
        clearInterval(changeObstacleInterval);
    }
    
    changeObstacleInterval = setInterval(() => {
        const obstacleSize = randomObstacleSize();
        
        if (isBackground2) {
            obstacleElement.className = `obstacle obstacle2 obstacle-${obstacleSize}`;
        } else {
            obstacleElement.className = `obstacle obstacle-${obstacleSize}`;
        }
        
        lastObstacleSpawn = Date.now();
        
        recordGameEvent('obstacle_spawn', {
            size: obstacleSize,
            background: currentBackground,
            currentSpeed
        });
    }, currentSpeed);
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
    } else if (backgroundNumber === 1 && isBackground2) {
        isBackground2 = false;
        obstacleElement.classList.remove('obstacle2');
    }
}

function checkGameIntegrity() {
    if (!gameActive) return;
    
    const obstacleStyle = getComputedStyle(obstacleElement);
    
    if (
        !obstacleElement.isConnected || 
        obstacleElement.parentNode === null ||
        obstacleStyle.display === 'none' ||
        obstacleStyle.visibility === 'hidden' ||
        parseFloat(obstacleStyle.opacity) < 0.1 ||
        !obstacleElement.classList.contains('obstacle') || 
        obstacleStyle.animationName !== 'move' || 
        parseFloat(obstacleStyle.animationDuration) < (currentSpeed / 1000 * 0.5) || 
        obstacleElement.offsetWidth <= 0 || 
        obstacleElement.offsetHeight <= 0
    ) {
        console.warn('Game integrity violation detected!');
        recordGameEvent('integrity_violation', {
            reason: 'obstacle_tampered',
            computedDisplay: obstacleStyle.display,
            computedVisibility: obstacleStyle.visibility,
            computedOpacity: obstacleStyle.opacity,
            animationName: obstacleStyle.animationName,
            classList: obstacleElement.className
        });
        gameActive = false;
        stopGame();
        submitGameScore = function() {
            alert('Game integrity violation detected. Score not submitted.');
        };
    }
}

function collisionDetection() {
    if (collisionInterval) {
        clearInterval(collisionInterval);
    }
    collisionInterval = setInterval(() => {
        checkGameIntegrity();
        
        if(isCollision()) {
            recordGameEvent('collision', {
                finalScore: score,
                survivalTime: Date.now() - gameStartTime,
                totalJumps: gameEvents.filter(e => e.type === 'jump').length
            });
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
    }, GAME_CONSTANTS.SCORE_INCREMENT_INTERVAL);
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
            console.error('No authentication token');
            return;
        }

        if (score <= highscore) {
            console.log('Score not higher than current high score');
            return;
        }

        if (!gameStartTime || !gameEvents || gameEvents.length < 2) {
            console.error('Invalid game data');
            return;
        }

        if (!gameSessionKey) {
            console.error('Anti-cheat protection failed: No session key');
            alert('Game session invalid. Please restart the game.');
            return;
        }

        const gameData = {
            score: score,
            sessionKey: gameSessionKey, 
            gameSession: {
                startTime: new Date(gameStartTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - gameStartTime,
                events: gameEvents,
                finalScore: score,
                eventCount: gameEvents.length,
                maxSpeed: currentSpeed,
                backgroundsReached: currentBackground,
                totalJumps: gameEvents.filter(e => e.type === 'jump').length,
                playerStats: {
                    averageReactionTime: calculateAverageReactionTime(),
                    difficultyChanges: gameEvents.filter(e => e.type === 'difficulty_change').length
                }
            }
        };

        console.log('Submitting score with data:', {
            score,
            sessionKey: gameSessionKey,
            duration: gameData.gameSession.duration,
            eventCount: gameData.gameSession.eventCount
        });

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
                console.log('HIGH SCORE VALIDATION PASSED - New high score saved!', score);
                
            } else {
                console.log('Score not saved:', data.message);
            }
        } else {
            const errorData = await response.json();
            console.error('High score anti-cheat validation failed:', errorData);
            
            if (errorData.error && (errorData.error.includes('session') || errorData.error.includes('key'))) {
                alert('Game session invalid. Please restart to create a new session.');
            }
        }
    } catch (error) {
        console.error('Error submitting high score:', error);
    }
}

function calculateAverageReactionTime() {
    const jumpEvents = gameEvents.filter(e => e.type === 'jump' && e.reactionTime);
    if (jumpEvents.length === 0) return 0;
    
    const totalReactionTime = jumpEvents.reduce((sum, event) => sum + event.reactionTime, 0);
    return Math.round(totalReactionTime / jumpEvents.length);
}

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
    
    lastObstacleSpawn = Date.now();
    restartObstacleInterval();
}

function stopGame() {
    gameActive = false;
    
    if (collisionInterval) clearInterval(collisionInterval);
    if (scoreInterval) clearInterval(scoreInterval);
    if (changeObstacleInterval) clearInterval(changeObstacleInterval);
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    
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
    
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
    pendingTimeoutId = null;
    
}

async function restartgame() {
    showLoadingScreen();
    updateLoadingProgress(50, 'Restarting game...');
    
    if (collisionInterval) clearInterval(collisionInterval);
    if (scoreInterval) clearInterval(scoreInterval);
    if (changeObstacleInterval) clearInterval(changeObstacleInterval);
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    
    gameActive = false;
    jumping = false;
    score = 0;
    lastJumpTime = 0;
    gameStartTime = null;
    gameEvents = [];
    
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
    
    currentSpeed = GAME_CONSTANTS.BASE_SPEED;
    currentJumpDuration = GAME_CONSTANTS.BASE_JUMP_DURATION;
    currentBackground = 1;
    isBackground2 = false;
    waitingForObstacleCompletion = false;
    pendingDifficultyChange = null;
    
    try {
        const sessionCreated = await createGameSession();
        if (!sessionCreated) {
            throw new Error('Failed to create new session');
        }
    } catch (error) {
        console.error('Failed to create new session:', error);
        alert('Failed to create new session. Please refresh the page.');
        return;
    }
    
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

    if (!gameSessionKey) {
        console.error('Cannot start game: No session key');
        alert('Game session not ready. Please restart the game.');
        return;
    }

    try {
        console.log('Starting game with session key:', gameSessionKey);
        
        initGameSession();

        recordGameEvent('game_start', {
            sessionKey: gameSessionKey,
            initialSpeed: currentSpeed,
            initialJumpDuration: currentJumpDuration
        });
        
        if (obstacleElement) {
            obstacleElement.style.animation = `move ${currentSpeed / 1000}s linear infinite`;
        }
        
        jumpListener();
        collisionDetection();
        countScore();
        randomObstacle();
        
    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start the game. Please refresh and try again.');
    }
}