const BOARD_KEY = "fiap_kanban_data";
const CHAT_KEY = "fiap_kanban_chat";
const LOGS_KEY = "fiap_kanban_logs";
const UNREAD_LOGS_KEY = "fiap_kanban_unread_logs";
const PROFILES_KEY = "fiap_kanban_profiles";

const COLUMN_IDS = ["todo", "doing", "done"];
const COLUMN_LABELS = {
  todo: "A Fazer",
  doing: "Em Andamento",
  done: "Concluido"
};

const session = getSession();
if (!session) {
  window.location.href = "./index.html";
}

const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout");
const chatFab = document.getElementById("chat-fab");
const chatWidget = document.getElementById("chat-widget");
const chatClose = document.getElementById("chat-close");
const chatMessagesEl = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const logsList = document.getElementById("logs-list");
const logsToggle = document.getElementById("logs-toggle");
const logsDropdown = document.getElementById("logs-dropdown");
const logsBadge = document.getElementById("logs-badge");
const downloadPdfBtn = document.getElementById("download-pdf");

function safeRead(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getProfiles() {
  return safeRead(PROFILES_KEY, {});
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

let profiles = getProfiles();
if (!profiles[session.rm]) {
  profiles[session.rm] = {
    fullName: `Aluno RM ${session.rm}`,
    username: `aluno${session.rm}`,
    role: "Developer",
    avatar: ""
  };
  saveProfiles(profiles);
}

let currentProfile = profiles[session.rm];

function displayName() {
  return currentProfile.username || currentProfile.fullName || `RM ${session.rm}`;
}

function normalizeBoard(input) {
  const base = {
    todo: [{ id: uid(), text: "Definir backlog inicial" }],
    doing: [{ id: uid(), text: "Montar tela estilo trello" }],
    done: [{ id: uid(), text: "Criar autenticacao por RM" }]
  };

  if (!input || typeof input !== "object") return base;

  const normalized = {};

  COLUMN_IDS.forEach((columnId) => {
    const items = Array.isArray(input[columnId]) ? input[columnId] : base[columnId];
    normalized[columnId] = items.map((item) => {
      if (typeof item === "string") {
        return { id: uid(), text: item };
      }
      return {
        id: item.id || uid(),
        text: String(item.text || "Card sem titulo")
      };
    });
  });

  return normalized;
}

const board = normalizeBoard(safeRead(BOARD_KEY, null));
const chat = safeRead(CHAT_KEY, []);
const logs = safeRead(LOGS_KEY, []);
let unreadLogs = Number(localStorage.getItem(`${UNREAD_LOGS_KEY}_${session.rm}`) || "0");

function saveBoard() {
  localStorage.setItem(BOARD_KEY, JSON.stringify(board));
}

function saveChat() {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
}

function saveLogs() {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function saveUnreadLogs() {
  localStorage.setItem(`${UNREAD_LOGS_KEY}_${session.rm}`, String(unreadLogs));
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function getProfileByRm(rm, fallbackName) {
  const source = getProfiles()[rm] || {};
  return {
    fullName: source.fullName || fallbackName || `Aluno RM ${rm}`,
    username: source.username || fallbackName || `aluno${rm}`,
    role: source.role || "Developer",
    avatar: source.avatar || "",
    rm
  };
}

function initialsFrom(name) {
  const parts = String(name || "RM").trim().split(" ").filter(Boolean);
  if (!parts.length) return "RM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function updateHeaderUserInfo() {
  userInfo.textContent = `${displayName()} (${currentProfile.role}) - RM ${session.rm}`;
}

function renderLogsBadge() {
  if (unreadLogs > 0) {
    logsBadge.textContent = String(Math.min(unreadLogs, 99));
    logsBadge.classList.remove("hidden");
    return;
  }

  logsBadge.textContent = "0";
  logsBadge.classList.add("hidden");
}

function addLog(text) {
  logs.unshift({ id: uid(), text, at: Date.now() });
  if (logs.length > 40) logs.length = 40;
  unreadLogs += 1;
  saveLogs();
  saveUnreadLogs();
  renderLogs();
}

function renderLogs() {
  logsList.innerHTML = "";

  if (!logs.length) {
    const empty = document.createElement("li");
    empty.className = "log-item empty";
    empty.textContent = "Sem alteracoes ainda.";
    logsList.appendChild(empty);
  } else {
    logs.slice(0, 12).forEach((entry) => {
      const li = document.createElement("li");
      li.className = "log-item";
      const text = document.createElement("span");
      text.textContent = entry.text;
      const time = document.createElement("small");
      time.textContent = formatTime(entry.at);
      li.appendChild(text);
      li.appendChild(time);
      logsList.appendChild(li);
    });
  }

  renderLogsBadge();
}

function createTaskElement(taskData, columnId) {
  const task = document.createElement("article");
  task.className = "task";
  task.draggable = true;
  task.dataset.id = taskData.id;
  task.dataset.column = columnId;

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = taskData.text;
  task.appendChild(title);

  task.addEventListener("dragstart", () => {
    task.classList.add("is-dragging");
  });

  task.addEventListener("dragend", () => {
    task.classList.remove("is-dragging");
    syncFromDom();
  });

  task.addEventListener("dblclick", () => {
    task.remove();
    syncFromDom();
    addLog(`${displayName()} removeu o card "${taskData.text}".`);
  });

  return task;
}

function renderBoard() {
  COLUMN_IDS.forEach((columnId) => {
    const container = document.getElementById(columnId);
    container.innerHTML = "";

    board[columnId].forEach((taskData) => {
      container.appendChild(createTaskElement(taskData, columnId));
    });
  });
}

function syncFromDom() {
  COLUMN_IDS.forEach((columnId) => {
    const container = document.getElementById(columnId);
    board[columnId] = Array.from(container.querySelectorAll(".task")).map((taskEl) => {
      const titleEl = taskEl.querySelector(".task-title");
      return {
        id: taskEl.dataset.id || uid(),
        text: titleEl ? titleEl.textContent : "Card"
      };
    });
  });

  saveBoard();
}

let dragMeta = null;

document.querySelectorAll(".column form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.task;
    const value = input.value.trim();
    if (!value) return;

    const columnId = form.dataset.form;
    board[columnId].push({ id: uid(), text: value });
    input.value = "";
    renderBoard();
    saveBoard();
    addLog(`${displayName()} criou um card em ${COLUMN_LABELS[columnId]}: "${value}".`);
  });
});

document.querySelectorAll(".tasks").forEach((container) => {
  container.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  container.addEventListener("drop", () => {
    const dragging = document.querySelector(".is-dragging");
    if (!dragging) return;

    container.appendChild(dragging);
    const targetColumn = container.id;

    if (dragMeta && dragMeta.sourceColumn !== targetColumn) {
      addLog(
        `${displayName()} moveu "${dragMeta.text}" de ${COLUMN_LABELS[dragMeta.sourceColumn]} para ${COLUMN_LABELS[targetColumn]}.`
      );
    }
  });
});

document.addEventListener("dragstart", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const taskEl = target.closest(".task");
  if (!taskEl) return;

  const titleEl = taskEl.querySelector(".task-title");
  dragMeta = {
    text: titleEl ? titleEl.textContent : "Card",
    sourceColumn: taskEl.closest(".tasks") ? taskEl.closest(".tasks").id : "todo"
  };
});

