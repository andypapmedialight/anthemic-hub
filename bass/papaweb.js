/* Contact form — first non-empty option wins (good for DO static sites: no SMTP on the droplet needed):
 * 1) CONTACT_FORM_ENDPOINT — POST JSON to your own API (see PapaWeb/contact-backend/server.mjs for DigitalOcean App Platform).
 * 2) CONTACT_FORMSPREE_ID — form id from https://formspree.io (hosted submissions inbox + optional email via their integrations).
 * 3) CONTACT_FORM_ACCESS_KEY — https://web3forms.com (emails you; no inbox UI).
 * 4) CONTACT_SLACK_WEBHOOK_URL — Incoming Webhook from a Slack app (https://api.slack.com/messaging/webhooks). Posts to a channel; no extra hosting. Warning: the URL is a secret — anyone who reads your page source can spam the channel; use Slack “IP allowlists” / rotate URL if abused, or proxy via your own API.
 * 5) Otherwise opens the visitor's mail app (mailto). */
const CONTACT_FORM_ENDPOINT = '';
const CONTACT_FORMSPREE_ID = '';
const CONTACT_FORM_ACCESS_KEY = '';
const CONTACT_SLACK_WEBHOOK_URL = '';
const CONTACT_TO_EMAIL = 'hello@andypap.dev';

// ── CURSOR ──
const cur  = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cur.style.left = mx + 'px'; cur.style.top = my + 'px';
});
(function tick() {
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(tick);
})();
document.querySelectorAll('a, button, .bc, .slink').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('c-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('c-hover'));
});

// ── NAV SCROLL ──
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 50), { passive: true });

// ── HERO NAME KINETIC REVEAL ──
const words = 'Andy Pap'.split(' ');
const nameEl = document.getElementById('hero-name');
let delay = 0.5;
words.forEach(word => {
  const wEl = document.createElement('span');
  wEl.className = 'word';
  [...word].forEach(ch => {
    const cEl = document.createElement('span');
    cEl.className = 'char';
    cEl.textContent = ch;
    cEl.style.animationDelay = delay + 's';
    delay += 0.065;
    wEl.appendChild(cEl);
  });
  nameEl.appendChild(wEl);
});

// ── CANVAS: PHOTO + OVERLAYS ──
const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');
let canvasMouseY = 0.5;

function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
resize();
window.addEventListener('resize', resize, { passive: true });
document.addEventListener('mousemove', e => { canvasMouseY = e.clientY / innerHeight; }, { passive: true });

// Load the actual bass guitar photo
const guitarPhoto = new Image();
guitarPhoto.src = 'brand_assets/AndyPBass.png';

// Floating music notes
const floatNotes = Array.from({ length: 9 }, (_, i) => ({
  x: 0.05 + Math.random() * 0.9, y: 0.1 + Math.random() * 0.8,
  speed: 0.00025 + Math.random() * 0.00035,
  size: 0.013 + Math.random() * 0.011,
  alpha: 0.07 + Math.random() * 0.12,
  char: ['♩','♪','♫','♬'][i % 4],
  phase: Math.random() * Math.PI * 2,
}));

function drawGuitarPNG(W, H, t) {
  if (!guitarPhoto.complete || !guitarPhoto.naturalWidth) return;
  ctx.save();

  const iW = guitarPhoto.naturalWidth, iH = guitarPhoto.naturalHeight;
  // Scale guitar to 74% of canvas width
  const dw = W * 0.74;
  const dh = iH * (dw / iW);
  // Center horizontally; sit at ~50% vertically (on the clef's body curve)
  const dx = (W - dw) / 2;
  const dy = H * 0.50 - dh * 0.5 + Math.sin(t * 0.28) * 4; // gentle float

  // Warm neon glow behind guitar (stage-light effect)
  const aura = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.42);
  aura.addColorStop(0,   'rgba(255,184,0,0.07)');
  aura.addColorStop(0.5, 'rgba(255,45,117,0.05)');
  aura.addColorStop(1,   'transparent');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, H);

  // Neon shadow pass — gives the guitar a pink/coral edge glow
  ctx.shadowBlur  = 38;
  ctx.shadowColor = 'rgba(255,45,117,0.55)';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(guitarPhoto, dx, dy, dw, dh);

  // Clean sharp pass on top
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.drawImage(guitarPhoto, dx, dy, dw, dh);

  ctx.restore();
}

