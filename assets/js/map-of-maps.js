/* Map of Maps — single chronological timeline with lineage edges.
   year ≈ floruit / key work (illustrative, not biographical precision). */

const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const pal = dark
  ? { ink: "#D8DFEC", muted: "#8A96AE", cyan: "#3BC1D6", violet: "#A987F5", gold: "#D9B15E", line: "rgba(255,255,255,0.28)", panel: "rgba(20,28,48,0.92)", softG: "#3BC1D629", softV: "#A987F529", softGo: "#D9B15E2E" }
  : { ink: "#161C28", muted: "#58627A", cyan: "#0E7F94", violet: "#6B46C1", gold: "#9C6F1C", line: "rgba(20,28,48,0.28)", panel: "rgba(255,255,255,0.94)", softG: "#0E7F941F", softV: "#6B46C11F", softGo: "#9C6F1C24" };

const HREF = {
  grounding: "/grounding-the-unconscious.html",
  genealogies: "/genealogies-of-desire.html",
  constellations: "/constellations-of-history.html",
  concept: null
};

const GROUP_LABELS = {
  grounding: "Grounding the Unconscious",
  genealogies: "Genealogies of Desire",
  constellations: "Constellations of History",
  concept: "Shared concepts"
};

/** @type {{id:string,name:string,sub:string,group:string,year:number,href?:string}[]} */
const NODES = [
  { id: "platoAr", name: "Plato · Aristotle", sub: "akrasia", group: "grounding", year: -380, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "artemid", name: "Artemidorus", sub: "dream interpretation", group: "grounding", year: 150, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "descartes", name: "Descartes", sub: "cogito · dualism", group: "grounding", year: 1641, href: "/grounding-the-unconscious.html#descartes" },
  { id: "spinoza", name: "Spinoza", sub: "desire w/o knowing why", group: "grounding", year: 1677, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "leibniz", name: "Leibniz", sub: "petites perceptions", group: "grounding", year: 1704, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "kant", name: "Kant", sub: "synthetic a priori", group: "genealogies", year: 1781, href: "/genealogies-of-desire.html#kant-hegel" },
  { id: "hegel", name: "Hegel", sub: "lordship and bondage", group: "genealogies", year: 1807, href: "/genealogies-of-desire.html#kant-hegel" },
  { id: "cRecog", name: "desire & recognition", sub: "", group: "concept", year: 1807, href: "/genealogies-of-desire.html#gloss-recognition" },
  { id: "schopen", name: "Schopenhauer", sub: "the Will", group: "grounding", year: 1819, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "herbart", name: "Herbart", sub: "dynamic psychology", group: "grounding", year: 1824, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "cIdeology", name: "ideology", sub: "", group: "concept", year: 1846, href: "/genealogies-of-desire.html#gloss-ideology" },
  { id: "fechner", name: "Fechner", sub: "constancy principle", group: "grounding", year: 1873, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "marx", name: "Marx", sub: "base & superstructure", group: "genealogies", year: 1859, href: "/genealogies-of-desire.html#freud-marx" },
  { id: "vonHart", name: "von Hartmann", sub: "Philosophy of the Unconscious", group: "grounding", year: 1869, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "nietzsche", name: "Nietzsche", sub: "genealogy as method", group: "genealogies", year: 1887, href: "/genealogies-of-desire.html#nietzsche" },
  { id: "cGenMethod", name: "genealogy as method", sub: "", group: "concept", year: 1887, href: "/genealogies-of-desire.html#gloss-genealogy" },
  { id: "charJan", name: "Charcot · Janet", sub: "hysteria, dissociation", group: "grounding", year: 1890, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "freud", name: "Freud", sub: "id · ego · superego", group: "grounding", year: 1900, href: "/grounding-the-unconscious.html#freud" },
  { id: "cUnconscious", name: "the unconscious / repression", sub: "", group: "concept", year: 1900, href: "/genealogies-of-desire.html#gloss-unconscious" },
  { id: "bergson", name: "Bergson", sub: "durée · élan vital", group: "genealogies", year: 1907, href: "/genealogies-of-desire.html#bergson" },
  { id: "structImp", name: "Saussure · Jakobson · Lévi-Strauss · Benveniste", sub: "structuralist imports", group: "grounding", year: 1916, href: "/grounding-the-unconscious.html#lacan" },
  { id: "lukacs", name: "Lukács", sub: "reification", group: "constellations", year: 1923, href: "/constellations-of-history.html#lukacs-gramsci" },
  { id: "cReif", name: "reification / commodity fetishism", sub: "", group: "concept", year: 1923, href: "/constellations-of-history.html#gloss-reification" },
  { id: "kracauer", name: "Kracauer", sub: "mass ornament", group: "constellations", year: 1927, href: "/constellations-of-history.html#weimar-circle" },
  { id: "malinowski", name: "Malinowski", sub: "Trobriand fieldwork", group: "grounding", year: 1927, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "gramsci", name: "Gramsci", sub: "hegemony", group: "constellations", year: 1930, href: "/constellations-of-history.html#lukacs-gramsci" },
  { id: "cHegemony", name: "hegemony", sub: "", group: "concept", year: 1930, href: "/constellations-of-history.html#gloss-hegemony" },
  { id: "brecht", name: "Brecht", sub: "epic theater", group: "constellations", year: 1930, href: "/constellations-of-history.html#weimar-circle" },
  { id: "reich", name: "Reich", sub: "character armor", group: "genealogies", year: 1933, href: "/genealogies-of-desire.html#reich" },
  { id: "bloch", name: "Bloch", sub: "non-synchronism", group: "constellations", year: 1935, href: "/constellations-of-history.html#weimar-circle" },
  { id: "benjamin", name: "Benjamin", sub: "aura · dialectical image", group: "constellations", year: 1936, href: "/constellations-of-history.html#benjamin" },
  { id: "kojeve", name: "Kojève", sub: "desire for recognition", group: "genealogies", year: 1939, href: "/genealogies-of-desire.html#kojeve" },
  { id: "fromm", name: "Fromm", sub: "escape from freedom", group: "genealogies", year: 1941, href: "/genealogies-of-desire.html#fromm" },
  { id: "scholem", name: "Scholem", sub: "Kabbalah · messianism", group: "constellations", year: 1941, href: "/constellations-of-history.html#weimar-circle" },
  { id: "adorno", name: "Adorno · Horkheimer", sub: "culture industry", group: "genealogies", year: 1947, href: "/genealogies-of-desire.html#adorno" },
  { id: "eysenck", name: "Eysenck", sub: "efficacy", group: "grounding", year: 1952, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "lacan", name: "Lacan", sub: "Real · Symbolic · Imaginary", group: "grounding", year: 1953, href: "/grounding-the-unconscious.html#lacan" },
  { id: "marcuse", name: "Marcuse", sub: "surplus-repression", group: "genealogies", year: 1955, href: "/genealogies-of-desire.html#marcuse" },
  { id: "williamsR", name: "Raymond Williams", sub: "structure of feeling", group: "constellations", year: 1958, href: "/constellations-of-history.html#cultural-studies" },
  { id: "popper", name: "Popper", sub: "falsifiability", group: "grounding", year: 1963, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "mcluhan", name: "Marshall McLuhan", sub: "the medium is the message", group: "constellations", year: 1964, href: "/constellations-of-history.html#mcluhan" },
  { id: "chomLak", name: "Chomsky · Lakoff", sub: "innate / embodied pushback", group: "grounding", year: 1965, href: "/grounding-the-unconscious.html#lacan" },
  { id: "debord", name: "Debord", sub: "society of the spectacle", group: "constellations", year: 1967, href: "/constellations-of-history.html#adorno-debord" },
  { id: "ellenb", name: "Ellenberger", sub: "synthesis thesis", group: "grounding", year: 1970, href: "/grounding-the-unconscious.html#prehistory" },
  { id: "althusser", name: "Althusser", sub: "interpellation", group: "genealogies", year: 1970, href: "/genealogies-of-desire.html#althusser" },
  { id: "dg", name: "Deleuze & Guattari", sub: "desiring-production", group: "genealogies", year: 1972, href: "/genealogies-of-desire.html#dg" },
  { id: "kristeva", name: "Kristeva", sub: "the semiotic", group: "grounding", year: 1974, href: "/grounding-the-unconscious.html#kristeva" },
  { id: "baudLyo", name: "Baudrillard · Lyotard", sub: "Mirror of Production · libidinal economy", group: "genealogies", year: 1974, href: "/genealogies-of-desire.html#baudrillard-lyotard" },
  { id: "anderson", name: "Perry Anderson", sub: "periodizes Western Marxism", group: "constellations", year: 1976, href: "/constellations-of-history.html#anderson-harvey-eagleton" },
  { id: "eagleton", name: "Terry Eagleton", sub: "transmission · Literary Theory", group: "constellations", year: 1976, href: "/constellations-of-history.html#anderson-harvey-eagleton" },
  { id: "foucault", name: "Foucault", sub: "biopower", group: "genealogies", year: 1976, href: "/genealogies-of-desire.html#foucault" },
  { id: "hobsonMc", name: "Hobson · McCarley", sub: "activation-synthesis", group: "grounding", year: 1977, href: "/grounding-the-unconscious.html#hobson-mccarley" },
  { id: "hofstadter", name: "Hofstadter", sub: "strange loop", group: "grounding", year: 1979, href: "/grounding-the-unconscious.html#cognitive-science" },
  { id: "searle", name: "Searle", sub: "Chinese Room", group: "grounding", year: 1980, href: "/grounding-the-unconscious.html#cognitive-science" },
  { id: "hall", name: "Stuart Hall", sub: "encoding / decoding", group: "constellations", year: 1973, href: "/constellations-of-history.html#cultural-studies" },
  { id: "jackson", name: "Jackson", sub: "Mary's Room", group: "grounding", year: 1982, href: "/grounding-the-unconscious.html#dissenters" },
  { id: "grunbaum", name: "Grünbaum", sub: "the tally argument", group: "grounding", year: 1984, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "churchland", name: "P. & P. Churchland", sub: "eliminative materialism", group: "grounding", year: 1986, href: "/grounding-the-unconscious.html#cognitive-science" },
  { id: "edelman", name: "Edelman", sub: "TNGS · reentry", group: "grounding", year: 1987, href: "/grounding-the-unconscious.html#edelman" },
  { id: "harvey", name: "David Harvey", sub: "time-space compression", group: "constellations", year: 1989, href: "/constellations-of-history.html#anderson-harvey-eagleton" },
  { id: "zizek", name: "Žižek", sub: "parallax view", group: "grounding", year: 1989, href: "/grounding-the-unconscious.html#zizek" },
  { id: "jameson", name: "Jameson", sub: "postmodernism · cognitive mapping", group: "constellations", year: 1991, href: "/constellations-of-history.html#jameson" },
  { id: "habermas", name: "Habermas", sub: "communicative action", group: "constellations", year: 1981, href: "/constellations-of-history.html#habermas" },
  { id: "taylor", name: "Charles Taylor", sub: "moral horizons", group: "constellations", year: 1989, href: "/constellations-of-history.html#rosa" },
  { id: "honneth", name: "Honneth", sub: "struggle for recognition", group: "constellations", year: 1992, href: "/constellations-of-history.html#honneth" },
  { id: "land", name: "Nick Land", sub: "diagonalization · Meltdown", group: "genealogies", year: 1995, href: "/genealogies-of-desire.html#land" },
  { id: "damasio", name: "Damasio", sub: "core / autobiographical self", group: "grounding", year: 1994, href: "/grounding-the-unconscious.html#damasio" },
  { id: "crews", name: "Crews", sub: "historical fraud", group: "grounding", year: 1995, href: "/grounding-the-unconscious.html#rebuttals" },
  { id: "chalmers", name: "Chalmers", sub: "hard problem", group: "grounding", year: 1995, href: "/grounding-the-unconscious.html#chalmers" },
  { id: "cHardProb", name: "the hard problem / subject as gap", sub: "", group: "concept", year: 1995, href: "/grounding-the-unconscious.html#dissenters" },
  { id: "ccruTrio", name: "Eshun · Mackay · Grant", sub: "theory-fiction", group: "genealogies", year: 1995, href: "/genealogies-of-desire.html#warwick-ccru" },
  { id: "ledoux", name: "LeDoux", sub: "fast threat pathway", group: "grounding", year: 1996, href: "/grounding-the-unconscious.html#cognitive-science" },
  { id: "plant", name: "Sadie Plant", sub: "cyberfeminism", group: "genealogies", year: 1997, href: "/genealogies-of-desire.html#plant" },
  { id: "solms", name: "Solms", sub: "SEEKING drives dreaming", group: "grounding", year: 2000, href: "/grounding-the-unconscious.html#solms" },
  { id: "miller", name: "Miller-school", sub: "anti-neuro Lacan", group: "grounding", year: 2000, href: "/grounding-the-unconscious.html#dissenters" },
  { id: "domhoff", name: "Domhoff", sub: "neurocognitive / continuity", group: "grounding", year: 2003, href: "/grounding-the-unconscious.html#domhoff" },
  { id: "malabou", name: "Malabou", sub: "destructive plasticity", group: "grounding", year: 2007, href: "/grounding-the-unconscious.html#malabou" },
  { id: "strawGoff", name: "Strawson · Goff", sub: "panpsychism", group: "grounding", year: 2006, href: "/grounding-the-unconscious.html#dissenters" },
  { id: "johnston", name: "Johnston", sub: "transcendental materialism", group: "grounding", year: 2008, href: "/grounding-the-unconscious.html#johnston" },
  { id: "fisher", name: "Mark Fisher", sub: "capitalist realism", group: "genealogies", year: 2009, href: "/genealogies-of-desire.html#fisher" },
  { id: "friston", name: "Friston", sub: "predictive processing", group: "grounding", year: 2010, href: "/grounding-the-unconscious.html#cognitive-science" },
  { id: "nagel", name: "Nagel", sub: "Mind and Cosmos", group: "grounding", year: 2012, href: "/grounding-the-unconscious.html#dissenters" },
  { id: "berardiDean", name: "Berardi · Dean", sub: "semiocapitalism", group: "genealogies", year: 2012, href: "/genealogies-of-desire.html#berardi-dean" },
  { id: "leftAccel", name: "Left-accelerationism", sub: "Srnicek & Williams", group: "genealogies", year: 2013, href: "/genealogies-of-desire.html#left-accelerationism" },
  { id: "rosa", name: "Hartmut Rosa", sub: "social acceleration · resonance", group: "constellations", year: 2013, href: "/constellations-of-history.html#rosa" },
  { id: "cSocAccel", name: "social acceleration / dynamic stabilization", sub: "", group: "concept", year: 2013, href: "/constellations-of-history.html#gloss-social-acceleration" },
  { id: "kastrup", name: "Kastrup", sub: "analytic idealism", group: "grounding", year: 2014, href: "/grounding-the-unconscious.html#dissenters" },
  { id: "acidXeno", name: "Acid Communism / Xenofeminism", sub: "2015–18", group: "genealogies", year: 2016, href: "/genealogies-of-desire.html#connected-strains" },
  { id: "cResonance", name: "resonance / world-relation", sub: "", group: "concept", year: 2016, href: "/constellations-of-history.html#gloss-resonance" }
];