document.addEventListener("dragend", () => {
  dragMeta = null;
});

function buildAvatarElement(profile) {
  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";

  if (profile.avatar) {
    avatar.style.backgroundImage = `url(${profile.avatar})`;
    avatar.classList.add("has-image");
  } else {
    avatar.textContent = initialsFrom(profile.username || profile.fullName);
  }

  return avatar;
}

function renderChat() {
  chatMessagesEl.innerHTML = "";

  if (!chat.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "Sem mensagens ainda. Inicie a conversa do grupo.";
    chatMessagesEl.appendChild(empty);
    return;
  }

  chat.slice(-40).forEach((message) => {
    const profile = getProfileByRm(message.rm, message.name);

    const bubble = document.createElement("article");
    bubble.className = "chat-bubble";

    const avatar = buildAvatarElement(profile);

    const body = document.createElement("div");
    body.className = "chat-bubble-body";

    const header = document.createElement("header");
    const author = document.createElement("strong");
    author.className = "chat-author";
    author.textContent = profile.username;

    const widget = document.createElement("div");
    widget.className = "profile-widget";

    const widgetAvatar = buildAvatarElement(profile);
    widgetAvatar.classList.add("small");

    const info = document.createElement("div");
    info.className = "profile-widget-info";

    const fullName = document.createElement("p");
    fullName.textContent = profile.fullName;
    const rm = document.createElement("small");
    rm.textContent = `RM ${profile.rm} • ${profile.role}`;

    info.appendChild(fullName);
    info.appendChild(rm);
    widget.appendChild(widgetAvatar);
    widget.appendChild(info);

    author.appendChild(widget);

    const time = document.createElement("small");
    time.textContent = formatTime(message.at);

    const content = document.createElement("p");
    content.textContent = message.text;

    header.appendChild(author);
    header.appendChild(time);
    body.appendChild(header);
    body.appendChild(content);

    bubble.appendChild(avatar);
    bubble.appendChild(body);

    chatMessagesEl.appendChild(bubble);
  });

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = chatForm.message;
  const value = input.value.trim();
  if (!value) return;

  chat.push({
    id: uid(),
    rm: session.rm,
    name: displayName(),
    text: value,
    at: Date.now()
  });

  if (chat.length > 120) {
    chat.splice(0, chat.length - 120);
  }

  saveChat();
  renderChat();
  addLog(`${displayName()} enviou mensagem no chat.`);
  input.value = "";
});

