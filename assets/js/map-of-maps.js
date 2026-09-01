/* Thinkers Timeline — single chronological timeline with lineage edges.
   year ≈ when active, or a key work (illustrative, not biographical precision). */

const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const pal = dark
  ? { ink: "#D8DFEC", muted: "#8A96AE", cyan: "#3BC1D6", violet: "#A987F5", gold: "#D9B15E", rose: "#E08A9A", line: "rgba(255,255,255,0.28)", panel: "rgba(20,28,48,0.92)", softG: "#3BC1D629", softV: "#A987F529", softGo: "#D9B15E2E", softR: "#E08A9A29" }
  : { ink: "#161C28", muted: "#58627A", cyan: "#0E7F94", violet: "#6B46C1", gold: "#9C6F1C", rose: "#A84D5C", line: "rgba(20,28,48,0.28)", panel: "rgba(255,255,255,0.94)", softG: "#0E7F941F", softV: "#6B46C11F", softGo: "#9C6F1C24", softR: "#A84D5C1F" };

const HREF = {
  grounding: "/grounding-the-unconscious.html",
  genealogies: "/genealogies-of-desire.html",
  constellations: "/constellations-of-history.html",
  techne: "/technics-and-time.html",
  concept: null
};

const GROUP_LABELS = {
  grounding: "Grounding the Unconscious",
  genealogies: "Genealogies of Desire",
  constellations: "Constellations of History",
  techne: "Technics and Time",
  concept: "Shared concepts"
};