function drawColorOverlay(W, H, t) {
  // Neon screen wash
  ctx.globalCompositeOperation = 'screen';
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0,    'rgba(0, 110, 140, 0.22)');
  wash.addColorStop(0.55, 'rgba(0,  60,  90, 0.10)');
  wash.addColorStop(1,    'rgba(70,   0,  35, 0.20)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // Pulsing spotlight centred on guitar/clef
  const pulse = 0.06 + 0.02 * Math.sin(t * 0.55);
  const spot = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.45);
  spot.addColorStop(0, `rgba(0,243,255,${pulse})`);
  spot.addColorStop(1, 'transparent');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // Deep void vignette
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.15, W * 0.5, H * 0.5, H * 0.9);
  vg.addColorStop(0, 'rgba(13,15,26,0)');
  vg.addColorStop(1, 'rgba(13,15,26,0.88)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawStaffLines(W, H, t) {
  const sp   = H * 0.055;
  const midY = H * 0.5 + (canvasMouseY - 0.5) * 12;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = midY - sp * 2 + sp * i;
    ctx.strokeStyle = `rgba(0,243,255,${0.05 + 0.02 * Math.sin(t * 0.5 + i * 0.8)})`;
    ctx.beginPath(); ctx.moveTo(W * 0.03, y); ctx.lineTo(W * 0.97, y); ctx.stroke();
  }
}

