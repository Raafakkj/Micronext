(function () {
  const appShell = document.querySelector(".app-shell");
  if (!appShell) return;

  const peekButtons = document.querySelectorAll("[data-menu-peek]");
  if (!peekButtons.length) return;

  const sideMenu = document.querySelector(".side-menu");
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  peekButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (isMobile()) {
        appShell.classList.toggle("menu-peek");
        return;
      }

      appShell.classList.toggle("menu-collapsed");
    });
  });

  document.addEventListener("click", (event) => {
    if (!isMobile() || !appShell.classList.contains("menu-peek")) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const clickedToggle = target.closest("[data-menu-peek]");
    const clickedMenu = sideMenu && sideMenu.contains(target);
    if (!clickedToggle && !clickedMenu) {
      appShell.classList.remove("menu-peek");
    }
  });

  window.addEventListener("resize", () => {
    appShell.classList.remove("menu-peek");
  });

  document.addEventListener("keyup", (event) => {
    if (event.key !== "Escape") return;
    appShell.classList.remove("menu-peek");
    appShell.classList.remove("menu-collapsed");
  });
})();
