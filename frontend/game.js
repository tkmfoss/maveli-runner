import { initializeAuthGuard, getAuthToken } from './auth-guard.js';
import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

const playerElement = document.querySelector('.player');
const obstacleElement = document.querySelector('.obstacle');
const scoreElement = document.querySelector('.score-card .score')
const highscoreElement = document.querySelector('.score-card .high-score')
const restartGameElement = document.querySelector('.restart-game');
const gamecontainerElement = document.querySelector('.game-container');

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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const isAuthenticated = await initializeAuthGuard();
        if (isAuthenticated) {
            await initializeGame();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

function initGameSession() {
    gameStartTime = Date.now();
    gameEvents = [];
    gameActive = true;
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
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(event) {
    if(event.key === ' '|| event.key === 'ArrowUp') {
        event.preventDefault();
        jump();
    }
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
    }, 1200)
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
                eventCount: gameEvents.length
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
        obstacleElement.className = `obstacle obstacle-${obstacleSize}`;
        recordGameEvent('obstacle_change', { size: obstacleSize });
    }, 4000)
}

function stopGame() {
    gameActive = false;
    if (collisonInterval) clearInterval(collisonInterval);
    if (scoreInterval) clearInterval(scoreInterval);
    if (changeObstacleInteral) clearInterval(changeObstacleInteral);
    
    if (restartGameElement) restartGameElement.classList.add('show');
    if (gamecontainerElement) gamecontainerElement.classList.add('stop');
    if (obstacleElement) obstacleElement.classList.add('stop');
    if (playerElement) playerElement.classList.add('stop');
}

function restartgame() {
    location.reload();
}

function mainmenu() {
    window.location.href = "mainmenu.html";
}

async function initializeGame() {
    try {
        if (!playerElement || !obstacleElement || !scoreElement || !highscoreElement) {
            console.error('Required game elements not found');
            return;
        }

        console.log('Initializing game...');
        
        await loadHighScore();
        
        initGameSession();
        
        jumpListener();
        collisionDetection();
        countScore();
        randomObstacle();
        
        recordGameEvent('game_start');
        
        const resetBtn = document.getElementById("btn-reset");
        const menuBtn = document.getElementById("btn-main-menu");
        
        if (resetBtn) {
            resetBtn.addEventListener("click", restartgame);
        }
        
        if (menuBtn) {
            menuBtn.addEventListener("click", mainmenu);
        }
        
        console.log('Game initialized successfully!');
        
        setScore(0);
        
    } catch (error) {
        console.error('Error initializing game:', error);
    }
}