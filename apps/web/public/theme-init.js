// Applies the stored theme before first paint so the page never flashes the wrong palette.
// Loaded as a same-origin file because the CSP forbids inline scripts.
(function () {
  var preference = "system";
  try {
    var stored = window.localStorage.getItem("spicytrack-theme");
    if (stored === "light" || stored === "dark") {
      preference = stored;
    }
  } catch {
    // Storage can be blocked; fall back to the system preference.
  }
  var dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
