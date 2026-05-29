require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const { startAutoLeaderboard } = require("./services/autoLeaderboard");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    console.log(`✅ Commande chargée : ${command.data.name}`);
  } catch (error) {
    console.error(`❌ Erreur dans la commande ${file} :`, error);
  }
}

client.once("ready", () => {
  client.user.setPresence({
    status: "dnd"
  });

  console.log(`✅ Connecté en tant que ${client.user.tag} en mode Ne pas déranger`);

  startAutoLeaderboard(client);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Erreur pendant /${interaction.commandName} :`, error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "Une erreur est survenue pendant l'exécution de la commande."
      });
    } else {
      await interaction.reply({
        content: "Une erreur est survenue pendant l'exécution de la commande.",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
