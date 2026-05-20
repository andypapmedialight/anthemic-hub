(function () {
  var LS_API = 'papaweb_contact_api_base';
  var LS_TOK = 'papaweb_contact_bearer';

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, kind) {
    var el = $('status');
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function normalizeBase(url) {
    if (!url) return '';
    var s = String(url).trim().replace(/\/+$/, '');
    if (s.charAt(0) === '/') {
      return (window.location.origin || '').replace(/\/+$/, '') + s;
    }
    return s;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderRows(rows) {
    var tb = $('tbody');
    var wrap = $('table-wrap');
    tb.innerHTML = '';
    if (!rows.length) {
      wrap.hidden = false;
      tb.innerHTML = '<tr><td colspan="5" class="mono">No submissions yet.</td></tr>';
      return;
    }
    wrap.hidden = false;
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="mono">' + escapeHtml(r.receivedAt || '—') + '</td>' +
        '<td>' + escapeHtml(r.name || '') + '</td>' +
        '<td class="mono">' + escapeHtml(r.email || '') + '</td>' +
        '<td>' + escapeHtml(r.interest || '') + '</td>' +
        '<td class="msg">' + escapeHtml(r.message || '') + '</td>';
      tb.appendChild(tr);
    });
  }

  async function loadSubmissions() {
    var base = normalizeBase($('api-base').value);
    var token = $('token').value.trim();
    if (!base || !token) {
      setStatus('Enter both API base URL and admin token.', 'err');
      return;
    }
    localStorage.setItem(LS_API, base);
    localStorage.setItem(LS_TOK, token);
    setStatus('Loading…', '');
    $('load-btn').disabled = true;
    try {
      var res = await fetch(base + '/contacts', {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      var data = await res.json().catch(function () {
        return null;
      });
      if (!res.ok) {
        var err = data && (data.error || data.message);
        if (res.status === 401) {
          throw new Error(
            (err || 'Unauthorized') +
              ' — check CONTACT_ADMIN_TOKEN matches GitHub secret and hub was redeployed.'
          );
        }
        if (res.status === 503) {
          throw new Error(
            (err || 'Service unavailable') +
              ' — set CONTACT_ADMIN_TOKEN in GitHub Actions secrets and redeploy hub.'
          );
        }
        throw new Error(err || 'HTTP ' + res.status);
      }
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response (expected a JSON array).');
      }
      renderRows(data);
      setStatus('Loaded ' + data.length + ' row(s).', 'ok');
    } catch (e) {
      setStatus(e.message || String(e), 'err');
      $('table-wrap').hidden = true;
    } finally {
      $('load-btn').disabled = false;
    }
  }

  $('load-form').addEventListener('submit', function (e) {
    e.preventDefault();
    loadSubmissions();
  });

  var b = localStorage.getItem(LS_API);
  var t = localStorage.getItem(LS_TOK);
  $('api-base').value = b || '/bass/api';
  if (t) $('token').value = t;
})();