function openChat() {
  chatWidget.classList.remove("hidden");
  chatFab.classList.add("hidden");
}

function closeChat() {
  chatWidget.classList.add("hidden");
  chatFab.classList.remove("hidden");
}

chatFab.addEventListener("click", openChat);
chatClose.addEventListener("click", closeChat);

downloadPdfBtn.addEventListener("click", () => {
  syncFromDom();

  const jsPdfLib = window.jspdf && window.jspdf.jsPDF;
  if (!jsPdfLib) {
    alert("Biblioteca de PDF nao carregada. Recarregue a pagina e tente novamente.");
    return;
  }

  const doc = new jsPdfLib({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const colGap = 6;
  const colWidth = (pageWidth - margin * 2 - colGap * 2) / 3;
  const colTop = 34;
  const colBottom = pageHeight - 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Kanban", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado por: ${displayName()} (RM ${session.rm})`, margin, 22);
  doc.text(`Data: ${formatTime(Date.now())}`, margin, 27);

  COLUMN_IDS.forEach((columnId, colIndex) => {
    const x = margin + colIndex * (colWidth + colGap);
    let y = colTop + 6;

    doc.setDrawColor(120, 120, 120);
    doc.roundedRect(x, colTop, colWidth, colBottom - colTop, 2, 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(COLUMN_LABELS[columnId], x + 3, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const cards = board[columnId].length ? board[columnId] : [{ text: "Sem cards" }];

    cards.forEach((card) => {
      const lines = doc.splitTextToSize(`- ${card.text}`, colWidth - 6);
      const needed = lines.length * 4.4;

      if (y + needed > colBottom - 3) return;

      doc.text(lines, x + 3, y);
      y += needed + 1;
    });
  });

  doc.save(`kanban-${session.rm}.pdf`);
});

logsToggle.addEventListener("click", () => {
  const willOpen = logsDropdown.classList.contains("hidden");
  logsDropdown.classList.toggle("hidden");

  if (willOpen) {
    unreadLogs = 0;
    saveUnreadLogs();
    renderLogsBadge();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (!logsDropdown.contains(target) && !logsToggle.contains(target)) {
    logsDropdown.classList.add("hidden");
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  window.location.href = "./index.html";
});

if (!logs.length) {
  addLog(`${displayName()} acessou o board.`);
}

updateHeaderUserInfo();
renderBoard();
renderChat();
renderLogs();
renderLogsBadge();
saveBoard();
