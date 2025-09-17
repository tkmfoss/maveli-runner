# Maveli Runner Frontend

## Overview

This is the client for Maveli Runner—a browser-based endless runner themed around Kerala’s Onam festival, featuring leaderboard and authentication features. Built with HTML/JS.

## Features

- Endless runner gameplay
- Onam-themed graphics and interface
- Login/signup & user auth via backend
- Live leaderboard
- Mobile and desktop friendly

## Setup

1. **Clone the repo:**
    ```
    git clone https://github.com/tkmfoss/maveli-runner.git
    cd maveli-runner/Maveli_Game_Client
    ```

2. **Configure backend URL**  
    Edit `config.js`:
    ```
    BACKEND_URL=https://your-backend-url.com
    ```

## FRONTEND_FOLDER_STRUCTURE
```
frontend
├── .env
├── .gitignore
├── assets
│ ├── background1.png
│ ├── background2.webp
│ ├── Email-logo.png
│ ├── fosscell-logo.png
│ ├── Minecraft.ttf
│ ├── normalmaveli.png
│ ├── obstacle1.webp
│ ├── obstacle2.webp
│ ├── obstacle3.webp
│ └── runningmaveli.gif
├── auth-guard.js
├── auth.js
├── config.js
├── game.css
├── game.html
├── game.js
├── index.css
├── index.html
├── leaderboard.css
├── leaderboard.html
├── leaderboard.js
├── libs
├── mainmenu.css
├── mainmenu.html
└── mainmenu.js
```

## Usage

- Signup/login to play
- Play and submit your score
- See leaderboard in real-time

## Notes

- Ensure the backend is running for API features to work.
- Auth token is saved and sent with each protected API request.

---