/** @type {{id:string,name:string,sub:string,group:string,year:number,href?:string,approx?:boolean}[]} */
const NODES = [
  { id: "nearEastDream", name: "Egyptian · Mesopotamian", sub: "dream books · omens", group: "grounding", year: -1200, href: "/grounding-the-unconscious.html#near-east-dreams", approx: true },
  { id: "zoroaster", name: "Zoroaster", sub: "truth · the lie", group: "grounding", year: -1000, href: "/grounding-the-unconscious.html#zoroaster", approx: true },
  { id: "upanishads", name: "Upanishads", sub: "avidya · desire", group: "grounding", year: -700, href: "/grounding-the-unconscious.html#upanishads", approx: true },
  { id: "confucius", name: "Confucius", sub: "self-cultivation", group: "grounding", year: -500, href: "/grounding-the-unconscious.html#confucius", approx: true },
  { id: "laozi", name: "Laozi", sub: "Dao · wu wei", group: "grounding", year: -500, href: "/grounding-the-unconscious.html#laozi", approx: true },
  { id: "heraclitus", name: "Heraclitus", sub: "logos · psyche", group: "grounding", year: -500, href: "/grounding-the-unconscious.html#presocratics", approx: true },
  { id: "buddha", name: "Buddha", sub: "craving · dependent origination", group: "grounding", year: -480, href: "/grounding-the-unconscious.html#buddha", approx: true },
  { id: "parmenides", name: "Parmenides", sub: "Being · doxa", group: "grounding", year: -475, href: "/grounding-the-unconscious.html#parmenides", approx: true },
  { id: "empedocles", name: "Empedocles", sub: "Love · Strife", group: "grounding", year: -444, href: "/grounding-the-unconscious.html#presocratics", approx: true },
  { id: "democritus", name: "Democritus", sub: "atoms · void", group: "grounding", year: -420, href: "/grounding-the-unconscious.html#democritus", approx: true },
  { id: "socrates", name: "Socrates", sub: "know thyself · daimonion", group: "grounding", year: -399, href: "/grounding-the-unconscious.html#socrates", approx: true },
  { id: "platoAr", name: "Plato · Aristotle", sub: "akrasia", group: "grounding", year: -375, href: "/grounding-the-unconscious.html#plato-aristotle", approx: true },
  { id: "artemid", name: "Artemidorus", sub: "dream interpretation", group: "grounding", year: 150, href: "/grounding-the-unconscious.html#prehistory", approx: true },
  { id: "descartes", name: "Descartes", sub: "cogito · dualism", group: "grounding", year: 1641, href: "/grounding-the-unconscious.html#descartes" },
  { id: "spinoza", name: "Spinoza", sub: "desire w/o knowing why", group: "grounding", year: 1677, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "leibniz", name: "Leibniz", sub: "petites perceptions", group: "grounding", year: 1704, href: "/grounding-the-unconscious.html#prehistory", approx: true },
  { id: "kant", name: "Kant", sub: "synthetic a priori", group: "genealogies", year: 1781, href: "/genealogies-of-desire.html#kant-hegel" },
  { id: "cRecog", name: "desire & recognition", sub: "", group: "concept", year: 1807, href: "/genealogies-of-desire.html#gloss-recognition" },
  { id: "hegel", name: "Hegel", sub: "lordship and bondage", group: "genealogies", year: 1807, href: "/genealogies-of-desire.html#kant-hegel" },
  { id: "schopen", name: "Schopenhauer", sub: "the Will", group: "grounding", year: 1819, href: "/grounding-the-unconscious.html#prehistory", approx: true },
  { id: "herbart", name: "Herbart", sub: "dynamic psychology", group: "grounding", year: 1824, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "cIdeology", name: "ideology", sub: "", group: "concept", year: 1846, href: "/genealogies-of-desire.html#gloss-ideology" },
  { id: "marx", name: "Marx", sub: "base & superstructure", group: "genealogies", year: 1859, href: "/genealogies-of-desire.html#freud-marx" },
  { id: "fechner", name: "Fechner", sub: "constancy principle", group: "grounding", year: 1860, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "vonHart", name: "von Hartmann", sub: "Philosophy of the Unconscious", group: "grounding", year: 1869, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "cGenMethod", name: "genealogy as method", sub: "", group: "concept", year: 1887, href: "/genealogies-of-desire.html#gloss-genealogy" },
  { id: "nietzsche", name: "Nietzsche", sub: "genealogy as method", group: "genealogies", year: 1887, href: "/genealogies-of-desire.html#nietzsche" },
  { id: "charJan", name: "Charcot · Janet", sub: "hysteria, dissociation", group: "grounding", year: 1890, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "james", name: "William James", sub: "stream · radical empiricism", group: "grounding", year: 1890, href: "/grounding-the-unconscious.html#james" },
  { id: "cUnconscious", name: "the unconscious / repression", sub: "", group: "concept", year: 1900, href: "/genealogies-of-desire.html#gloss-unconscious" },
  { id: "freud", name: "Freud", sub: "dreams · repression", group: "grounding", year: 1900, href: "/grounding-the-unconscious.html#freud" },
  { id: "bergson", name: "Bergson", sub: "durée · élan vital", group: "genealogies", year: 1907, href: "/genealogies-of-desire.html#bergson" },
  { id: "jung", name: "Jung", sub: "collective unconscious · break with Freud", group: "grounding", year: 1912, href: "/grounding-the-unconscious.html#jung" },
  { id: "spielrein", name: "Sabina Spielrein", sub: "destruction · Freud–Jung hinge", group: "grounding", year: 1912, href: "/grounding-the-unconscious.html#spielrein" },
  { id: "cCollective", name: "collective unconscious / archetype", sub: "", group: "concept", year: 1912, href: "/grounding-the-unconscious.html#gloss-collective" },
  { id: "structImp", name: "Saussure · Jakobson · Lévi-Strauss · Benveniste", sub: "structuralist imports", group: "grounding", year: 1916, href: "/grounding-the-unconscious.html#lacan", approx: true },
  { id: "cReif", name: "reification / commodity fetishism", sub: "", group: "concept", year: 1923, href: "/constellations-of-history.html#gloss-reification" },
  { id: "lukacs", name: "Lukács", sub: "reification", group: "constellations", year: 1923, href: "/constellations-of-history.html#lukacs-gramsci" },
  { id: "heidegger", name: "Heidegger", sub: "Being and Time · Dasein", group: "genealogies", year: 1927, href: "/genealogies-of-desire.html#heidegger" },
  { id: "kracauer", name: "Kracauer", sub: "mass ornament", group: "constellations", year: 1927, href: "/constellations-of-history.html#weimar-circle" },
  { id: "malinowski", name: "Malinowski", sub: "Trobriand fieldwork", group: "grounding", year: 1927, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "mead", name: "Margaret Mead", sub: "culture and personality · Samoa", group: "genealogies", year: 1928, href: "/genealogies-of-desire.html#mead" },
  { id: "benedict", name: "Ruth Benedict", sub: "Patterns of Culture", group: "genealogies", year: 1934, href: "/genealogies-of-desire.html#benedict" },
  { id: "brecht", name: "Brecht", sub: "epic theater", group: "constellations", year: 1930, href: "/constellations-of-history.html#weimar-circle" },
  { id: "cHegemony", name: "hegemony", sub: "", group: "concept", year: 1930, href: "/constellations-of-history.html#gloss-hegemony", approx: true },
  { id: "gramsci", name: "Gramsci", sub: "hegemony", group: "constellations", year: 1930, href: "/constellations-of-history.html#lukacs-gramsci", approx: true },
  { id: "reich", name: "Reich", sub: "character armor", group: "genealogies", year: 1933, href: "/genealogies-of-desire.html#reich" },
  { id: "bloch", name: "Bloch", sub: "non-synchronism", group: "constellations", year: 1935, href: "/constellations-of-history.html#weimar-circle" },
  { id: "benjamin", name: "Benjamin", sub: "aura · dialectical image", group: "constellations", year: 1936, href: "/constellations-of-history.html#benjamin" },
  { id: "bateson", name: "Gregory Bateson", sub: "schismogenesis · plateau", group: "genealogies", year: 1936, href: "/genealogies-of-desire.html#bateson" },
  { id: "kojeve", name: "Kojève", sub: "desire for recognition", group: "genealogies", year: 1939, href: "/genealogies-of-desire.html#kojeve" },
  { id: "fromm", name: "Fromm", sub: "escape from freedom", group: "genealogies", year: 1941, href: "/genealogies-of-desire.html#fromm" },
  { id: "scholem", name: "Scholem", sub: "Kabbalah · messianism", group: "constellations", year: 1941, href: "/constellations-of-history.html#weimar-circle" },
  { id: "sartre", name: "Sartre", sub: "Being and Nothingness", group: "constellations", year: 1943, href: "/constellations-of-history.html#sartre" },
  { id: "adorno", name: "Adorno · Horkheimer", sub: "culture industry", group: "genealogies", year: 1947, href: "/genealogies-of-desire.html#adorno" },
  { id: "bataille", name: "Bataille", sub: "expenditure · sovereignty", group: "genealogies", year: 1949, href: "/genealogies-of-desire.html#bataille" },
  { id: "ryle", name: "Ryle", sub: "ghost in the machine", group: "grounding", year: 1949, href: "/consciousness-map.html#ryle" },
  { id: "turing", name: "Turing", sub: "imitation game", group: "grounding", year: 1950, href: "/consciousness-map.html#turing" },
  { id: "eysenck", name: "Eysenck", sub: "efficacy", group: "grounding", year: 1952, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "lacan", name: "Lacan", sub: "seminars · RSI · three periods", group: "grounding", year: 1953, href: "/grounding-the-unconscious.html#lacan" },
  { id: "marcuse", name: "Marcuse", sub: "surplus-repression", group: "genealogies", year: 1955, href: "/genealogies-of-desire.html#marcuse" },
  { id: "williamsR", name: "Raymond Williams", sub: "Culture and Society", group: "constellations", year: 1958, href: "/constellations-of-history.html#cultural-studies" },
  { id: "girard", name: "René Girard", sub: "mimetic desire · scapegoat", group: "genealogies", year: 1961, href: "/genealogies-of-desire.html#girard" },
  { id: "cObjetA", name: "objet a / object-cause", sub: "", group: "concept", year: 1962, href: "/grounding-the-unconscious.html#objet-a" },
  { id: "cMimesis", name: "mimetic desire / scapegoat", sub: "", group: "concept", year: 1961, href: "/genealogies-of-desire.html#gloss-mimetic-desire" },
  { id: "cMimeticFaculty", name: "mimetic faculty (Benjamin)", sub: "", group: "concept", year: 1933, href: "/genealogies-of-desire.html#gloss-mimetic-faculty", approx: true },
  { id: "popper", name: "Popper", sub: "falsifiability", group: "grounding", year: 1963, href: "/grounding-the-unconscious.html#rebuttals", approx: true },
  { id: "mcluhan", name: "Marshall McLuhan", sub: "the medium is the message", group: "constellations", year: 1964, href: "/constellations-of-history.html#mcluhan" },
  { id: "chomLak", name: "Chomsky · Lakoff", sub: "UG · later 'no theory'", group: "grounding", year: 1965, href: "/grounding-the-unconscious.html#chomsky", approx: true },
  { id: "debord", name: "Debord", sub: "society of the spectacle", group: "constellations", year: 1967, href: "/constellations-of-history.html#adorno-debord" },
  { id: "derrida", name: "Derrida", sub: "différance · specters", group: "genealogies", year: 1967, href: "/genealogies-of-desire.html#derrida" },
  { id: "althusser", name: "Althusser", sub: "interpellation", group: "genealogies", year: 1970, href: "/genealogies-of-desire.html#althusser" },
  { id: "ellenb", name: "Ellenberger", sub: "synthesis thesis", group: "grounding", year: 1970, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "dg", name: "Deleuze & Guattari", sub: "desiring-production", group: "genealogies", year: 1972, href: "/genealogies-of-desire.html#dg" },
  { id: "mandel", name: "Ernest Mandel", sub: "late capitalism stages", group: "constellations", year: 1972, href: "/constellations-of-history.html#mandel" },
  { id: "hall", name: "Stuart Hall", sub: "encoding / decoding", group: "constellations", year: 1973, href: "/constellations-of-history.html#cultural-studies" },
  { id: "baudLyo", name: "Baudrillard · Lyotard", sub: "Mirror of Production · libidinal economy", group: "genealogies", year: 1974, href: "/genealogies-of-desire.html#baudrillard-lyotard" },
  { id: "kristeva", name: "Kristeva", sub: "semiotic · Melanie Klein", group: "grounding", year: 1974, href: "/grounding-the-unconscious.html#kristeva" },
  { id: "anderson", name: "Perry Anderson", sub: "periodizes Western Marxism", group: "constellations", year: 1976, href: "/constellations-of-history.html#anderson-harvey-eagleton" },
  { id: "eagleton", name: "Terry Eagleton", sub: "Marxism and Literary Criticism", group: "constellations", year: 1976, href: "/constellations-of-history.html#anderson-harvey-eagleton" },
  { id: "foucault", name: "Foucault", sub: "biopower", group: "genealogies", year: 1976, href: "/genealogies-of-desire.html#foucault" },
  { id: "hobsonMc", name: "Hobson · McCarley", sub: "activation-synthesis", group: "grounding", year: 1977, href: "/grounding-the-unconscious.html#hobson-mccarley" },
  { id: "hofstadter", name: "Hofstadter", sub: "strange loop", group: "grounding", year: 1979, href: "/grounding-the-unconscious.html#hofstadter" },
  { id: "bohm", name: "Bohm", sub: "implicate order · holomovement", group: "grounding", year: 1980, href: "/grounding-the-unconscious.html#bohm" },
  { id: "searle", name: "Searle", sub: "Chinese Room", group: "grounding", year: 1980, href: "/grounding-the-unconscious.html#searle" },
  { id: "habermas", name: "Habermas", sub: "communicative action", group: "constellations", year: 1981, href: "/constellations-of-history.html#habermas" },
  { id: "jackson", name: "Jackson", sub: "Mary's Room", group: "grounding", year: 1982, href: "/grounding-the-unconscious.html#jackson" },
  { id: "grunbaum", name: "Grünbaum", sub: "the tally argument", group: "grounding", year: 1984, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "churchland", name: "P. & P. Churchland", sub: "eliminative materialism", group: "grounding", year: 1986, href: "/grounding-the-unconscious.html#churchland" },
  { id: "gwt", name: "Baars · Dehaene", sub: "global workspace", group: "grounding", year: 1988, href: "/consciousness-map.html#gwt", approx: true },
  { id: "edelman", name: "Edelman", sub: "TNGS · reentry", group: "grounding", year: 1987, href: "/grounding-the-unconscious.html#edelman" },
  { id: "badiou", name: "Badiou", sub: "event · subject of truth", group: "grounding", year: 1988, href: "/grounding-the-unconscious.html#badiou" },
  { id: "harvey", name: "David Harvey", sub: "time-space compression", group: "constellations", year: 1989, href: "/constellations-of-history.html#anderson-harvey-eagleton" },
  { id: "taylor", name: "Charles Taylor", sub: "moral horizons", group: "constellations", year: 1989, href: "/constellations-of-history.html#rosa" },
  { id: "zizek", name: "Žižek", sub: "sublime object", group: "grounding", year: 1989, href: "/grounding-the-unconscious.html#zizek" },
  { id: "copjec", name: "Joan Copjec", sub: "orthopsychic subject · Read My Desire", group: "grounding", year: 1989, href: "/grounding-the-unconscious.html#copjec" },
  { id: "dennett", name: "Dennett", sub: "consciousness explained", group: "grounding", year: 1991, href: "/consciousness-map.html#dennett" },
  { id: "jameson", name: "Jameson", sub: "postmodernism · cognitive mapping", group: "constellations", year: 1991, href: "/constellations-of-history.html#jameson", approx: true },
  { id: "taussig", name: "Michael Taussig", sub: "mimesis and alterity", group: "genealogies", year: 1993, href: "/genealogies-of-desire.html#taussig" },
  { id: "honneth", name: "Honneth", sub: "struggle for recognition", group: "constellations", year: 1992, href: "/constellations-of-history.html#honneth" },
  { id: "benhabib", name: "Seyla Benhabib", sub: "situated self · democratic iterations", group: "constellations", year: 1992, href: "/constellations-of-history.html#benhabib" },
  { id: "damasio", name: "Damasio", sub: "core / autobiographical self", group: "grounding", year: 1994, href: "/grounding-the-unconscious.html#damasio" },
  { id: "crick", name: "Crick", sub: "NCC · claustrum", group: "grounding", year: 1994, href: "/consciousness-map.html#crick" },
  { id: "penrose", name: "Penrose · Hameroff", sub: "Orch OR", group: "grounding", year: 1994, href: "/consciousness-map.html#penrose" },
  { id: "ccruTrio", name: "Eshun · Mackay · Grant", sub: "theory-fiction", group: "genealogies", year: 1995, href: "/genealogies-of-desire.html#warwick-ccru", approx: true },
  { id: "chalmers", name: "Chalmers", sub: "hard problem", group: "grounding", year: 1995, href: "/grounding-the-unconscious.html#chalmers" },
  { id: "cHardProb", name: "the hard problem / subject as gap", sub: "", group: "concept", year: 1995, href: "/grounding-the-unconscious.html#gloss-hard-problem" },
  { id: "block", name: "Block", sub: "access / phenomenal", group: "grounding", year: 1995, href: "/consciousness-map.html#block" },
  { id: "crews", name: "Crews", sub: "Memory Wars · historical critique", group: "grounding", year: 1995, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "sokal", name: "Sokal · Bricmont", sub: "Fashionable Nonsense", group: "grounding", year: 1997, href: "/grounding-the-unconscious.html#chomsky-theory" },
  { id: "land", name: "Nick Land", sub: "diagonalization · Meltdown", group: "genealogies", year: 1995, href: "/genealogies-of-desire.html#land" },
  { id: "ledoux", name: "LeDoux", sub: "fast threat pathway", group: "grounding", year: 1996, href: "/grounding-the-unconscious.html#cognitive-science" },
  { id: "plant", name: "Sadie Plant", sub: "cyberfeminism", group: "genealogies", year: 1997, href: "/genealogies-of-desire.html#plant" },
  { id: "panksepp", name: "Panksepp", sub: "affective neuroscience · SEEKING", group: "grounding", year: 1998, href: "/grounding-the-unconscious.html#panksepp" },
  { id: "miller", name: "Miller-school", sub: "anti-neuro Lacan", group: "grounding", year: 2000, href: "/grounding-the-unconscious.html#dissenters", approx: true },
  { id: "zupancic", name: "Alenka Zupančič", sub: "Ethics of the Real · sexuation", group: "grounding", year: 2000, href: "/grounding-the-unconscious.html#zupancic" },
  { id: "solms", name: "Solms", sub: "SEEKING drives dreaming", group: "grounding", year: 2000, href: "/grounding-the-unconscious.html#solms" },
  { id: "revonsuo", name: "Revonsuo", sub: "threat / social simulation", group: "grounding", year: 2000, href: "/grounding-the-unconscious.html#revonsuo" },
  { id: "domhoff", name: "Domhoff", sub: "neurocognitive / continuity", group: "grounding", year: 2003, href: "/grounding-the-unconscious.html#domhoff" },
  { id: "iit", name: "Tononi · Koch", sub: "integrated information (Φ)", group: "grounding", year: 2004, href: "/consciousness-map.html#iit", approx: true },
  { id: "varela", name: "Varela · Thompson · Rosch", sub: "enactive · Embodied Mind", group: "grounding", year: 1991, href: "/grounding-the-unconscious.html#varela" },
  { id: "strawGoff", name: "Strawson · Goff", sub: "panpsychism", group: "grounding", year: 2006, href: "/grounding-the-unconscious.html#goff", approx: true },
  { id: "malabou", name: "Malabou", sub: "destructive plasticity", group: "grounding", year: 2007, href: "/grounding-the-unconscious.html#malabou" },
  { id: "johnston", name: "Johnston", sub: "transcendental materialism", group: "grounding", year: 2008, href: "/grounding-the-unconscious.html#johnston" },
  { id: "fisher", name: "Mark Fisher", sub: "capitalist realism", group: "genealogies", year: 2009, href: "/genealogies-of-desire.html#fisher" },
  { id: "mcgilchrist", name: "McGilchrist", sub: "Master & Emissary · hemispheres", group: "grounding", year: 2009, href: "/grounding-the-unconscious.html#mcgilchrist" },
  { id: "noys", name: "Benjamin Noys", sub: "names accel · corpse of accel", group: "genealogies", year: 2010, href: "/genealogies-of-desire.html#noys" },
  { id: "han", name: "Byung-Chul Han", sub: "burnout / achievement society", group: "constellations", year: 2010, href: "/constellations-of-history.html#han" },
  { id: "friston", name: "Friston", sub: "predictive processing", group: "grounding", year: 2010, href: "/grounding-the-unconscious.html#seth" },
  { id: "seth", name: "Anil Seth", sub: "beast machine", group: "grounding", year: 2021, href: "/grounding-the-unconscious.html#seth" },
  { id: "barrett", name: "Lisa Feldman Barrett", sub: "constructed emotion", group: "grounding", year: 2017, href: "/grounding-the-unconscious.html#barrett" },
  { id: "weeks", name: "Kathi Weeks", sub: "problem with work · post-work", group: "constellations", year: 2011, href: "/constellations-of-history.html#weeks" },
  { id: "berardiDean", name: "Berardi · Dean", sub: "semiocapitalism", group: "genealogies", year: 2012, href: "/genealogies-of-desire.html#berardi-dean", approx: true },
  { id: "bostrom", name: "Bostrom", sub: "orthogonality thesis", group: "genealogies", year: 2012, href: "/genealogies-of-desire.html#bostrom" },
  { id: "nagel", name: "Nagel", sub: "Mind and Cosmos", group: "grounding", year: 2012, href: "/grounding-the-unconscious.html#nagel" },
  { id: "cSocAccel", name: "social acceleration / dynamic stabilization", sub: "", group: "concept", year: 2005, href: "/constellations-of-history.html#gloss-social-acceleration", approx: true },
  { id: "crary", name: "Jonathan Crary", sub: "24/7 · ends of sleep", group: "constellations", year: 2013, href: "/constellations-of-history.html#crary" },
  { id: "leftAccel", name: "Left-accelerationism", sub: "Srnicek & Williams", group: "genealogies", year: 2013, href: "/genealogies-of-desire.html#left-accelerationism" },
  { id: "rosa", name: "Hartmut Rosa", sub: "social acceleration · resonance", group: "constellations", year: 2005, href: "/constellations-of-history.html#rosa", approx: true },
  { id: "forst", name: "Rainer Forst", sub: "right to justification", group: "constellations", year: 2007, href: "/constellations-of-history.html#forst", approx: true },
  { id: "cJustification", name: "right to justification", sub: "", group: "concept", year: 2007, href: "/constellations-of-history.html#gloss-right-to-justification", approx: true },
  { id: "kastrup", name: "Kastrup", sub: "analytic idealism", group: "grounding", year: 2014, href: "/grounding-the-unconscious.html#kastrup" },
  { id: "albahari", name: "Miri Albahari", sub: "perennial idealism", group: "grounding", year: 2019, href: "/grounding-the-unconscious.html#albahari" },
  { id: "faggin", name: "Faggin", sub: "quantum-info panpsychism", group: "grounding", year: 2021, href: "/grounding-the-unconscious.html#faggin" },
  { id: "jaeggi", name: "Rahel Jaeggi", sub: "critique of forms of life", group: "constellations", year: 2014, href: "/constellations-of-history.html#jaeggi" },
  { id: "cFormsOfLife", name: "forms of life", sub: "", group: "concept", year: 2014, href: "/constellations-of-history.html#gloss-forms-of-life" },
  { id: "acidXeno", name: "Acid Communism / Xenofeminism", sub: "2015–18", group: "genealogies", year: 2016, href: "/genealogies-of-desire.html#connected-strains", approx: true },
  { id: "cResonance", name: "resonance / world-relation", sub: "", group: "concept", year: 2016, href: "/constellations-of-history.html#gloss-resonance" },
  { id: "eacc", name: "e/acc", sub: "effective accelerationism", group: "genealogies", year: 2023, href: "/genealogies-of-desire.html#corpse-of-accelerationism", approx: true },
  { id: "mckerracher", name: "McKerracher", sub: "timenergy", group: "constellations", year: 2023, href: "/constellations-of-history.html#mckerracher" },
  { id: "cTimenergy", name: "timenergy", sub: "", group: "concept", year: 2023, href: "/constellations-of-history.html#gloss-timenergy" },
  { id: "aristotleTech", name: "Aristotle · techne", sub: "making vs phronesis", group: "techne", year: -350, href: "/technics-and-time.html#aristotle-techne", approx: true },
  { id: "cTechneGestell", name: "techne / Gestell", sub: "", group: "concept", year: 1954, href: "/technics-and-time.html#gloss-gestell" },
  { id: "heideggerGestell", name: "Heidegger · Gestell", sub: "enframing · standing-reserve", group: "techne", year: 1954, href: "/technics-and-time.html#heidegger-gestell", approx: true },
  { id: "simondon", name: "Simondon", sub: "technical individuation", group: "techne", year: 1958, href: "/technics-and-time.html#simondon" },
  { id: "stiegler", name: "Stiegler", sub: "tertiary retention · pharmakon", group: "techne", year: 1994, href: "/technics-and-time.html#stiegler" },
  { id: "clark", name: "Andy Clark", sub: "extended mind", group: "techne", year: 1998, href: "/technics-and-time.html#clark" },
  { id: "cPharmakon", name: "pharmacology / tertiary retention", sub: "", group: "concept", year: 1994, href: "/technics-and-time.html#gloss-tertiary" },
  { id: "yukHui", name: "Yuk Hui", sub: "cosmotechnics", group: "techne", year: 2016, href: "/technics-and-time.html#yuk-hui" },
  { id: "cCosmotech", name: "cosmotechnics", sub: "", group: "concept", year: 2016, href: "/technics-and-time.html#gloss-cosmotechnics" },
  { id: "beauvoir", name: "Beauvoir", sub: "Second Sex · becoming-woman", group: "genealogies", year: 1949, href: "/genealogies-of-desire.html#beauvoir" },
  { id: "irigaray", name: "Irigaray", sub: "phallocentric Symbolic", group: "genealogies", year: 1974, href: "/genealogies-of-desire.html#irigaray" },
  { id: "federici", name: "Federici", sub: "Caliban and the Witch", group: "genealogies", year: 2004, href: "/genealogies-of-desire.html#federici" },
  { id: "butler", name: "Butler", sub: "gender performativity", group: "genealogies", year: 1990, href: "/genealogies-of-desire.html#butler" },
  { id: "haraway", name: "Haraway", sub: "cyborg manifesto", group: "genealogies", year: 1985, href: "/genealogies-of-desire.html#haraway" },
  { id: "arendt", name: "Arendt", sub: "Origins of Totalitarianism", group: "constellations", year: 1951, href: "/constellations-of-history.html#arendt" },
  { id: "fanon", name: "Fanon", sub: "Black Skin, White Masks", group: "constellations", year: 1952, href: "/constellations-of-history.html#fanon" },
  { id: "bourdieu", name: "Bourdieu", sub: "habitus · cultural capital", group: "constellations", year: 1979, href: "/constellations-of-history.html#bourdieu" },
  { id: "cHabitus", name: "habitus / cultural capital", sub: "", group: "concept", year: 1979, href: "/constellations-of-history.html#gloss-habitus" },
  { id: "said", name: "Said", sub: "Orientalism", group: "constellations", year: 1978, href: "/constellations-of-history.html#said" },
  { id: "spivak", name: "Spivak", sub: "Can the Subaltern Speak?", group: "constellations", year: 1988, href: "/constellations-of-history.html#spivak" },
  { id: "wynter", name: "Wynter", sub: "after Man · coloniality of being", group: "constellations", year: 2003, href: "/constellations-of-history.html#wynter" },
  { id: "mills", name: "Charles W. Mills", sub: "racial contract", group: "constellations", year: 1997, href: "/constellations-of-history.html#mills" },
  { id: "hobbes", name: "Hobbes", sub: "Leviathan · social contract", group: "constellations", year: 1651, href: "/constellations-of-history.html#hobbes" },
  { id: "locke", name: "Locke", sub: "Second Treatise · property", group: "constellations", year: 1689, href: "/constellations-of-history.html#locke" },
  { id: "rousseau", name: "Rousseau", sub: "Social Contract · general will", group: "constellations", year: 1762, href: "/constellations-of-history.html#rousseau" },
  { id: "voltaire", name: "Voltaire · philosophes", sub: "Candide · Encyclopédie", group: "constellations", year: 1759, href: "/constellations-of-history.html#voltaire", approx: true },
  { id: "reid", name: "Thomas Reid", sub: "common sense · Inquiry", group: "genealogies", year: 1764, href: "/genealogies-of-desire.html#reid" },
  { id: "cRacialContract", name: "racial contract", sub: "", group: "concept", year: 1997, href: "/constellations-of-history.html#gloss-racial-contract" },
  { id: "cSocialContract", name: "social contract", sub: "", group: "concept", year: 1651, href: "/constellations-of-history.html#gloss-social-contract" },
  { id: "cCommonSense", name: "common sense (Reid)", sub: "", group: "concept", year: 1764, href: "/genealogies-of-desire.html#gloss-common-sense" },
  { id: "fraser", name: "Nancy Fraser", sub: "redistribution or recognition", group: "constellations", year: 2003, href: "/constellations-of-history.html#fraser" },
  { id: "cPMC", name: "PMC / virtue hoarding", sub: "", group: "concept", year: 1977, href: "/constellations-of-history.html#gloss-pmc-virtue-hoarding" },
  { id: "liu", name: "Catherine Liu", sub: "PMC · virtue hoarders", group: "constellations", year: 2021, href: "/constellations-of-history.html#liu" },
  { id: "lasch", name: "Christopher Lasch", sub: "culture of narcissism · revolt of elites", group: "constellations", year: 1979, href: "/constellations-of-history.html#lasch" },
  { id: "cNarcissism", name: "culture of narcissism / therapeutic culture", sub: "", group: "concept", year: 1979, href: "/constellations-of-history.html#gloss-culture-of-narcissism" },
  { id: "bauman", name: "Bauman", sub: "liquid modernity · Holocaust", group: "constellations", year: 2000, href: "/constellations-of-history.html#bauman" },
  { id: "weil", name: "Simone Weil", sub: "Need for Roots · poem of force", group: "constellations", year: 1949, href: "/constellations-of-history.html#weil" },
  { id: "firestone", name: "Firestone", sub: "Dialectic of Sex", group: "genealogies", year: 1970, href: "/genealogies-of-desire.html#firestone" },
  { id: "cixous", name: "Cixous", sub: "écriture féminine", group: "genealogies", year: 1975, href: "/genealogies-of-desire.html#cixous" },
  { id: "davis", name: "Angela Davis", sub: "Women, Race & Class", group: "constellations", year: 1981, href: "/constellations-of-history.html#davis" },
  { id: "lordeHooks", name: "Lorde · hooks", sub: "Sister Outsider · margin to center", group: "constellations", year: 1984, href: "/constellations-of-history.html#lorde-hooks", approx: true },
  { id: "collins", name: "Patricia Hill Collins", sub: "Black feminist thought", group: "constellations", year: 1990, href: "/constellations-of-history.html#collins" },
  { id: "hayles", name: "N. Katherine Hayles", sub: "How We Became Posthuman", group: "techne", year: 1999, href: "/technics-and-time.html#hayles" },
  { id: "lugones", name: "María Lugones", sub: "coloniality of gender", group: "constellations", year: 2007, href: "/constellations-of-history.html#lugones" },
  { id: "luxemburg", name: "Rosa Luxemburg", sub: "Accumulation of Capital", group: "constellations", year: 1913, href: "/constellations-of-history.html#luxemburg" },
  { id: "mitchell", name: "Juliet Mitchell", sub: "Psychoanalysis and Feminism", group: "genealogies", year: 1974, href: "/genealogies-of-desire.html#mitchell" },
  { id: "mohanty", name: "Chandra Mohanty", sub: "Under Western Eyes", group: "constellations", year: 1984, href: "/constellations-of-history.html#mohanty" },
  { id: "merchant", name: "Carolyn Merchant", sub: "Death of Nature", group: "techne", year: 1980, href: "/technics-and-time.html#merchant" },
  { id: "anzaldua", name: "Gloria Anzaldúa", sub: "Borderlands / mestiza", group: "constellations", year: 1987, href: "/constellations-of-history.html#anzaldua" },
  { id: "dubois", name: "W.E.B. Du Bois", sub: "double consciousness", group: "constellations", year: 1903, href: "/constellations-of-history.html#dubois" },
  { id: "cDoubleConsciousness", name: "double consciousness", sub: "", group: "concept", year: 1903, href: "/constellations-of-history.html#gloss-double-consciousness" },
  { id: "cesaire", name: "Aimé Césaire", sub: "Discourse on Colonialism · Négritude", group: "constellations", year: 1950, href: "/constellations-of-history.html#cesaire" },
  { id: "clrJames", name: "C.L.R. James", sub: "Black Jacobins", group: "constellations", year: 1938, href: "/constellations-of-history.html#clr-james" },
  { id: "robinson", name: "Cedric Robinson", sub: "racial capitalism · Black Marxism", group: "constellations", year: 1983, href: "/constellations-of-history.html#robinson" },
  { id: "cRacialCapitalism", name: "racial capitalism", sub: "", group: "concept", year: 1983, href: "/constellations-of-history.html#gloss-racial-capitalism" },
  { id: "quijano", name: "Aníbal Quijano", sub: "coloniality of power", group: "constellations", year: 2000, href: "/constellations-of-history.html#quijano" },
  { id: "cColonialityOfPower", name: "coloniality of power", sub: "", group: "concept", year: 2000, href: "/constellations-of-history.html#gloss-coloniality-of-power" },
  { id: "spillers", name: "Hortense Spillers", sub: "flesh · ungendering", group: "genealogies", year: 1987, href: "/genealogies-of-desire.html#spillers" },
  { id: "mahmood", name: "Saba Mahmood", sub: "pious agency · Politics of Piety", group: "genealogies", year: 2005, href: "/genealogies-of-desire.html#mahmood" },
  { id: "klein", name: "Melanie Klein", sub: "play · positions · envy", group: "grounding", year: 1946, href: "/grounding-the-unconscious.html#klein" },
  { id: "cProjectiveId", name: "projective identification", sub: "", group: "concept", year: 1946, href: "/grounding-the-unconscious.html#gloss-projective-identification" },
  { id: "segal", name: "Hanna Segal", sub: "symbol formation", group: "grounding", year: 1957, href: "/grounding-the-unconscious.html#segal" },
  { id: "cEnvy", name: "envy / gratitude", sub: "", group: "concept", year: 1957, href: "/grounding-the-unconscious.html#envy" },
  { id: "moretonRobinson", name: "Aileen Moreton-Robinson", sub: "white possessive · Indigenous sovereignty", group: "constellations", year: 2015, href: "/constellations-of-history.html#moreton-robinson" },
  { id: "cWhitePossessive", name: "white possessive / patriarchal white sovereignty", sub: "", group: "concept", year: 2015, href: "/constellations-of-history.html#gloss-white-possessive" },
  { id: "chakrabarty", name: "Dipesh Chakrabarty", sub: "provincializing Europe", group: "constellations", year: 2000, href: "/constellations-of-history.html#chakrabarty" },
  { id: "cProvincializing", name: "provincializing Europe", sub: "", group: "concept", year: 2000, href: "/constellations-of-history.html#gloss-provincializing-europe" },
  { id: "mbembe", name: "Achille Mbembe", sub: "necropolitics", group: "genealogies", year: 2003, href: "/genealogies-of-desire.html#mbembe" },
  { id: "cNecropolitics", name: "necropolitics", sub: "", group: "concept", year: 2003, href: "/genealogies-of-desire.html#gloss-necropolitics" },
  { id: "chun", name: "Wendy Hui Kyong Chun", sub: "software as memory · discriminating data", group: "techne", year: 2011, href: "/technics-and-time.html#chun" }
];