/** kind: build | critique | parallel | callback */
const EDGES = [
  { from: "spinoza", to: "freud", kind: "build" },
  { from: "leibniz", to: "freud", kind: "build" },
  { from: "herbart", to: "freud", kind: "build" },
  { from: "schopen", to: "freud", kind: "build" },
  { from: "vonHart", to: "freud", kind: "build" },
  { from: "platoAr", to: "freud", kind: "build" },
  { from: "artemid", to: "freud", kind: "build" },
  { from: "descartes", to: "spinoza", kind: "critique" },
  { from: "descartes", to: "kant", kind: "critique" },
  { from: "descartes", to: "chalmers", kind: "build" },
  { from: "descartes", to: "cHardProb", kind: "build" },
  { from: "descartes", to: "hofstadter", kind: "critique" },
  { from: "charJan", to: "freud", kind: "build" },
  { from: "fechner", to: "freud", kind: "build" },
  { from: "ellenb", to: "freud", kind: "critique" },
  { from: "nietzsche", to: "freud", kind: "build" },
  { from: "popper", to: "freud", kind: "critique" },
  { from: "grunbaum", to: "freud", kind: "critique" },
  { from: "crews", to: "freud", kind: "critique" },
  { from: "eysenck", to: "freud", kind: "critique" },
  { from: "malinowski", to: "freud", kind: "critique" },
  { from: "freud", to: "lacan", kind: "build" },
  { from: "structImp", to: "lacan", kind: "build" },
  { from: "kristeva", to: "lacan", kind: "critique" },
  { from: "chomLak", to: "structImp", kind: "critique" },
  { from: "hegel", to: "zizek", kind: "build" },
  { from: "lacan", to: "zizek", kind: "build" },
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
  { from: "freud", to: "hobsonMc", kind: "callback" },
  { from: "hobsonMc", to: "solms", kind: "critique" },
  { from: "solms", to: "domhoff", kind: "parallel" },
  { from: "hobsonMc", to: "domhoff", kind: "parallel" },
  { from: "zizek", to: "chalmers", kind: "parallel" },
  { from: "chalmers", to: "jackson", kind: "parallel" },
  { from: "chalmers", to: "nagel", kind: "parallel" },
  { from: "chalmers", to: "strawGoff", kind: "critique" },
  { from: "strawGoff", to: "kastrup", kind: "build" },
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
  { from: "land", to: "leftAccel", kind: "critique" },
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
  { from: "hegel", to: "honneth", kind: "build" },
  { from: "cRecog", to: "honneth", kind: "build" },
  { from: "honneth", to: "rosa", kind: "build" },
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
  { from: "jackson", to: "cHardProb", kind: "build" },
  { from: "miller", to: "cHardProb", kind: "critique" },
  { from: "nietzsche", to: "cGenMethod", kind: "build" },
  { from: "foucault", to: "cGenMethod", kind: "build" },
  { from: "fisher", to: "cGenMethod", kind: "build" },
  { from: "gramsci", to: "cHegemony", kind: "build" },
  { from: "hall", to: "cHegemony", kind: "build" }
];

