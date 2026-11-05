require("dotenv").config();

const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { startAutoLeaderboard } = require("./services/autoLeaderboard");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const commandsDir = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsDir, file));
    client.commands.set(command.data.name, command);
    console.log(`✅ Commande chargée : ${command.data.name}`);
  } catch (error) {
    console.error(`❌ Erreur dans la commande ${file} :`, error);
  }
}

client.once(Events.ClientReady, readyClient => {
  readyClient.user.setPresence({ status: "dnd" });

  console.log(`✅ Connecté en tant que ${readyClient.user.tag} en mode Ne pas déranger`);

  startAutoLeaderboard(readyClient);
});

client.on(Events.InteractionCreate, async interaction => {
  // Autocomplétion des options (ex : liste des comptes pour /elosit)
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`❌ Erreur autocomplétion /${interaction.commandName} :`, error.message);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Erreur pendant /${interaction.commandName} :`, error);

    const content = "Une erreur est survenue pendant l'exécution de la commande.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [] });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      console.error("❌ Impossible d'envoyer le message d'erreur :", replyError.message);
    }
  }
});

client.on(Events.Error, error => console.error("❌ Erreur client Discord :", error));

process.on("unhandledRejection", reason => {
  console.error("❌ unhandledRejection :", reason);
});

// Railway envoie SIGTERM à chaque redéploiement : on se déconnecte proprement.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    console.log(`🛑 ${signal} reçu, arrêt du bot...`);
    await client.destroy();
    process.exit(0);
  });
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  // Sans ça, un échec de connexion (token invalide, intents refusés, réseau...)
  // laisse le processus se terminer "proprement" sans que Railway ne le signale.
  console.error("❌ Connexion à Discord impossible :", error);
  process.exit(1);
});
