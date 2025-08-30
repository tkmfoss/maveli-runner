const playerElement = document.querySelector('.player');
const obstacleElement = document.querySelector('.obstacle');
const scoreElement = document.querySelector('.score-card .score')
const highscoreElement = document.querySelector('.score-card .high-score')
const restartGameElement = document.querySelector('.restart-game');
const gamecontainerElement = document.querySelector('.game-container');

const OBSTACLE_SIZE = ['s','m','l'];
let jumping=false;
function jumpListener()
{
    document.addEventListener('keydown',event =>{
        if(event.key === ' '|| event.key === 'ArrowUp')
        {
            jump();
        }
    })
}
function jump(){
    if(jumping)
    {
        return;
    }
    jumping = true;
    playerElement.classList.add('jump');
    setTimeout(() =>
    {
        playerElement.classList.remove('jump');
        jumping = false;
    },1200)
}

let collisonInterval;
function collisionDetection()
{
    collisonInterval = setInterval(() => {
        if(isCollision())
        {
            checkHighScore();
            score = 0;
            stopGame();
        }
    },20)
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
        { x: playerRect.left + playerRect.width * 0.3, y: playerRect.bottom - 5 },
        { x: playerRect.right - playerRect.width * 0.3, y: playerRect.bottom - 5 },
        { x: playerRect.left + playerRect.width * 0.5, y: playerRect.top + playerRect.height * 0.7 }
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

let score = 0;
function setScore(newScore)
{
    scoreElement.innerHTML = score = newScore;
}

let scoreInterval;
function countScore(){
    scoreInterval = setInterval(() =>
    {
        setScore(score+1);
    },50);
}

let highscore = localStorage.getItem('highscore') || 0;

function setHighScore(newScore) 
{
    highscoreElement.innerText = highscore = newScore;
    localStorage.setItem('highscore', newScore);
}

function checkHighScore()
{
    if(score > highscore)
    {
        setHighScore(score);
    }
}

function randomObstacleSize()
{
    const index = Math.floor(Math.random()*(OBSTACLE_SIZE.length));
    return OBSTACLE_SIZE[index];
}

let changeObstacleInteral;
function randomObstacle()
{
    changeObstacleInteral = setInterval(() =>
    {
        const obstacleSize = randomObstacleSize();
        obstacleElement.className = `obstacle obstacle-${obstacleSize}`;
    },4000)
}


function stopGame()
{
    clearInterval(collisonInterval);
    clearInterval(scoreInterval);
    clearInterval(changeObstacleInteral);
    restartGameElement.classList.add('show')
    gamecontainerElement.classList.add('stop');
    obstacleElement.classList.add('stop'); 
    playerElement.classList.add('stop');

}

function restartgame()
{
    location.reload();
}

function mainmenu() {
    window.location.href = "leaderboard.html";
}

function main() {
    jumpListener();
    collisionDetection(); 
    countScore();
    setHighScore(highscore);
    randomObstacle();
};
main();