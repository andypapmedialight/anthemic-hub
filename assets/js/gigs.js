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
      "<article class=\"" + cls + "\" id=\"gig-" + esc(g.date) + "\" data-gig-date=\"" + esc(g.date) + "\">" +
        poster +
        "<div class=\"row-top\">" + badge + "<span class=\"gig-date\">" + esc(formatWhen(ymd, g.time)) + "</span>" + entryTag + "</div>" +
        "<h3 class=\"gig-title\">" + esc(g.title) + "</h3>" +
        desc + meta + link +
      "</article>"
    );
  }

  var SITE_ORIGIN = "https://anthemic-developments.com";
  var GIG_DEFAULT_IMAGE = SITE_ORIGIN + "/assets/cinnamon.jpg";
  var GIG_PERFORMER = {
    "@type": "Person",
    "@id": SITE_ORIGIN + "/#person",
    "name": "Andy Papadopoulos",
    "url": SITE_ORIGIN + "/bass/"
  };
  var GIG_ORGANIZER = {
    "@type": "Organization",
    "@id": SITE_ORIGIN + "/#organization",
    "name": "Anthemic Developments",
    "url": SITE_ORIGIN + "/"
  };

  function parseClockOnDate(date, clockStr) {
    if (!clockStr || !String(clockStr).trim()) return null;
    var m = String(clockStr).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var min = m[2] ? parseInt(m[2], 10) : 0;
    if (/pm/i.test(m[3]) && h < 12) h += 12;
    if (/am/i.test(m[3]) && h === 12) h = 0;
    return date + "T" + String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0") + ":00+10:00";
  }

  function gigStartDateTime(date, timeStr) {
    if (!timeStr || !String(timeStr).trim()) return date;
    var chunk = String(timeStr).trim().split(/\s*[–-]\s*/)[0];
    return parseClockOnDate(date, chunk) || date;
  }

  function gigEndDateTime(date, timeStr, startIso) {
    if (timeStr && String(timeStr).trim()) {
      var parts = String(timeStr).trim().split(/\s*[–-]\s*/);
      if (parts.length > 1) {
        var endIso = parseClockOnDate(date, parts[parts.length - 1]);
        if (endIso) return endIso;
      }
    }
    if (startIso && startIso.indexOf("T") !== -1) {
      var startMatch = startIso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}([+-]\d{2}:\d{2})$/);
      if (startMatch) {
        var endHour = parseInt(startMatch[2], 10) + 3;
        return startMatch[1] + "T" + String(endHour).padStart(2, "0") + ":" + startMatch[3] + ":00" + startMatch[4];
      }
    }
    return date + "T23:59:59+10:00";
  }

  function gigEventUrl(g) {
    if (g.link && String(g.link).trim()) return String(g.link).trim();
    return SITE_ORIGIN + "/gigs/#gig-" + g.date;
  }

  function gigEventImage(g) {
    if (g.poster && String(g.poster).trim()) {
      return SITE_ORIGIN + "/assets/gig-posters/" + encodeURIComponent(g.poster);
    }
    return GIG_DEFAULT_IMAGE;
  }

  function buildEventOffers(g, eventUrl) {
    var offerUrl = (g.tickets_link && String(g.tickets_link).trim())
      || (g.link && String(g.link).trim())
      || eventUrl;
    var offer = {
      "@type": "Offer",
      "url": offerUrl,
      "availability": "https://schema.org/InStock",
      "priceCurrency": "AUD",
      "validFrom": g.date + "T00:00:00+10:00"
    };
    if (g.free) {
      offer.price = "0";
    } else if (g.price && String(g.price).trim()) {
      var priceMatch = String(g.price).trim().match(/(\d+(?:\.\d{1,2})?)/);
      if (priceMatch) offer.price = priceMatch[1];
    }
    return offer;
  }

  function buildEventSchema(g) {
    var startDate = gigStartDateTime(g.date, g.time);
    var eventUrl = gigEventUrl(g);
    var schema = {
      "@type": "Event",
      "name": g.title,
      "startDate": startDate,
      "endDate": gigEndDateTime(g.date, g.time, startDate),
      "url": eventUrl,
      "image": gigEventImage(g),
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "organizer": GIG_ORGANIZER,
      "performer": GIG_PERFORMER,
      "offers": buildEventOffers(g, eventUrl)
    };
    var venue = g.venue && String(g.venue).trim();
    var city = g.city && String(g.city).trim();
    if (venue || city) {
      schema.location = { "@type": "Place", "name": venue || city };
      if (city) {
        schema.location.address = {
          "@type": "PostalAddress",
          "addressLocality": city,
          "addressRegion": "VIC",
          "addressCountry": "AU"
        };
        if (venue) schema.location.address.streetAddress = venue;
      }
    }
    var descParts = [];
    if (g.description && String(g.description).trim()) descParts.push(String(g.description).trim());
    if (g.time && String(g.time).trim()) descParts.push("Time: " + String(g.time).trim());
    if (g.role && String(g.role).trim()) descParts.push("Role: " + String(g.role).trim());
    if (g.support && String(g.support).trim()) descParts.push("Support: " + String(g.support).trim());
    if (descParts.length) schema.description = descParts.join(". ");
    return schema;
  }

  function injectEventSchemas(upcoming, past) {
    var events = upcoming.map(buildEventSchema);
    if (past && past.length) {
      past.slice(0, 12).forEach(function (g) {
        events.push(buildEventSchema(g));
      });
    }
    var graph = [
      {
        "@type": "WebPage",
        "@id": SITE_ORIGIN + "/gigs/#webpage",
        "url": SITE_ORIGIN + "/gigs/",
        "name": "Gig calendar - Anthemic Developments",
        "description": "Upcoming and past live bass gigs.",
        "inLanguage": "en-AU",
        "isPartOf": { "@id": SITE_ORIGIN + "/#website" }
      }
    ].concat(events);
    var payload = { "@context": "https://schema.org", "@graph": graph };
    var el = document.getElementById("ld-gig-events");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "ld-gig-events";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(payload);
  }

  var upcomingEl = document.getElementById("gigs-upcoming");
  var pastEl = document.getElementById("gigs-past");
  var pastSection = document.getElementById("gigs-past-section");
  var errEl = document.getElementById("load-err");

  fetch("gigs.json")
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
      injectEventSchemas(upcoming, past);

      upcomingEl.innerHTML = upcoming.length
        ? upcoming.map(function (g) { return buildCard(g, true); }).join("")
        : "<p class=\"empty\">No upcoming gigs.</p>";
      if (past.length) {
        pastEl.innerHTML = past.map(function (g) { return buildCard(g, false); }).join("");
        if (pastSection) pastSection.hidden = false;
      } else {
        pastEl.innerHTML = "";
        if (pastSection) pastSection.hidden = true;
      }

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