/** kind: build | critique | parallel | callback */
const EDGES = [
  { from: "spinoza", to: "freud", kind: "build" },
  { from: "leibniz", to: "freud", kind: "build" },
  { from: "herbart", to: "freud", kind: "build" },
  { from: "schopen", to: "freud", kind: "build" },
  { from: "vonHart", to: "freud", kind: "build" },
  { from: "nearEastDream", to: "artemid", kind: "build" },
  { from: "nearEastDream", to: "freud", kind: "build" },
  { from: "zoroaster", to: "nietzsche", kind: "parallel" },
  { from: "zoroaster", to: "freud", kind: "parallel" },
  { from: "upanishads", to: "schopen", kind: "build" },
  { from: "upanishads", to: "buddha", kind: "parallel" },
  { from: "confucius", to: "socrates", kind: "parallel" },
  { from: "laozi", to: "heraclitus", kind: "parallel" },
  { from: "buddha", to: "schopen", kind: "build" },
  { from: "heraclitus", to: "platoAr", kind: "build" },
  { from: "parmenides", to: "platoAr", kind: "build" },
  { from: "empedocles", to: "platoAr", kind: "build" },
  { from: "empedocles", to: "freud", kind: "parallel" },
  { from: "democritus", to: "platoAr", kind: "critique" },
  { from: "democritus", to: "churchland", kind: "build" },
  { from: "democritus", to: "descartes", kind: "critique" },
  { from: "socrates", to: "platoAr", kind: "build" },
  { from: "socrates", to: "freud", kind: "build" },
  { from: "platoAr", to: "freud", kind: "build" },
  { from: "artemid", to: "freud", kind: "build" },
  { from: "descartes", to: "spinoza", kind: "critique" },
  { from: "descartes", to: "kant", kind: "critique" },
  { from: "descartes", to: "chalmers", kind: "build" },
  { from: "descartes", to: "cHardProb", kind: "build" },
  { from: "descartes", to: "hofstadter", kind: "critique" },
  { from: "heidegger", to: "kojeve", kind: "build" },
  { from: "heidegger", to: "sartre", kind: "build" },
  { from: "kojeve", to: "bataille", kind: "critique" },
  { from: "bataille", to: "land", kind: "build" },
  { from: "bataille", to: "baudLyo", kind: "build" },
  { from: "sartre", to: "jameson", kind: "build" },
  { from: "sartre", to: "anderson", kind: "build" },
  { from: "mandel", to: "jameson", kind: "build" },
  { from: "derrida", to: "fisher", kind: "build" },
  { from: "derrida", to: "foucault", kind: "parallel" },
  { from: "badiou", to: "johnston", kind: "critique" },
  { from: "badiou", to: "zizek", kind: "parallel" },
  { from: "panksepp", to: "solms", kind: "build" },
  { from: "panksepp", to: "freud", kind: "build" },
  { from: "panksepp", to: "johnston", kind: "build" },
  { from: "land", to: "bostrom", kind: "critique" },
  { from: "charJan", to: "freud", kind: "build" },
  { from: "fechner", to: "freud", kind: "build" },
  { from: "ellenb", to: "freud", kind: "critique" },
  { from: "nietzsche", to: "freud", kind: "build" },
  { from: "nietzsche", to: "jung", kind: "build" },
  { from: "schopen", to: "jung", kind: "build" },
  { from: "freud", to: "jung", kind: "critique" },
  { from: "jung", to: "cCollective", kind: "build" },
  { from: "spielrein", to: "freud", kind: "build" },
  { from: "spielrein", to: "jung", kind: "build" },
  { from: "popper", to: "freud", kind: "critique" },
  { from: "grunbaum", to: "freud", kind: "critique" },
  { from: "crews", to: "freud", kind: "critique" },
  { from: "eysenck", to: "freud", kind: "critique" },
  { from: "malinowski", to: "freud", kind: "critique" },
  { from: "malinowski", to: "mead", kind: "parallel" },
  { from: "mead", to: "freud", kind: "critique" },
  { from: "mead", to: "bateson", kind: "parallel" },
  { from: "mead", to: "beauvoir", kind: "parallel" },
  { from: "benedict", to: "mead", kind: "parallel" },
  { from: "benedict", to: "freud", kind: "critique" },
  { from: "bateson", to: "dg", kind: "build" },
  { from: "bateson", to: "girard", kind: "parallel" },
  { from: "kojeve", to: "girard", kind: "critique" },
  { from: "girard", to: "cRecog", kind: "critique" },
  { from: "girard", to: "cMimesis", kind: "build" },
  { from: "lacan", to: "girard", kind: "parallel" },
  { from: "girard", to: "dg", kind: "parallel" },
  { from: "girard", to: "freud", kind: "critique" },
  { from: "bataille", to: "girard", kind: "critique" },
  { from: "structImp", to: "girard", kind: "critique" },
  { from: "nietzsche", to: "girard", kind: "parallel" },
  { from: "federici", to: "girard", kind: "critique" },
  { from: "spillers", to: "girard", kind: "critique" },
  { from: "benjamin", to: "cMimeticFaculty", kind: "build" },
  { from: "cMimeticFaculty", to: "taussig", kind: "build" },
  { from: "taussig", to: "girard", kind: "critique" },
  { from: "taussig", to: "cMimesis", kind: "critique" },
  { from: "mead", to: "taussig", kind: "parallel" },
  { from: "marx", to: "taussig", kind: "build" },
  { from: "said", to: "taussig", kind: "parallel" },
  { from: "spillers", to: "taussig", kind: "parallel" },
  { from: "freud", to: "lacan", kind: "build" },
  { from: "kojeve", to: "lacan", kind: "build" },
  { from: "kant", to: "lacan", kind: "build" },
  { from: "structImp", to: "lacan", kind: "build" },
  { from: "lacan", to: "cObjetA", kind: "build" },
  { from: "kristeva", to: "lacan", kind: "critique" },
  { from: "chomLak", to: "structImp", kind: "critique" },
  { from: "chomLak", to: "lacan", kind: "critique" },
  { from: "chomLak", to: "zizek", kind: "critique" },
  { from: "sokal", to: "lacan", kind: "critique" },
  { from: "sokal", to: "kristeva", kind: "critique" },
  { from: "hegel", to: "zizek", kind: "build" },
  { from: "lacan", to: "zizek", kind: "build" },
  { from: "cObjetA", to: "zizek", kind: "build" },
  { from: "kant", to: "copjec", kind: "build" },
  { from: "lacan", to: "copjec", kind: "build" },
  { from: "copjec", to: "zizek", kind: "parallel" },
  { from: "copjec", to: "butler", kind: "critique" },
  { from: "irigaray", to: "copjec", kind: "parallel" },
  { from: "lacan", to: "zupancic", kind: "build" },
  { from: "zizek", to: "zupancic", kind: "parallel" },
  { from: "copjec", to: "zupancic", kind: "parallel" },
  { from: "kant", to: "zupancic", kind: "build" },
  { from: "hegel", to: "zupancic", kind: "build" },
  { from: "cObjetA", to: "copjec", kind: "parallel" },
  { from: "zizek", to: "johnston", kind: "build" },
  { from: "johnston", to: "edelman", kind: "build" },
  { from: "johnston", to: "malabou", kind: "critique" },
  { from: "edelman", to: "malabou", kind: "parallel" },
  { from: "freud", to: "edelman", kind: "build" },
  { from: "freud", to: "damasio", kind: "build" },
  { from: "friston", to: "freud", kind: "build" },
  { from: "ledoux", to: "freud", kind: "build" },
  { from: "churchland", to: "freud", kind: "critique" },
  { from: "hofstadter", to: "zizek", kind: "parallel" },
  { from: "searle", to: "hofstadter", kind: "critique" },
  { from: "turing", to: "hofstadter", kind: "build" },
  { from: "turing", to: "searle", kind: "critique" },
  { from: "ryle", to: "dennett", kind: "build" },
  { from: "dennett", to: "churchland", kind: "parallel" },
  { from: "dennett", to: "chalmers", kind: "critique" },
  { from: "dennett", to: "hofstadter", kind: "parallel" },
  { from: "crick", to: "churchland", kind: "parallel" },
  { from: "crick", to: "gwt", kind: "parallel" },
  { from: "gwt", to: "dennett", kind: "parallel" },
  { from: "penrose", to: "hofstadter", kind: "critique" },
  { from: "penrose", to: "chalmers", kind: "critique" },
  { from: "penrose", to: "bohm", kind: "parallel" },
  { from: "penrose", to: "faggin", kind: "parallel" },
  { from: "block", to: "chalmers", kind: "parallel" },
  { from: "edelman", to: "iit", kind: "build" },
  { from: "iit", to: "chalmers", kind: "critique" },
  { from: "freud", to: "hobsonMc", kind: "callback" },
  { from: "hobsonMc", to: "solms", kind: "critique" },
  { from: "hobsonMc", to: "revonsuo", kind: "critique" },
  { from: "freud", to: "revonsuo", kind: "critique" },
  { from: "solms", to: "revonsuo", kind: "parallel" },
  { from: "revonsuo", to: "domhoff", kind: "parallel" },
  { from: "solms", to: "domhoff", kind: "parallel" },
  { from: "hobsonMc", to: "domhoff", kind: "parallel" },
  { from: "zizek", to: "chalmers", kind: "parallel" },
  { from: "chalmers", to: "jackson", kind: "parallel" },
  { from: "chalmers", to: "nagel", kind: "parallel" },
  { from: "chalmers", to: "strawGoff", kind: "critique" },
  { from: "strawGoff", to: "kastrup", kind: "build" },
  { from: "strawGoff", to: "faggin", kind: "build" },
  { from: "bohm", to: "faggin", kind: "parallel" },
  { from: "bohm", to: "strawGoff", kind: "parallel" },
  { from: "bohm", to: "cHardProb", kind: "build" },
  { from: "faggin", to: "cHardProb", kind: "build" },
  { from: "heidegger", to: "mcgilchrist", kind: "build" },
  { from: "bohm", to: "mcgilchrist", kind: "parallel" },
  { from: "strawGoff", to: "mcgilchrist", kind: "parallel" },
  { from: "mcgilchrist", to: "faggin", kind: "parallel" },
  { from: "mcgilchrist", to: "kastrup", kind: "parallel" },
  { from: "mcgilchrist", to: "cHardProb", kind: "build" },
  { from: "mcgilchrist", to: "dennett", kind: "critique" },
  { from: "mcgilchrist", to: "turing", kind: "critique" },
  { from: "penrose", to: "mcgilchrist", kind: "parallel" },
  { from: "lacan", to: "miller", kind: "critique" },
  { from: "miller", to: "johnston", kind: "critique" },
  { from: "kant", to: "hegel", kind: "build" },
  { from: "hegel", to: "kojeve", kind: "build" },
  { from: "nietzsche", to: "foucault", kind: "build" },
  { from: "freud", to: "reich", kind: "build" },
  { from: "marx", to: "adorno", kind: "build" },
  { from: "kojeve", to: "dg", kind: "critique" },
  { from: "kojeve", to: "baudLyo", kind: "build" },
  { from: "bergson", to: "dg", kind: "build" },
  { from: "althusser", to: "dg", kind: "build" },
  { from: "foucault", to: "reich", kind: "critique" },
  { from: "foucault", to: "marcuse", kind: "critique" },
  { from: "dg", to: "land", kind: "build" },
  { from: "land", to: "fisher", kind: "build" },
  { from: "marcuse", to: "fisher", kind: "callback" },
  { from: "reich", to: "adorno", kind: "parallel" },
  { from: "adorno", to: "marcuse", kind: "parallel" },
  { from: "marcuse", to: "fromm", kind: "parallel" },
  { from: "plant", to: "acidXeno", kind: "build" },
  { from: "land", to: "noys", kind: "critique" },
  { from: "dg", to: "noys", kind: "critique" },
  { from: "baudLyo", to: "noys", kind: "critique" },
  { from: "noys", to: "leftAccel", kind: "critique" },
  { from: "fisher", to: "noys", kind: "parallel" },
  { from: "land", to: "leftAccel", kind: "critique" },
  { from: "land", to: "eacc", kind: "build" },
  { from: "noys", to: "eacc", kind: "critique" },
  { from: "nietzsche", to: "eacc", kind: "parallel" },
  { from: "ccruTrio", to: "leftAccel", kind: "build" },
  { from: "ccruTrio", to: "berardiDean", kind: "parallel" },
  { from: "fisher", to: "berardiDean", kind: "parallel" },
  { from: "jameson", to: "fisher", kind: "build" },
  { from: "zizek", to: "jameson", kind: "build" },
  { from: "adorno", to: "benjamin", kind: "critique" },
  { from: "benjamin", to: "debord", kind: "build" },
  { from: "benjamin", to: "mcluhan", kind: "build" },
  { from: "debord", to: "mcluhan", kind: "parallel" },
  { from: "williamsR", to: "mcluhan", kind: "critique" },
  { from: "lukacs", to: "debord", kind: "build" },
  { from: "althusser", to: "hall", kind: "build" },
  { from: "lukacs", to: "brecht", kind: "critique" },
  { from: "gramsci", to: "hall", kind: "build" },
  { from: "benjamin", to: "bloch", kind: "parallel" },
  { from: "benjamin", to: "brecht", kind: "parallel" },
  { from: "benjamin", to: "scholem", kind: "parallel" },
  { from: "benjamin", to: "kracauer", kind: "parallel" },
  { from: "bloch", to: "williamsR", kind: "build" },
  { from: "benjamin", to: "jameson", kind: "build" },
  { from: "hall", to: "jameson", kind: "build" },
  { from: "anderson", to: "lukacs", kind: "callback" },
  { from: "anderson", to: "gramsci", kind: "callback" },
  { from: "harvey", to: "jameson", kind: "parallel" },
  { from: "williamsR", to: "eagleton", kind: "build" },
  { from: "adorno", to: "habermas", kind: "build" },
  { from: "habermas", to: "honneth", kind: "build" },
  { from: "habermas", to: "benhabib", kind: "build" },
  { from: "habermas", to: "forst", kind: "build" },
  { from: "hegel", to: "honneth", kind: "build" },
  { from: "cRecog", to: "honneth", kind: "build" },
  { from: "honneth", to: "rosa", kind: "build" },
  { from: "honneth", to: "jaeggi", kind: "build" },
  { from: "forst", to: "cJustification", kind: "build" },
  { from: "jaeggi", to: "cFormsOfLife", kind: "build" },
  { from: "jaeggi", to: "rosa", kind: "parallel" },
  { from: "benhabib", to: "fraser", kind: "parallel" },
  { from: "taylor", to: "rosa", kind: "build" },
  { from: "fromm", to: "rosa", kind: "callback" },
  { from: "harvey", to: "rosa", kind: "parallel" },
  { from: "rosa", to: "fisher", kind: "parallel" },
  { from: "rosa", to: "cSocAccel", kind: "build" },
  { from: "rosa", to: "cResonance", kind: "build" },
  { from: "harvey", to: "cSocAccel", kind: "parallel" },
  { from: "spinoza", to: "cUnconscious", kind: "build" },
  { from: "leibniz", to: "cUnconscious", kind: "build" },
  { from: "herbart", to: "cUnconscious", kind: "build" },
  { from: "schopen", to: "cUnconscious", kind: "build" },
  { from: "vonHart", to: "cUnconscious", kind: "build" },
  { from: "freud", to: "cUnconscious", kind: "build" },
  { from: "reich", to: "cUnconscious", kind: "build" },
  { from: "marcuse", to: "cUnconscious", kind: "build" },
  { from: "friston", to: "cUnconscious", kind: "build" },
  { from: "foucault", to: "cUnconscious", kind: "critique" },
  { from: "marx", to: "cIdeology", kind: "build" },
  { from: "althusser", to: "cIdeology", kind: "build" },
  { from: "zizek", to: "cIdeology", kind: "build" },
  { from: "hall", to: "cIdeology", kind: "build" },
  { from: "jameson", to: "cIdeology", kind: "build" },
  { from: "hegel", to: "cRecog", kind: "build" },
  { from: "kojeve", to: "cRecog", kind: "build" },
  { from: "lacan", to: "cRecog", kind: "build" },
  { from: "dg", to: "cRecog", kind: "critique" },
  { from: "marx", to: "cReif", kind: "build" },
  { from: "lukacs", to: "cReif", kind: "build" },
  { from: "jameson", to: "cReif", kind: "build" },
  { from: "debord", to: "cReif", kind: "build" },
  { from: "chalmers", to: "cHardProb", kind: "build" },
  { from: "zizek", to: "cHardProb", kind: "build" },
  { from: "johnston", to: "cHardProb", kind: "build" },
  { from: "nagel", to: "cHardProb", kind: "build" },
  { from: "strawGoff", to: "cHardProb", kind: "build" },
  { from: "kastrup", to: "cHardProb", kind: "build" },
  { from: "kastrup", to: "albahari", kind: "parallel" },
  { from: "strawGoff", to: "albahari", kind: "parallel" },
  { from: "buddha", to: "albahari", kind: "callback" },
  { from: "albahari", to: "cHardProb", kind: "build" },
  { from: "james", to: "freud", kind: "parallel" },
  { from: "james", to: "cUnconscious", kind: "build" },
  { from: "james", to: "kastrup", kind: "build" },
  { from: "leibniz", to: "james", kind: "build" },
  { from: "descartes", to: "varela", kind: "critique" },
  { from: "searle", to: "varela", kind: "parallel" },
  { from: "varela", to: "mcgilchrist", kind: "parallel" },
  { from: "varela", to: "seth", kind: "critique" },
  { from: "friston", to: "seth", kind: "build" },
  { from: "seth", to: "crick", kind: "parallel" },
  { from: "seth", to: "dennett", kind: "parallel" },
  { from: "seth", to: "gwt", kind: "parallel" },
  { from: "friston", to: "barrett", kind: "parallel" },
  { from: "seth", to: "barrett", kind: "build" },
  { from: "barrett", to: "damasio", kind: "parallel" },
  { from: "chalmers", to: "clark", kind: "build" },
  { from: "stiegler", to: "clark", kind: "parallel" },
  { from: "clark", to: "hayles", kind: "parallel" },
  { from: "clark", to: "friston", kind: "parallel" },
  { from: "jackson", to: "cHardProb", kind: "build" },
  { from: "miller", to: "cHardProb", kind: "critique" },
  { from: "nietzsche", to: "cGenMethod", kind: "build" },
  { from: "foucault", to: "cGenMethod", kind: "build" },
  { from: "fisher", to: "cGenMethod", kind: "build" },
  { from: "gramsci", to: "cHegemony", kind: "build" },
  { from: "hall", to: "cHegemony", kind: "build" },
  { from: "aristotleTech", to: "heideggerGestell", kind: "critique" },
  { from: "heidegger", to: "heideggerGestell", kind: "build" },
  { from: "heideggerGestell", to: "cTechneGestell", kind: "build" },
  { from: "aristotleTech", to: "cTechneGestell", kind: "build" },
  { from: "heideggerGestell", to: "simondon", kind: "critique" },
  { from: "simondon", to: "stiegler", kind: "build" },
  { from: "heideggerGestell", to: "stiegler", kind: "build" },
  { from: "stiegler", to: "cPharmakon", kind: "build" },
  { from: "stiegler", to: "yukHui", kind: "critique" },
  { from: "yukHui", to: "cCosmotech", kind: "build" },
  { from: "heideggerGestell", to: "yukHui", kind: "critique" },
  { from: "mcluhan", to: "heideggerGestell", kind: "parallel" },
  { from: "mcluhan", to: "stiegler", kind: "parallel" },
  { from: "land", to: "stiegler", kind: "parallel" },
  { from: "haraway", to: "stiegler", kind: "parallel" },
  { from: "haraway", to: "plant", kind: "build" },
  { from: "haraway", to: "acidXeno", kind: "build" },
  { from: "kojeve", to: "beauvoir", kind: "build" },
  { from: "hegel", to: "beauvoir", kind: "build" },
  { from: "beauvoir", to: "butler", kind: "build" },
  { from: "lacan", to: "irigaray", kind: "critique" },
  { from: "kristeva", to: "irigaray", kind: "parallel" },
  { from: "foucault", to: "butler", kind: "build" },
  { from: "marcuse", to: "federici", kind: "critique" },
  { from: "marx", to: "federici", kind: "build" },
  { from: "benjamin", to: "arendt", kind: "parallel" },
  { from: "sartre", to: "fanon", kind: "build" },
  { from: "fanon", to: "hall", kind: "build" },
  { from: "cRecog", to: "fanon", kind: "critique" },
  { from: "hall", to: "bourdieu", kind: "parallel" },
  { from: "williamsR", to: "bourdieu", kind: "parallel" },
  { from: "gramsci", to: "bourdieu", kind: "parallel" },
  { from: "adorno", to: "bourdieu", kind: "parallel" },
  { from: "bourdieu", to: "cHabitus", kind: "build" },
  { from: "jameson", to: "said", kind: "critique" },
  { from: "said", to: "spivak", kind: "build" },
  { from: "derrida", to: "spivak", kind: "build" },
  { from: "fanon", to: "wynter", kind: "parallel" },
  { from: "mills", to: "cRacialContract", kind: "build" },
  { from: "hobbes", to: "mills", kind: "critique" },
  { from: "hobbes", to: "locke", kind: "build" },
  { from: "locke", to: "rousseau", kind: "build" },
  { from: "locke", to: "mills", kind: "critique" },
  { from: "rousseau", to: "mills", kind: "critique" },
  { from: "hobbes", to: "cSocialContract", kind: "build" },
  { from: "locke", to: "cSocialContract", kind: "build" },
  { from: "rousseau", to: "cSocialContract", kind: "build" },
  { from: "cSocialContract", to: "cRacialContract", kind: "critique" },
  { from: "locke", to: "voltaire", kind: "parallel" },
  { from: "voltaire", to: "adorno", kind: "critique" },
  { from: "descartes", to: "reid", kind: "critique" },
  { from: "locke", to: "reid", kind: "critique" },
  { from: "reid", to: "kant", kind: "parallel" },
  { from: "reid", to: "cCommonSense", kind: "build" },
  { from: "hall", to: "mills", kind: "parallel" },
  { from: "honneth", to: "fraser", kind: "critique" },
  { from: "butler", to: "fraser", kind: "parallel" },
  { from: "cRecog", to: "fraser", kind: "build" },
  { from: "kracauer", to: "cPMC", kind: "build" },
  { from: "cPMC", to: "liu", kind: "build" },
  { from: "bourdieu", to: "liu", kind: "build" },
  { from: "fraser", to: "liu", kind: "build" },
  { from: "anderson", to: "liu", kind: "parallel" },
  { from: "hall", to: "liu", kind: "critique" },
  { from: "adorno", to: "liu", kind: "parallel" },
  { from: "fromm", to: "lasch", kind: "build" },
  { from: "adorno", to: "lasch", kind: "build" },
  { from: "lasch", to: "cNarcissism", kind: "build" },
  { from: "lasch", to: "liu", kind: "build" },
  { from: "bourdieu", to: "lasch", kind: "parallel" },
  { from: "lasch", to: "taylor", kind: "parallel" },
  { from: "lasch", to: "han", kind: "parallel" },
  { from: "bauman", to: "rosa", kind: "parallel" },
  { from: "bauman", to: "cSocAccel", kind: "parallel" },
  { from: "harvey", to: "bauman", kind: "parallel" },
  { from: "adorno", to: "bauman", kind: "parallel" },
  { from: "fisher", to: "bauman", kind: "parallel" },
  { from: "rosa", to: "weeks", kind: "parallel" },
  { from: "rosa", to: "han", kind: "parallel" },
  { from: "rosa", to: "crary", kind: "parallel" },
  { from: "rosa", to: "mckerracher", kind: "parallel" },
  { from: "federici", to: "weeks", kind: "build" },
  { from: "berardiDean", to: "han", kind: "parallel" },
  { from: "stiegler", to: "crary", kind: "parallel" },
  { from: "mcluhan", to: "crary", kind: "parallel" },
  { from: "weeks", to: "mckerracher", kind: "parallel" },
  { from: "han", to: "mckerracher", kind: "parallel" },
  { from: "crary", to: "mckerracher", kind: "parallel" },
  { from: "fisher", to: "mckerracher", kind: "parallel" },
  { from: "mckerracher", to: "cTimenergy", kind: "build" },
  { from: "benjamin", to: "weil", kind: "parallel" },
  { from: "arendt", to: "weil", kind: "parallel" },
  { from: "marx", to: "weil", kind: "build" },
  { from: "marcuse", to: "firestone", kind: "build" },
  { from: "reich", to: "firestone", kind: "build" },
  { from: "firestone", to: "federici", kind: "parallel" },
  { from: "firestone", to: "haraway", kind: "build" },
  { from: "irigaray", to: "cixous", kind: "parallel" },
  { from: "kristeva", to: "cixous", kind: "parallel" },
  { from: "derrida", to: "cixous", kind: "parallel" },
  { from: "adorno", to: "davis", kind: "build" },
  { from: "marcuse", to: "davis", kind: "build" },
  { from: "fanon", to: "davis", kind: "build" },
  { from: "hall", to: "lordeHooks", kind: "parallel" },
  { from: "davis", to: "lordeHooks", kind: "parallel" },
  { from: "lordeHooks", to: "collins", kind: "build" },
  { from: "davis", to: "collins", kind: "build" },
  { from: "collins", to: "mills", kind: "parallel" },
  { from: "haraway", to: "hayles", kind: "parallel" },
  { from: "stiegler", to: "hayles", kind: "parallel" },
  { from: "wynter", to: "lugones", kind: "parallel" },
  { from: "fanon", to: "lugones", kind: "build" },
  { from: "spivak", to: "lugones", kind: "parallel" },
  { from: "marx", to: "luxemburg", kind: "build" },
  { from: "luxemburg", to: "lukacs", kind: "parallel" },
  { from: "luxemburg", to: "gramsci", kind: "parallel" },
  { from: "freud", to: "mitchell", kind: "build" },
  { from: "marx", to: "mitchell", kind: "build" },
  { from: "lacan", to: "mitchell", kind: "build" },
  { from: "mitchell", to: "irigaray", kind: "parallel" },
  { from: "mitchell", to: "firestone", kind: "parallel" },
  { from: "said", to: "mohanty", kind: "parallel" },
  { from: "spivak", to: "mohanty", kind: "parallel" },
  { from: "mohanty", to: "lordeHooks", kind: "parallel" },
  { from: "aristotleTech", to: "merchant", kind: "critique" },
  { from: "heideggerGestell", to: "merchant", kind: "parallel" },
  { from: "merchant", to: "haraway", kind: "parallel" },
  { from: "merchant", to: "hayles", kind: "parallel" },
  { from: "spivak", to: "anzaldua", kind: "parallel" },
  { from: "fanon", to: "anzaldua", kind: "parallel" },
  { from: "anzaldua", to: "lugones", kind: "build" },
  { from: "anzaldua", to: "mohanty", kind: "parallel" },
  { from: "hegel", to: "dubois", kind: "build" },
  { from: "cRecog", to: "dubois", kind: "build" },
  { from: "dubois", to: "cDoubleConsciousness", kind: "build" },
  { from: "dubois", to: "fanon", kind: "build" },
  { from: "dubois", to: "davis", kind: "parallel" },
  { from: "dubois", to: "robinson", kind: "build" },
  { from: "cesaire", to: "fanon", kind: "build" },
  { from: "sartre", to: "cesaire", kind: "parallel" },
  { from: "cesaire", to: "said", kind: "parallel" },
  { from: "hegel", to: "clrJames", kind: "build" },
  { from: "marx", to: "clrJames", kind: "build" },
  { from: "luxemburg", to: "clrJames", kind: "parallel" },
  { from: "anderson", to: "clrJames", kind: "callback" },
  { from: "clrJames", to: "robinson", kind: "build" },
  { from: "clrJames", to: "fanon", kind: "parallel" },
  { from: "clrJames", to: "hall", kind: "parallel" },
  { from: "clrJames", to: "wynter", kind: "parallel" },
  { from: "marx", to: "robinson", kind: "critique" },
  { from: "anderson", to: "robinson", kind: "critique" },
  { from: "robinson", to: "cRacialCapitalism", kind: "build" },
  { from: "robinson", to: "wynter", kind: "parallel" },
  { from: "quijano", to: "cColonialityOfPower", kind: "build" },
  { from: "quijano", to: "lugones", kind: "build" },
  { from: "wynter", to: "quijano", kind: "parallel" },
  { from: "mills", to: "quijano", kind: "parallel" },
  { from: "lacan", to: "spillers", kind: "critique" },
  { from: "mitchell", to: "spillers", kind: "critique" },
  { from: "irigaray", to: "spillers", kind: "critique" },
  { from: "fanon", to: "spillers", kind: "parallel" },
  { from: "spillers", to: "butler", kind: "parallel" },
  { from: "spillers", to: "lugones", kind: "parallel" },
  { from: "davis", to: "spillers", kind: "parallel" },
  { from: "foucault", to: "mahmood", kind: "build" },
  { from: "butler", to: "mahmood", kind: "critique" },
  { from: "beauvoir", to: "mahmood", kind: "critique" },
  { from: "freud", to: "klein", kind: "build" },
  { from: "spielrein", to: "klein", kind: "build" },
  { from: "klein", to: "lacan", kind: "critique" },
  { from: "klein", to: "cProjectiveId", kind: "build" },
  { from: "klein", to: "cEnvy", kind: "build" },
  { from: "klein", to: "segal", kind: "build" },
  { from: "klein", to: "cObjetA", kind: "parallel" },
  { from: "segal", to: "lacan", kind: "critique" },
  { from: "klein", to: "kristeva", kind: "build" },
  { from: "klein", to: "mitchell", kind: "build" },
  { from: "klein", to: "lasch", kind: "parallel" },
  { from: "cEnvy", to: "cRecog", kind: "critique" },
  { from: "cEnvy", to: "cMimesis", kind: "parallel" },
  { from: "mills", to: "moretonRobinson", kind: "build" },
  { from: "locke", to: "moretonRobinson", kind: "critique" },
  { from: "wynter", to: "moretonRobinson", kind: "parallel" },
  { from: "moretonRobinson", to: "cWhitePossessive", kind: "build" },
  { from: "spivak", to: "chakrabarty", kind: "build" },
  { from: "said", to: "chakrabarty", kind: "parallel" },
  { from: "quijano", to: "chakrabarty", kind: "parallel" },
  { from: "chakrabarty", to: "cProvincializing", kind: "build" },
  { from: "foucault", to: "mbembe", kind: "critique" },
  { from: "fanon", to: "mbembe", kind: "build" },
  { from: "wynter", to: "mbembe", kind: "parallel" },
  { from: "mbembe", to: "cNecropolitics", kind: "build" },
  { from: "stiegler", to: "chun", kind: "parallel" },
  { from: "hayles", to: "chun", kind: "build" },
  { from: "clark", to: "chun", kind: "parallel" },
  { from: "merchant", to: "chun", kind: "parallel" }
];

