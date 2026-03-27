const SPRINTS_KEY = "fiap_sprints_data";
const BOARD_KEY = "fiap_kanban_data";

const session = getSession();
if (!session) {
  window.location.href = "./index.html";
}

const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout");
const sprintForm = document.getElementById("sprint-form");
const sprintList = document.getElementById("sprint-list");
const sprintMessage = document.getElementById("sprint-message");

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
  return safeRead("fiap_kanban_profiles", {});
}

const profiles = getProfiles();
const profile = profiles[session.rm] || { username: `aluno${session.rm}`, role: "Developer" };
userInfo.textContent = `${profile.username} (${profile.role}) - RM ${session.rm}`;

const sprints = safeRead(SPRINTS_KEY, []);

function saveSprints() {
  localStorage.setItem(SPRINTS_KEY, JSON.stringify(sprints));
}

function normalizeBoard(input) {
  const base = { todo: [], doing: [], done: [] };
  if (!input || typeof input !== "object") return base;

  const normalized = {};
  ["todo", "doing", "done"].forEach((columnId) => {
    const items = Array.isArray(input[columnId]) ? input[columnId] : [];
    normalized[columnId] = items.map((item) => {
      if (typeof item === "string") {
        return { id: uid(), text: item };
      }
      return {
        id: item.id || uid(),
        text: String(item.text || "Card")
      };
    });
  });

  return normalized;
}

function sprintToColumn(status) {
  if (status === "Ativa") return "doing";
  if (status === "Concluida") return "done";
  return "todo";
}

function sprintCardText(sprint) {
  return `Sprint: ${sprint.name} | ${sprint.priority} | ${sprint.status}`;
}

function syncSprintsToKanban() {
  const board = normalizeBoard(safeRead(BOARD_KEY, null));

  ["todo", "doing", "done"].forEach((columnId) => {
    board[columnId] = board[columnId].filter((card) => !String(card.id).startsWith("sprint-card-"));
  });

  const sortedSprints = [...sprints].sort((a, b) => b.createdAt - a.createdAt);
  sortedSprints.forEach((sprint) => {
    const targetColumn = sprintToColumn(sprint.status);
    board[targetColumn].unshift({
      id: `sprint-card-${sprint.id}`,
      text: sprintCardText(sprint)
    });
  });

  localStorage.setItem(BOARD_KEY, JSON.stringify(board));
}

function priorityClass(priority) {
  return {
    Baixa: "prio-low",
    Media: "prio-mid",
    Alta: "prio-high",
    Critica: "prio-critical"
  }[priority] || "prio-mid";
}

function renderSprints() {
  sprintList.innerHTML = "";

  if (!sprints.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "Nenhuma sprint cadastrada ainda.";
    sprintList.appendChild(empty);
    return;
  }

  sprints.forEach((sprint) => {
    const card = document.createElement("article");
    card.className = "sprint-card";

    const top = document.createElement("header");
    const title = document.createElement("strong");
    const status = document.createElement("small");
    title.textContent = sprint.name;
    status.textContent = sprint.status;
    top.appendChild(title);
    top.appendChild(status);

    const goal = document.createElement("p");
    goal.textContent = sprint.goal;

    const badge = document.createElement("span");
    badge.className = `priority-badge ${priorityClass(sprint.priority)}`;
    badge.textContent = `Importancia: ${sprint.priority}`;

    const actions = document.createElement("div");
    actions.className = "sprint-actions";

    const advance = document.createElement("button");
    advance.type = "button";
    advance.textContent = "Avancar status";
    advance.addEventListener("click", () => {
      const order = ["Planejada", "Ativa", "Concluida"];
      const currentIndex = order.indexOf(sprint.status);
      sprint.status = order[(currentIndex + 1) % order.length];
      saveSprints();
      syncSprintsToKanban();
      renderSprints();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-btn";
    remove.textContent = "Remover";
    remove.addEventListener("click", () => {
      const index = sprints.findIndex((item) => item.id === sprint.id);
      if (index >= 0) {
        const removedName = sprints[index].name;
        sprints.splice(index, 1);
        saveSprints();
        syncSprintsToKanban();
        renderSprints();
      }
    });

    actions.appendChild(advance);
    actions.appendChild(remove);

    card.appendChild(top);
    card.appendChild(goal);
    card.appendChild(badge);
    card.appendChild(actions);
    sprintList.appendChild(card);
  });
}

sprintForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = sprintForm.name.value.trim();
  const goal = sprintForm.goal.value.trim();
  const priority = sprintForm.priority.value;
  const status = sprintForm.status.value;

  if (!name || !goal) {
    sprintMessage.style.color = "#ff6f78";
    sprintMessage.textContent = "Preencha nome e objetivo da sprint.";
    return;
  }

  sprints.unshift({
    id: uid(),
    name,
    goal,
    priority,
    status,
    rm: session.rm,
    createdAt: Date.now()
  });

  saveSprints();
  syncSprintsToKanban();
  sprintForm.reset();
  sprintMessage.style.color = "#16d47b";
  sprintMessage.textContent = "Sprint cadastrada com sucesso.";
  renderSprints();
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  window.location.href = "./index.html";
});

syncSprintsToKanban();
renderSprints();
