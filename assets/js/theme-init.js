(function () {
  var key = "anthemic-hub-theme";
  var r = document.documentElement;
  var v;
  try { v = localStorage.getItem(key); } catch (e) { v = null; }
  if (v === "light" || v === "dark") r.setAttribute("data-theme", v);
  else r.setAttribute("data-theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
