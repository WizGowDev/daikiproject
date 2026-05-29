const fs = require("fs");
const path = require("path");
const { buildLeaderboardPayload } = require("../services/leaderboardBuilder");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "../data");
const configPath = path.join(dataDir, "autoLeaderboard.json");

function ensureConfigFolder() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

module.exports = {
  data: {
    name: "setleaderboard",
    description: "Crée le leaderboard automatique dans ce salon"
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      ensureConfigFolder();

      const payload = await buildLeaderboardPayload();
      const message = await interaction.channel.send(payload);

      const config = {
        channelId: interaction.channel.id,
        messageId: message.id,
        createdAt: new Date().toISOString()
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

      return interaction.editReply({
        content: "✅ Leaderboard automatique créé. Il se mettra à jour toutes les 5 minutes."
      });
    } catch (error) {
      console.error("Erreur setleaderboard :", error);

      return interaction.editReply({
        content: "Impossible de créer le leaderboard automatique."
      });
    }
  }
};
