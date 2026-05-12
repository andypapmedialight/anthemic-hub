(function () {
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }
  function safeBookUrl(u) {
    u = String(u || '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
    return u.length > 500 ? u.slice(0, 500) : u;
  }
  function renderReadingListHtml(rl) {
    var parts = [];
    if (rl.intro) {
      parts.push('<p class="reading-intro">' + esc(rl.intro) + '</p>');
    }
    var cats = rl.categories;
    if (!Array.isArray(cats)) return parts.join('');
    cats.forEach(function (cat, ci) {
      if (!cat || !cat.label) return;
      var id = 'reading-cat-' + ci;
      parts.push(
        '<section class="reading-category" aria-labelledby="' + id + '">' +
        '<h3 class="reading-category-title" id="' + id + '">' + esc(cat.label) + '</h3>' +
        '<ul class="reading-books">'
      );
      (Array.isArray(cat.books) ? cat.books : []).forEach(function (b) {
        if (!b || !b.title) return;
        var st = b.status === 'reading' ? 'reading' : 'read';
        var stLabel = st === 'reading' ? 'Reading' : 'Read';
        var url = safeBookUrl(b.url);
        var titleHtml = url
          ? '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer">' + esc(b.title) + '</a>'
          : esc(b.title);
        var authorPart = b.author
          ? '<span class="reading-by">' + esc(b.author) + '</span>'
          : '';
        var notePart = b.note ? '<span class="reading-note">' + esc(b.note) + '</span>' : '';
        parts.push(
          '<li class="reading-book">' +
          '<span class="reading-status reading-status--' + st + '">' + stLabel + '</span>' +
          '<span class="reading-line"><span class="reading-title">' + titleHtml + '</span>' +
          authorPart +
          notePart +
          '</span></li>'
        );
      });
      parts.push('</ul></section>');
    });
    return parts.join('');
  }
  fetch('/content/hub.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('no content'); return r.json(); })
    .then(function (c) {
      var hn = document.getElementById('hero-name');
      if (hn && c.hero_name) hn.textContent = c.hero_name;
      var ht = document.getElementById('hero-tagline');
      if (ht && c.hero_tagline) ht.textContent = c.hero_tagline;

      var skillsEl = document.getElementById('employer-skills');
      if (skillsEl && Array.isArray(c.employer_skills) && c.employer_skills.length) {
        skillsEl.innerHTML = c.employer_skills.map(function (s) {
          return '<span class="employer-skill">' + esc(s) + '</span>';
        }).join('');
      }

      var gh = document.getElementById('employer-github');
      if (gh && c.github_url) gh.setAttribute('href', c.github_url);
      var cs = document.getElementById('employer-case');
      if (cs && c.case_study_url) cs.setAttribute('href', c.case_study_url);
      if (cs && c.case_study_label) cs.textContent = c.case_study_label;

      var ships = document.getElementById('profile-ships');
      if (ships && c.ships_line) {
        ships.textContent = c.ships_line;
      }

      var gtag = document.getElementById('photo-gallery-tagline');
      if (gtag && c.gallery_tagline) {
        gtag.textContent = c.gallery_tagline;
      }

      var wai = document.getElementById('who-am-i-body');
      if (wai && c.who_am_i) wai.textContent = c.who_am_i;

      var origin = document.getElementById('bio-origin');
      if (origin && Array.isArray(c.music_bio_origin)) {
        origin.innerHTML = '<h3>How it all began</h3>' +
          c.music_bio_origin.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      }

      var anthems = document.getElementById('bio-anthems');
      if (anthems && Array.isArray(c.music_bio_anthems)) {
        anthems.innerHTML = "<h3>Why ‘Anthems to the Fall’?</h3>" +
          c.music_bio_anthems.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      }

      var instruments = document.getElementById('bio-instruments');
      if (instruments && Array.isArray(c.instruments)) {
        instruments.innerHTML = c.instruments.map(function (inst) {
          var cls = 'chip' + (inst.primary ? ' chip--primary' : '');
          return '<span class="' + cls + '">' + esc(inst.name) + '</span>';
        }).join('');
      }

      var projects = document.getElementById('bio-projects');
      if (projects && Array.isArray(c.projects)) {
        projects.innerHTML = c.projects.map(function (p) {
          var dates = p.dates ? '<span class="proj-dates">' + esc(p.dates) + '</span>' : '';
          return '<span class="project-chip">' + esc(p.name) + dates + '</span>';
        }).join('');
      }

      var readingRoot = document.getElementById('reading-list-root');
      if (readingRoot && c.reading_list && typeof c.reading_list === 'object') {
        readingRoot.innerHTML = renderReadingListHtml(c.reading_list);
      }
    })
    .catch(function () {
      var rr = document.getElementById('reading-list-root');
      if (rr) {
        rr.innerHTML = '<p class="reading-fallback">Could not load the reading list. It is stored in <code>/content/hub.json</code> on the server.</p>';
      }
    });
})();

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
  var y = document.getElementById("y");
  if (y) y.textContent = new Date().getFullYear();

  var interestKey = "anthemic-hub-interest";
  var interestSelect = document.getElementById("hub-interest");
  var interestValues = ["all", "music", "teaching", "creative", "work", "community", "personal"];

  function cardInterestTags(el) {
    return (el.getAttribute("data-interests") || "").trim().split(/\s+/).filter(Boolean);
  }
  function cardMatchesInterest(el, interest) {
    if (!interest || interest === "all") return true;
    return cardInterestTags(el).indexOf(interest) !== -1;
  }
  function assignOriginalOrder() {
    var sections = document.querySelectorAll("main section.grid");
    for (var s = 0; s < sections.length; s++) {
      var cards = sections[s].querySelectorAll(":scope > a.card");
      for (var i = 0; i < cards.length; i++) {
        cards[i].setAttribute("data-orig-order", String(i));
      }
    }
  }
  function assignOriginalSectionOrder() {
    var wrap = document.querySelector("main .wrap");
    if (!wrap) return;
    var blocks = wrap.querySelectorAll(":scope > .hub-section");
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].setAttribute("data-orig-section-order", String(i));
    }
  }
  function sectionMatchCount(block, interest) {
    if (!interest || interest === "all") return 0;
    var n = 0;
    // Section-level data-interests (e.g. bio section with no grid cards)
    var sectionTags = (block.getAttribute("data-interests") || "").trim().split(/\s+/).filter(Boolean);
    if (sectionTags.indexOf(interest) !== -1) n++;
    // Card-level matches within grids
    var cards = block.querySelectorAll("section.grid > .card[data-interests]");
    for (var i = 0; i < cards.length; i++) {
      if (cardMatchesInterest(cards[i], interest)) n++;
    }
    return n;
  }
  function sortGridsByInterest(interest) {
    var sections = document.querySelectorAll("main section.grid");
    for (var s = 0; s < sections.length; s++) {
      var section = sections[s];
      var cards = Array.prototype.slice.call(section.querySelectorAll(":scope > a.card"));
      cards.sort(function (a, b) {
        var ao = parseInt(a.getAttribute("data-orig-order") || "0", 10);
        var bo = parseInt(b.getAttribute("data-orig-order") || "0", 10);
        if (!interest || interest === "all") return ao - bo;
        var aMatch = cardMatchesInterest(a, interest) ? 0 : 1;
        var bMatch = cardMatchesInterest(b, interest) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return ao - bo;
      });
      for (var i = 0; i < cards.length; i++) section.appendChild(cards[i]);
    }
  }
  function sortHubSectionsByInterest(interest) {
    var wrap = document.querySelector("main .wrap");
    if (!wrap) return;
    var blocks = Array.prototype.slice.call(wrap.querySelectorAll(":scope > .hub-section"));
    if (!blocks.length) return;
    blocks.sort(function (a, b) {
      var ao = parseInt(a.getAttribute("data-orig-section-order") || "0", 10);
      var bo = parseInt(b.getAttribute("data-orig-section-order") || "0", 10);
      if (!interest || interest === "all") return ao - bo;
      var ac = sectionMatchCount(a, interest);
      var bc = sectionMatchCount(b, interest);
      var aHit = ac > 0 ? 1 : 0;
      var bHit = bc > 0 ? 1 : 0;
      if (aHit !== bHit) {
        if (aHit && !bHit) return -1;
        if (!aHit && bHit) return 1;
      }
      if (ac !== bc) return bc - ac;
      return ao - bo;
    });
    for (var i = 0; i < blocks.length; i++) wrap.appendChild(blocks[i]);
  }
  function updateSectionNumbers() {
    var wrap = document.querySelector("main .wrap");
    if (!wrap) return;
    var blocks = wrap.querySelectorAll(":scope > .hub-section");
    for (var i = 0; i < blocks.length; i++) {
      var num = blocks[i].querySelector(".sec-num");
      if (num) num.textContent = i + 1 < 10 ? "0" + (i + 1) : String(i + 1);
    }
  }
  function updateInterestFilterVisuals(interest) {
    var main = document.querySelector("main");
    if (!main) return;
    var all = !interest || interest === "all";
    main.classList.toggle("interest-filtering", !all);
    var cards = main.querySelectorAll(".card[data-interests], article.card[data-interests]");
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i];
      var match = cardMatchesInterest(el, interest);
      el.classList.toggle("is-interest-match", all || match);
      el.classList.toggle("is-interest-dim", !all && !match);
    }
    var status = document.getElementById("interest-status");
    if (status && interestSelect) {
      if (all) {
        status.textContent = "";
      } else {
        var opt = interestSelect.querySelector("option[value=\"" + interest + "\"]");
        status.textContent = opt ? "Showing: " + opt.textContent : "";
      }
    }
  }
  function setInterest(interest) {
    if (interestValues.indexOf(interest) === -1) interest = "all";
    if (interestSelect) interestSelect.value = interest;
    sortGridsByInterest(interest);
    sortHubSectionsByInterest(interest);
    updateSectionNumbers();
    updateInterestFilterVisuals(interest);
    try { localStorage.setItem(interestKey, interest); } catch (e) {}
  }
  assignOriginalOrder();
  assignOriginalSectionOrder();
  if (interestSelect) {
    var saved = null;
    try { saved = localStorage.getItem(interestKey); } catch (e) {}
    if (saved && interestValues.indexOf(saved) !== -1) interestSelect.value = saved;
    setInterest(interestSelect.value);
    interestSelect.addEventListener("change", function () {
      setInterest(interestSelect.value);
    });
  }
})();

