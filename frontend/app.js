const player = document.querySelector('.player');
const obstacle = document.querySelector('.obstacle');
const scoreElement = document.querySelector('.score-card .score')
const highscoreElement = document.querySelector('.score-card .high-score')
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
    player.classList.add('jump');
    setTimeout(() =>
    {
        player.classList.remove('jump');
        jumping = false;
    },1200)
}

function collisionDetection()
{
    setInterval(() => {
        if(isCollision())
        {
            checkHighScore();
            score = 0;
            alert('You Dead Boy');          
        }
    })
}
function isCollision() {
    const playerRect = player.getBoundingClientRect();
    const obstacleRect = obstacle.getBoundingClientRect();
    
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

function countScore(){
    setInterval(() =>
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

function randomObstacle()
{
    setInterval(() =>
    {
        const obstacleSize = randomObstacleSize();
        obstacle.className = `obstacle obstacle-${obstacleSize}`;
    },4000)
}

function main() {
    jumpListener();
    collisionDetection(); 
    countScore();
    setHighScore(highscore);
    randomObstacle();
};
main();