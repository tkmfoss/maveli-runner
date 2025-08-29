const player = document.querySelector('.player');
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
    },800)
}
function main() {
    jumpListener();
}
main();