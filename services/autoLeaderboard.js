const { buildLeaderboardPayload } = require("./leaderboardBuilder");
const { readJson, deleteJson } = require("./accountsStore");

const CONFIG_FILE = "autoLeaderboard.json";

// Intervalle minimum de 60 s pour ne pas saturer l'API Valorant.
const UPDATE_INTERVAL = Math.max(
  Number(process.env.LEADERBOARD_UPDATE_INTERVAL_MS) || 5 * 60 * 1000,
  60 * 1000
);

const UNKNOWN_CHANNEL = 10003;
const UNKNOWN_MESSAGE = 10008;

// Met à jour le message du leaderboard automatique.
// force: true ignore le cache et redemande les données à l'API.
// Renvoie : "updated" | "no-config" | "deleted" | "error"
async function updateLeaderboardMessage(client, { force = false } = {}) {
  let config;

  try {
    config = readJson(CONFIG_FILE, null);
  } catch (error) {
    console.error("Erreur lecture autoLeaderboard.json :", error.message);
    return "error";
  }

  if (!config?.channelId || !config?.messageId) {
    return "no-config";
  }

  try {
    const channel = await client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(config.messageId);
    const payload = await buildLeaderboardPayload({ force });

    await message.edit(payload);

    console.log(
      force
        ? "✅ Leaderboard mis à jour sur commande"
        : "✅ Leaderboard mis à jour automatiquement"
    );

    return "updated";
  } catch (error) {
    if (error.code === UNKNOWN_CHANNEL || error.code === UNKNOWN_MESSAGE) {
      console.error(
        "❌ Salon ou message du leaderboard supprimé : configuration effacée. Relance /setleaderboard."
      );
      deleteJson(CONFIG_FILE);
      return "deleted";
    }

    console.error("Erreur update leaderboard :", error.message);
    return "error";
  }
}

// setTimeout récursif plutôt que setInterval : une mise à jour lente
// ne peut jamais chevaucher la suivante.
function startAutoLeaderboard(client) {
  const loop = async () => {
    try {
      await updateLeaderboardMessage(client);
    } finally {
      setTimeout(loop, UPDATE_INTERVAL);
    }
  };

  loop();
}

module.exports = {
  startAutoLeaderboard,
  updateLeaderboardMessage
};
