/* Optional “browse by current” view — separate from the chronological timeline.
   Uses window.THINKERS_TIMELINE from map-of-maps.js (data only when #mmd-target is absent). */

const CURRENTS = [
  {
    id: "neuro-unconscious",
    label: "Neuro · unconscious",
    home: "Grounding the Unconscious",
    homeHref: "/grounding-the-unconscious.html",
    blurb: "Freud’s models through Lacan, dream science, and neural substrates — plus the hard-problem dissent.",
    nodes: [
      "freud", "cUnconscious", "lacan", "structImp", "kristeva", "zizek", "johnston", "malabou",
      "panksepp", "solms", "hobsonMc", "domhoff", "damasio", "edelman", "friston", "churchland",
      "chalmers", "cHardProb", "jackson", "nagel", "strawGoff", "kastrup", "bohm", "faggin", "mcgilchrist",
      "miller", "badiou", "popper", "grunbaum", "crews", "eysenck", "schopen", "leibniz", "herbart",
      "vonHart", "descartes", "spinoza", "platoAr", "socrates",
      "turing", "ryle", "searle", "hofstadter", "dennett", "crick", "gwt", "penrose", "block", "iit"
    ]
  },
  {
    id: "freudo-marxism",
    label: "Freudo-Marxism",
    home: "Genealogies of Desire",
    homeHref: "/genealogies-of-desire.html#freudo-marxism",
    blurb: "Reich through the Frankfurt School: repression, surplus-repression, culture industry — pressed later by Firestone, Federici, Mitchell.",
    nodes: [
      "freud", "marx", "reich", "adorno", "marcuse", "fromm", "benjamin", "firestone", "federici",
      "mitchell", "fisher", "acidXeno", "cIdeology", "cUnconscious"
    ]
  },
  {
    id: "french-feminism",
    label: "French feminism · sexual difference",
    home: "Genealogies / Grounding",
    homeHref: "/genealogies-of-desire.html#french-turn",
    blurb: "Irigaray, Cixous, Kristeva, Mitchell — and Beauvoir / Butler as hinges into performativity and recognition.",
    nodes: [
      "beauvoir", "irigaray", "cixous", "kristeva", "mitchell", "butler", "lacan", "derrida",
      "kojeve", "cRecog", "foucault"
    ]
  },
  {
    id: "cultural-studies",
    label: "Cultural Studies · habitus",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#cultural-studies",
    blurb: "Williams and Hall’s culture-as-material-practice, beside Bourdieu’s habitus / field / cultural capital.",
    nodes: [
      "williamsR", "hall", "bourdieu", "cHabitus", "gramsci", "cHegemony", "althusser", "mcluhan",
      "eagleton"
    ]
  },
  {
    id: "colonial-critique",
    label: "Colonial · decolonial critique",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#colonial-critique",
    blurb: "Fanon through Said, Spivak, Mills, Wynter, Mohanty, Anzaldúa, Lugones — pressure on the Western culture map from inside it.",
    nodes: [
      "fanon", "said", "spivak", "mills", "cRacialContract", "wynter", "mohanty", "anzaldua",
      "lugones", "sartre", "hall", "davis"
    ]
  },
  {
    id: "black-feminist",
    label: "Black feminist thought",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#davis",
    blurb: "Davis, Lorde · hooks, Collins — abolition, margin-as-theory, outsider-within epistemology.",
    nodes: ["davis", "lordeHooks", "collins", "marcuse", "fanon", "hall", "fraser"]
  },
  {
    id: "recognition",
    label: "Recognition debates",
    home: "Constellations / Genealogies",
    homeHref: "/constellations-of-history.html#habermas-honneth-rosa",
    blurb: "Hegel/Kojève desire-for-recognition through Honneth, Fraser’s redistribution fight, Butler, Benhabib’s situated self, Forst’s justification, Jaeggi’s forms of life.",
    nodes: [
      "hegel", "cRecog", "kojeve", "beauvoir", "butler", "honneth", "fraser", "habermas",
      "taylor", "fanon", "benhabib", "forst", "jaeggi", "cJustification", "cFormsOfLife", "rosa"
    ]
  },
  {
    id: "acceleration",
    label: "Accelerationism",
    home: "Genealogies of Desire",
    homeHref: "/genealogies-of-desire.html#warwick-ccru",
    blurb: "Land, CCRU, Fisher, Noys’s naming/refusal, left-accelerationism, e/acc — not Rosa’s social acceleration.",
    nodes: [
      "dg", "land", "ccruTrio", "plant", "fisher", "noys", "leftAccel", "eacc", "acidXeno",
      "bostrom", "berardiDean", "derrida"
    ]
  },
  {
    id: "techne",
    label: "Techne · Gestell · organology",
    home: "Technics and Time",
    homeHref: "/technics-and-time.html",
    blurb: "Aristotle’s techne through Heidegger’s Gestell, Simondon, Stiegler’s pharmacology, Hui’s cosmotechnics — with Merchant and Hayles as feminist foils.",
    nodes: [
      "aristotleTech", "heideggerGestell", "cTechneGestell", "simondon", "stiegler", "cPharmakon",
      "yukHui", "cCosmotech", "merchant", "hayles", "haraway", "plant", "mcluhan", "heidegger"
    ]
  },
  {
    id: "late-modern-speed",
    label: "Late-modern speed",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#habermas-honneth-rosa",
    blurb: "Harvey’s time-space compression, Rosa’s acceleration vs resonance, Weeks/Han/Crary on exhaustion and work, McKerracher’s timenergy — peer diagnoses of speed and thinning.",
    nodes: [
      "harvey", "jameson", "mandel", "bauman", "rosa", "cSocAccel", "cResonance", "taylor",
      "fisher", "debord", "weeks", "han", "crary", "mckerracher", "cTimenergy", "federici", "berardiDean"
    ]
  },
  {
    id: "western-marxism",
    label: "Western Marxism spine",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#lukacs-gramsci",
    blurb: "Lukács, Gramsci, Luxemburg, Weimar circle, Anderson’s naming — the culture-and-consciousness break from orthodox Marxism.",
    nodes: [
      "luxemburg", "lukacs", "gramsci", "cReif", "cHegemony", "benjamin", "bloch", "brecht",
      "kracauer", "scholem", "arendt", "weil", "adorno", "debord", "anderson", "jameson",
      "marx"
    ]
  }
];

