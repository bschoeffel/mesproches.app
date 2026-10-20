// Thème du site (20/10/2026) : Auto (suit l'appareil), Clair ou Sombre, retenu sur cet appareil.
(function () {
  var KEY = "mp-theme";
  function lire() { try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; } }
  function appliquer(choix) {
    var root = document.documentElement;
    if (choix === "light" || choix === "dark") root.setAttribute("data-theme", choix); else root.removeAttribute("data-theme");
    // Les captures de l'app suivent le thème choisi
    document.querySelectorAll("picture source[data-sombre]").forEach(function (s) {
      s.media = choix === "dark" ? "all" : choix === "light" ? "not all" : "(prefers-color-scheme: dark)";
    });
    document.querySelectorAll(".theme button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.choix === choix));
    });
  }
  appliquer(lire());
  document.addEventListener("DOMContentLoaded", function () {
    appliquer(lire());
    document.querySelectorAll(".theme button").forEach(function (b) {
      b.addEventListener("click", function () {
        try { localStorage.setItem(KEY, b.dataset.choix); } catch (e) {}
        appliquer(b.dataset.choix);
      });
    });
  });
})();