(function () {
  var wrap = document.getElementById("photo-gallery-wrap");
  var ul   = document.getElementById("photo-gallery");
  if (!wrap || !ul) return;
  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function checkVisible() {
    var items = ul.querySelectorAll("li");
    var visible = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].style.display !== "none" && !items[i].hasAttribute("hidden")) visible++;
    }
    if (visible === 0) wrap.setAttribute("hidden", "");
    else wrap.removeAttribute("hidden");
  }
  function attachErrors() {
    ul.querySelectorAll("img[data-gallery-img]").forEach(function (img) {
      img.addEventListener("error", function () {
        var li = img.closest("li");
        if (li) li.style.display = "none";
        checkVisible();
      });
      if (img.complete && img.naturalWidth === 0) {
        var li2 = img.closest("li");
        if (li2) li2.style.display = "none";
      }
    });
    checkVisible();
  }
  fetch("/assets/gallery/manifest.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      if (!Array.isArray(data.images) || !data.images.length) throw new Error();
      ul.innerHTML = data.images.map(function (f) {
        var src = "/assets/gallery/" + encodeURIComponent(f);
        var alt = f.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
        return "<li><a href=\"" + src + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          "<img src=\"" + src + "\" alt=\"" + escAttr(alt) + "\" width=\"640\" height=\"640\" loading=\"lazy\" decoding=\"async\" data-gallery-img /></a></li>";
      }).join("");
      attachErrors();
    })
    .catch(attachErrors);
})();
