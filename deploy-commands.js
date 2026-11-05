require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Lancé automatiquement avant le bot (script "start" de package.json),
// donc à chaque déploiement sur Railway. Peut aussi être lancé à la main : npm run deploy

const missing = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"].filter(name => !process.env[name]);

if (missing.length > 0) {
  // On ne bloque pas le démarrage du bot : on signale seulement le problème.
  console.error(`❌ Déploiement des commandes ignoré, variable(s) manquante(s) : ${missing.join(", ")}`);
  process.exit(0);
}

const commandsDir = path.join(__dirname, "commands");
const commands = [];

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith(".js"))) {
  const command = require(path.join(commandsDir, file));
  commands.push(command.data);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Déploiement de ${commands.length} commandes...`);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`✅ Commandes déployées : ${commands.map(c => "/" + c.name).join(", ")}`);
  } catch (err) {
    // Une erreur ici ne doit pas empêcher le bot de démarrer.
    console.error("❌ Erreur pendant le déploiement des commandes :", err.message);
  }
})();
