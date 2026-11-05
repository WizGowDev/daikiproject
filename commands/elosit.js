const { MessageFlags } = require("discord.js");
const { getAccounts, setElosit } = require("../services/accountsStore");
const { updateLeaderboardMessage } = require("../services/autoLeaderboard");

// Le compte est transmis sous la forme "pseudo#tag" (valeur de l'autocomplétion).
function parseAccount(value) {
  const index = String(value).lastIndexOf("#");

  if (index <= 0 || index === value.length - 1) return null;

  return {
    name: value.slice(0, index).trim(),
    tag: value.slice(index + 1).trim()
  };
}

module.exports = {
  data: {
    name: "elosit",
    description: "Ajoute ou retire la mention ⚠️ (elosit) sur un compte du leaderboard",
    options: [
      {
        name: "compte",
        description: "Compte concerné (pseudo#tag)",
        type: 3, // STRING
        required: true,
        autocomplete: true
      },
      {
        name: "actif",
        description: "Oui = ajouter la mention, Non = la retirer (vide = inverser)",
        type: 5, // BOOLEAN
        required: false
      }
    ]
  },

  // Propose la liste des comptes enregistrés pendant la saisie.
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();

    let accounts = [];

    try {
      accounts = getAccounts();
    } catch (error) {
      console.error("Erreur autocomplétion /elosit :", error.message);
    }

    const choices = accounts
      .map(account => {
        const value = `${account.name}#${account.tag}`;
        return {
          name: `${value}${account.elosit ? " ⚠️ (elosit)" : ""}`.slice(0, 100),
          value: value.slice(0, 100)
        };
      })
      .filter(choice => choice.value.toLowerCase().includes(focused))
      .slice(0, 25); // limite Discord

    await interaction.respond(choices);
  },

  async execute(interaction) {
    await interaction.deferReply();

    const parsed = parseAccount(interaction.options.getString("compte"));

    if (!parsed) {
      return interaction.editReply({
        content: "❌ Format invalide. Choisis un compte dans la liste (pseudo#tag)."
      });
    }

    const wanted = interaction.options.getBoolean("actif"); // null si non renseigné
    const result = setElosit(parsed.name, parsed.tag, wanted);

    if (!result.found) {
      return interaction.editReply({
        content: `❌ Le compte **${parsed.name}#${parsed.tag}** n'est pas dans le leaderboard.`
      });
    }

    const label = `**${result.account.name}#${result.account.tag}**`;

    let content;

    if (!result.changed) {
      content = result.account.elosit
        ? `ℹ️ ${label} a déjà la mention ⚠️ (elosit).`
        : `ℹ️ ${label} n'a déjà pas la mention (elosit).`;
    } else {
      content = result.account.elosit
        ? `⚠️ La mention **(elosit)** a été ajoutée à ${label}.`
        : `✅ La mention **(elosit)** a été retirée de ${label}.`;
    }

    await interaction.editReply({ content });

    // Rafraîchit le leaderboard automatique s'il existe (sans bloquer la réponse).
    if (result.changed) {
      updateLeaderboardMessage(interaction.client).catch(error => {
        console.error("Erreur mise à jour leaderboard après /elosit :", error.message);
      });
    }
  }
};