const NODE_W = 168;
const NODE_H = 52;
const CONCEPT_H = 44;
const COL_W = 200;
const LANE_GAP = 18;
const V_GAP = 12;
const PAD_L = 180;
const PAD_T = 56;
const PAD_R = 40;
const PAD_B = 56;
const AXIS_W = 8;
/** Side-by-side pack density: card width capped so adjacent slots can sit this far apart. */
const SUBLANE_PITCH = 156;
const MAX_NODE_W = SUBLANE_PITCH - 8;

/** Essay tracks keep the diagram wide; collisions prefer horizontal pack, then downward. */
const GROUP_TRACK = { grounding: 0, genealogies: 1, constellations: 2, techne: 3, concept: 4 };
const TRACK_COUNT = 5;

/** Relative base lengths along the time axis (sum = 1). Final spans also grow for peak clusters. */
const YEAR_WEIGHTS = [
  { y0: -1300, y1: -600, w: 0.07 },
  { y0: -600, y1: -300, w: 0.10 },
  { y0: -300, y1: 500, w: 0.06 },
  { y0: 500, y1: 1600, w: 0.04 },
  { y0: 1600, y1: 1850, w: 0.09 },
  { y0: 1850, y1: 1900, w: 0.07 },
  { y0: 1900, y1: 1950, w: 0.15 },
  { y0: 1950, y1: 1980, w: 0.17 },
  { y0: 1980, y1: 2025, w: 0.25 }
];

