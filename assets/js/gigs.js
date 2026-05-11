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
  var MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
  var DOW = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  var calYear = new Date().getFullYear();
  var calMonth = new Date().getMonth();
  var calGigDates = {}; // "YYYY-MM-DD" -> ["Title", ...]

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

  function renderCalendar() {
    var calEl = document.getElementById("gig-calendar");
    if (!calEl) return;

    var todayStr = todayYmd();
    var firstDay = new Date(calYear, calMonth, 1);
    var startDow = (firstDay.getDay() + 6) % 7; // Mon = 0
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    var html = "<div class=\"cal-header\">"
      + "<button class=\"cal-nav\" id=\"cal-prev\" aria-label=\"Previous month\">&#8592;</button>"
      + "<span class=\"cal-title\">" + MONTH_NAMES[calMonth] + " " + calYear + "</span>"
      + "<button class=\"cal-nav\" id=\"cal-next\" aria-label=\"Next month\">&#8594;</button>"
      + "</div>"
      + "<div class=\"cal-grid\" role=\"grid\" aria-label=\"" + MONTH_NAMES[calMonth] + " " + calYear + "\">";

    for (var h = 0; h < 7; h++) {
      html += "<div class=\"cal-dow\" role=\"columnheader\">" + DOW[h] + "</div>";
    }
    for (var e = 0; e < startDow; e++) {
      html += "<div class=\"cal-day\" aria-hidden=\"true\"></div>";
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var mm = String(calMonth + 1).padStart(2, "0");
      var dd = String(d).padStart(2, "0");
      var dateStr = calYear + "-" + mm + "-" + dd;
      var cls = "cal-day";
      var extra = "";
      if (dateStr === todayStr) cls += " cal-day--today";
      if (calGigDates[dateStr]) {
        cls += " cal-day--has-gig";
        var label = d + ", " + esc(calGigDates[dateStr].join(", "));
        extra = " role=\"button\" tabindex=\"0\" data-cal-date=\"" + esc(dateStr)
              + "\" aria-label=\"" + label + "\"";
      }
      html += "<div class=\"" + cls + "\"" + extra + ">" + d + "</div>";
    }
    html += "</div>";

    calEl.innerHTML = html;
    calEl.removeAttribute("hidden");

    document.getElementById("cal-prev").addEventListener("click", function () {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
    document.getElementById("cal-next").addEventListener("click", function () {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });

    calEl.querySelectorAll("[data-cal-date]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = document.querySelector("[data-gig-date=\"" + btn.getAttribute("data-cal-date") + "\"]");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
      });
    });
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
    var actionDefs = [
      [g.link,         "Event details"],
      [g.tickets_link, "Tickets"],
      [g.maps_link,    "Map"],
      [g.venue_link,   "Venue"],
    ];
    var actionItems = actionDefs.filter(function (l) { return l[0] && String(l[0]).trim(); });
    var link = actionItems.length
      ? "<div class=\"gig-actions\">" + actionItems.map(function (l) {
          return "<a href=\"" + esc(l[0]) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + esc(l[1]) + " →</a>";
        }).join("") + "</div>"
      : "";
    var badge = upcoming ? "<span class=\"badge upcoming\">Upcoming</span>" : "<span class=\"badge past\">Past</span>";
    var entryTag = g.free
      ? "<span class=\"badge free\">Free</span>"
      : (g.price && String(g.price).trim() ? "<span class=\"gig-price\">" + esc(g.price) + "</span>" : "");
    var poster = (g.poster && String(g.poster).trim())
      ? "<img class=\"gig-poster\" src=\"/assets/gig-posters/" + esc(encodeURIComponent(g.poster))
          + "\" alt=\"" + esc(g.title) + " poster\" loading=\"lazy\" decoding=\"async\" />"
      : "";
    var cls = "gig-card" + (upcoming ? " gig-card--upcoming" : "") + (poster ? " gig-card--has-poster" : "");
    var desc = (g.description && String(g.description).trim())
      ? "<p class=\"gig-desc\">" + esc(g.description) + "</p>"
      : "";
    return (
      "<article class=\"" + cls + "\" data-gig-date=\"" + esc(g.date) + "\">" +
        poster +
        "<div class=\"row-top\">" + badge + "<span class=\"gig-date\">" + esc(formatWhen(ymd, g.time)) + "</span>" + entryTag + "</div>" +
        "<h3 class=\"gig-title\">" + esc(g.title) + "</h3>" +
        desc + meta + link +
      "</article>"
    );
  }

  function injectEventSchemas(gigs) {
    var schemas = gigs.map(function (g) {
      var schema = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": g.title,
        "startDate": g.date,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode"
      };
      if (g.venue || g.city) {
        schema.location = { "@type": "Place", "name": g.venue || g.city };
        if (g.venue && g.city) schema.location.address = g.city;
      }
      if (g.description && String(g.description).trim()) schema.description = g.description;
      if (g.link && String(g.link).trim()) schema.url = g.link;
      if (g.tickets_link && String(g.tickets_link).trim()) {
        schema.offers = { "@type": "Offer", "url": g.tickets_link, "availability": "https://schema.org/InStock" };
        if (g.free) { schema.offers.price = "0"; schema.offers.priceCurrency = "AUD"; }
      } else if (g.free) {
        schema.offers = { "@type": "Offer", "price": "0", "priceCurrency": "AUD", "availability": "https://schema.org/InStock" };
      }
      return schema;
    });
    var el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(schemas);
    document.head.appendChild(el);
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
        if (!calGigDates[g.date]) calGigDates[g.date] = [];
        calGigDates[g.date].push(g.title);
        if (g.date >= today) upcoming.push(g);
        else past.push(g);
      }

      upcoming.sort(function (a, b) { return compareYmd(parseYmd(a.date), parseYmd(b.date)); });
      past.sort(function (a, b) { return compareYmd(parseYmd(b.date), parseYmd(a.date)); });
      if (upcoming.length) injectEventSchemas(upcoming);

      upcomingEl.innerHTML = upcoming.length
        ? upcoming.map(function (g) { return buildCard(g, true); }).join("")
        : "<p class=\"empty\">No upcoming gigs.</p>";
      pastEl.innerHTML = past.length
        ? past.map(function (g) { return buildCard(g, false); }).join("")
        : "<p class=\"empty\">No past gigs yet.</p>";

      // Jump to the month of the first upcoming gig if it exists
      if (upcoming.length > 0) {
        var first = parseYmd(upcoming[0].date);
        if (first) { calYear = first.y; calMonth = first.m - 1; }
      }

      renderCalendar();
    })
    .catch(function () {
      errEl.hidden = false;
      errEl.textContent = "Could not load the gig list.";
      upcomingEl.innerHTML = "";
      pastEl.innerHTML = "";
    });
})();
