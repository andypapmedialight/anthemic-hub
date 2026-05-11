(function () {
  var key = "anthemic-hub-theme";
  var root = document.documentElement;
  function syncThemeButtons() {
    var t = root.getAttribute("data-theme") || "dark";
    var d = document.getElementById("theme-dark");
    var l = document.getElementById("theme-light");
    if (d) d.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
    if (l) l.setAttribute("aria-pressed", t === "light" ? "true" : "false");
  }
  function setTheme(theme) {
    if (theme !== "light" && theme !== "dark") return;
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(key, theme); } catch (e) {}
    syncThemeButtons();
  }
  document.getElementById("theme-dark").addEventListener("click", function () { setTheme("dark"); });
  document.getElementById("theme-light").addEventListener("click", function () { setTheme("light"); });
  syncThemeButtons();
})();

(function () {
  function todayYmd() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function parseYmd(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split("-");
    return { y: +p[0], m: +p[1], d: +p[2], raw: s };
  }

  function compareYmd(a, b) {
    if (a.raw < b.raw) return -1;
    if (a.raw > b.raw) return 1;
    return 0;
  }

  function formatWhen(ymd, timeStr) {
    var d = new Date(ymd.y, ymd.m - 1, ymd.d);
    var opts = { weekday: "short", day: "numeric", month: "long", year: "numeric" };
    var s = d.toLocaleDateString("en-AU", opts);
    if (timeStr && String(timeStr).trim()) s += " · " + String(timeStr).trim();
    return s;
  }

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildCard(g, upcoming) {
    var ymd = parseYmd(g.date);
    if (!ymd) return null;
    var where = [g.venue, g.city].filter(Boolean).join(", ");
    var supportLine = g.support ? "<strong>Support</strong> · " + esc(g.support) : "";
    var roleLine = g.role ? "<strong>Role</strong> · " + esc(g.role) : "";
    var metaParts = [];
    if (where) metaParts.push("<strong>Where</strong> · " + esc(where));
    if (supportLine) metaParts.push(supportLine);
    if (roleLine) metaParts.push(roleLine);
    var meta = metaParts.length ? "<p class=\"gig-meta\">" + metaParts.join("<br />") + "</p>" : "";
    var link = (g.link && String(g.link).trim())
      ? "<div class=\"gig-actions\"><a href=\"" + esc(g.link) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Event details →</a></div>"
      : "";
    var badge = upcoming ? "<span class=\"badge upcoming\">Upcoming</span>" : "<span class=\"badge past\">Past</span>";
    var cls = "gig-card" + (upcoming ? " gig-card--upcoming" : "");
    return (
      "<article class=\"" + cls + "\">" +
        "<div class=\"row-top\">" + badge + "<span class=\"gig-date\">" + esc(formatWhen(ymd, g.time)) + "</span></div>" +
        "<h3 class=\"gig-title\">" + esc(g.title) + "</h3>" +
        meta +
        link +
      "</article>"
    );
  }

  var upcomingEl = document.getElementById("gigs-upcoming");
  var pastEl = document.getElementById("gigs-past");
  var errEl = document.getElementById("load-err");

  fetch("gigs.json", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var list = data && Array.isArray(data.gigs) ? data.gigs : [];
      var today = todayYmd();
      var upcoming = [];
      var past = [];
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        if (!g || typeof g !== "object") continue;
        if (!g.date || !g.title) continue;
        var ymd = parseYmd(g.date);
        if (!ymd) continue;
        if (g.date >= today) upcoming.push(g);
        else past.push(g);
      }
      upcoming.sort(function (a, b) { return compareYmd(parseYmd(a.date), parseYmd(b.date)); });
      past.sort(function (a, b) { return compareYmd(parseYmd(b.date), parseYmd(a.date)); });

      upcomingEl.innerHTML = upcoming.length
        ? upcoming.map(function (g) { return buildCard(g, true); }).join("")
        : "<p class=\"empty\">No upcoming gigs.</p>";
      pastEl.innerHTML = past.length
        ? past.map(function (g) { return buildCard(g, false); }).join("")
        : "<p class=\"empty\">No past gigs yet.</p>";
    })
    .catch(function () {
      errEl.hidden = false;
      errEl.textContent = "Could not load the gig list.";
      upcomingEl.innerHTML = "";
      pastEl.innerHTML = "";
    });
})();
