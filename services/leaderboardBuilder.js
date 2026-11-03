const { EmbedBuilder } = require("discord.js");
const { getAccounts } = require("./accountsStore");
const { getRR } = require("./valorant");

const MAX_DESCRIPTION_LENGTH = 3900; // limite Discord : 4096 (marge pour le bloc ansi)

// Mode d'affichage des couleurs, réglable avec la variable RANK_COLOR_MODE :
//   "ansi"  (défaut) : texte du rang coloré (bloc de code ansi)
//   "emoji"          : pastille de couleur devant le rang (compatible partout)
//   "off"            : aucune couleur
const COLOR_MODE = (process.env.RANK_COLOR_MODE || "ansi").toLowerCase();

const ESC = "\u001b";
const ANSI_RESET = `${ESC}[0m`;
const DEFAULT_EMBED_COLOR = 0x1a1519;

// ansi : codes de couleur supportés par Discord (30 gris, 31 rouge, 32 vert,
//        33 jaune, 34 bleu, 35 rose, 36 cyan, 37 blanc ; 1 = gras, 4 = souligné)
// hex  : couleur de la barre latérale de l'embed (celle du 1er du classement)
const RANK_STYLES = {
  iron: { ansi: "30", emoji: "⬛", hex: 0x6b6b6b },
  bronze: { ansi: "33", emoji: "🟫", hex: 0xa5662a },
  silver: { ansi: "37", emoji: "⬜", hex: 0xc0c4c8 },
  gold: { ansi: "1;33", emoji: "🟨", hex: 0xe6b93a },
  platinum: { ansi: "36", emoji: "🟦", hex: 0x3bb3b0 },
  diamond: { ansi: "35", emoji: "🟪", hex: 0xb27df0 },
  ascendant: { ansi: "32", emoji: "🟩", hex: 0x2ea867 },
  immortal: { ansi: "31", emoji: "🟥", hex: 0xd1344f },
  radiant: { ansi: "4;33", emoji: "✨", hex: 0xf6e58d }
};

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

function getRankStyle(rank) {
  if (!rank) return null;

  for (const [key, style] of Object.entries(RANK_STYLES)) {
    if (new RegExp(key, "i").test(rank)) {
      return style;
    }
  }

  return null;
}

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

function colorRank(text, style) {
  if (!style) return text;

  if (COLOR_MODE === "ansi") {
    return `${ESC}[${style.ansi}m${text}${ANSI_RESET}`;
  }

  if (COLOR_MODE === "emoji") {
    return `${style.emoji} ${text}`;
  }

  return text;
}

function formatPlayer(player) {
  if (player.unavailable) {
    return `${player.name} (Indisponible) ⚠️`;
  }

  const rank = colorRank(translateRank(player.rank), getRankStyle(player.rank));
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

  if (COLOR_MODE === "ansi") {
    description = "```ansi\n" + description.trimEnd() + "\n```";
  }

  // La barre latérale prend la couleur du rang du joueur en tête.
  const leader = players[0];
  const embedColor =
    COLOR_MODE !== "off" && leader && !leader.unavailable
      ? getRankStyle(leader.rank)?.hex ?? DEFAULT_EMBED_COLOR
      : DEFAULT_EMBED_COLOR;

  const embed = new EmbedBuilder()
    .setTitle("Classement des joueurs")
    .setColor(embedColor)
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
