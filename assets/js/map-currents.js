/* Optional “browse by current” view — separate from the chronological timeline.
   Uses window.THINKERS_TIMELINE from map-of-maps.js (data only when #mmd-target is absent). */

const CURRENTS = [
  {
    id: "neuro-unconscious",
    label: "Neuro · unconscious",
    home: "Grounding the Unconscious",
    homeHref: "/grounding-the-unconscious.html",
    blurb: "Freud’s models, Jung’s break, Klein’s object relations (play, positions, envy), Segal’s symbol formation, Lacan in three dated periods, dream science (Hobson, Solms, Revonsuo, Domhoff), and neural substrates — plus the hard-problem dissent.",
    nodes: [
      "freud", "jung", "spielrein", "klein", "cProjectiveId", "segal", "cEnvy", "cCollective", "cUnconscious", "lacan", "structImp", "cObjetA", "kristeva", "zizek", "copjec", "zupancic", "johnston", "malabou",
      "panksepp", "solms", "hobsonMc", "revonsuo", "domhoff", "damasio", "edelman", "friston", "churchland",
      "chalmers", "cHardProb", "jackson", "nagel", "strawGoff", "kastrup", "albahari", "bohm", "faggin", "mcgilchrist",
      "miller", "badiou", "popper", "grunbaum", "crews", "eysenck", "sokal", "chomLak", "schopen", "leibniz", "herbart",
      "vonHart", "descartes", "spinoza", "platoAr", "socrates", "nietzsche", "james",
      "turing", "ryle", "searle", "hofstadter", "dennett", "crick", "gwt", "penrose", "block", "iit",
      "varela", "seth", "barrett"
    ]
  },
  {
    id: "freudo-marxism",
    label: "Freudo-Marxism",
    home: "Genealogies of Desire",
    homeHref: "/genealogies-of-desire.html#freudo-marxism",
    blurb: "Reich through the Frankfurt School: repression, surplus-repression, culture industry — pressed later by Firestone, Federici, Mitchell, Spillers; Lasch’s culture of narcissism as the American social-character sequel, via Klein’s positions in The Minimal Self.",
    nodes: [
      "freud", "marx", "reich", "adorno", "marcuse", "fromm", "benjamin", "firestone", "federici",
      "mitchell", "spillers", "fisher", "acidXeno", "cIdeology", "cUnconscious", "lasch", "cNarcissism",
      "klein", "cEnvy"
    ]
  },
  {
    id: "french-feminism",
    label: "French feminism · sexual difference",
    home: "Genealogies / Grounding",
    homeHref: "/genealogies-of-desire.html#french-turn",
    blurb: "Irigaray, Cixous, Kristeva, Mitchell — Beauvoir / Butler as hinges into performativity; Copjec and Zupančič as the 1989/Ljubljana reading of sexuation; Klein and Segal as the British clinic Kristeva and Mitchell keep using; Spillers’s ungendering and Mahmood’s pious agency as later cuts.",
    nodes: [
      "beauvoir", "irigaray", "cixous", "kristeva", "mitchell", "butler", "lacan", "copjec", "zupancic", "derrida",
      "kojeve", "cRecog", "foucault", "spillers", "mahmood", "mead", "klein", "segal", "cEnvy"
    ]
  },
  {
    id: "cultural-studies",
    label: "Cultural Studies · habitus",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#cultural-studies",
    blurb: "Williams and Hall’s culture-as-material-practice, beside Bourdieu’s habitus / field / cultural capital — and Liu’s later polemic that distinction became virtue-hoarding.",
    nodes: [
      "williamsR", "hall", "bourdieu", "cHabitus", "gramsci", "cHegemony", "althusser", "mcluhan",
      "eagleton", "liu", "cPMC", "lasch", "clrJames"
    ]
  },
  {
    id: "colonial-critique",
    label: "Colonial · decolonial critique",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#colonial-critique",
    blurb: "Hobbes and Locke as social-contract hinges; Du Bois and Césaire before Fanon; then Said, Spivak, Chakrabarty, Mills, Wynter, Quijano, Lugones, Moreton-Robinson — pressure on the Western culture map from inside it, including the settler colony this site is written from.",
    nodes: [
      "hobbes", "locke", "rousseau", "cSocialContract", "dubois", "cDoubleConsciousness", "cesaire", "fanon", "said", "spivak", "chakrabarty", "cProvincializing", "mills", "cRacialContract", "wynter", "mohanty", "anzaldua",
      "quijano", "cColonialityOfPower", "lugones", "moretonRobinson", "cWhitePossessive", "sartre", "hall", "davis", "taussig", "mbembe", "cNecropolitics"
    ]
  },
  {
    id: "black-feminist",
    label: "Black feminist thought",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#davis",
    blurb: "Davis, Lorde · hooks, Collins — abolition, margin-as-theory, outsider-within epistemology; Spillers’s flesh/ungendering as the psychoanalytic cut.",
    nodes: ["davis", "lordeHooks", "collins", "marcuse", "fanon", "hall", "fraser", "spillers", "dubois"]
  },
  {
    id: "recognition",
    label: "Recognition debates",
    home: "Constellations / Genealogies",
    homeHref: "/constellations-of-history.html#habermas-honneth-rosa",
    blurb: "Hegel/Kojève desire-for-recognition through Du Bois’s double consciousness, Honneth, Fraser’s redistribution fight, Lasch’s therapeutic culture, Liu’s PMC polemic, Butler, Copjec’s anti-historicist sex, Mahmood’s pious agency, Benhabib’s situated self, Forst’s justification, Jaeggi’s forms of life — with Klein’s envy as the desire-machine that is not recognition.",
    nodes: [
      "hegel", "cRecog", "kojeve", "cObjetA", "beauvoir", "butler", "copjec", "honneth", "fraser", "habermas",
      "taylor", "dubois", "cDoubleConsciousness", "fanon", "benhabib", "forst", "jaeggi", "cJustification", "cFormsOfLife", "rosa",
      "liu", "cPMC", "lasch", "cNarcissism", "mahmood", "girard", "cMimesis", "mead", "taussig",
      "klein", "cEnvy"
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
      "bostrom", "berardiDean", "derrida", "bateson"
    ]
  },
  {
    id: "techne",
    label: "Techne · Gestell · organology",
    home: "Technics and Time",
    homeHref: "/technics-and-time.html",
    blurb: "Aristotle’s techne through Heidegger’s Gestell, Simondon, Stiegler’s pharmacology, Hui’s cosmotechnics — with Merchant, Hayles, and Chun as feminist/STS foils, Clark’s extended mind as the Anglophone rhyme.",
    nodes: [
      "aristotleTech", "heideggerGestell", "cTechneGestell", "simondon", "stiegler", "cPharmakon",
      "clark", "yukHui", "cCosmotech", "merchant", "hayles", "chun", "haraway", "plant", "mcluhan", "heidegger"
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
    blurb: "Lukács, Gramsci, Luxemburg, Weimar circle, Anderson’s naming — pressed by C.L.R. James’s Black Jacobins and Robinson’s racial capitalism.",
    nodes: [
      "luxemburg", "lukacs", "gramsci", "cReif", "cHegemony", "benjamin", "bloch", "brecht",
      "kracauer", "scholem", "arendt", "weil", "adorno", "debord", "anderson", "jameson",
      "marx", "clrJames", "robinson", "cRacialCapitalism"
    ]
  },
  {
    id: "mimesis-cybernetics",
    label: "Mimesis · culture · schismogenesis",
    home: "Genealogies of Desire",
    homeHref: "/genealogies-of-desire.html#mead-bateson-girard",
    blurb: "Mead and Benedict’s culture-and-personality, Bateson’s schismogenesis / plateau, Girard’s mimetic desire and scapegoat, and Taussig’s Benjaminian mimesis-and-alterity as the late ethnographic brake on Girard’s universal — beside Kojève, against Freud’s Oedipus, rival to Anti-Oedipus in 1972.",
    nodes: [
      "mead", "benedict", "bateson", "girard", "taussig", "cMimesis", "cMimeticFaculty", "malinowski",
      "kojeve", "cRecog", "lacan", "dg", "freud", "structImp", "bataille", "nietzsche",
      "federici", "spillers", "beauvoir", "benjamin", "marx", "said"
    ]
  },
  {
    id: "pmc-virtue",
    label: "PMC · virtue hoarding",
    home: "Constellations of History",
    homeHref: "/constellations-of-history.html#liu",
    blurb: "Ehrenreichs’ 1977 PMC via Kracauer; Lasch’s narcissism and revolt of the elites; Bourdieu’s distinction; Fraser’s redistribution insistence — Liu’s polemic that the credentialed left hoards virtue while blocking class politics.",
    nodes: [
      "kracauer", "cPMC", "anderson", "hall", "bourdieu", "cHabitus", "fraser", "lasch",
      "cNarcissism", "liu", "adorno", "weeks", "fromm", "taylor"
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
