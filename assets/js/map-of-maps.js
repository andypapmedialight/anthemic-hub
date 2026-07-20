const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const pal = dark
  ? { ink:"#D8DFEC", muted:"#8A96AE", cyan:"#3BC1D6", violet:"#A987F5", gold:"#D9B15E", line:"rgba(255,255,255,0.35)" }
  : { ink:"#161C28", muted:"#58627A", cyan:"#0E7F94", violet:"#6B46C1", gold:"#9C6F1C", line:"rgba(20,28,48,0.35)" };

const graphSrc = `flowchart TD

subgraph sgGround["GROUNDING THE UNCONSCIOUS"]
direction TB
subgraph sgPre["Prehistory of the unconscious"]
direction LR
platoAr["Plato · Aristotle<br/><small>akrasia</small>"]
artemid["Artemidorus<br/><small>dream interpretation</small>"]
spinoza["Spinoza<br/><small>desire w/o knowing why</small>"]
leibniz["Leibniz<br/><small>petites perceptions</small>"]
herbart["Herbart<br/><small>dynamic psychology</small>"]
schopen["Schopenhauer<br/><small>the Will</small>"]
vonHart["von Hartmann<br/><small>Philosophy of the Unconscious</small>"]
charJan["Charcot · Janet<br/><small>hysteria, dissociation</small>"]
fechner["Fechner<br/><small>constancy principle</small>"]
ellenb["Ellenberger<br/><small>synthesis thesis</small>"]
end
subgraph sgFreudSec["Freud"]
direction LR
freud["Freud<br/><small>id · ego · superego</small>"]
end
subgraph sgRebut["The direct rebuttals"]
direction LR
popper["Popper<br/><small>falsifiability</small>"]
grunbaum["Grünbaum<br/><small>the tally argument</small>"]
crews["Crews<br/><small>historical fraud</small>"]
eysenck["Eysenck<br/><small>efficacy</small>"]
malinowski["Malinowski<br/><small>Trobriand fieldwork</small>"]
end
subgraph sgLacanSec["Lacan"]
direction LR
lacan["Lacan<br/><small>Real · Symbolic · Imaginary</small>"]
structImp["Saussure · Jakobson ·<br/>Lévi-Strauss · Benveniste<br/><small>structuralist imports</small>"]
kristeva["Kristeva<br/><small>the semiotic</small>"]
chomLak["Chomsky · Lakoff<br/><small>innate / embodied pushback</small>"]
end
subgraph sgZizJoh["Žižek and Johnston"]
direction LR
zizek["Žižek<br/><small>parallax view</small>"]
johnston["Johnston<br/><small>transcendental materialism</small>"]
end
subgraph sgCog["The cognitive-science side"]
direction LR
hofstadter["Hofstadter<br/><small>strange loop</small>"]
searle["Searle<br/><small>Chinese Room</small>"]
churchland["P. &amp; P. Churchland<br/><small>eliminative materialism</small>"]
damasio["Damasio<br/><small>core / autobiographical self</small>"]
friston["Friston<br/><small>predictive processing</small>"]
ledoux["LeDoux<br/><small>fast threat pathway</small>"]
malabou["Malabou<br/><small>destructive plasticity</small>"]
edelman["Edelman<br/><small>TNGS · reentry</small>"]
end
subgraph sgDreams["Dreams: a case study"]
direction LR
hobsonMc["Hobson · McCarley<br/><small>activation-synthesis</small>"]
solms["Solms<br/><small>SEEKING drives dreaming</small>"]
domhoff["Domhoff<br/><small>continuity hypothesis</small>"]
end
subgraph sgDissent["The dissenters"]
direction LR
chalmers["Chalmers<br/><small>hard problem</small>"]
jackson["Jackson<br/><small>Mary's Room</small>"]
nagel["Nagel<br/><small>Mind and Cosmos</small>"]
strawGoff["Strawson · Goff<br/><small>panpsychism</small>"]
kastrup["Kastrup<br/><small>analytic idealism</small>"]
miller["Miller-school<br/><small>anti-neuro Lacan</small>"]
end
end

subgraph sgGen["GENEALOGIES OF DESIRE"]
direction TB
subgraph sgKH["Kant and Hegel"]
direction LR
kant["Kant<br/><small>phenomena / noumena</small>"]
hegel["Hegel<br/><small>lordship and bondage</small>"]
end
subgraph sgNie["Nietzsche"]
direction LR
nietzsche["Nietzsche<br/><small>genealogy as method</small>"]
end
subgraph sgKoj["Kojève's Hegel"]
direction LR
kojeve["Kojève<br/><small>desire for recognition</small>"]
end
subgraph sgFM["Freud and Marx"]
direction LR
marx["Marx<br/><small>base &amp; superstructure</small>"]
end
subgraph sgFrM["Freudo-Marxism"]
direction LR
reich["Reich<br/><small>character armor</small>"]
adorno["Adorno · Horkheimer<br/><small>culture industry</small>"]
marcuse["Marcuse<br/><small>surplus-repression</small>"]
fromm["Fromm<br/><small>escape from freedom</small>"]
end
subgraph sgFrench["French (Post-)Structuralism"]
direction LR
bergson["Bergson<br/><small>durée · élan vital</small>"]
althusser["Althusser<br/><small>interpellation</small>"]
dg["Deleuze &amp; Guattari<br/><small>desiring-production</small>"]
foucault["Foucault<br/><small>biopower</small>"]
baudLyo["Baudrillard · Lyotard<br/><small>simulacra · libidinal economy</small>"]
end
subgraph sgWarwick["Warwick / CCRU"]
direction LR
plant["Sadie Plant<br/><small>cyberfeminism</small>"]
land["Nick Land<br/><small>accelerationism</small>"]
fisher["Mark Fisher<br/><small>capitalist realism</small>"]
ccruTrio["Eshun · Mackay · Grant<br/><small>theory-fiction</small>"]
end
subgraph sgContemp["Contemporary strains"]
direction LR
leftAccel["Left-accelerationism<br/><small>Srnicek &amp; Williams</small>"]
acidXeno["Acid Communism /<br/>Xenofeminism"]
berardiDean["Berardi · Dean<br/><small>semiocapitalism</small>"]
end
end

subgraph sgCon["CONSTELLATIONS OF HISTORY"]
direction TB
subgraph sgLG["Lukács and Gramsci"]
direction LR
lukacs["Lukács<br/><small>reification</small>"]
gramsci["Gramsci<br/><small>hegemony</small>"]
end
subgraph sgWeimar["The Weimar circle"]
direction LR
benjamin["Benjamin<br/><small>aura · dialectical image</small>"]
bloch["Bloch<br/><small>non-synchronism</small>"]
brecht["Brecht<br/><small>epic theater</small>"]
scholem["Scholem<br/><small>Kabbalah · messianism</small>"]
kracauer["Kracauer<br/><small>mass ornament</small>"]
end
subgraph sgAdDeb["Adorno's critique, Debord's spectacle"]
direction LR
debord["Debord<br/><small>society of the spectacle</small>"]
end
subgraph sgCultStud["British Cultural Studies"]
direction LR
williamsR["Raymond Williams<br/><small>structure of feeling</small>"]
hall["Stuart Hall<br/><small>encoding / decoding</small>"]
end
subgraph sgJameson["Fredric Jameson"]
direction LR
jameson["Jameson<br/><small>cognitive mapping</small>"]
end
subgraph sgNaming["Naming the tradition"]
direction LR
anderson["Perry Anderson<br/><small>coins Western Marxism</small>"]
harvey["David Harvey<br/><small>time-space compression</small>"]
eagleton["Terry Eagleton<br/><small>popularizer</small>"]
end
end

subgraph sgConcepts["SHARED CONCEPTS, ACROSS ALL THREE"]
direction LR
cUnconscious(["the unconscious /<br/>repression"])
cIdeology(["ideology"])
cRecog(["desire &amp; recognition"])
cReif(["reification /<br/>commodity fetishism"])
cHardProb(["the hard problem /<br/>subject as gap"])
cGenMethod(["genealogy as method"])
cHegemony(["hegemony"])
end

spinoza --> freud
leibniz --> freud
herbart --> freud
schopen --> freud
vonHart --> freud
platoAr --> freud
artemid --> freud
charJan --> freud
fechner --> freud
ellenb -.-> freud
nietzsche --> freud
popper -.-> freud
grunbaum -.-> freud
crews -.-> freud
eysenck -.-> freud
malinowski -.-> freud
freud --> lacan
structImp --> lacan
kristeva -.-> lacan
chomLak -.-> structImp
hegel --> zizek
lacan --> zizek
zizek --> johnston
johnston --> edelman
johnston -.-> malabou
edelman -.- malabou
freud --> edelman
freud --> damasio
friston --> freud
ledoux --> freud
churchland -.-> freud
hofstadter -.- zizek
searle -.-> hofstadter
freud ==> hobsonMc
hobsonMc -.-> solms
solms -.- domhoff
hobsonMc -.- domhoff
zizek -.- chalmers
chalmers -.- jackson
chalmers -.- nagel
chalmers -.-> strawGoff
strawGoff --> kastrup
lacan -.-> miller
miller -.-> johnston

kant --> hegel
hegel --> kojeve
nietzsche --> foucault
freud --> reich
marx --> adorno
kojeve -.-> dg
kojeve --> baudLyo
bergson --> dg
althusser --> dg
foucault -.-> reich
foucault -.-> marcuse
dg --> land
land --> fisher
marcuse ==> fisher
reich -.- adorno
adorno -.- marcuse
marcuse -.- fromm
plant --> acidXeno
land --> leftAccel
ccruTrio --> leftAccel
ccruTrio -.- berardiDean
fisher -.- berardiDean

fisher ==> jameson
zizek --> jameson
adorno -.-> benjamin
benjamin --> debord
lukacs --> debord
althusser --> hall
lukacs -.-> brecht
gramsci --> hall
benjamin -.- bloch
benjamin -.- brecht
benjamin -.- scholem
benjamin -.- kracauer
bloch --> williamsR
benjamin --> jameson
hall --> jameson
anderson ==> lukacs
anderson ==> gramsci
harvey -.- jameson
williamsR --> eagleton

spinoza --> cUnconscious
leibniz --> cUnconscious
herbart --> cUnconscious
schopen --> cUnconscious
vonHart --> cUnconscious
freud --> cUnconscious
reich --> cUnconscious
marcuse --> cUnconscious
friston --> cUnconscious
foucault -.-> cUnconscious

marx --> cIdeology
althusser --> cIdeology
zizek --> cIdeology
hall --> cIdeology
jameson --> cIdeology

hegel --> cRecog
kojeve --> cRecog
lacan --> cRecog
dg -.-> cRecog

marx --> cReif
lukacs --> cReif
jameson --> cReif
debord --> cReif

chalmers --> cHardProb
zizek --> cHardProb
johnston --> cHardProb
nagel --> cHardProb
strawGoff --> cHardProb
kastrup --> cHardProb
jackson --> cHardProb
miller -.-> cHardProb

nietzsche --> cGenMethod
foucault --> cGenMethod
fisher --> cGenMethod

gramsci --> cHegemony
hall --> cHegemony

classDef grounding fill:${dark ? "#3BC1D629" : "#0E7F941F"},stroke:${pal.cyan},color:${pal.ink};
classDef genealogies fill:${dark ? "#A987F529" : "#6B46C11F"},stroke:${pal.violet},color:${pal.ink};
classDef constellations fill:${dark ? "#D9B15E2E" : "#9C6F1C24"},stroke:${pal.gold},color:${pal.ink};
classDef concept fill:transparent,stroke:${pal.muted},stroke-dasharray:4 3,color:${pal.ink};

class platoAr,artemid,spinoza,leibniz,herbart,schopen,vonHart,charJan,fechner,ellenb,freud,popper,grunbaum,crews,eysenck,malinowski,lacan,structImp,kristeva,chomLak,zizek,johnston,hofstadter,searle,churchland,damasio,friston,ledoux,malabou,edelman,hobsonMc,solms,domhoff,chalmers,jackson,nagel,strawGoff,kastrup,miller grounding
class kant,hegel,nietzsche,kojeve,marx,reich,adorno,marcuse,fromm,bergson,althusser,dg,foucault,baudLyo,plant,land,fisher,ccruTrio,leftAccel,acidXeno,berardiDean genealogies
class lukacs,gramsci,benjamin,bloch,brecht,scholem,kracauer,debord,williamsR,hall,jameson,anderson,harvey,eagleton constellations
class cUnconscious,cIdeology,cRecog,cReif,cHardProb,cGenMethod,cHegemony concept

click platoAr "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click artemid "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click spinoza "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click leibniz "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click herbart "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click schopen "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click vonHart "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click charJan "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click fechner "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click ellenb "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click freud "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click popper "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click grunbaum "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click crews "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click eysenck "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click malinowski "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click lacan "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click structImp "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click kristeva "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click chomLak "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click zizek "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click johnston "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click hofstadter "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click searle "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click churchland "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click damasio "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click friston "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click ledoux "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click malabou "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click edelman "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click hobsonMc "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click solms "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click domhoff "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click chalmers "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click jackson "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click nagel "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click strawGoff "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click kastrup "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank
click miller "/grounding-the-unconscious.html" "Open Grounding the Unconscious" _blank

click kant "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click hegel "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click nietzsche "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click kojeve "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click marx "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click reich "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click adorno "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click marcuse "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click fromm "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click bergson "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click althusser "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click dg "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click foucault "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click baudLyo "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click plant "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click land "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click fisher "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click ccruTrio "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click leftAccel "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click acidXeno "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank
click berardiDean "/genealogies-of-desire.html" "Open Genealogies of Desire" _blank

click lukacs "/constellations-of-history.html#lukacs-gramsci" "Open Constellations of History" _blank
click gramsci "/constellations-of-history.html#lukacs-gramsci" "Open Constellations of History" _blank
click benjamin "/constellations-of-history.html#benjamin" "Open Constellations of History" _blank
click bloch "/constellations-of-history.html#weimar-circle" "Open Constellations of History" _blank
click brecht "/constellations-of-history.html#weimar-circle" "Open Constellations of History" _blank
click scholem "/constellations-of-history.html#weimar-circle" "Open Constellations of History" _blank
click kracauer "/constellations-of-history.html#weimar-circle" "Open Constellations of History" _blank
click debord "/constellations-of-history.html#adorno-debord" "Open Constellations of History" _blank
click williamsR "/constellations-of-history.html#cultural-studies" "Open Constellations of History" _blank
click hall "/constellations-of-history.html#cultural-studies" "Open Constellations of History" _blank
click jameson "/constellations-of-history.html#jameson" "Open Constellations of History" _blank
click anderson "/constellations-of-history.html#anderson-harvey-eagleton" "Open Constellations of History" _blank
click harvey "/constellations-of-history.html#anderson-harvey-eagleton" "Open Constellations of History" _blank
click eagleton "/constellations-of-history.html#anderson-harvey-eagleton" "Open Constellations of History" _blank
`;

