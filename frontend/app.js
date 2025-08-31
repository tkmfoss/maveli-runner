import { config } from "./config.js";

const BACKEND_URL = config.BACKEND_URL;

async function fetchLeaderboard() {
  console.log("Backend URL used:", BACKEND_URL);

  try {
    const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
    const data = await response.json();

    if (data.error) {
      console.error("Backend error:", data.error);
      return;
    }

    const leaderboardTable = document.querySelector("#leaderboard");
    leaderboardTable.innerHTML = "";

    data.leaderboard.forEach(({ rank, player, score }) => {
      const row = document.createElement("tr");

      const rankCell = document.createElement("td");
      rankCell.textContent = rank;
      row.appendChild(rankCell);

      const playerCell = document.createElement("td");
      playerCell.textContent = player;
      row.appendChild(playerCell);

      const scoreCell = document.createElement("td");
      scoreCell.textContent = score;
      row.appendChild(scoreCell);

      leaderboardTable.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
  }
}

document.addEventListener("DOMContentLoaded", fetchLeaderboard);
