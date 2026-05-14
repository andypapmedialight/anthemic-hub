(function () {
  var canvas = document.getElementById('warmth-motif-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var canvasMouseY = 0.5;
  var aT = 0;
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    var hero = canvas.closest('.hero');
    var w = hero ? hero.offsetWidth : canvas.offsetWidth;
    var h = hero ? hero.offsetHeight : canvas.offsetHeight;
    if (w < 1 || h < 1) return;
    canvas.width = w;
    canvas.height = h;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener(
    'mousemove',
    function (e) {
      canvasMouseY = e.clientY / (window.innerHeight || 1);
    },
    { passive: true }
  );

  var floatNotes = [];
  var i;
  for (i = 0; i < 11; i++) {
    floatNotes.push({
      x: 0.05 + Math.random() * 0.9,
      y: 0.1 + Math.random() * 0.85,
      speed: 0.00022 + Math.random() * 0.00032,
      size: 0.012 + Math.random() * 0.012,
      alpha: 0.08 + Math.random() * 0.11,
      char: ['\u2669', '\u266a', '\u266b', '\u266c'][i % 4],
      phase: Math.random() * Math.PI * 2,
    });
  }

  function drawStaffLines(W, H, t) {
    var sp = H * 0.052;
    var midY = H * 0.5 + (canvasMouseY - 0.5) * 14;
    ctx.lineWidth = 1;
    for (i = 0; i < 5; i++) {
      var y = midY - sp * 2 + sp * i;
      ctx.strokeStyle =
        'rgba(200,131,26,' + (0.07 + 0.035 * Math.sin(t * 0.5 + i * 0.8)) + ')';
      ctx.beginPath();
      ctx.moveTo(W * 0.03, y);
      ctx.lineTo(W * 0.97, y);
      ctx.stroke();
    }
  }

  function drawBassClef(W, H, t) {
    var size = Math.min(W, H) * (W < 520 ? 0.58 : 0.72);
    var x = W * 0.5;
    var y = H * 0.62 + size * 0.08;
    var alpha = 0.11 + 0.045 * Math.sin(t * 0.55);
    ctx.save();
    ctx.font =
      size +
      'px "Noto Music", "Times New Roman", "Bravura", "Apple Symbols", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = 56;
    ctx.shadowColor = 'rgba(200,131,26,0.28)';
    ctx.fillStyle = 'rgba(232,168,74,' + alpha + ')';
    ctx.fillText('\u{1D122}', x, y);
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(200,131,26,' + alpha * 0.45 + ')';
    ctx.fillText('\u{1D122}', x, y);
    ctx.restore();
  }

  function drawFloatingNotes(W, H, t) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    floatNotes.forEach(function (n) {
      if (!reduceMotion) {
        n.y -= n.speed;
        if (n.y < -0.06) {
          n.y = 1.08;
          n.x = 0.05 + Math.random() * 0.9;
        }
      }
      var wx = (n.x + Math.sin(t * 1.35 + n.phase) * 0.02) * W;
      var wy = n.y * H;
      var a =
        n.alpha *
        Math.min(1, n.y * 11) *
        Math.min(1, (1 - n.y) * 9);
      ctx.font = n.size * Math.min(W, H) + 'px serif';
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(200,131,26,' + a * 0.45 + ')';
      ctx.fillStyle = 'rgba(232,168,74,' + a + ')';
      ctx.fillText(n.char, wx, wy);
    });
    ctx.restore();
  }

  function frame() {
    var W = canvas.width;
    var H = canvas.height;
    var t = reduceMotion ? 0 : aT;
    if (W > 0 && H > 0) {
      ctx.clearRect(0, 0, W, H);
      drawStaffLines(W, H, t);
      drawBassClef(W, H, t);
      drawFloatingNotes(W, H, t);
      if (!reduceMotion) aT += 0.009;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

(function () {
  /* Resolve next to this page so /prefix/hub/bass/ still hits ../gigs and ../content (root-only /gigs/... breaks subpaths). */
  var jsonBase = document.baseURI || window.location.href;
  var GIGS_JSON = new URL('../gigs/gigs.json', jsonBase).toString();
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var listEl = document.getElementById('gigs-warmth-list');
  var emptyEl = document.getElementById('gigs-warmth-empty');
  var errEl = document.getElementById('gigs-warmth-err');
  if (!listEl) return;

  function todayYmd() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseYmd(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-');
    return { y: +p[0], m: +p[1], d: +p[2], raw: s };
  }

  function compareYmd(a, b) {
    if (a.raw < b.raw) return -1;
    if (a.raw > b.raw) return 1;
    return 0;
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function actionHref(g) {
    var t = g.tickets_link && String(g.tickets_link).trim();
    if (t) return t;
    var l = g.link && String(g.link).trim();
    if (l) return l;
    return '/gigs/';
  }

  function actionLabel(g) {
    if (g.tickets_link && String(g.tickets_link).trim()) return 'Tickets →';
    if (g.link && String(g.link).trim()) return 'Details →';
    return 'Calendar →';
  }

  function jsonFromResponse(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text().then(function (t) {
      var u = t.replace(/^\uFEFF/, '').trim();
      if (u.charAt(0) === '<')
        throw new Error('HTML not JSON — check URL and server routing for gigs.json');
      return JSON.parse(u);
    });
  }

  fetch(GIGS_JSON, { cache: 'no-store' })
    .then(jsonFromResponse)
    .then(function (data) {
      var raw = data && Array.isArray(data.gigs) ? data.gigs : [];
      var today = todayYmd();
      var upcoming = [];
      for (var i = 0; i < raw.length; i++) {
        var g = raw[i];
        if (!g || typeof g !== 'object') continue;
        var dateStr = g.date != null ? String(g.date).trim() : '';
        if (!dateStr || !g.title) continue;
        if (!parseYmd(dateStr)) continue;
        if (dateStr >= today) {
          g.date = dateStr;
          upcoming.push(g);
        }
      }
      upcoming.sort(function (a, b) { return compareYmd(parseYmd(a.date), parseYmd(b.date)); });
      var show = upcoming.slice(0, 12);

      if (!show.length) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }
      if (emptyEl) emptyEl.style.display = 'none';

      listEl.innerHTML = show.map(function (g) {
        var ymd = parseYmd(g.date);
        var dayNum = ymd.d;
        var mon = MONTHS[ymd.m - 1];
        var where = [g.venue, g.city].filter(Boolean).join(', ');
        var loc = where;
        if (g.time && String(g.time).trim()) loc += (loc ? ' · ' : '') + String(g.time).trim();
        var rawHref = actionHref(g);
        var href = esc(rawHref);
        var lab = esc(actionLabel(g));
        var ext = /^https?:\/\//i.test(rawHref);
        var aAttr = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
        return (
          '<div class="gig-item">' +
            '<div class="gig-date"><div class="gig-day">' + esc(String(dayNum)) + '</div><div class="gig-month">' + esc(mon) + '</div></div>' +
            '<div><div class="gig-title">' + esc(g.title) + '</div><div class="gig-location">' + esc(loc || 'TBC') + '</div></div>' +
            '<a href="' + href + '" class="gig-ticket"' + aAttr + '>' + lab + '</a>' +
          '</div>'
        );
      }).join('');
    })
    .catch(function (e) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent =
          (e && e.message) ||
          'Could not load gigs.json (path is ../gigs/gigs.json from this page — check deploy and nginx). If you opened this file from disk, use a local server from the hub root.';
      }
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'none';
    });
})();

(function () {
  var jsonBase = document.baseURI || window.location.href;
  var HUB_JSON = new URL('../content/hub.json', jsonBase).toString();
  var root = document.getElementById('warmth-projects');
  var errEl = document.getElementById('warmth-projects-err');
  if (!root) return;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function jsonFromResponse(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text().then(function (t) {
      var u = t.replace(/^\uFEFF/, '').trim();
      if (u.charAt(0) === '<')
        throw new Error('HTML not JSON — check URL and server routing for hub.json');
      return JSON.parse(u);
    });
  }

  fetch(HUB_JSON, { cache: 'no-store' })
    .then(jsonFromResponse)
    .then(function (c) {
      var arr = c && Array.isArray(c.projects) ? c.projects : [];
      var chips = [];
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (!p || typeof p !== 'object' || !p.name) continue;
        var name = String(p.name).trim();
        if (!name) continue;
        var d = p.dates != null ? String(p.dates).trim() : '';
        var datesHtml = d
          ? '<span class="hub-project-dates">' + esc(d) + '</span>'
          : '';
        chips.push(
          '<span class="hub-project-chip">' +
            '<span class="hub-project-name">' + esc(name) + '</span>' +
            datesHtml +
          '</span>'
        );
      }
      if (!chips.length) {
        root.innerHTML =
          '<p class="gigs-lede">No projects in <code>hub.json</code> yet — add a <code>projects</code> array (same shape as the main hub).</p>';
        return;
      }
      root.innerHTML = chips.join('');
    })
    .catch(function (e) {
      root.innerHTML = '';
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent =
          (e && e.message) ||
          'Could not load hub.json (path is ../content/hub.json from this page — check deploy). Use a local server from the hub root if testing from disk.';
      }
    });
})();
