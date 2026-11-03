const { MessageFlags } = require("discord.js");
const { updateLeaderboardMessage } = require("../services/autoLeaderboard");

// Délai minimum entre deux mises à jour manuelles (pour ne pas saturer l'API).
const COOLDOWN = Number(process.env.UPDATE_COOLDOWN_MS) || 30 * 1000;

let lastUpdateAt = 0;

module.exports = {
  data: {
    name: "update",
    description: "Met à jour le leaderboard automatique maintenant"
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const remaining = lastUpdateAt + COOLDOWN - Date.now();

    if (remaining > 0) {
      return interaction.editReply({
        content: `⏳ Le leaderboard vient d'être mis à jour. Réessaie dans ${Math.ceil(remaining / 1000)} s.`
      });
    }

    lastUpdateAt = Date.now();

    const status = await updateLeaderboardMessage(interaction.client, { force: true });

    if (status === "updated") {
      return interaction.editReply({ content: "✅ Leaderboard mis à jour." });
    }

    // En cas d'échec, on autorise un nouvel essai immédiat.
    lastUpdateAt = 0;

    if (status === "no-config") {
      return interaction.editReply({
        content: "Aucun leaderboard automatique n'est configuré. Utilise d'abord /setleaderboard dans le salon voulu."
      });
    }

    if (status === "deleted") {
      return interaction.editReply({
        content: "Le message du leaderboard a été supprimé. Relance /setleaderboard dans le salon voulu."
      });
    }

    return interaction.editReply({
      content: "❌ Impossible de mettre à jour le leaderboard pour le moment. Regarde les logs pour plus de détails."
    });
  }
};
