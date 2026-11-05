const fs = require("fs");
const path = require("path");

// En production (Railway), DATA_DIR doit pointer vers un volume (ex : /data)
// sinon les données sont perdues à chaque redéploiement.
const dataDir = process.env.DATA_DIR || path.join(__dirname, "../data");

// accounts.json du dépôt : sert de point de départ si le volume est vide.
const seedAccountsPath = path.join(__dirname, "../data/accounts.json");

function dataPath(fileName) {
  return path.join(dataDir, fileName);
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Renvoie `fallback` si le fichier n'existe pas.
// Lève une erreur si le fichier existe mais est corrompu
// (pour ne jamais écraser des données par erreur).
function readJson(fileName, fallback) {
  ensureDataDir();

  const filePath = dataPath(fileName);
  if (!fs.existsSync(filePath)) return fallback;

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Écriture atomique : on écrit dans un fichier temporaire puis on renomme.
function writeJson(fileName, data) {
  ensureDataDir();

  const filePath = dataPath(fileName);
  const tmpPath = `${filePath}.tmp`;

  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

function deleteJson(fileName) {
  const filePath = dataPath(fileName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function initAccountsFile() {
  ensureDataDir();

  const target = dataPath("accounts.json");
  if (fs.existsSync(target)) return;

  const sameFile = path.resolve(seedAccountsPath) === path.resolve(target);

  if (!sameFile && fs.existsSync(seedAccountsPath)) {
    fs.copyFileSync(seedAccountsPath, target);
  } else {
    fs.writeFileSync(target, "[]", "utf8");
  }
}

function normalize(name, tag) {
  return {
    name: String(name).trim(),
    tag: String(tag).trim().replace(/^#/, "")
  };
}

function isSameAccount(a, b) {
  return (
    a.name.toLowerCase() === b.name.toLowerCase() &&
    a.tag.toLowerCase() === b.tag.toLowerCase()
  );
}

function getAccounts() {
  initAccountsFile();

  const accounts = readJson("accounts.json", []);

  if (!Array.isArray(accounts)) {
    throw new Error("accounts.json doit contenir un tableau.");
  }

  return accounts;
}

function addAccount(name, tag) {
  const account = normalize(name, tag);
  const accounts = getAccounts();

  if (accounts.some(existing => isSameAccount(existing, account))) {
    return { added: false, account };
  }

  accounts.push(account);
  writeJson("accounts.json", accounts);

  return { added: true, account };
}

function removeAccount(name, tag) {
  const account = normalize(name, tag);
  const accounts = getAccounts();

  const remaining = accounts.filter(existing => !isSameAccount(existing, account));

  if (remaining.length === accounts.length) {
    return { removed: false, account };
  }

  writeJson("accounts.json", remaining);

  return { removed: true, account };
}

// Active / désactive la mention (elosit) sur un compte.
// value: true / false, ou null pour inverser l'état actuel.
function setElosit(name, tag, value = null) {
  const target = normalize(name, tag);
  const accounts = getAccounts();

  const account = accounts.find(existing => isSameAccount(existing, target));

  if (!account) {
    return { found: false, changed: false, account: target };
  }

  const current = Boolean(account.elosit);
  const next = value === null ? !current : Boolean(value);

  if (next === current) {
    return { found: true, changed: false, account };
  }

  if (next) {
    account.elosit = true;
  } else {
    delete account.elosit;
  }

  writeJson("accounts.json", accounts);

  return { found: true, changed: true, account };
}

module.exports = {
  getAccounts,
  addAccount,
  removeAccount,
  setElosit,
  readJson,
  writeJson,
  deleteJson
};
