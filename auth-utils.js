const USERS_KEY = "fiap_kanban_users";
const SESSION_KEY = "fiap_kanban_session";

const DEFAULT_USERS = [
  { rm: "553001", password: "fiap2026" },
  { rm: "553002", password: "fiap2026" },
  { rm: "553003", password: "fiap2026" },
  { rm: "571073", password: "fiap2026" }
];

function sanitizeRm(value) {
  return String(value || "").replace(/\D/g, "");
}

function getRegisteredUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return [...DEFAULT_USERS];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return [...DEFAULT_USERS];
    }
    return parsed;
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return [...DEFAULT_USERS];
  }
}

function saveRegisteredUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const rm = sanitizeRm(parsed.rm);
    if (rm.length < 5 || rm.length > 7) return null;

    return { ...parsed, rm };
  } catch {
    return null;
  }
}

function setSession(rm) {
  const sanitizedRm = sanitizeRm(rm);
  if (sanitizedRm.length < 5 || sanitizedRm.length > 7) {
    clearSession();
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ rm: sanitizedRm, loginAt: Date.now() }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function bytesToBase64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derivePasswordHash(password, saltBytes, iterations = 120000) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations
    },
    keyMaterial,
    256
  );

  return bytesToBase64(bits);
}

async function buildPasswordRecord(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 120000;
  const passwordHash = await derivePasswordHash(password, saltBytes, iterations);
  return {
    passwordHash,
    passwordSalt: bytesToBase64(saltBytes),
    passwordIter: iterations,
    passwordAlgo: "PBKDF2-SHA256"
  };
}

function isPasswordHashed(user) {
  return Boolean(user && user.passwordHash && user.passwordSalt && user.passwordIter);
}

async function verifyUserPassword(user, password) {
  if (!user) return false;

  if (isPasswordHashed(user)) {
    const saltBytes = base64ToBytes(user.passwordSalt);
    const calc = await derivePasswordHash(password, saltBytes, Number(user.passwordIter) || 120000);
    return calc === user.passwordHash;
  }

  return user.password === password;
}

async function setUserPassword(user, newPassword) {
  const record = await buildPasswordRecord(newPassword);
  user.passwordHash = record.passwordHash;
  user.passwordSalt = record.passwordSalt;
  user.passwordIter = record.passwordIter;
  user.passwordAlgo = record.passwordAlgo;
  delete user.password;
}

async function upgradeUserPasswordIfNeeded(user, plainPassword) {
  if (!user || isPasswordHashed(user)) return false;
  if (user.password !== plainPassword) return false;
  await setUserPassword(user, plainPassword);
  return true;
}
