const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "../data");
const accountsPath = path.join(dataDir, "accounts.json");

function ensureAccountsFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(accountsPath)) {
    fs.writeFileSync(accountsPath, "[]", "utf8");
  }
}

function readAccounts() {
  ensureAccountsFile();

  try {
    const file = fs.readFileSync(accountsPath, "utf8");
    const accounts = JSON.parse(file);

    if (!Array.isArray(accounts)) {
      return [];
    }

    return accounts;
  } catch (error) {
    console.error("Erreur lecture accounts.json :", error);
    return [];
  }
}

module.exports = {
  data: {
    name: "listaccounts",
    description: "Affiche tous les comptes enregistrés dans le leaderboard"
  },

  async execute(interaction) {
    const accounts = readAccounts();

    if (accounts.length === 0) {
      return interaction.reply({
        content: "Aucun compte n'est enregistré dans le leaderboard.",
        ephemeral: true
      });
    }

    let message = "**Comptes enregistrés dans le leaderboard :**\n\n";

    accounts.forEach((account, index) => {
      message += `**${index + 1}.** ${account.name}#${account.tag}\n`;
    });

    return interaction.reply({
      content: message,
      ephemeral: true
    });
  }
};
