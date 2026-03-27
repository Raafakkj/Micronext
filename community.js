const COMMUNITY_KEY = "fiap_community_posts";
const PROFILES_KEY = "fiap_kanban_profiles";

const session = getSession();
if (!session) {
  window.location.href = "./index.html";
}

const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout");
const postForm = document.getElementById("community-form");
const postMessage = document.getElementById("community-message");
const feedEl = document.getElementById("community-feed");
const filterType = document.getElementById("filter-type");
const filterSearch = document.getElementById("filter-search");
const MAX_IMAGE_BYTES = 1_200_000;

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

function initials(name) {
  const parts = String(name || "").trim().split(" ").filter(Boolean);
  if (!parts.length) return "RM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const profiles = safeRead(PROFILES_KEY, {});
const currentProfile = profiles[session.rm] || {
  fullName: `Aluno RM ${session.rm}`,
  username: `aluno${session.rm}`,
  role: "Developer",
  avatar: ""
};

userInfo.textContent = `${currentProfile.username} (${currentProfile.role}) - RM ${session.rm}`;

const posts = safeRead(COMMUNITY_KEY, []);
let lastPostsFingerprint = JSON.stringify(posts);

function setPostMessage(text, ok = false) {
  postMessage.style.color = ok ? "#16d47b" : "#ff6f78";
  postMessage.textContent = text;
}

function postMatchesFilter(post) {
  const type = filterType.value;
  const query = filterSearch.value.trim().toLowerCase();

  if (type !== "Todos" && post.type !== type) return false;
  if (!query) return true;

  const bucket = `${post.title} ${post.content} ${post.sprint}`.toLowerCase();
  return bucket.includes(query);
}

function renderAvatar(profile) {
  if (profile.avatar) {
    return `<span class="community-avatar has-image" style="background-image:url('${escapeHtml(profile.avatar)}')"></span>`;
  }
  return `<span class="community-avatar">${escapeHtml(initials(profile.username || profile.fullName))}</span>`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

function persistCommunityRemote() {
  fetch("/api/data/communityPosts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: posts }),
    keepalive: true
  }).catch(() => {
    // cloud-sync retries in background
  });
}

async function readPostImage(form) {
  const file = form.image && form.image.files ? form.image.files[0] : null;
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem valido.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Imagem muito grande. Use ate 1.2MB.");
  }

  return fileToDataUrl(file);
}

