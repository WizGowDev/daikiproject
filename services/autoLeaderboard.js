const fs = require("fs");
const path = require("path");
const { buildLeaderboardPayload } = require("./leaderboardBuilder");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "../data");
const configPath = path.join(dataDir, "autoLeaderboard.json");

const UPDATE_INTERVAL =
  Number(process.env.LEADERBOARD_UPDATE_INTERVAL_MS) || 5 * 60 * 1000;

function ensureConfigFolder() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readConfig() {
  ensureConfigFolder();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("Erreur lecture autoLeaderboard.json :", error);
    return null;
  }
}

async function updateLeaderboardMessage(client) {
  const config = readConfig();

  if (!config || !config.channelId || !config.messageId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(config.channelId);

    if (!channel || !channel.messages) {
      console.log("Salon du leaderboard introuvable.");
      return;
    }

    const message = await channel.messages.fetch(config.messageId);

    if (!message) {
      console.log("Message du leaderboard introuvable.");
      return;
    }

    const payload = await buildLeaderboardPayload();

    await message.edit(payload);

    console.log("✅ Leaderboard mis à jour automatiquement");
  } catch (error) {
    console.error("Erreur update auto leaderboard :", error.message);
  }
}

function startAutoLeaderboard(client) {
  updateLeaderboardMessage(client);

  setInterval(() => {
    updateLeaderboardMessage(client);
  }, UPDATE_INTERVAL);
}

module.exports = {
  startAutoLeaderboard
};
