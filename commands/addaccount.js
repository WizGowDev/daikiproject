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
    name: "addaccount",
    description: "Ajoute un compte Valorant au leaderboard",
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

    const alreadyExists = accounts.some(
      acc =>
        acc.name.toLowerCase() === name.toLowerCase() &&
        acc.tag.toLowerCase() === tag.toLowerCase()
    );

    if (alreadyExists) {
      return interaction.reply({
        content: `⚠️ Le compte **${name}#${tag}** est déjà dans le leaderboard.`,
        ephemeral: true
      });
    }

    accounts.push({
      name,
      tag
    });

    fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));

    return interaction.reply({
      content: `✅ Le compte **${name}#${tag}** a été ajouté au leaderboard.`,
      ephemeral: false
    });
  }
};