function yearLabel(y, approx) {
  const abs = Math.abs(y);
  const s = y < 0 ? `${abs} BCE` : String(y);
  return approx ? `c. ${s}` : s;
}

function nodeById(id) {
  const { NODES } = window.THINKERS_TIMELINE || {};
  return (NODES || []).find((n) => n.id === id) || null;
}

function cohortNodes(current) {
  const seen = new Set();
  const out = [];
  for (const id of current.nodes) {
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodeById(id);
    if (n) out.push(n);
  }
  out.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  return out;
}

function cohortEdges(nodeIds) {
  const { EDGES } = window.THINKERS_TIMELINE || {};
  const set = new Set(nodeIds);
  return (EDGES || []).filter((e) => set.has(e.from) && set.has(e.to));
}

function groupClass(group) {
  return group || "concept";
}

function renderChips(activeId) {
  const el = document.getElementById("currentChips");
  if (!el) return;
  el.innerHTML = CURRENTS.map((c) => {
    const active = c.id === activeId ? " is-active" : "";
    return `<button type="button" class="current-chip${active}" data-current="${c.id}" aria-pressed="${c.id === activeId}">${c.label}</button>`;
  }).join("");
}

function renderCurrent(currentId) {
  const current = CURRENTS.find((c) => c.id === currentId) || CURRENTS[0];
  const nodes = cohortNodes(current);
  const edges = cohortEdges(nodes.map((n) => n.id));
  const panel = document.getElementById("currentPanel");
  const list = document.getElementById("currentList");
  const status = document.getElementById("currentStatus");
  const title = document.getElementById("currentTitle");
  const blurb = document.getElementById("currentBlurb");
  const home = document.getElementById("currentHome");

  renderChips(current.id);
  if (title) title.textContent = current.label;
  if (blurb) blurb.textContent = current.blurb;
  if (home) {
    home.href = current.homeHref;
    home.textContent = current.home;
  }

  if (list) {
    list.innerHTML = nodes.map((n) => {
      const href = n.href || "#";
      const sub = n.sub ? `<span class="sub">${n.sub}</span>` : "";
      const yr = yearLabel(n.year, n.approx);
      return `<li class="current-node ${groupClass(n.group)}">
        <a href="${href}">
          <span class="yr">${yr}</span>
          <span class="nm">${n.name}</span>
          ${sub}
        </a>
      </li>`;
    }).join("");
  }

  if (panel) {
    const edgeBits = edges.slice(0, 40).map((e) => {
      const a = nodeById(e.from);
      const b = nodeById(e.to);
      if (!a || !b) return "";
      return `<li class="edge ${e.kind}"><span>${a.name}</span> <em>${e.kind}</em> <span>${b.name}</span></li>`;
    }).filter(Boolean).join("");
    const edgeBox = document.getElementById("currentEdges");
    if (edgeBox) {
      edgeBox.innerHTML = edgeBits || "<li class=\"muted\">No mapped edges wholly inside this cohort.</li>";
    }
  }

  if (status) {
    status.textContent = `${nodes.length} thinkers/concepts · ${edges.length} edges inside this current · optional view — chronological timeline unchanged`;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("current", current.id);
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function initCurrentsView() {
  if (!window.THINKERS_TIMELINE || !window.THINKERS_TIMELINE.NODES) {
    const status = document.getElementById("currentStatus");
    if (status) status.textContent = "Timeline data failed to load.";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const start = params.get("current") || CURRENTS[0].id;

  document.getElementById("currentChips")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-current]");
    if (!btn) return;
    renderCurrent(btn.getAttribute("data-current"));
  });

  renderCurrent(start);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCurrentsView);
} else {
  initCurrentsView();
}