const TICKS = [-1200, -800, -500, -400, 0, 500, 1000, 1600, 1700, 1800, 1850, 1900, 1925, 1950, 1975, 2000, 2015];

/** Illustrative era washes — layout anchors, not historiography. */
const PERIODS = [
  { id: "axial", label: "Axial & earlier", y0: -1300, y1: -300, fillLight: "rgba(140, 100, 50, 0.11)", fillDark: "rgba(180, 130, 70, 0.13)" },
  { id: "antiquity", label: "Antiquity", y0: -300, y1: 500, fillLight: "rgba(180, 120, 60, 0.10)", fillDark: "rgba(210, 150, 80, 0.12)" },
  { id: "middleAges", label: "Middle Ages", y0: 500, y1: 1400, fillLight: "rgba(90, 110, 140, 0.09)", fillDark: "rgba(120, 140, 170, 0.11)" },
  { id: "renaissance", label: "Renaissance", y0: 1400, y1: 1600, fillLight: "rgba(160, 70, 90, 0.10)", fillDark: "rgba(200, 100, 120, 0.12)" },
  { id: "earlyModern", label: "Early modern", y0: 1600, y1: 1700, fillLight: "rgba(50, 120, 130, 0.10)", fillDark: "rgba(70, 160, 170, 0.12)" },
  { id: "enlightenment", label: "Enlightenment", y0: 1700, y1: 1800, fillLight: "rgba(180, 150, 40, 0.11)", fillDark: "rgba(210, 180, 70, 0.13)" },
  { id: "long19th", label: "Long 19th", y0: 1800, y1: 1900, fillLight: "rgba(100, 80, 150, 0.09)", fillDark: "rgba(140, 120, 200, 0.12)" },
  { id: "early20th", label: "Early 20th", y0: 1900, y1: 1945, fillLight: "rgba(40, 110, 90, 0.10)", fillDark: "rgba(60, 150, 120, 0.12)" },
  { id: "postwar", label: "Postwar", y0: 1945, y1: 1980, fillLight: "rgba(150, 80, 50, 0.09)", fillDark: "rgba(190, 110, 70, 0.12)" },
  { id: "contemporary", label: "Contemporary", y0: 1980, y1: 2025, fillLight: "rgba(50, 90, 160, 0.09)", fillDark: "rgba(80, 130, 210, 0.12)" }
];