const NODE_W = 168;
const NODE_H = 56;
const CONCEPT_H = 48;
const COL_W = 200;
const LANE_GAP = 18;
const V_GAP = 18;
const PAD_L = 92;
const PAD_T = 56;
const PAD_R = 40;
const PAD_B = 56;
const AXIS_W = 8;

/** Essay tracks keep the diagram wide; collisions stack downward inside a track. */
const GROUP_TRACK = { grounding: 0, genealogies: 1, constellations: 2, concept: 3 };
const TRACK_COUNT = 4;

/** Relative lengths along the time axis (sum = 1). */
const YEAR_WEIGHTS = [
  { y0: -400, y1: 1600, w: 0.10 },
  { y0: 1600, y1: 1850, w: 0.12 },
  { y0: 1850, y1: 1950, w: 0.30 },
  { y0: 1950, y1: 2025, w: 0.48 }
];

const TICKS = [-400, 0, 500, 1000, 1600, 1700, 1800, 1850, 1900, 1925, 1950, 1975, 2000, 2015];

function contentWidth() {
  return PAD_L + AXIS_W + 28 + TRACK_COUNT * (COL_W + LANE_GAP) + PAD_R;
}

/** Time-axis length: at least tall enough to separate dense years; also aims to fill viewport width. */
function yearSegmentsForViewport(vpW, vpH) {
  const cW = contentWidth();
  const fillWidthH = (vpH * cW) / Math.max(vpW, 1) - PAD_T - PAD_B;
  // ~one node row per ~3 years in the densest modern band, across 4 tracks
  const readableH = 3200;
  const targetH = Math.max(fillWidthH, readableH);
  let t = 0;
  return YEAR_WEIGHTS.map((seg) => {
    const span = targetH * seg.w;
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

function formatYear(y) {
  if (y < 0) return Math.abs(y) + " BCE";
  return String(y);
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function groupStroke(group) {
  if (group === "grounding") return pal.cyan;
  if (group === "genealogies") return pal.violet;
  if (group === "constellations") return pal.gold;
  return pal.muted;
}

function groupFill(group) {
  if (group === "grounding") return pal.softG;
  if (group === "genealogies") return pal.softV;
  if (group === "constellations") return pal.softGo;
  return "transparent";
}

function layoutNodes(nodes) {
  const byTrack = [[], [], [], []];
  for (const n of nodes) {
    const w = nodeWidth(n);
    const lines = nameLines(n, n.group === "concept" ? 26 : 24);
    const lineCount = lines.length + (n.sub ? 1 : 0);
    const h = Math.min(70, Math.max(n.group === "concept" ? CONCEPT_H : NODE_H, 18 + lineCount * 14));
    const idealY = Math.max(PAD_T * 0.35, PAD_T + yearToY(n.year) - h / 2);
    const track = GROUP_TRACK[n.group] ?? 0;
    byTrack[track].push({ ...n, w, h, lines, idealY });
  }

  const placed = [];
  let maxBottom = 0;
  for (let t = 0; t < TRACK_COUNT; t++) {
    const list = byTrack[t].slice().sort((a, b) => a.idealY - b.idealY || a.year - b.year || a.name.localeCompare(b.name));
    let prevBottom = -Infinity;
    const trackX = PAD_L + AXIS_W + 28 + t * (COL_W + LANE_GAP);
    for (const n of list) {
      const y = Math.max(n.idealY, prevBottom + V_GAP);
      prevBottom = y + n.h;
      maxBottom = Math.max(maxBottom, prevBottom);
      placed.push({
        ...n,
        x: trackX,
        y,
        cx: trackX + n.w / 2,
        cy: y + n.h / 2,
        lane: t
      });
    }
  }

  const width = contentWidth();
  const height = Math.max(maxBottom + PAD_B, PAD_T + YEAR_SEGMENTS[YEAR_SEGMENTS.length - 1].t1 + PAD_B);
  return { placed, width, height, laneCount: TRACK_COUNT };
}

function nodeWidth(n) {
  const len = (n.name || "").length + (n.sub ? 4 : 0);
  if (n.group === "concept") return Math.min(200, Math.max(150, len * 6.2));
  return Math.min(210, Math.max(148, len * 5.8));
}

function nameLines(n, maxChars) {
  const name = n.name;
  if (name.length <= maxChars) return [name];
  if (name.includes(" · ")) {
    const parts = name.split(" · ");
    const lines = [];
    let cur = "";
    for (const p of parts) {
      const next = cur ? cur + " · " + p : p;
      if (next.length > maxChars && cur) {
        lines.push(cur);
        cur = p;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    if (lines.length <= 3) return lines;
  }
  if (name.includes(" / ")) {
    return name.split(" / ").slice(0, 2);
  }
  const mid = Math.ceil(name.length / 2);
  const sp = name.lastIndexOf(" ", mid);
  const cut = sp > 8 ? sp : mid;
  return [name.slice(0, cut).trim(), name.slice(cut).trim()];
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

  const tickMarks = TICKS.map((yr) => {
    const y = PAD_T + yearToY(yr);
    return `<g class="tick">
      <line x1="${PAD_L}" y1="${y}" x2="${width - PAD_R}" y2="${y}" stroke="${pal.line}" stroke-width="1" stroke-dasharray="2 6"/>
      <text x="${PAD_L - 10}" y="${y + 4}" text-anchor="end" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11">${escapeXml(formatYear(yr))}</text>
    </g>`;
  }).join("");

  const axis = `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${height - PAD_B}" stroke="${pal.line}" stroke-width="1.5"/>
    <text x="${PAD_L}" y="${PAD_T - 20}" text-anchor="middle" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" letter-spacing="0.06em">TIME ↓</text>`;

  const trackLabels = [
    { i: 0, label: "Grounding" },
    { i: 1, label: "Genealogies" },
    { i: 2, label: "Constellations" },
    { i: 3, label: "Concepts" }
  ].map(({ i, label }) => {
    const x = PAD_L + AXIS_W + 28 + i * (COL_W + LANE_GAP) + COL_W / 2;
    return `<text x="${x}" y="${PAD_T - 20}" text-anchor="middle" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10" letter-spacing="0.04em">${label}</text>`;
  }).join("");

  const edgeEls = EDGES.map((e) => {
    const a = byId[e.from];
    const b = byId[e.to];
    if (!a || !b) return "";
    const st = edgeStyle(e.kind);
    return `<path class="edge edge-${e.kind}" d="${edgePath(a, b)}" fill="none" stroke="${st.color}" stroke-width="${st.width}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ""} marker-end="${st.marker}" opacity="0.75"/>`;
  }).join("");

  const nodeEls = placed.map((n) => {
    const isConcept = n.group === "concept";
    const href = n.href || HREF[n.group];
    const stroke = groupStroke(n.group);
    const fill = groupFill(n.group);
    const dash = isConcept ? `stroke-dasharray="4 3"` : "";
    const lines = n.lines || nameLines(n, isConcept ? 26 : 24);
    const hasSub = Boolean(n.sub);
    const lineH = 13;
    const blockH = lines.length * lineH + (hasSub ? lineH : 0);
    const startY = n.cy - blockH / 2 + 10;
    const nameTs = lines.map((ln, i) => {
      const y = startY + i * lineH;
      return `<tspan x="${n.cx}" y="${y}">${escapeXml(ln)}</tspan>`;
    }).join("");
    const subTs = hasSub
      ? `<tspan x="${n.cx}" y="${startY + lines.length * lineH}" fill="${pal.muted}" font-size="10">${escapeXml(n.sub)}</tspan>`
      : "";
    const yearLabel = `<text x="${n.x + 8}" y="${n.y + 12}" fill="${pal.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9">${escapeXml(formatYear(n.year))}</text>`;
    const body = `
      <rect class="node-box" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isConcept ? 14 : 8}" ry="${isConcept ? 14 : 8}"
        fill="${fill}" stroke="${stroke}" stroke-width="1.6" ${dash}/>
      ${yearLabel}
      <text class="node-label" text-anchor="middle" fill="${pal.ink}"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="${isConcept ? 11 : 12}" font-weight="${isConcept ? 500 : 600}">${nameTs}${subTs}</text>`;
    const tip = `${escapeXml(n.name)}${n.sub ? " — " + escapeXml(n.sub) : ""} · ${escapeXml(formatYear(n.year))}`;
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

const statusEl = document.getElementById("mapStatus");
const target = document.getElementById("mmd-target");
const sidebarList = document.getElementById("mapSidebarList");
const searchInput = document.getElementById("mapSearch");

let panZoomInstance = null;
let layoutPlaced = [];

function centuryBucket(year) {
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
  for (const n of NODES) {
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
    btn.dataset.filter = normalizeSearch(n.name + " " + n.sub + " " + formatYear(n.year) + " " + (GROUP_LABELS[n.group] || ""));
    const yearBit = formatYear(n.year);
    btn.textContent = n.sub ? `${yearBit} · ${n.name} — ${n.sub}` : `${yearBit} · ${n.name}`;
    btn.addEventListener("click", () => centerOnNode(n.id));
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
    zoomScaleSensitivity: 0.35
  });
  bindWheelScroll(svgEl);
  fitWidth();
  statusEl.textContent = `${NODES.length} nodes, ${EDGES.length} edges · chronological top→bottom · scroll or drag to move · buttons zoom.`;
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
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderMap, 160);
});