function drawBassClef(W, H, t) {
  const size  = Math.min(W, H) * 0.78;
  const x     = W * 0.50;
  const y     = H * 0.62 + size * 0.08;
  const alpha = 0.12 + 0.045 * Math.sin(t * 0.55);
  ctx.save();
  ctx.font         = `${size}px "Times New Roman", Georgia, serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowBlur   = 100;
  ctx.shadowColor  = 'rgba(0,243,255,0.6)';
  ctx.fillStyle    = `rgba(0,243,255,${alpha})`;
  ctx.fillText('\u{1D122}', x, y);
  ctx.shadowBlur   = 32;
  ctx.fillStyle    = `rgba(0,243,255,${alpha * 0.5})`;
  ctx.fillText('\u{1D122}', x, y);
  ctx.restore();
}

function drawFloatingNotes(W, H, t) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  floatNotes.forEach(n => {
    n.y -= n.speed;
    if (n.y < -0.06) { n.y = 1.06; n.x = 0.05 + Math.random() * 0.9; }
    const wx = (n.x + Math.sin(t * 1.4 + n.phase) * 0.018) * W;
    const wy = n.y * H;
    const a  = n.alpha * Math.min(1, n.y * 12) * Math.min(1, (1 - n.y) * 10);
    ctx.font        = `${n.size * Math.min(W, H)}px serif`;
    ctx.fillStyle   = `rgba(0,243,255,${a})`;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = `rgba(0,243,255,${a * 0.5})`;
    ctx.fillText(n.char, wx, wy);
  });
  ctx.restore();
}

let aT = 0;
(function drawScene() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  drawStaffLines(W, H, aT);
  drawBassClef(W, H, aT);
  drawGuitarPNG(W, H, aT);
  drawColorOverlay(W, H, aT);
  drawFloatingNotes(W, H, aT);
  aT += 0.009;
  requestAnimationFrame(drawScene);
})();

// ── SCROLL REVEAL ──
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── LEVEL BARS ──
const bIo = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.width = e.target.dataset.w + '%';
      bIo.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.lbar-fill').forEach(el => bIo.observe(el));

// ── 3D TILT ──
document.querySelectorAll('[data-tilt]').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top)  / r.height;
    card.style.transform = `perspective(900px) rotateX(${(y-.5)*-7}deg) rotateY(${(x-.5)*7}deg) translateZ(6px)`;
    card.style.setProperty('--mx', (x * 100) + '%');
    card.style.setProperty('--my', (y * 100) + '%');
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

// ── RIPPLE ──
document.querySelectorAll('.ripple-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const spot = document.createElement('span');
    spot.className = 'ripple-spot';
    spot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
    btn.appendChild(spot);
    setTimeout(() => spot.remove(), 700);
  });
});

// ── FORM (custom API → Formspree → Web3Forms → Slack webhook → mailto) ──
const submitBtnDefaultHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Send Message`;

function setFormStatus(msg, kind) {
  const el = document.getElementById('form-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'err');
  if (kind) el.classList.add(kind);
  el.hidden = !msg;
}

function contactSubject(interestLabel, name) {
  return '[PapaWeb] ' + interestLabel + ' — ' + name;
}

function contactBody(interestLabel, msg) {
  return 'Interest: ' + interestLabel + '\n\n' + msg;
}

async function postContactJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(function () { return {}; });
  return { res: res, data: data };
}

function slackMrkdwnEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function postSlackContact(webhookUrl, payload) {
  /* Slack webhooks + application/json triggers a CORS preflight that hooks.slack.com does not satisfy.
   * application/x-www-form-urlencoded with `payload=` is treated as a simple request in browsers. */
  const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  });
  const raw = await res.text().catch(function () { return ''; });
  let okJson = false;
  try {
    okJson = JSON.parse(raw).ok === true;
  } catch (e) { /* ignore */ }
  const okText = raw.trim() === 'ok';
  if (!res.ok || (!okText && !okJson)) {
    let err = 'Could not post to Slack';
    try {
      const j = JSON.parse(raw);
      if (j.error) err = j.error;
    } catch (e2) { /* ignore */ }
    throw new Error(err);
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('submit-btn');
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const interest = document.getElementById('interest').value;
  const msg = document.getElementById('msg').value.trim();

  const interestLabels = { lesson: 'Bass lesson', software: 'Software project', both: 'Both' };
  const interestLabel = interestLabels[interest] || interest || 'Not specified';
  const subjectLine = contactSubject(interestLabel, name);
  const fullMessage = contactBody(interestLabel, msg);

  setFormStatus('', null);
  btn.disabled = true;
  btn.innerHTML = 'Sending…';

  function mailtoFallback() {
    const subject = encodeURIComponent(subjectLine);
    const body = encodeURIComponent(
      'Name: ' + name + '\nEmail: ' + email + '\nInterest: ' + interestLabel + '\n\n' + msg
    );
    window.location.href = 'mailto:' + CONTACT_TO_EMAIL + '?subject=' + subject + '&body=' + body;
    btn.innerHTML = submitBtnDefaultHtml;
    btn.disabled = false;
    setFormStatus('Opening your email app… If nothing opens, use the Email link below.', 'ok');
  }

  function finishSuccess() {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M20 6L9 17l-5-5"/></svg> Sent`;
    btn.style.background = '#10b981';
    setFormStatus('Thanks — your message was sent. I will get back to you soon.', 'ok');
    form.reset();
    setTimeout(function () {
      btn.innerHTML = submitBtnDefaultHtml;
      btn.style.background = '';
      setFormStatus('', null);
    }, 5000);
  }

  function finishError(err) {
    btn.style.background = '#b91c1c';
    setFormStatus(err.message || 'Something went wrong. Try the email link below.', 'err');
    btn.innerHTML = submitBtnDefaultHtml;
    setTimeout(function () {
      btn.style.background = '';
      setFormStatus('', null);
    }, 6000);
  }

  if (!CONTACT_FORM_ENDPOINT && !CONTACT_FORMSPREE_ID && !CONTACT_FORM_ACCESS_KEY && !CONTACT_SLACK_WEBHOOK_URL) {
    mailtoFallback();
    return;
  }

  try {
    if (CONTACT_FORM_ENDPOINT) {
      const { res, data } = await postContactJson(CONTACT_FORM_ENDPOINT, {
        subject: subjectLine,
        name: name,
        email: email,
        interest: interestLabel,
        message: msg,
      });
      if (!res.ok || data.success === false) {
        throw new Error((data && (data.message || data.error)) || 'Could not send message');
      }
    } else if (CONTACT_FORMSPREE_ID) {
      const { res, data } = await postContactJson('https://formspree.io/f/' + CONTACT_FORMSPREE_ID, {
        name: name,
        email: email,
        message: fullMessage,
        _subject: subjectLine,
      });
      if (!res.ok) {
        const errMsg = (data && (data.error || (data.errors && data.errors[0] && data.errors[0].message))) || 'Could not send message';
        throw new Error(typeof errMsg === 'string' ? errMsg : 'Could not send message');
      }
    } else if (CONTACT_FORM_ACCESS_KEY) {
      const { res, data } = await postContactJson('https://api.web3forms.com/submit', {
        access_key: CONTACT_FORM_ACCESS_KEY,
        subject: subjectLine,
        name: name,
        email: email,
        message: fullMessage,
      });
      if (!res.ok || !data.success) {
        throw new Error((data && data.message) || 'Could not send message');
      }
    } else if (CONTACT_SLACK_WEBHOOK_URL) {
      const sn = slackMrkdwnEscape(name);
      const se = slackMrkdwnEscape(email);
      const si = slackMrkdwnEscape(interestLabel);
      const sm = slackMrkdwnEscape(msg);
      const mailtoHref = 'mailto:' + encodeURIComponent(email);
      await postSlackContact(CONTACT_SLACK_WEBHOOK_URL, {
        text: subjectLine,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'New PapaWeb contact', emoji: true } },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*Name*\n' + sn },
              { type: 'mrkdwn', text: '*Email*\n<' + mailtoHref + '|' + se + '>' },
            ],
          },
          { type: 'section', text: { type: 'mrkdwn', text: '*Interest*\n' + si } },
          { type: 'section', text: { type: 'mrkdwn', text: '*Message*\n' + sm } },
        ],
      });
    }
    finishSuccess();
  } catch (err) {
    finishError(err);
  } finally {
    btn.disabled = false;
  }
}

(function () {
  var form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', handleSubmit);
})();