function trackOriginX(track) {
  return PAD_L + AXIS_W + 28 + track * (COL_W + LANE_GAP);
}

function contentWidth() {
  // Extra pack lane so dense cross-track clusters can sit 6-abreast
  return trackOriginX(TRACK_COUNT - 1) + COL_W + SUBLANE_PITCH + PAD_R;
}

function packRightLimit() {
  return trackOriginX(TRACK_COUNT - 1) + COL_W + SUBLANE_PITCH;
}

function horizontalSlots() {
  const left = trackOriginX(0);
  return Math.max(TRACK_COUNT, Math.floor((packRightLimit() - left) / SUBLANE_PITCH));
}

/** Peak nodes in a collision-sized year window inside [y0, y1]. */
function peakClusterRows(y0, y1) {
  const years = NODES.filter((n) => n.year >= y0 && n.year <= y1).map((n) => n.year).sort((a, b) => a - b);
  if (!years.length) return 0;
  // Wide enough that cards whose idealYs fall within one row height count as one cluster
  const windowYears = Math.max(20, Math.ceil((y1 - y0) * 0.12));
  let peak = 1;
  for (let i = 0; i < years.length; i++) {
    let j = i;
    while (j + 1 < years.length && years[j + 1] - years[i] <= windowYears) j++;
    peak = Math.max(peak, j - i + 1);
  }
  return Math.ceil(peak / horizontalSlots());
}

/** Time-axis length: base weights, then grow any band that can't fit its densest packed rows. */
function yearSegmentsForViewport(vpW, vpH) {
  const cW = contentWidth();
  const fillWidthH = (vpH * cW) / Math.max(vpW, 1) - PAD_T - PAD_B;
  const readableH = 4200;
  const targetH = Math.max(fillWidthH, readableH);
  const rowPitch = NODE_H + V_GAP;
  let t = 0;
  return YEAR_WEIGHTS.map((seg) => {
    const base = targetH * seg.w;
    const need = peakClusterRows(seg.y0, seg.y1) * rowPitch + V_GAP * 2;
    const span = Math.max(base, need);
    const out = { y0: seg.y0, y1: seg.y1, t0: t, t1: t + span };
    t += span;
    return out;
  });
}

let YEAR_SEGMENTS = yearSegmentsForViewport(1100, 650);

function yearToY(year) {
  for (const s of YEAR_SEGMENTS) {
    if (year <= s.y1) {
      const t = (year - s.y0) / (s.y1 - s.y0);
      return s.t0 + Math.max(0, Math.min(1, t)) * (s.t1 - s.t0);
    }
  }
  return YEAR_SEGMENTS[YEAR_SEGMENTS.length - 1].t1;
}

