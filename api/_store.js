const fs = require("fs/promises");
const path = require("path");

const STORE_KEY = "micronext:state:v1";
const LOCAL_FILE = path.join(process.cwd(), ".micronext-state.json");

const DEFAULT_STATE = {
  users: [],
  profiles: {},
  board: null,
  chat: [],
  logs: [],
  sprints: [],
  communityPosts: [],
  unreadByRm: {}
};

const CATEGORY_DESCRIPTIONS = {
  users: "Usuarios e credenciais",
  profiles: "Perfis de usuario",
  board: "Cards do Kanban",
  chat: "Mensagens do chat",
  logs: "Historico de alteracoes",
  sprints: "Planejamento de sprints",
  communityPosts: "Feed da comunidade",
  unreadByRm: "Notificacoes nao lidas por RM"
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeState(input) {
  const base = cloneDefaultState();
  if (!isPlainObject(input)) return base;

  const next = { ...base };

  next.users = Array.isArray(input.users) ? input.users : base.users;
  next.profiles = isPlainObject(input.profiles) ? input.profiles : base.profiles;
  next.board = isPlainObject(input.board) || input.board === null ? input.board : base.board;
  next.chat = Array.isArray(input.chat) ? input.chat : base.chat;
  next.logs = Array.isArray(input.logs) ? input.logs : base.logs;
  next.sprints = Array.isArray(input.sprints) ? input.sprints : base.sprints;
  next.communityPosts = Array.isArray(input.communityPosts) ? input.communityPosts : base.communityPosts;
  next.unreadByRm = isPlainObject(input.unreadByRm) ? input.unreadByRm : base.unreadByRm;

  return next;
}

function hasMeaningfulData(state) {
  const data = normalizeState(state);
  return (
    data.users.length > 0 ||
    Object.keys(data.profiles).length > 0 ||
    (data.board && Object.keys(data.board).length > 0) ||
    data.chat.length > 0 ||
    data.logs.length > 0 ||
    data.sprints.length > 0 ||
    data.communityPosts.length > 0 ||
    Object.keys(data.unreadByRm).length > 0
  );
}

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(parts) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(parts)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KV request failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function readFromKv() {
  const payload = await kvCommand(["GET", STORE_KEY]);
  if (!payload || payload.result == null) return cloneDefaultState();

  try {
    const parsed = JSON.parse(String(payload.result));
    return normalizeState(parsed);
  } catch {
    return cloneDefaultState();
  }
}

async function writeToKv(state) {
  const normalized = normalizeState(state);
  await kvCommand(["SET", STORE_KEY, JSON.stringify(normalized)]);
  return normalized;
}

function readFromMemory() {
  if (!globalThis.__MICRONEXT_STATE__) {
    globalThis.__MICRONEXT_STATE__ = cloneDefaultState();
  }
  return normalizeState(globalThis.__MICRONEXT_STATE__);
}

function writeToMemory(state) {
  const normalized = normalizeState(state);
  globalThis.__MICRONEXT_STATE__ = normalized;
  return normalized;
}

async function readFromFile() {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return cloneDefaultState();
  }
}

async function writeToFile(state) {
  const normalized = normalizeState(state);
  await fs.writeFile(LOCAL_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

async function readState() {
  if (hasKvConfig()) return readFromKv();
  if (process.env.VERCEL) return readFromMemory();
  return readFromFile();
}

async function writeState(state) {
  if (hasKvConfig()) return writeToKv(state);
  if (process.env.VERCEL) return writeToMemory(state);
  return writeToFile(state);
}

function listCategories() {
  return Object.keys(DEFAULT_STATE).map((name) => ({
    name,
    description: CATEGORY_DESCRIPTIONS[name]
  }));
}

module.exports = {
  DEFAULT_STATE,
  cloneDefaultState,
  normalizeState,
  hasMeaningfulData,
  readState,
  writeState,
  listCategories
};