const statusEl = document.getElementById("mapStatus");
const target = document.getElementById("mmd-target");
let scale = 1;
function applyScale() { target.style.transform = `scale(${scale})`; }

mermaid.initialize({ startOnLoad: false, securityLevel: "loose", flowchart: { htmlLabels: true, curve: "basis" }, theme: "base", themeVariables: { background: "transparent", primaryColor: "transparent", primaryBorderColor: pal.line, primaryTextColor: pal.ink, lineColor: pal.muted, clusterBkg: "transparent", clusterBorder: pal.line, fontFamily: "inherit" } });

mermaid.render("mmdGraph", graphSrc).then(({ svg }) => {
  target.innerHTML = svg;
  statusEl.textContent = "81 nodes · rendered client-side with Mermaid. Drag to scroll, click a box to open its page.";
}).catch((err) => {
  statusEl.textContent = "Diagram failed to render: " + err.message;
  console.error(err);
});

document.getElementById("zoomIn").addEventListener("click", () => { scale = Math.min(1.6, scale + 0.1); applyScale(); });
document.getElementById("zoomOut").addEventListener("click", () => { scale = Math.max(0.3, scale - 0.1); applyScale(); });
document.getElementById("zoomReset").addEventListener("click", () => { scale = 1; applyScale(); });
