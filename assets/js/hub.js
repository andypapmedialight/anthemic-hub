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
      var bookArr = Array.isArray(cat.books) ? cat.books : [];
      var n = 0;
      for (var bi = 0; bi < bookArr.length; bi++) {
        if (bookArr[bi] && bookArr[bi].title) n++;
      }
      var countLabel = n === 1 ? '1 title' : String(n) + ' titles';
      parts.push(
        '<details class="reading-category reading-category-details">' +
        '<summary class="reading-category-summary">' +
        '<span class="reading-category-summary-row">' +
        '<span class="reading-category-title" id="' + id + '">' + esc(cat.label) + '</span>' +
        '<span class="reading-category-count">' + esc(countLabel) + '</span>' +
        '</span>' +
        '</summary>' +
        '<ul class="reading-books" aria-labelledby="' + id + '">'
      );
      bookArr.forEach(function (b) {
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
      parts.push('</ul></details>');
    });
    return parts.join('');
  }
  /** Same shape check as deploy merge (object with categories array). */
  function readingListValid(rl) {
    return rl && typeof rl === 'object' && !Array.isArray(rl) && Array.isArray(rl.categories);
  }
  /** Always clear the loading skeleton once hub.json has been fetched (even if reading_list is absent). */
  function applyReadingListFromHub(c) {
    var readingRoot = document.getElementById('reading-list-root');
    if (!readingRoot) return;
    var rl = c && c.reading_list;
    if (readingListValid(rl)) {
      var html = renderReadingListHtml(rl);
      readingRoot.innerHTML =
        html ||
        '<p class="reading-fallback">Nothing listed yet. Add categories and books under <code>reading_list</code> in <code>/content/hub.json</code> or in admin → Site content.</p>';
      return;
    }
    readingRoot.innerHTML =
      '<p class="reading-fallback">No usable <code>reading_list</code> in <code>hub.json</code> and the bundled seed did not load. Add it under Admin → Site content, or redeploy so the apply script can merge from git.</p>';
  }

  function normaliseBandName(s) {
    s = String(s || '').trim();
    return s.length > 120 ? s.slice(0, 120) : s;
  }
  function favouriteBandsDefaultsFromHub(c) {
    if (c && Array.isArray(c.favourite_bands)) {
      return c.favourite_bands.map(normaliseBandName).filter(Boolean);
    }
    return [];
  }
  function renderSwarmCaseStudy(c) {
    var root = document.getElementById('swarm-case-study-root');
    var sc = c && c.swarm_case_study;
    if (!root || !sc || typeof sc !== 'object') return;
    var bullets = Array.isArray(sc.bullets) ? sc.bullets : [];
    var bulletHtml = bullets.map(function (b) {
      return '<li>' + esc(b) + '</li>';
    }).join('');
    var url = sc.url || c.case_study_url || 'https://report.safermurrayroad.com';
    var host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    root.innerHTML =
      '<span class="badge external">Case study · Live &nearr;</span>' +
      '<h3 class="case-study-title" id="swarm-case-study-title">' + esc(sc.title || 'Safer Murray Road — SWARM Reporter') + '</h3>' +
      '<p class="case-study-meta">' + esc(sc.role_line || 'Lead Developer — SWARM · Volunteer') +
      (sc.dates ? ' · ' + esc(sc.dates) : '') + '</p>' +
      (sc.organisation ? '<p class="case-study-org">' + esc(sc.organisation) + '</p>' : '') +
      (sc.stack ? '<p class="card-stack">' + esc(sc.stack) + '</p>' : '') +
      (bulletHtml ? '<ul class="case-study-bullets">' + bulletHtml + '</ul>' : '') +
      '<a class="case-study-cta" href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer">' + esc(host) + '</a>';
  }

  function renderEmployerSkills(c) {
    var primary = c && Array.isArray(c.employer_skills) ? c.employer_skills : [];
    var more = c && Array.isArray(c.employer_skills_more) ? c.employer_skills_more : [];
    var allSkills = primary.concat(more);
    if (!allSkills.length) return;
    var skillChip = function (s) {
      return '<span class="employer-skill">' + esc(s) + '</span>';
    };
    var previewEl = document.getElementById('employer-skills-preview');
    var skillsRoot = document.getElementById('employer-skills-root');
    var skillsCount = document.getElementById('employer-skills-count');
    var previewSkills = primary.slice(0, 2);
    if (previewEl && previewSkills.length) {
      previewEl.innerHTML = previewSkills.map(skillChip).join('');
    }
    if (skillsRoot) {
      skillsRoot.innerHTML =
        '<div class="employer-skills">' + allSkills.map(skillChip).join('') + '</div>';
    }
    if (skillsCount) {
      skillsCount.textContent = '(' + String(allSkills.length) + ')';
    }
  }

  function setupFavouriteBands(c) {
    var ul = document.getElementById('favourite-bands-list');
    if (!ul) return;
    var bands = favouriteBandsDefaultsFromHub(c);
    ul.innerHTML = '';
    if (!bands.length) {
      var empty = document.createElement('li');
      empty.className = 'favourite-bands-empty';
      empty.textContent =
        'No bands listed yet. Add a favourite_bands array in hub.json or edit Site content in admin.';
      ul.appendChild(empty);
      return;
    }
    for (var i = 0; i < bands.length; i++) {
      var li = document.createElement('li');
      li.className = 'favourite-bands-item';
      li.textContent = bands[i];
      ul.appendChild(li);
    }
  }

  fetch('/content/hub.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('no content'); return r.json(); })
    .then(function (c) {
      if (readingListValid(c.reading_list)) {
        return Promise.resolve(c);
      }
      return fetch('/content/reading-list.seed.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (seed) {
          if (seed && readingListValid(seed.reading_list)) {
            c.reading_list = seed.reading_list;
          }
          return c;
        })
        .catch(function () { return c; });
    })
    .then(function (c) {
      try {
        var hn = document.getElementById('hero-name');
        if (hn && c.hero_name) hn.textContent = c.hero_name;
        var ht = document.getElementById('hero-tagline');
        if (ht && c.hero_tagline) ht.textContent = c.hero_tagline;

        renderEmployerSkills(c);

        // Gilbert & Sullivan skills quote (paused)
        // var skillsQuote = document.getElementById('employer-skills-quote');
        // if (skillsQuote && c.skills_quote) {
        //   var attrib = c.skills_quote_attrib
        //     ? '<span class="employer-skills-quote-note">' + esc(c.skills_quote_attrib) + '</span>'
        //     : '';
        //   skillsQuote.innerHTML = '<q>' + esc(c.skills_quote) + '</q>' + attrib;
        // }

        var gh = document.getElementById('employer-github');
        if (gh && c.github_url) gh.setAttribute('href', c.github_url);
        var ig = document.getElementById('employer-instagram');
        var profileIg = document.getElementById('profile-instagram');
        if (c.instagram_url) {
          if (ig) ig.setAttribute('href', c.instagram_url);
          if (profileIg) profileIg.setAttribute('href', c.instagram_url);
        }
        var cs = document.getElementById('employer-case');
        if (cs && c.case_study_url) cs.setAttribute('href', c.case_study_url);
        if (cs && c.case_study_label) cs.textContent = c.case_study_label;

        renderSwarmCaseStudy(c);

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
      } finally {
        applyReadingListFromHub(c);
        setupFavouriteBands(c);
      }
    })
    .catch(function () {
      var rr = document.getElementById('reading-list-root');
      if (rr) {
        rr.innerHTML = '<p class="reading-fallback">Could not load the reading list. It is stored in <code>/content/hub.json</code> on the server.</p>';
      }
      setupFavouriteBands(null);
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
  var interestValues = ["all", "music", "teaching", "creative", "work", "community", "personal"];

  function syncInterestChips(interest) {
    var chips = document.querySelectorAll(".interest-chip[data-interest]");
    for (var i = 0; i < chips.length; i++) {
      var v = chips[i].getAttribute("data-interest");
      chips[i].setAttribute("aria-pressed", v === interest ? "true" : "false");
    }
  }

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
  /** When an interest is active, these hub-section ids sort first (in order) among sections that still match. */
  var interestPrimaryHubOrder = {
    music: ["music", "music-bio", "projects", "reading-list", "work"],
    teaching: ["music", "reading-list", "projects", "music-bio", "work"],
    creative: ["projects", "music", "reading-list", "music-bio", "work"],
    work: ["work", "reading-list", "projects", "music", "music-bio"],
    community: ["projects", "music", "reading-list", "music-bio", "work"],
    personal: ["reading-list", "music-bio", "projects", "music", "work"]
  };
  function primarySectionRank(block, interest) {
    if (!interest || interest === "all") return 0;
    var order = interestPrimaryHubOrder[interest];
    if (!order || !order.length) return 999;
    var id = block.getAttribute("data-hub-section") || "";
    var ix = order.indexOf(id);
    return ix === -1 ? 999 : ix;
  }
  function sectionMatchCount(block, interest) {
    if (!interest || interest === "all") return 0;
    var n = 0;
    // Section-level data-interests (e.g. bio section with no grid cards)
    var sectionTags = (block.getAttribute("data-interests") || "").trim().split(/\s+/).filter(Boolean);
    if (sectionTags.indexOf(interest) !== -1) n++;
    // Card-level matches within grids
    var cards = block.querySelectorAll(":scope .card[data-interests]");
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
      var apr = primarySectionRank(a, interest);
      var bpr = primarySectionRank(b, interest);
      if (apr !== bpr) return apr - bpr;
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
    if (status) {
      if (all) {
        status.textContent = "";
      } else {
        var chip = main.querySelector('.interest-chip[data-interest="' + interest + '"]');
        status.textContent = chip ? "Showing: " + chip.textContent.replace(/\s+/g, " ").trim() : "";
      }
    }
  }
  function setInterest(interest) {
    if (interestValues.indexOf(interest) === -1) interest = "all";
    syncInterestChips(interest);
    sortGridsByInterest(interest);
    sortHubSectionsByInterest(interest);
    updateSectionNumbers();
    updateInterestFilterVisuals(interest);
    try { localStorage.setItem(interestKey, interest); } catch (e) {}
  }
  assignOriginalOrder();
  assignOriginalSectionOrder();
  var interestChips = document.querySelectorAll(".interest-chip[data-interest]");
  if (interestChips.length) {
    var saved = null;
    try { saved = localStorage.getItem(interestKey); } catch (e) {}
    var initial = saved && interestValues.indexOf(saved) !== -1 ? saved : "all";
    setInterest(initial);
    for (var ic = 0; ic < interestChips.length; ic++) {
      interestChips[ic].addEventListener("click", function () {
        var v = this.getAttribute("data-interest");
        if (v) setInterest(v);
      });
    }
  }
})();

