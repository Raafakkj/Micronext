(function () {
  const STORAGE_KEYS = {
    users: "fiap_kanban_users",
    profiles: "fiap_kanban_profiles",
    board: "fiap_kanban_data",
    chat: "fiap_kanban_chat",
    logs: "fiap_kanban_logs",
    sprints: "fiap_sprints_data",
    communityPosts: "fiap_community_posts",
    presenceByRm: "fiap_online_presence"
  };

  const UNREAD_PREFIX = "fiap_kanban_unread_logs_";
  const DEFAULT_STATE = {
    users: [],
    profiles: {},
    board: null,
    chat: [],
    logs: [],
    sprints: [],
    communityPosts: [],
    unreadByRm: {},
    presenceByRm: {}
  };

  let isApplyingRemote = false;
  let syncTimer = null;
  let lastLocalWriteAt = 0;

  function safeParse(raw, fallback) {
    if (raw == null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function hasMeaningfulData(state) {
    return (
      Array.isArray(state.users) && state.users.length > 0 ||
      state.profiles && Object.keys(state.profiles).length > 0 ||
      state.board && Object.keys(state.board).length > 0 ||
      Array.isArray(state.chat) && state.chat.length > 0 ||
      Array.isArray(state.logs) && state.logs.length > 0 ||
      Array.isArray(state.sprints) && state.sprints.length > 0 ||
      Array.isArray(state.communityPosts) && state.communityPosts.length > 0 ||
      state.unreadByRm && Object.keys(state.unreadByRm).length > 0
    );
  }

  function readUnreadFromLocal() {
    const unreadByRm = {};

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(UNREAD_PREFIX)) continue;

      const rm = key.slice(UNREAD_PREFIX.length);
      const value = Number(localStorage.getItem(key) || "0");
      if (!Number.isNaN(value) && value > 0) {
        unreadByRm[rm] = value;
      }
    }

    return unreadByRm;
  }

  function readLocalState() {
    return {
      users: safeParse(localStorage.getItem(STORAGE_KEYS.users), DEFAULT_STATE.users),
      profiles: safeParse(localStorage.getItem(STORAGE_KEYS.profiles), DEFAULT_STATE.profiles),
      board: safeParse(localStorage.getItem(STORAGE_KEYS.board), DEFAULT_STATE.board),
      chat: safeParse(localStorage.getItem(STORAGE_KEYS.chat), DEFAULT_STATE.chat),
      logs: safeParse(localStorage.getItem(STORAGE_KEYS.logs), DEFAULT_STATE.logs),
      sprints: safeParse(localStorage.getItem(STORAGE_KEYS.sprints), DEFAULT_STATE.sprints),
      communityPosts: safeParse(localStorage.getItem(STORAGE_KEYS.communityPosts), DEFAULT_STATE.communityPosts),
      unreadByRm: readUnreadFromLocal(),
      presenceByRm: safeParse(localStorage.getItem(STORAGE_KEYS.presenceByRm), DEFAULT_STATE.presenceByRm)
    };
  }

  function applyRemoteState(state) {
    isApplyingRemote = true;

    try {
      Object.entries(STORAGE_KEYS).forEach(([category, key]) => {
        const value = Object.prototype.hasOwnProperty.call(state, category) ? state[category] : DEFAULT_STATE[category];
        localStorage.setItem(key, JSON.stringify(value));
      });

      const remoteUnread = state && state.unreadByRm && typeof state.unreadByRm === "object" ? state.unreadByRm : {};

      const unreadKeys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(UNREAD_PREFIX)) {
          unreadKeys.push(key);
        }
      }

      unreadKeys.forEach((key) => {
        const rm = key.slice(UNREAD_PREFIX.length);
        if (!Object.prototype.hasOwnProperty.call(remoteUnread, rm)) {
          localStorage.removeItem(key);
        }
      });

      Object.entries(remoteUnread).forEach(([rm, value]) => {
        const n = Number(value);
        if (!Number.isNaN(n) && n > 0) {
          localStorage.setItem(`${UNREAD_PREFIX}${rm}`, String(n));
        }
      });
    } finally {
      isApplyingRemote = false;
    }
  }

  function fetchRemoteStateSync() {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", "/api/data", false);
      request.send();

      if (request.status < 200 || request.status >= 300) return null;
      const payload = JSON.parse(request.responseText || "{}");
      return payload && payload.ok ? payload.state : null;
    } catch {
      return null;
    }
  }

  function syncStateNow() {
    if (isApplyingRemote) return;

    const snapshot = readLocalState();

    fetch("/api/data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      keepalive: true
    }).catch(() => {
      // Retry naturally in next user interaction.
    });
  }

  async function fetchRemoteState() {
    try {
      const response = await fetch("/api/data", { method: "GET", cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload && payload.ok ? payload.state : null;
    } catch {
      return null;
    }
  }

  async function pullRemoteState() {
    if (isApplyingRemote) return;
    if (Date.now() - lastLocalWriteAt < 1500) return;

    const remoteState = await fetchRemoteState();
    if (!remoteState) return;

    const localSnapshot = JSON.stringify(readLocalState());
    const remoteSnapshot = JSON.stringify(remoteState);

    if (localSnapshot === remoteSnapshot) return;

    applyRemoteState(remoteState);
    window.dispatchEvent(
      new CustomEvent("cloud-sync:remote-update", {
        detail: { at: Date.now() }
      })
    );
  }

  function scheduleSync() {
    if (isApplyingRemote) return;

    lastLocalWriteAt = Date.now();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncStateNow, 500);
  }

  function patchStorageMethods() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);

    localStorage.setItem = function patchedSetItem(key, value) {
      originalSetItem(key, value);
      if (Object.values(STORAGE_KEYS).includes(key) || key.startsWith(UNREAD_PREFIX)) {
        scheduleSync();
      }
    };

    localStorage.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem(key);
      if (Object.values(STORAGE_KEYS).includes(key) || key.startsWith(UNREAD_PREFIX)) {
        scheduleSync();
      }
    };

    localStorage.clear = function patchedClear() {
      originalClear();
      scheduleSync();
    };
  }

  function bootstrap() {
    const localState = readLocalState();
    const remoteState = fetchRemoteStateSync();

    if (remoteState && hasMeaningfulData(remoteState)) {
      applyRemoteState(remoteState);
    } else if (hasMeaningfulData(localState)) {
      syncStateNow();
    }

    patchStorageMethods();
    window.addEventListener("beforeunload", syncStateNow);
    setInterval(pullRemoteState, 2500);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        pullRemoteState();
      }
    });
  }

  bootstrap();
})();