function formatYear(y, approx) {
  const core = y < 0 ? Math.abs(y) + " BCE" : String(y);
  return approx ? "c. " + core : core;
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function groupStroke(group) {
  if (group === "grounding") return pal.cyan;
  if (group === "genealogies") return pal.violet;
  if (group === "constellations") return pal.gold;
  if (group === "techne") return pal.rose;
  return pal.muted;
}

function groupFill(group) {
  if (group === "grounding") return pal.softG;
  if (group === "genealogies") return pal.softV;
  if (group === "constellations") return pal.softGo;
  if (group === "techne") return pal.softR;
  return "transparent";
}

function rectsOverlap(a, b, pad = 4) {
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
}

/** Prefer home track, then other track columns, then a fine horizontal scan. */
function xCandidatesFor(homeX, nodeW, rightLimit) {
  const left = trackOriginX(0);
  const seen = new Set();
  const xs = [];
  function add(x) {
    const xi = Math.round(x);
    if (xi < left - 1 || xi + nodeW > rightLimit + 1) return;
    if (seen.has(xi)) return;
    seen.add(xi);
    xs.push(xi);
  }
  add(homeX);
  for (let t = 0; t < TRACK_COUNT; t++) add(trackOriginX(t));
  for (let x = left; x + nodeW <= rightLimit + 1; x += SUBLANE_PITCH) add(x);
  // Fine fill for leftover gaps between wide/narrow cards
  for (let x = left; x + nodeW <= rightLimit + 1; x += 24) add(x);
  xs.sort((a, b) => Math.abs(a - homeX) - Math.abs(b - homeX) || a - b);
  return xs;
}

function layoutNodes(nodes) {
  const rightLimit = packRightLimit();
  const prepared = nodes.map((n) => {
    const fitted = fitNodeText(n);
    const idealY = Math.max(PAD_T * 0.35, PAD_T + yearToY(n.year) - fitted.h / 2);
    const track = GROUP_TRACK[n.group] ?? 0;
    return { ...n, ...fitted, idealY, track, homeX: trackOriginX(track) };
  });

  prepared.sort((a, b) => a.year - b.year || a.track - b.track || a.name.localeCompare(b.name));

  const placed = [];
  let maxBottom = 0;
  let maxRight = contentWidth() - PAD_R;

  for (const n of prepared) {
    const xs = xCandidatesFor(n.homeX, n.w, rightLimit);
    let spot = null;

    for (const x of xs) {
      const cand = { x, y: n.idealY, w: n.w, h: n.h };
      if (!placed.some((p) => rectsOverlap(cand, p))) {
        spot = { x, y: n.idealY };
        break;
      }
    }

    if (!spot) {
      let y = n.idealY;
      search: for (let step = 0; step < 280; step++) {
        for (const x of xs) {
          const cand = { x, y, w: n.w, h: n.h };
          if (!placed.some((p) => rectsOverlap(cand, p))) {
            spot = { x, y };
            break search;
          }
        }
        y += 6;
      }
    }

    if (!spot) spot = { x: n.homeX, y: n.idealY };

    const node = {
      ...n,
      x: spot.x,
      y: spot.y,
      cx: spot.x + n.w / 2,
      cy: spot.y + n.h / 2,
      lane: n.track
    };
    placed.push(node);
    maxBottom = Math.max(maxBottom, node.y + node.h);
    maxRight = Math.max(maxRight, node.x + node.w);
  }

  const width = Math.max(contentWidth(), maxRight + PAD_R);
  const height = Math.max(maxBottom + PAD_B, PAD_T + YEAR_SEGMENTS[YEAR_SEGMENTS.length - 1].t1 + PAD_B);
  return { placed, width, height, laneCount: TRACK_COUNT };
}

const NODE_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
const NODE_PAD_X = 16;
const YEAR_BAND = 22;
const LINE_H = 17;
let _measureCtx = null;

function measureText(text, sizePx, weight) {
  if (!_measureCtx) {
    const c = document.createElement("canvas");
    _measureCtx = c.getContext("2d");
  }
  _measureCtx.font = `${weight} ${sizePx}px ${NODE_FONT}`;
  return _measureCtx.measureText(text).width;
}

function hardSplitToWidth(text, maxW, sizePx, weight) {
  if (measureText(text, sizePx, weight) <= maxW) return [text];
  const lines = [];
  let cur = "";
  for (const ch of text) {
    const next = cur + ch;
    if (cur && measureText(next, sizePx, weight) > maxW) {
      lines.push(cur);
      cur = ch;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function spaceWrap(text, maxW, sizePx, weight) {
  if (measureText(text, sizePx, weight) <= maxW) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (cur && measureText(next, sizePx, weight) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.flatMap((ln) => hardSplitToWidth(ln, maxW, sizePx, weight));
}

function wrapToWidth(text, maxW, sizePx, weight) {
  if (!text) return [];
  if (measureText(text, sizePx, weight) <= maxW) return [text];
  const chunks = text.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const chunk of chunks) {
    const next = cur ? cur + " · " + chunk : chunk;
    if (cur && measureText(next, sizePx, weight) > maxW) {
      lines.push(...spaceWrap(cur, maxW, sizePx, weight));
      cur = chunk;
    } else cur = next;
  }
  if (cur) lines.push(...spaceWrap(cur, maxW, sizePx, weight));
  return lines;
}

function fitNodeText(n) {
  const isConcept = n.group === "concept";
  const nameSize = isConcept ? 11 : 12;
  const nameWeight = isConcept ? "500" : "600";
  const innerW = MAX_NODE_W - NODE_PAD_X;
  const lines = wrapToWidth(n.name, innerW, nameSize, nameWeight);
  const subLines = n.sub ? wrapToWidth(n.sub, innerW, 10, "400") : [];
  const longest = Math.max(
    ...lines.map((l) => measureText(l, nameSize, nameWeight)),
    ...subLines.map((l) => measureText(l, 10, "400")),
    isConcept ? 116 : 120
  );
  const w = Math.min(MAX_NODE_W, Math.ceil(longest) + NODE_PAD_X);
  const h = YEAR_BAND + 6 + (lines.length + subLines.length) * LINE_H + 6;
  return { w, h, lines, subLines };
}

function edgePath(a, b) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.hypot(dx, dy) || 1;
  const shortenA = Math.min(a.w, a.h) * 0.42;
  const shortenB = Math.min(b.w, b.h) * 0.42;
  const x1 = a.cx + (dx / dist) * shortenA;
  const y1 = a.cy + (dy / dist) * shortenA;
  const x2 = b.cx - (dx / dist) * shortenB;
  const y2 = b.cy - (dy / dist) * shortenB;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Bow sideways so vertical time-flows don't stack into one line
  const bend = Math.min(90, Math.abs(dy) * 0.1 + 20) * (dx >= 0 ? 1 : -1);
  return `M ${x1} ${y1} Q ${mx + bend} ${my} ${x2} ${y2}`;
}

function edgeStyle(kind) {
  if (kind === "critique") return { dash: "6 4", width: 1.4, color: pal.violet, marker: "url(#arrowCritique)" };
  if (kind === "parallel") return { dash: "2 4", width: 1.3, color: pal.muted, marker: "url(#arrowParallel)" };
  if (kind === "callback") return { dash: null, width: 2.6, color: pal.cyan, marker: "url(#arrowCallback)" };
  return { dash: null, width: 1.5, color: pal.muted, marker: "url(#arrowBuild)" };
}

function buildSvg() {
  const { placed, width, height } = layoutNodes(NODES);
  const byId = Object.fromEntries(placed.map((n) => [n.id, n]));

  const tickYs = TICKS.map((yr) => PAD_T + yearToY(yr));
  const LABEL_CLEAR = 13;
  const usedPeriodLabelYs = [];

  function placePeriodLabelY(y0, y1) {
    const top = y0 + 11;
    const bottom = y1 - 5;
    if (bottom < top) return null;
    let y = top;
    for (let attempt = 0; attempt < 20; attempt++) {
      const hit = usedPeriodLabelYs.find((by) => Math.abs(by - y) < LABEL_CLEAR);
      if (!hit) {
        if (y > bottom) return null;
        usedPeriodLabelYs.push(y);
        return y;
      }
      y = hit + LABEL_CLEAR;
      if (y > bottom) return null;
    }
    return null;
  }

  const periodEls = PERIODS.map((p) => {
    const y0 = PAD_T + yearToY(p.y0);
    const y1 = PAD_T + yearToY(p.y1);
    const h = Math.max(2, y1 - y0);
    const fill = dark ? p.fillDark : p.fillLight;
    // Left gutter column (separate from year ticks at PAD_L); top of band, de-collided with peers
    const labelY = h >= 26 ? placePeriodLabelY(y0, y1) : null;
    const label = labelY != null
      ? `<text class="period-label" x="4" y="${labelY}" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9" letter-spacing="0.02em" opacity="0.78">${escapeXml(p.label)}</text>`
      : "";
    return `<g class="period" data-period="${escapeXml(p.id)}">
      <rect x="${PAD_L}" y="${y0}" width="${width - PAD_L - PAD_R}" height="${h}" fill="${fill}" pointer-events="none"/>
      ${label}
    </g>`;
  }).join("");

  const tickMarks = TICKS.map((yr, i) => {
    const y = tickYs[i];
    return `<g class="tick">
      <line x1="${PAD_L}" y1="${y}" x2="${width - PAD_R}" y2="${y}" stroke="${pal.line}" stroke-width="1" stroke-dasharray="2 6"/>
      <text x="${PAD_L - 8}" y="${y + 4}" text-anchor="end" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11">${escapeXml(formatYear(yr))}</text>
    </g>`;
  }).join("");

  const axis = `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${height - PAD_B}" stroke="${pal.line}" stroke-width="1.5"/>
    <text x="${PAD_L}" y="${PAD_T - 20}" text-anchor="middle" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" letter-spacing="0.06em">TIME ↓</text>`;

  const trackLabels = [
    { i: 0, label: "Grounding" },
    { i: 1, label: "Genealogies" },
    { i: 2, label: "Constellations" },
    { i: 3, label: "Technics" },
    { i: 4, label: "Concepts" }
  ].map(({ i, label }) => {
    const x = trackOriginX(i) + COL_W / 2;
    return `<text x="${x}" y="${PAD_T - 20}" text-anchor="middle" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10" letter-spacing="0.04em">${label}</text>`;
  }).join("");

  const edgeEls = EDGES.map((e) => {
    const a = byId[e.from];
    const b = byId[e.to];
    if (!a || !b) return "";
    const st = edgeStyle(e.kind);
    return `<path class="edge edge-${e.kind}" data-from="${escapeXml(e.from)}" data-to="${escapeXml(e.to)}" d="${edgePath(a, b)}" fill="none" stroke="${st.color}" stroke-width="${st.width}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ""} marker-end="${st.marker}" opacity="0.75"/>`;
  }).join("");

  const nodeEls = placed.map((n) => {
    const isConcept = n.group === "concept";
    const href = n.href || HREF[n.group];
    const stroke = groupStroke(n.group);
    const fill = groupFill(n.group);
    const dash = isConcept ? `stroke-dasharray="4 3"` : "";
    const lines = n.lines || [n.name];
    const subLines = n.subLines || (n.sub ? [n.sub] : []);
    const startY = n.y + YEAR_BAND + 10;
    const nameTs = lines.map((ln, i) => {
      const y = startY + i * LINE_H;
      return `<tspan x="${n.cx}" y="${y}">${escapeXml(ln)}</tspan>`;
    }).join("");
    const subTs = subLines.map((ln, i) => {
      const y = startY + (lines.length + i) * LINE_H;
      return `<tspan x="${n.cx}" y="${y}" fill="${pal.muted}" font-size="10">${escapeXml(ln)}</tspan>`;
    }).join("");
    const yearLabel = `<text x="${n.x + 8}" y="${n.y + 12}" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9">${escapeXml(formatYear(n.year, n.approx))}</text>`;
    const body = `
      <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isConcept ? 14 : 8}" ry="${isConcept ? 14 : 8}"
        fill="${pal.panel}" stroke="none"/>
      <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isConcept ? 14 : 8}" ry="${isConcept ? 14 : 8}"
        fill="${fill}" stroke="none" pointer-events="none"/>
      <rect class="node-box" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isConcept ? 14 : 8}" ry="${isConcept ? 14 : 8}"
        fill="none" stroke="${stroke}" stroke-width="1.6" ${dash}/>
      ${yearLabel}
      <text class="node-label" text-anchor="middle" fill="${pal.ink}"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="${isConcept ? 11 : 12}" font-weight="${isConcept ? 500 : 600}">${nameTs}${subTs}</text>`;
    const tip = `${escapeXml(n.name)}${n.sub ? " — " + escapeXml(n.sub) : ""} · ${escapeXml(formatYear(n.year, n.approx))}${n.approx ? " (approx.)" : ""}`;
    if (href) {
      return `<a class="node" id="node-${n.id}" data-id="${n.id}" href="${escapeXml(href)}" target="_blank" rel="noopener">
        <title>${tip}</title>${body}</a>`;
    }
    return `<g class="node concept" id="node-${n.id}" data-id="${n.id}">
      <title>${tip}</title>${body}</g>`;
  }).join("");

  const markers = `
    <defs>
      <marker id="arrowBuild" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${pal.muted}"/>
      </marker>
      <marker id="arrowCritique" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${pal.violet}"/>
      </marker>
      <marker id="arrowParallel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${pal.muted}"/>
      </marker>
      <marker id="arrowCallback" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${pal.cyan}"/>
      </marker>
    </defs>`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Vertical chronological map of thinkers and concepts">
      ${markers}
      <rect width="${width}" height="${height}" fill="transparent"/>
      <g class="periods">${periodEls}</g>
      ${tickMarks}
      ${axis}
      ${trackLabels}
      <g class="edges">${edgeEls}</g>
      <g class="nodes">${nodeEls}</g>
    </svg>`,
    placed,
    width,
    height
  };
}

function normalizeSearch(str) {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

window.THINKERS_TIMELINE = { NODES, GROUP_LABELS, EDGES, HREF, formatYear };

const statusEl = document.getElementById("mapStatus");
const target = document.getElementById("mmd-target");
const sidebarList = document.getElementById("mapSidebarList");
const searchInput = document.getElementById("mapSearch");

if (!target) {
  /* Data-only load (e.g. philosophy booklet). */
} else {

let panZoomInstance = null;
let layoutPlaced = [];
/** Diagram content size in SVG units — used to clamp pan (svg-pan-zoom viewBox can be unreliable). */
let mapContentSize = { width: 0, height: 0 };
/** all = every lineage; off = hide edges; selected = only the focused thinker's edges. */
let edgeMode = "all";
let selectedId = null;
let ptrDown = null;
const mapShell = document.querySelector(".map-shell");
const hintEl = document.querySelector(".map-toolbar .hint");
const edgeSwitch = document.querySelector(".map-edge-switch");

function centuryBucket(year) {
  if (year < -800) return "Before 800 BCE";
  if (year < 0) return "Antiquity";
  if (year < 1600) return "To 1600";
  if (year < 1800) return "1600s–1700s";
  if (year < 1900) return "1800s";
  if (year < 1950) return "1900–1949";
  if (year < 1980) return "1950–1979";
  if (year < 2000) return "1980–1999";
  return "2000–";
}

function buildSidebar() {
  const frag = document.createDocumentFragment();
  let lastBucket = null;
  const ordered = NODES.slice().sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  for (const n of ordered) {
    const bucket = centuryBucket(n.year);
    if (bucket !== lastBucket) {
      const label = document.createElement("div");
      label.className = "grp-label";
      label.textContent = bucket;
      frag.appendChild(label);
      lastBucket = bucket;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = n.id;
    btn.dataset.filter = normalizeSearch(n.name + " " + n.sub + " " + formatYear(n.year, n.approx) + " " + (GROUP_LABELS[n.group] || ""));
    const yearBit = formatYear(n.year, n.approx);
    btn.textContent = n.sub ? `${yearBit} · ${n.name} — ${n.sub}` : `${yearBit} · ${n.name}`;
    btn.addEventListener("click", () => {
      selectedId = n.id;
      applyEdgeFilter();
      centerOnNode(n.id);
    });
    frag.appendChild(btn);
  }
  sidebarList.appendChild(frag);
}

function centerOnNode(id) {
  if (!panZoomInstance) return;
  const nodeEl = document.getElementById("node-" + id);
  if (!nodeEl) return;

  const svg = target.querySelector("svg");
  const sizes0 = panZoomInstance.getSizes();
  const pan0 = panZoomInstance.getPan();
  const real0 = sizes0.realZoom;
  const svgRect = svg.getBoundingClientRect();
  const nb = nodeEl.getBoundingClientRect();
  const cx = (nb.left + nb.width / 2 - svgRect.left - pan0.x) / real0;
  const cy = (nb.top + nb.height / 2 - svgRect.top - pan0.y) / real0;
  const nodeSpan = Math.max(nb.width / real0, nb.height / real0, 1);

  const rel = panZoomInstance.getZoom() || 1;
  const fitScale = real0 / rel;
  const targetPx = Math.min(sizes0.width, sizes0.height) * 0.5;
  const z = Math.min(Math.max(targetPx / (nodeSpan * fitScale), 3.2), 14);

  panZoomInstance.zoom(z);
  const s = panZoomInstance.getSizes();
  panZoomInstance.pan({
    x: s.width / 2 - cx * s.realZoom,
    y: s.height / 2 - cy * s.realZoom
  });

  nodeEl.classList.add("is-focus");
  setTimeout(() => nodeEl.classList.remove("is-focus"), 1200);
}

function updateStatus() {
  const base = `${NODES.length} nodes, ${EDGES.length} edges · chronological top→bottom · scroll or drag to move · buttons zoom.`;
  if (edgeMode === "off") {
    statusEl.textContent = base + " Connections hidden.";
    if (hintEl) hintEl.textContent = "scroll/pinch to zoom · drag to pan · click a box to open its page";
    return;
  }
  if (edgeMode === "selected") {
    const n = selectedId && NODES.find((x) => x.id === selectedId);
    if (!n) {
      statusEl.textContent = base + " Click a thinker to show only their connections.";
      if (hintEl) hintEl.textContent = "click a box to see only that thinker’s connections";
      return;
    }
    const count = EDGES.filter((e) => e.from === selectedId || e.to === selectedId).length;
    statusEl.textContent = base + ` Showing ${count} connection${count === 1 ? "" : "s"} for ${n.name}. Click the same box again to open its page.`;
    if (hintEl) hintEl.textContent = "click another thinker to switch · click the same box again to open its page";
    return;
  }
  statusEl.textContent = base;
  if (hintEl) hintEl.textContent = "scroll/pinch to zoom · drag to pan · click a box to open its page";
}

function applyEdgeFilter() {
  if (!mapShell || !target) return;
  mapShell.classList.toggle("edges-off", edgeMode === "off");
  mapShell.classList.toggle("edges-selected", edgeMode === "selected");
  mapShell.classList.toggle("is-picked", edgeMode === "selected" && Boolean(selectedId));

  const edges = target.querySelectorAll(".edge");
  const nodes = target.querySelectorAll(".node");
  nodes.forEach((el) => {
    el.classList.toggle("is-selected", el.dataset.id === selectedId);
    el.classList.remove("is-neighbor");
  });
  if (sidebarList) {
    sidebarList.querySelectorAll("button[data-id]").forEach((btn) => {
      if (btn.dataset.id === selectedId) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }
  edges.forEach((el) => {
    const lit = edgeMode === "selected" && selectedId && (el.dataset.from === selectedId || el.dataset.to === selectedId);
    el.classList.toggle("is-lit", Boolean(lit));
    if (lit) {
      const other = el.dataset.from === selectedId ? el.dataset.to : el.dataset.from;
      const otherEl = document.getElementById("node-" + other);
      if (otherEl) otherEl.classList.add("is-neighbor");
    }
  });
  updateStatus();
}

function setEdgeMode(mode) {
  edgeMode = mode;
  if (edgeSwitch) {
    edgeSwitch.querySelectorAll("[data-edges]").forEach((btn) => {
      btn.setAttribute("aria-checked", btn.dataset.edges === mode ? "true" : "false");
    });
  }
  applyEdgeFilter();
}

searchInput.addEventListener("input", () => {
  const q = normalizeSearch(searchInput.value.trim());
  const buttons = sidebarList.querySelectorAll("button");
  const labels = sidebarList.querySelectorAll(".grp-label");
  buttons.forEach((b) => { b.hidden = q.length > 0 && !b.dataset.filter.includes(q); });
  labels.forEach((l) => {
    let sib = l.nextElementSibling;
    let anyVisible = false;
    while (sib && sib.tagName === "BUTTON") {
      if (!sib.hidden) anyVisible = true;
      sib = sib.nextElementSibling;
    }
    l.hidden = q.length > 0 && !anyVisible;
  });
});

/** Zoom so diagram width fills the viewport; pan to top (time scrolls vertically). */
function fitWidth() {
  if (!panZoomInstance) return;
  panZoomInstance.resize();
  const sizes = panZoomInstance.getSizes();
  const vbW = sizes.viewBox.width;
  if (!vbW) return;
  const rel = panZoomInstance.getZoom() || 1;
  const unitReal = sizes.realZoom / rel;
  const z = (sizes.width / vbW) / unitReal;
  panZoomInstance.zoom(z);
  const s = panZoomInstance.getSizes();
  panZoomInstance.pan({
    x: (s.width - vbW * s.realZoom) / 2,
    y: 12
  });
}

const PAN_MARGIN = 12;

/** Vertical pan limits so the diagram cannot scroll past its top or bottom. */
function clampPanY(sizes, y) {
  const zoom = sizes.realZoom || 1;
  const vbH = sizes.viewBox && sizes.viewBox.height > 1 ? sizes.viewBox.height : mapContentSize.height;
  const contentH = vbH * zoom;
  if (!(contentH > 1) || !(sizes.height > 0)) return y;
  if (contentH <= sizes.height) return PAN_MARGIN;
  const maxY = PAN_MARGIN;
  const minY = sizes.height - contentH - PAN_MARGIN;
  return Math.max(minY, Math.min(maxY, y));
}

let wheelScrollHandler = null;

function bindWheelScroll(svgEl) {
  if (wheelScrollHandler) {
    target.removeEventListener("wheel", wheelScrollHandler);
    wheelScrollHandler = null;
  }
  wheelScrollHandler = (e) => {
    if (!panZoomInstance) return;
    e.preventDefault();
    // Prefer vertical scroll; shift+wheel or dominant deltaX pans sideways.
    const dx = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX || e.deltaY : 0;
    const dy = e.shiftKey ? 0 : e.deltaY;
    panZoomInstance.panBy({ x: -dx, y: -dy });
  };
  target.addEventListener("wheel", wheelScrollHandler, { passive: false });
}

function renderMap() {
  const vp = document.getElementById("mapViewport").getBoundingClientRect();
  YEAR_SEGMENTS = yearSegmentsForViewport(Math.max(vp.width, 640), Math.max(vp.height, 420));

  if (panZoomInstance) {
    panZoomInstance.destroy();
    panZoomInstance = null;
  }

  const { svg, placed, width, height } = buildSvg();
  layoutPlaced = placed;
  mapContentSize = { width, height };
  target.innerHTML = svg;
  const svgEl = target.querySelector("svg");
  svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");
  svgEl.style.width = "100%";
  svgEl.style.height = "100%";

  panZoomInstance = window.svgPanZoom(svgEl, {
    zoomEnabled: true,
    panEnabled: true,
    controlIconsEnabled: false,
    mouseWheelZoomEnabled: false,
    fit: false,
    center: false,
    minZoom: 0.05,
    maxZoom: 20,
    zoomScaleSensitivity: 0.35,
    beforePan(oldPan, newPan) {
      return { x: newPan.x, y: clampPanY(this.getSizes(), newPan.y) };
    },
    onZoom() {
      const pan = this.getPan();
      const y = clampPanY(this.getSizes(), pan.y);
      if (y !== pan.y) this.pan({ x: pan.x, y });
    }
  });
  bindWheelScroll(svgEl);
  fitWidth();
  applyEdgeFilter();
}

function init() {
  buildSidebar();
  renderMap();
}

init();

document.getElementById("zoomIn").addEventListener("click", () => panZoomInstance && panZoomInstance.zoomIn());
document.getElementById("zoomOut").addEventListener("click", () => panZoomInstance && panZoomInstance.zoomOut());
document.getElementById("zoomFit").addEventListener("click", () => fitWidth());
document.getElementById("zoomReset").addEventListener("click", () => renderMap());

if (edgeSwitch) {
  edgeSwitch.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edges]");
    if (!btn) return;
    setEdgeMode(btn.dataset.edges);
  });
  edgeSwitch.addEventListener("keydown", (e) => {
    const modes = ["all", "off", "selected"];
    const i = modes.indexOf(edgeMode);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setEdgeMode(modes[(i + 1) % modes.length]);
      edgeSwitch.querySelector(`[data-edges="${edgeMode}"]`)?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setEdgeMode(modes[(i - 1 + modes.length) % modes.length]);
      edgeSwitch.querySelector(`[data-edges="${edgeMode}"]`)?.focus();
    }
  });
}

target.addEventListener("pointerdown", (e) => {
  ptrDown = { x: e.clientX, y: e.clientY };
});

target.addEventListener("click", (e) => {
  const dragged = ptrDown && Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y) > 8;
  const nodeEl = e.target.closest(".node");
  if (!nodeEl) {
    if (e.target.closest(".edge")) return;
    if (edgeMode === "selected" && selectedId && !dragged) {
      selectedId = null;
      applyEdgeFilter();
    }
    return;
  }
  if (dragged) return;
  const id = nodeEl.dataset.id;
  if (edgeMode === "selected") {
    if (selectedId !== id) {
      e.preventDefault();
      selectedId = id;
      applyEdgeFilter();
    }
    return;
  }
  selectedId = id;
  applyEdgeFilter();
}, true);
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderMap, 160);
});

} /* end mmd-target guard */
