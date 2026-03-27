const PROFILES_KEY = "fiap_kanban_profiles";
const CHAT_KEY = "fiap_kanban_chat";
const SPRINTS_KEY = "fiap_sprints_data";
const UNREAD_LOGS_KEY = "fiap_kanban_unread_logs";

const session = getSession();
if (!session) {
  window.location.href = "./index.html";
}

let currentRm = session.rm;

const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout");
const settingsForm = document.getElementById("settings-form");
const settingsMessage = document.getElementById("settings-message");
const avatarPreview = document.getElementById("avatar-preview");
const avatarUpload = document.getElementById("avatar-upload");
const clearAvatarBtn = document.getElementById("clear-avatar");

const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");

const ALLOWED_ROLES = ["Developer", "Scrum Master", "PO"];

function safeRead(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function initialsFromName(name) {
  const parts = String(name || "").trim().split(" ").filter(Boolean);
  if (!parts.length) return "RM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function ensureProfileExists(profiles, rm) {
  if (!profiles[rm]) {
    profiles[rm] = {
      fullName: `Aluno RM ${rm}`,
      username: `aluno${rm}`,
      role: "Developer",
      avatar: ""
    };
    saveProfiles(profiles);
  }
}

function migrateRmReferences(oldRm, newRm) {
  const chat = safeRead(CHAT_KEY, []);
  const updatedChat = chat.map((msg) => (msg.rm === oldRm ? { ...msg, rm: newRm } : msg));
  localStorage.setItem(CHAT_KEY, JSON.stringify(updatedChat));

  const sprints = safeRead(SPRINTS_KEY, []);
  const updatedSprints = sprints.map((sprint) => (sprint.rm === oldRm ? { ...sprint, rm: newRm } : sprint));
  localStorage.setItem(SPRINTS_KEY, JSON.stringify(updatedSprints));

  const oldUnreadKey = `${UNREAD_LOGS_KEY}_${oldRm}`;
  const newUnreadKey = `${UNREAD_LOGS_KEY}_${newRm}`;
  const unread = localStorage.getItem(oldUnreadKey);
  if (unread !== null) {
    localStorage.setItem(newUnreadKey, unread);
    localStorage.removeItem(oldUnreadKey);
  }
}

const profiles = safeRead(PROFILES_KEY, {});
ensureProfileExists(profiles, currentRm);

let profile = profiles[currentRm];
let pendingAvatarData = null;

if (!ALLOWED_ROLES.includes(profile.role)) {
  profile.role = "Developer";
}

function renderAvatar() {
  if (profile.avatar) {
    avatarPreview.style.backgroundImage = `url(${profile.avatar})`;
    avatarPreview.textContent = "";
    avatarPreview.classList.add("has-image");
    return;
  }

  avatarPreview.style.backgroundImage = "none";
  avatarPreview.textContent = initialsFromName(profile.username || profile.fullName);
  avatarPreview.classList.remove("has-image");
}

function refreshHeader() {
  userInfo.textContent = `${profile.username} (${profile.role}) - RM ${currentRm}`;
}

function setMessage(el, text, ok = false) {
  el.style.color = ok ? "#16d47b" : "#ff6f78";
  el.textContent = text;
}

settingsForm.fullName.value = profile.fullName || "";
settingsForm.username.value = profile.username || "";
settingsForm.role.value = profile.role || "Developer";
loginForm.newRm.value = currentRm;

refreshHeader();
renderAvatar();

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const fullName = settingsForm.fullName.value.trim();
  const username = settingsForm.username.value.trim();
  const role = ALLOWED_ROLES.includes(settingsForm.role.value) ? settingsForm.role.value : "Developer";

  if (fullName.length < 3 || username.length < 3) {
    setMessage(settingsMessage, "Preencha nome real e nome de usuario com ao menos 3 caracteres.");
    return;
  }

  profile.fullName = fullName;
  profile.username = username;
  profile.role = role;

  if (pendingAvatarData !== null) {
    profile.avatar = pendingAvatarData;
    pendingAvatarData = null;
  }

  profiles[currentRm] = profile;
  saveProfiles(profiles);

  setMessage(settingsMessage, "Perfil salvo com sucesso.", true);
  avatarUpload.value = "";
  refreshHeader();
  renderAvatar();
});

avatarUpload.addEventListener("change", () => {
  const file = avatarUpload.files && avatarUpload.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setMessage(settingsMessage, "Selecione um arquivo de imagem valido.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingAvatarData = String(reader.result || "");
    avatarPreview.style.backgroundImage = `url(${pendingAvatarData})`;
    avatarPreview.textContent = "";
    avatarPreview.classList.add("has-image");
    settingsMessage.style.color = "#b7b7bb";
    settingsMessage.textContent = "Foto carregada. Clique em Salvar perfil para confirmar.";
  };
  reader.readAsDataURL(file);
});

clearAvatarBtn.addEventListener("click", () => {
  pendingAvatarData = "";
  profile.avatar = "";
  profiles[currentRm] = profile;
  saveProfiles(profiles);
  renderAvatar();
  setMessage(settingsMessage, "Foto removida.", true);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const newRm = sanitizeRm(loginForm.newRm.value.trim());
  const currentPassword = loginForm.currentPassword.value;

  if (newRm.length < 5 || newRm.length > 7) {
    setMessage(loginMessage, "Informe um RM valido (5 a 7 digitos).");
    return;
  }

  const users = getRegisteredUsers();
  const currentUser = users.find((user) => user.rm === currentRm);
  const ok = await verifyUserPassword(currentUser, currentPassword);
  if (!ok) {
    setMessage(loginMessage, "Senha atual incorreta.");
    return;
  }

  const upgraded = await upgradeUserPasswordIfNeeded(currentUser, currentPassword);

  if (newRm !== currentRm && users.some((user) => user.rm === newRm)) {
    setMessage(loginMessage, "Esse RM ja esta em uso.");
    return;
  }

  const oldRm = currentRm;
  currentUser.rm = newRm;
  saveRegisteredUsers(users);

  if (newRm !== oldRm) {
    profiles[newRm] = profiles[oldRm] || profile;
    delete profiles[oldRm];
    saveProfiles(profiles);

    migrateRmReferences(oldRm, newRm);

    currentRm = newRm;
    profile = profiles[currentRm];
    setSession(currentRm);
    loginForm.newRm.value = currentRm;
    refreshHeader();
  }

  if (upgraded) {
    saveRegisteredUsers(users);
  }

  loginForm.currentPassword.value = "";
  setMessage(loginMessage, "Login atualizado com sucesso.", true);
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const currentPassword = passwordForm.currentPassword.value;
  const newPassword = passwordForm.newPassword.value;
  const confirmPassword = passwordForm.confirmPassword.value;

  if (newPassword.length < 6) {
    setMessage(passwordMessage, "A nova senha deve ter no minimo 6 caracteres.");
    return;
  }

  if (newPassword !== confirmPassword) {
    setMessage(passwordMessage, "A confirmacao da senha nao confere.");
    return;
  }

  const users = getRegisteredUsers();
  const currentUser = users.find((user) => user.rm === currentRm);
  const ok = await verifyUserPassword(currentUser, currentPassword);
  if (!ok) {
    setMessage(passwordMessage, "Senha atual incorreta.");
    return;
  }

  await setUserPassword(currentUser, newPassword);
  saveRegisteredUsers(users);

  passwordForm.reset();
  setMessage(passwordMessage, "Senha atualizada com sucesso.", true);
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  window.location.href = "./index.html";
});
