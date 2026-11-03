const axios = require("axios");

// Endpoint v3 : fournit le rang actuel et, quand il est connu,
// la place dans le classement officiel (leaderboard_placement).
const API_BASE =
  process.env.VALORANT_API_BASE || "https://api.henrikdev.xyz/valorant/v3";
const REGION = process.env.VALORANT_REGION || "eu";
const PLATFORM = process.env.VALORANT_PLATFORM || "pc";
const CACHE_TTL = Number(process.env.VALORANT_CACHE_TTL_MS) || 60 * 1000;

const cache = new Map();
const inflight = new Map();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cacheKey(name, tag) {
  return `${name}#${tag}`.toLowerCase();
}

function authHeaders() {
  return process.env.VALORANT_API_KEY
    ? { Authorization: process.env.VALORANT_API_KEY }
    : {};
}

function isTopTier(rankName) {
  return /immortal|radiant/i.test(rankName || "");
}

function parseMmr(data) {
  // v3 : les infos actuelles sont dans data.current
  const current = data.current ?? data;

  const elo = Number(current.elo) || 0;
  const placement = Number(current.leaderboard_placement?.rank) || null;

  return {
    rank: current.tier?.name || data.currenttierpatched || "Unknown",
    rr: Number(current.rr ?? current.ranking_in_tier ?? elo % 100) || 0,
    elo,
    placement // null si l'API ne donne pas de place pour ce joueur
  };
}

// GET avec une nouvelle tentative automatique en cas d'erreur 429.
async function get(url, params, attempt = 1) {
  try {
    return await axios.get(url, { headers: authHeaders(), params, timeout: 10000 });
  } catch (err) {
    const status = err.response?.status;

    if (status === 429 && attempt < 3) {
      const retryAfter = Number(err.response.headers?.["retry-after"]) || attempt * 2;
      await sleep(Math.min(retryAfter, 10) * 1000);
      return get(url, params, attempt + 1);
    }

    const error = new Error(err.response?.data?.errors?.[0]?.message || err.message);
    error.status = status;
    throw error;
  }
}

// Secours : on cherche le joueur directement dans le classement officiel.
// Renvoie sa place, ou null s'il n'y est pas (ou si on ne le trouve pas).
async function fetchPlacementFromLeaderboard(name, tag) {
  try {
    const res = await get(`${API_BASE}/leaderboard/${REGION}/${PLATFORM}`, {
      name,
      tag,
      size: 10
    });

    const players = res.data?.data?.players || [];

    const match = players.find(
      player =>
        String(player.name).toLowerCase() === name.toLowerCase() &&
        String(player.tag).toLowerCase() === tag.toLowerCase()
    );

    return Number(match?.leaderboard_rank) || null;
  } catch (error) {
    // 404 = pas dans le classement : situation normale.
    if (error.status !== 404) {
      console.error(`Recherche classement (${name}#${tag}) :`, error.status || "", error.message);
    }
    return null;
  }
}

async function request(name, tag) {
  const url =
    `${API_BASE}/mmr/${REGION}/${PLATFORM}/` +
    `${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;

  const res = await get(url);
  const data = res.data?.data;

  if (!data) {
    throw new Error("Réponse de l'API vide");
  }

  const result = parseMmr(data);

  if (!result.placement && isTopTier(result.rank)) {
    result.placement = await fetchPlacementFromLeaderboard(name, tag);

    console.log(
      `ℹ️ ${name}#${tag} (${result.rank}) : ` +
        (result.placement
          ? `Top ${result.placement} trouvé via le classement`
          : "aucune place dans le classement officiel")
    );
  }

  return result;
}

// Renvoie { rank, rr, elo, placement, stale }.
// - cache de courte durée pour limiter les appels à l'API (force: true l'ignore)
// - si l'API échoue mais qu'on a déjà une valeur, on la renvoie avec stale: true
// - sinon l'erreur est levée (error.status contient le code HTTP éventuel)
async function getRR(name, tag, { force = false } = {}) {
  const key = cacheKey(name, tag);
  const cached = cache.get(key);

  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { ...cached.data, stale: false };
  }

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = request(name, tag)
    .then(data => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return { ...data, stale: false };
    })
    .catch(error => {
      console.error(`API ERROR (${name}#${tag}) :`, error.status || "", error.message);

      if (cached) {
        return { ...cached.data, stale: true };
      }

      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);

  return promise;
}

module.exports = { getRR };
