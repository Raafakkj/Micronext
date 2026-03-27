(function () {
  const session = getSession();
  if (!session) return;

  const logsToggle = document.getElementById("logs-toggle");
  const logsDropdown = document.getElementById("logs-dropdown");
  const logsList = document.getElementById("logs-list");
  const logsBadge = document.getElementById("logs-badge");

  const chatFab = document.getElementById("chat-fab");
  const chatWidget = document.getElementById("chat-widget");
  const chatClose = document.getElementById("chat-close");
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");

  if (!logsToggle || !logsDropdown || !logsList || !logsBadge || !chatFab || !chatWidget || !chatClose || !chatMessagesEl || !chatForm) {
    return;
  }

  const CHAT_KEY = "fiap_kanban_chat";
  const LOGS_KEY = "fiap_kanban_logs";
  const PROFILES_KEY = "fiap_kanban_profiles";
  const UNREAD_LOGS_KEY = "fiap_kanban_unread_logs";

  function safeRead(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function initialsFrom(name) {
    const parts = String(name || "RM").trim().split(" ").filter(Boolean);
    if (!parts.length) return "RM";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  function getProfiles() {
    return safeRead(PROFILES_KEY, {});
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

  let logs = safeRead(LOGS_KEY, []);
  let chat = safeRead(CHAT_KEY, []);
  let unreadLogs = Number(localStorage.getItem(`${UNREAD_LOGS_KEY}_${session.rm}`) || "0");

  function saveUnreadLogs() {
    localStorage.setItem(`${UNREAD_LOGS_KEY}_${session.rm}`, String(unreadLogs));
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

  function addLog(text) {
    logs.unshift({ id: uid(), text, at: Date.now() });
    if (logs.length > 40) logs.length = 40;
    unreadLogs += 1;
    save(LOGS_KEY, logs);
    saveUnreadLogs();
    renderLogs();
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

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = chatForm.message;
    const value = input.value.trim();
    if (!value) return;

    const me = getProfileByRm(session.rm, `aluno${session.rm}`);
    chat.push({
      id: uid(),
      rm: session.rm,
      name: me.username,
      text: value,
      at: Date.now()
    });

    if (chat.length > 120) {
      chat.splice(0, chat.length - 120);
    }

    save(CHAT_KEY, chat);
    renderChat();
    addLog(`${me.username} enviou mensagem no chat.`);
    input.value = "";
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

  renderChat();
  renderLogs();
})();