(function () {
  var wrap = document.getElementById("photo-gallery-wrap");
  var ul   = document.getElementById("photo-gallery");
  if (!wrap || !ul) return;

  var AUTOPLAY_MS = 5200;
  var lightbox = null;
  var lbImg = null;
  var lbCounter = null;
  var lbFull = null;
  var lbPlay = null;
  var lbClose = null;
  var currentIndex = 0;
  var autoplayTimer = null;
  var autoplayOn = true;
  var lastFocus = null;

  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveGalleryUrl(u) {
    try {
      return new URL(u, window.location.href).href;
    } catch (e) {
      return String(u || "");
    }
  }

  function galleryItemHtml(src, alt) {
    var safeSrc = escAttr(src);
    var safeAlt = escAttr(alt);
    return (
      "<li><a class=\"photo-gallery-link\" href=\"" + safeSrc + "\" data-full=\"" + safeSrc + "\">" +
      "<img src=\"" + safeSrc + "\" alt=\"" + safeAlt + "\" width=\"88\" height=\"88\" loading=\"lazy\" decoding=\"async\" data-gallery-img /></a></li>"
    );
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

  function dropBrokenImage(img) {
    var li = img && img.closest("li");
    if (li) li.remove();
    checkVisible();
  }

  function attachErrors() {
    ul.querySelectorAll("img[data-gallery-img]").forEach(function (img) {
      if (!img.dataset.galleryBound) {
        img.dataset.galleryBound = "1";
        img.addEventListener("error", function () {
          dropBrokenImage(img);
        });
      }
      if (img.complete && img.naturalWidth === 0) {
        dropBrokenImage(img);
      }
    });
    checkVisible();
  }

  function getLinks() {
    return ul.querySelectorAll("a.photo-gallery-link");
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (!autoplayOn || !lightbox || lightbox.hasAttribute("hidden")) return;
    var links = getLinks();
    if (links.length < 2) return;
    autoplayTimer = setInterval(function () {
      showIndex((currentIndex + 1) % links.length);
    }, AUTOPLAY_MS);
  }

  function syncPlayLabel() {
    if (!lbPlay) return;
    lbPlay.textContent = autoplayOn ? "Pause" : "Play";
    lbPlay.setAttribute("aria-pressed", autoplayOn ? "true" : "false");
  }

  function showIndex(i) {
    var links = getLinks();
    if (!links.length || !lbImg) return;
    currentIndex = ((i % links.length) + links.length) % links.length;
    var a = links[currentIndex];
    var thumb = a.querySelector("img");
    var full = a.getAttribute("data-full") || a.getAttribute("href") || "";
    var preview = (thumb && thumb.getAttribute("src")) || full;
    lbImg.removeAttribute("src");
    lbImg.alt = thumb ? thumb.getAttribute("alt") || "" : "";
    lbImg.src = preview;
    if (lbFull) {
      var same = !full || resolveGalleryUrl(preview) === resolveGalleryUrl(full);
      if (same) {
        lbFull.setAttribute("hidden", "");
        lbFull.setAttribute("aria-hidden", "true");
      } else {
        lbFull.removeAttribute("hidden");
        lbFull.setAttribute("aria-hidden", "false");
      }
    }
    if (lbCounter) {
      lbCounter.textContent = (currentIndex + 1) + " / " + links.length;
    }
    if (typeof lbImg.decode === "function") {
      lbImg.decode().catch(function () {});
    }
    var next = (currentIndex + 1) % links.length;
    var preload = new Image();
    var nextA = links[next];
    if (nextA) {
      var nextThumb = nextA.querySelector("img");
      var nextPreview = (nextThumb && nextThumb.getAttribute("src")) ||
        nextA.getAttribute("data-full") ||
        nextA.getAttribute("href") ||
        "";
      preload.src = nextPreview;
    }
  }

  function openLightbox(index) {
    var links = getLinks();
    if (!links.length || !lightbox) return;
    lastFocus = document.activeElement;
    lightbox.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    autoplayOn = true;
    syncPlayLabel();
    showIndex(index);
    startAutoplay();
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    stopAutoplay();
    lightbox.setAttribute("hidden", "");
    document.body.style.overflow = "";
    if (lbImg) lbImg.removeAttribute("src");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  function buildLightbox() {
    lightbox = document.createElement("div");
    lightbox.id = "gallery-lightbox";
    lightbox.className = "gallery-lightbox";
    lightbox.setAttribute("hidden", "");
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Photo gallery");

    var backdrop = document.createElement("div");
    backdrop.className = "gallery-lightbox__backdrop";
    backdrop.addEventListener("click", closeLightbox);

    var chrome = document.createElement("div");
    chrome.className = "gallery-lightbox__chrome";

    var top = document.createElement("div");
    top.className = "gallery-lightbox__top";

    lbCounter = document.createElement("span");
    lbCounter.className = "gallery-lightbox__counter";

    lbPlay = document.createElement("button");
    lbPlay.type = "button";
    lbPlay.className = "gallery-lightbox__btn";
    lbPlay.setAttribute("aria-pressed", "true");
    lbPlay.textContent = "Pause";
    lbPlay.addEventListener("click", function () {
      autoplayOn = !autoplayOn;
      syncPlayLabel();
      if (autoplayOn) startAutoplay();
      else stopAutoplay();
    });

    lbClose = document.createElement("button");
    lbClose.type = "button";
    lbClose.className = "gallery-lightbox__btn";
    lbClose.textContent = "Close";
    lbClose.setAttribute("aria-label", "Close gallery");
    lbClose.addEventListener("click", closeLightbox);

    lbFull = document.createElement("button");
    lbFull.type = "button";
    lbFull.className = "gallery-lightbox__btn";
    lbFull.textContent = "Full size";
    lbFull.setAttribute("aria-label", "Show full resolution image");
    lbFull.setAttribute("hidden", "");
    lbFull.setAttribute("aria-hidden", "true");
    lbFull.addEventListener("click", function () {
      var links = getLinks();
      if (!links.length || !lbImg) return;
      var cur = links[currentIndex];
      var hi = cur && (cur.getAttribute("data-full") || cur.getAttribute("href"));
      if (hi) lbImg.src = hi;
      lbFull.setAttribute("hidden", "");
      lbFull.setAttribute("aria-hidden", "true");
      if (typeof lbImg.decode === "function") {
        lbImg.decode().catch(function () {});
      }
    });

    var topActions = document.createElement("div");
    topActions.className = "gallery-lightbox__top-actions";
    topActions.appendChild(lbPlay);
    topActions.appendChild(lbClose);

    top.appendChild(lbCounter);
    top.appendChild(lbFull);
    top.appendChild(topActions);

    var navrow = document.createElement("div");
    navrow.className = "gallery-lightbox__navrow";

    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "gallery-lightbox__btn gallery-lightbox__btn--icon gallery-lightbox__side";
    prev.innerHTML = "&#8592;";
    prev.setAttribute("aria-label", "Previous photo");
    prev.addEventListener("click", function () {
      var n = getLinks().length;
      showIndex(currentIndex - 1);
      if (autoplayOn) startAutoplay();
    });

    var stage = document.createElement("div");
    stage.className = "gallery-lightbox__stage";
    var frame = document.createElement("div");
    frame.className = "gallery-lightbox__frame";
    lbImg = document.createElement("img");
    lbImg.alt = "";
    lbImg.decoding = "async";
    frame.appendChild(lbImg);
    stage.appendChild(frame);

    var next = document.createElement("button");
    next.type = "button";
    next.className = "gallery-lightbox__btn gallery-lightbox__btn--icon gallery-lightbox__side";
    next.innerHTML = "&#8594;";
    next.setAttribute("aria-label", "Next photo");
    next.addEventListener("click", function () {
      showIndex(currentIndex + 1);
      if (autoplayOn) startAutoplay();
    });

    navrow.appendChild(prev);
    navrow.appendChild(stage);
    navrow.appendChild(next);

    chrome.appendChild(top);
    chrome.appendChild(navrow);

    lightbox.appendChild(backdrop);
    lightbox.appendChild(chrome);
    document.body.appendChild(lightbox);

    document.addEventListener("keydown", onDocKey);
  }

  function onDocKey(e) {
    if (!lightbox || lightbox.hasAttribute("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      showIndex(currentIndex - 1);
      if (autoplayOn) startAutoplay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      showIndex(currentIndex + 1);
      if (autoplayOn) startAutoplay();
    }
  }

  function onGalleryClick(e) {
    var a = e.target.closest("a.photo-gallery-link");
    if (!a || !ul.contains(a)) return;
    e.preventDefault();
    var links = getLinks();
    var idx = Array.prototype.indexOf.call(links, a);
    if (idx === -1) return;
    openLightbox(idx);
  }

  buildLightbox();
  ul.addEventListener("click", onGalleryClick);

  fetch("/assets/gallery/manifest.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      if (!Array.isArray(data.images) || !data.images.length) throw new Error();
      ul.innerHTML = data.images.map(function (f) {
        var src = "/assets/gallery/" + encodeURIComponent(f);
        var alt = f.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
        return galleryItemHtml(src, alt);
      }).join("");
      attachErrors();
    })
    .catch(function () {
      attachErrors();
    });
})();