function renderFeed() {
  const filtered = posts.filter(postMatchesFilter).sort((a, b) => b.createdAt - a.createdAt);
  feedEl.innerHTML = "";

  if (!filtered.length) {
    feedEl.innerHTML = '<p class="chat-empty">Nenhuma publicacao encontrada.</p>';
    return;
  }

  filtered.forEach((post) => {
    const author = profiles[post.rm] || {
      fullName: post.authorName || `Aluno RM ${post.rm}`,
      username: post.authorUsername || `aluno${post.rm}`,
      role: "Developer",
      avatar: ""
    };

    const postEl = document.createElement("article");
    postEl.className = "community-post";

    const commentsHtml = (post.comments || [])
      .map((comment) => {
        const commentAuthor = profiles[comment.rm] || {
          username: comment.authorUsername || `aluno${comment.rm}`,
          fullName: comment.authorName || `Aluno RM ${comment.rm}`,
          avatar: ""
        };

        return `
          <div class="community-comment">
            ${renderAvatar(commentAuthor)}
            <div>
              <strong>${escapeHtml(commentAuthor.username)}</strong>
              <small>${escapeHtml(formatTime(comment.createdAt))}</small>
              <p>${escapeHtml(comment.text)}</p>
            </div>
          </div>
        `;
      })
      .join("");

    postEl.innerHTML = `
      <header class="community-post-header">
        <div class="community-author">
          ${renderAvatar(author)}
          <div>
            <strong>${escapeHtml(author.username)}</strong>
            <small>${escapeHtml(formatTime(post.createdAt))} • RM ${escapeHtml(post.rm)}</small>
          </div>
        </div>
        <span class="community-tag community-${escapeHtml(post.type.toLowerCase())}">${escapeHtml(post.type)}</span>
      </header>
      <h4>${escapeHtml(post.title)}</h4>
      ${post.sprint ? `<p class="community-sprint">Sprint: ${escapeHtml(post.sprint)}</p>` : ""}
      <p>${escapeHtml(post.content)}</p>
      ${post.imageData ? `<img class="community-post-image" src="${escapeHtml(post.imageData)}" alt="Imagem da publicacao" loading="lazy" />` : ""}

      <div class="community-actions">
        <button type="button" data-action="like" data-id="${post.id}">👍 ${post.likes || 0}</button>
        ${post.rm === session.rm ? `<button type="button" class="ghost-btn" data-action="delete" data-id="${post.id}">Excluir</button>` : ""}
      </div>

      <div class="community-comments">${commentsHtml || '<p class="chat-empty">Sem comentarios.</p>'}</div>
      <form class="community-comment-form" data-id="${post.id}">
        <input name="comment" type="text" maxlength="220" placeholder="Comentar sobre esta publicacao" required />
        <button type="submit">Comentar</button>
      </form>
    `;

    feedEl.appendChild(postEl);
  });

  feedEl.querySelectorAll("button[data-action='like']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const target = posts.find((post) => post.id === id);
      if (!target) return;
      target.likes = (target.likes || 0) + 1;
      save(COMMUNITY_KEY, posts);
      lastPostsFingerprint = JSON.stringify(posts);
      persistCommunityRemote();
      renderFeed();
    });
  });

  feedEl.querySelectorAll("button[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const index = posts.findIndex((post) => post.id === id);
      if (index < 0) return;
      const removedTitle = posts[index].title;
      posts.splice(index, 1);
      save(COMMUNITY_KEY, posts);
      lastPostsFingerprint = JSON.stringify(posts);
      persistCommunityRemote();
      renderFeed();
    });
  });

  feedEl.querySelectorAll(".community-comment-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = form.dataset.id;
      const post = posts.find((p) => p.id === id);
      if (!post) return;

      const value = form.comment.value.trim();
      if (!value) return;

      post.comments = post.comments || [];
      post.comments.push({
        id: uid(),
        rm: session.rm,
        authorName: currentProfile.fullName,
        authorUsername: currentProfile.username,
        text: value,
        createdAt: Date.now()
      });

      if (post.comments.length > 60) {
        post.comments.splice(0, post.comments.length - 60);
      }

      save(COMMUNITY_KEY, posts);
      lastPostsFingerprint = JSON.stringify(posts);
      persistCommunityRemote();
      renderFeed();
    });
  });
}

function refreshPostsFromStorage() {
  const latest = safeRead(COMMUNITY_KEY, []);
  const nextFingerprint = JSON.stringify(latest);
  if (nextFingerprint === lastPostsFingerprint) return;

  posts.splice(0, posts.length, ...latest);
  lastPostsFingerprint = nextFingerprint;
  renderFeed();
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const type = postForm.type.value;
  const title = postForm.title.value.trim();
  const sprint = postForm.sprint.value.trim();
  const content = postForm.content.value.trim();

  if (!title || !content) {
    setPostMessage("Preencha titulo e conteudo para publicar.");
    return;
  }

  let imageData = "";
  try {
    imageData = await readPostImage(postForm);
  } catch (error) {
    setPostMessage(error instanceof Error ? error.message : "Nao foi possivel carregar a imagem.");
    return;
  }

  posts.unshift({
    id: uid(),
    rm: session.rm,
    authorName: currentProfile.fullName,
    authorUsername: currentProfile.username,
    type,
    title,
    sprint,
    content,
    imageData,
    likes: 0,
    comments: [],
    createdAt: Date.now()
  });

  if (posts.length > 250) {
    posts.splice(250);
  }

  save(COMMUNITY_KEY, posts);
  lastPostsFingerprint = JSON.stringify(posts);
  persistCommunityRemote();
  postForm.reset();
  setPostMessage("Publicacao enviada para a comunidade.", true);
  renderFeed();
});

filterType.addEventListener("change", renderFeed);
filterSearch.addEventListener("input", renderFeed);

logoutBtn.addEventListener("click", () => {
  clearSession();
  window.location.href = "./index.html";
});

window.addEventListener("cloud-sync:remote-update", refreshPostsFromStorage);
window.addEventListener("focus", refreshPostsFromStorage);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshPostsFromStorage();
});
setInterval(refreshPostsFromStorage, 2000);

renderFeed();
