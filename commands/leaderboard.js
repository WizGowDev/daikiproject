const { buildLeaderboardPayload } = require("../services/leaderboardBuilder");

module.exports = {
  data: {
    name: "leaderboard",
    description: "Affiche le classement des joueurs"
  },

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const payload = await buildLeaderboardPayload();
      return interaction.editReply(payload);
    } catch (error) {
      console.error("Erreur leaderboard :", error);

      return interaction.editReply({
        content: "Impossible de générer le leaderboard pour le moment."
      });
    }
  }
};
