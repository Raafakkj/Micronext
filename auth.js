const form = document.getElementById("login-form");
const message = document.getElementById("message");

if (getSession()) {
  window.location.href = "./kanban.html";
}

getRegisteredUsers();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rm = sanitizeRm(form.rm.value.trim());
  const password = form.password.value;

  if (rm.length < 5 || rm.length > 7) {
    message.textContent = "Informe um RM FIAP valido (5 a 7 digitos).";
    return;
  }

  const users = getRegisteredUsers();
  const found = users.find((user) => user.rm === rm);

  if (!found) {
    message.textContent = "RM nao cadastrado. Procure um usuario autorizado.";
    return;
  }

  const ok = await verifyUserPassword(found, password);
  if (!ok) {
    message.textContent = "Senha incorreta.";
    return;
  }

  const upgraded = await upgradeUserPasswordIfNeeded(found, password);
  if (upgraded) {
    saveRegisteredUsers(users);
  }

  setSession(found.rm);
  window.location.href = "./kanban.html";
});
