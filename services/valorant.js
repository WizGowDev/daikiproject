const axios = require("axios");

// Endpoint v3 : seul à fournir la place dans le classement officiel
// (leaderboard_placement), l'ancien endpoint v1 ne l'a pas.
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

function parseMmr(data) {
  // v3 : les infos actuelles sont dans data.current
  const current = data.current ?? data;

  const elo = Number(current.elo) || 0;
  const placement = Number(current.leaderboard_placement?.rank) || null;

  return {
    rank: current.tier?.name || data.currenttierpatched || "Unknown",
    rr: Number(current.rr ?? current.ranking_in_tier ?? elo % 100) || 0,
    elo,
    placement // null si le joueur n'est pas dans le classement officiel
  };
}

async function request(name, tag, attempt = 1) {
  const url =
    `${API_BASE}/mmr/${REGION}/${PLATFORM}/` +
    `${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;

  const headers = process.env.VALORANT_API_KEY
    ? { Authorization: process.env.VALORANT_API_KEY }
    : {};

  try {
    const res = await axios.get(url, { headers, timeout: 10000 });
    const data = res.data?.data;

    if (!data) {
      throw new Error("Réponse de l'API vide");
    }

    return parseMmr(data);
  } catch (err) {
    const status = err.response?.status;

    // Trop de requêtes : on attend un peu puis on réessaie (2 fois max).
    if (status === 429 && attempt < 3) {
      const retryAfter = Number(err.response.headers?.["retry-after"]) || attempt * 2;
      await sleep(Math.min(retryAfter, 10) * 1000);
      return request(name, tag, attempt + 1);
    }

    const error = new Error(err.response?.data?.errors?.[0]?.message || err.message);
    error.status = status;
    throw error;
  }
}

// Renvoie { rank, rr, elo, placement, stale }.
// - cache de courte durée pour limiter les appels à l'API
// - si l'API échoue mais qu'on a déjà une valeur, on la renvoie avec stale: true
// - sinon l'erreur est levée (error.status contient le code HTTP éventuel)
async function getRR(name, tag) {
  const key = cacheKey(name, tag);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
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
