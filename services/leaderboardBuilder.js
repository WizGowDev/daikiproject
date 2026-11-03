const { EmbedBuilder } = require("discord.js");
const { getAccounts } = require("./accountsStore");
const { getRR } = require("./valorant");

const MAX_DESCRIPTION_LENGTH = 4000; // limite Discord : 4096

const RANK_TRANSLATIONS = {
  iron: "Fer",
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
  platinum: "Platine",
  diamond: "Diamant",
  ascendant: "Ascendant",
  immortal: "Immortel",
  radiant: "Radiant",
  unrated: "Non classé",
  unranked: "Non classé"
};

function formatRR(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "00";

  return String(number).padStart(2, "0");
}

function translateRank(rank) {
  if (!rank) return "Inconnu";

  for (const [english, french] of Object.entries(RANK_TRANSLATIONS)) {
    const regex = new RegExp(english, "i");

    if (regex.test(rank)) {
      return rank.replace(regex, french);
    }
  }

  return rank;
}

function getPositionLabel(index) {
  if (index === 0) return "🥇 1er";
  if (index === 1) return "🥈 2ème";
  if (index === 2) return "🥉 3ème";
  return `${index + 1}ème`;
}

function formatPlayer(player) {
  if (player.unavailable) {
    return `${player.name} (Indisponible) ⚠️`;
  }

  const rank = translateRank(player.rank);
  const rr = formatRR(player.rr);
  const warning = player.stale ? " ⚠️" : "";

  // Le Top n'apparaît que si le joueur est dans le classement officiel
  // (Immortel 1 et plus, selon ce que renvoie l'API).
  const top = player.placement ? ` • Top ${player.placement}` : "";

  return `${player.name} (${rank}${top} | ${rr}rr)${warning}`;
}

async function buildLeaderboardPayload({ force = false } = {}) {
  // Peut lever une erreur si accounts.json est corrompu : c'est voulu,
  // pour que le leaderboard affiché ne soit pas écrasé par un message d'erreur.
  const accounts = getAccounts();

  if (accounts.length === 0) {
    return {
      content: "Aucun compte n'est enregistré dans le leaderboard.",
      embeds: []
    };
  }

  const results = await Promise.allSettled(
    accounts.map(account => getRR(account.name, account.tag, { force }))
  );

  const players = accounts.map((account, index) => {
    const result = results[index];

    if (result.status === "fulfilled") {
      return {
        name: account.name,
        tag: account.tag,
        rank: result.value.rank,
        rr: result.value.rr,
        elo: result.value.elo,
        placement: result.value.placement,
        stale: result.value.stale,
        unavailable: false
      };
    }

    return {
      name: account.name,
      tag: account.tag,
      elo: -1,
      unavailable: true
    };
  });

  players.sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name));

  let description = "";

  for (let index = 0; index < players.length; index++) {
    const block = `${getPositionLabel(index)}\n${formatPlayer(players[index])}\n\n`;

    if (description.length + block.length > MAX_DESCRIPTION_LENGTH) {
      description += `…et ${players.length - index} autre(s) joueur(s)`;
      break;
    }

    description += block;
  }

  const embed = new EmbedBuilder()
    .setTitle("Classement des joueurs")
    .setColor(0x1a1519)
    .setDescription(description)
    .setFooter({ text: "Mise à jour automatique" })
    .setTimestamp();

  return {
    content: null,
    embeds: [embed]
  };
}

module.exports = {
  buildLeaderboardPayload
};
