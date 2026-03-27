const session = getSession();
if (!session) {
  window.location.href = "./index.html";
}

const form = document.getElementById("register-form");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.style.color = "#ff6f78";

  const rm = sanitizeRm(form.rm.value.trim());
  const password = form.password.value.trim();

  if (rm.length < 5 || rm.length > 7) {
    message.textContent = "RM invalido. Use entre 5 e 7 digitos.";
    return;
  }

  if (password.length < 6) {
    message.textContent = "Senha muito curta. Use no minimo 6 caracteres.";
    return;
  }

  const users = getRegisteredUsers();
  const exists = users.some((user) => user.rm === rm);

  if (exists) {
    message.textContent = "Esse RM ja esta cadastrado.";
    return;
  }

  const user = { rm };
  await setUserPassword(user, password);
  users.push(user);
  saveRegisteredUsers(users);

  form.reset();
  message.style.color = "#16d47b";
  message.textContent = "Novo usuario cadastrado com sucesso.";
});
