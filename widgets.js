(function () {
  const session = getSession();
  if (!session) return;

  const logsToggle = document.getElementById("logs-toggle");
  const logsDropdown = document.getElementById("logs-dropdown");
  const logsList = document.getElementById("logs-list");
  const logsBadge = document.getElementById("logs-badge");

  if (!logsToggle || !logsDropdown || !logsList || !logsBadge) {
    return;
  }

  const LOGS_KEY = "fiap_kanban_logs";
  const UNREAD_LOGS_KEY = "fiap_kanban_unread_logs";

  function safeRead(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderLogsBadge(unreadLogs) {
    if (unreadLogs > 0) {
      logsBadge.textContent = String(Math.min(unreadLogs, 99));
      logsBadge.classList.remove("hidden");
      return;
    }

    logsBadge.textContent = "0";
    logsBadge.classList.add("hidden");
  }

  function renderLogs() {
    const logs = safeRead(LOGS_KEY, []);
    const unreadLogs = Number(localStorage.getItem(`${UNREAD_LOGS_KEY}_${session.rm}`) || "0");

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

    renderLogsBadge(Number.isNaN(unreadLogs) ? 0 : unreadLogs);
  }

  logsToggle.addEventListener("click", () => {
    const willOpen = logsDropdown.classList.contains("hidden");
    logsDropdown.classList.toggle("hidden");

    if (willOpen) {
      localStorage.setItem(`${UNREAD_LOGS_KEY}_${session.rm}`, "0");
      renderLogs();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (!logsDropdown.contains(target) && !logsToggle.contains(target)) {
      logsDropdown.classList.add("hidden");
    }
  });

  window.addEventListener("cloud-sync:remote-update", renderLogs);
  window.addEventListener("focus", renderLogs);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderLogs();
  });

  renderLogs();
})();
