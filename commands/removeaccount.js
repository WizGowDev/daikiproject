const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "../data");
const accountsPath = path.join(dataDir, "accounts.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(accountsPath)) {
  fs.writeFileSync(accountsPath, "[]");
}

module.exports = {
  data: {
    name: "removeaccount",
    description: "Supprime un compte Valorant du leaderboard",
    options: [
      {
        name: "name",
        description: "Pseudo Valorant du joueur",
        type: 3,
        required: true
      },
      {
        name: "tag",
        description: "Tag Valorant du joueur, sans le #",
        type: 3,
        required: true
      }
    ]
  },

  async execute(interaction) {
    const name = interaction.options.getString("name");
    const tag = interaction.options.getString("tag");

    const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));

    const newAccounts = accounts.filter(
      acc =>
        !(
          acc.name.toLowerCase() === name.toLowerCase() &&
          acc.tag.toLowerCase() === tag.toLowerCase()
        )
    );

    if (newAccounts.length === accounts.length) {
      return interaction.reply({
        content: `❌ Le compte **${name}#${tag}** n’est pas dans le leaderboard.`,
        ephemeral: true
      });
    }

    fs.writeFileSync(accountsPath, JSON.stringify(newAccounts, null, 2));

    return interaction.reply({
      content: `🗑️ Le compte **${name}#${tag}** a été supprimé du leaderboard.`,
      ephemeral: false
    });
  }
};
