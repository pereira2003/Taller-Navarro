document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("body > nav.fixed.bottom-6");
  if (!nav) return;

  const firstLink = nav.querySelector("a");
  if (!firstLink) return;

  const openMenu = () => nav.classList.add("mobile-nav-open");
  const closeMenu = () => nav.classList.remove("mobile-nav-open");

  firstLink.addEventListener("click", (event) => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (nav.classList.contains("mobile-nav-open")) return;
    event.preventDefault();
    openMenu();
  });

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("mobile-nav-open")) return;
    if (nav.contains(event.target)) return;
    closeMenu();
  });

  window.addEventListener("scroll", closeMenu, { passive: true });
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 768px)").matches) closeMenu();
  });
});
