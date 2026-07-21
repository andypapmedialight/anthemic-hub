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

const NODE_INDEX = [
  {id:"platoAr", name:"Plato · Aristotle", sub:"akrasia", group:"grounding"},
  {id:"artemid", name:"Artemidorus", sub:"dream interpretation", group:"grounding"},
  {id:"spinoza", name:"Spinoza", sub:"desire w/o knowing why", group:"grounding"},
  {id:"leibniz", name:"Leibniz", sub:"petites perceptions", group:"grounding"},
  {id:"herbart", name:"Herbart", sub:"dynamic psychology", group:"grounding"},
  {id:"schopen", name:"Schopenhauer", sub:"the Will", group:"grounding"},
  {id:"vonHart", name:"von Hartmann", sub:"Philosophy of the Unconscious", group:"grounding"},
  {id:"charJan", name:"Charcot · Janet", sub:"hysteria, dissociation", group:"grounding"},
  {id:"fechner", name:"Fechner", sub:"constancy principle", group:"grounding"},
  {id:"ellenb", name:"Ellenberger", sub:"synthesis thesis", group:"grounding"},
  {id:"freud", name:"Freud", sub:"id · ego · superego", group:"grounding"},
  {id:"popper", name:"Popper", sub:"falsifiability", group:"grounding"},
  {id:"grunbaum", name:"Grünbaum", sub:"the tally argument", group:"grounding"},
  {id:"crews", name:"Crews", sub:"historical fraud", group:"grounding"},
  {id:"eysenck", name:"Eysenck", sub:"efficacy", group:"grounding"},
  {id:"malinowski", name:"Malinowski", sub:"Trobriand fieldwork", group:"grounding"},
  {id:"lacan", name:"Lacan", sub:"Real · Symbolic · Imaginary", group:"grounding"},
  {id:"structImp", name:"Saussure · Jakobson · Lévi-Strauss · Benveniste", sub:"structuralist imports", group:"grounding"},
  {id:"kristeva", name:"Kristeva", sub:"the semiotic", group:"grounding"},
  {id:"chomLak", name:"Chomsky · Lakoff", sub:"innate / embodied pushback", group:"grounding"},
  {id:"zizek", name:"Žižek", sub:"parallax view", group:"grounding"},
  {id:"johnston", name:"Johnston", sub:"transcendental materialism", group:"grounding"},
  {id:"hofstadter", name:"Hofstadter", sub:"strange loop", group:"grounding"},
  {id:"searle", name:"Searle", sub:"Chinese Room", group:"grounding"},
  {id:"churchland", name:"P. & P. Churchland", sub:"eliminative materialism", group:"grounding"},
  {id:"damasio", name:"Damasio", sub:"core / autobiographical self", group:"grounding"},
  {id:"friston", name:"Friston", sub:"predictive processing", group:"grounding"},
  {id:"ledoux", name:"LeDoux", sub:"fast threat pathway", group:"grounding"},
  {id:"malabou", name:"Malabou", sub:"destructive plasticity", group:"grounding"},
  {id:"edelman", name:"Edelman", sub:"TNGS · reentry", group:"grounding"},
  {id:"hobsonMc", name:"Hobson · McCarley", sub:"activation-synthesis", group:"grounding"},
  {id:"solms", name:"Solms", sub:"SEEKING drives dreaming", group:"grounding"},
  {id:"domhoff", name:"Domhoff", sub:"continuity hypothesis", group:"grounding"},
  {id:"chalmers", name:"Chalmers", sub:"hard problem", group:"grounding"},
  {id:"jackson", name:"Jackson", sub:"Mary's Room", group:"grounding"},
  {id:"nagel", name:"Nagel", sub:"Mind and Cosmos", group:"grounding"},
  {id:"strawGoff", name:"Strawson · Goff", sub:"panpsychism", group:"grounding"},
  {id:"kastrup", name:"Kastrup", sub:"analytic idealism", group:"grounding"},
  {id:"miller", name:"Miller-school", sub:"anti-neuro Lacan", group:"grounding"},
  {id:"kant", name:"Kant", sub:"phenomena / noumena", group:"genealogies"},
  {id:"hegel", name:"Hegel", sub:"lordship and bondage", group:"genealogies"},
  {id:"nietzsche", name:"Nietzsche", sub:"genealogy as method", group:"genealogies"},
  {id:"kojeve", name:"Kojève", sub:"desire for recognition", group:"genealogies"},
  {id:"marx", name:"Marx", sub:"base & superstructure", group:"genealogies"},
  {id:"reich", name:"Reich", sub:"character armor", group:"genealogies"},
  {id:"adorno", name:"Adorno · Horkheimer", sub:"culture industry", group:"genealogies"},
  {id:"marcuse", name:"Marcuse", sub:"surplus-repression", group:"genealogies"},
  {id:"fromm", name:"Fromm", sub:"escape from freedom", group:"genealogies"},
  {id:"bergson", name:"Bergson", sub:"durée · élan vital", group:"genealogies"},
  {id:"althusser", name:"Althusser", sub:"interpellation", group:"genealogies"},
  {id:"dg", name:"Deleuze & Guattari", sub:"desiring-production", group:"genealogies"},
  {id:"foucault", name:"Foucault", sub:"biopower", group:"genealogies"},
  {id:"baudLyo", name:"Baudrillard · Lyotard", sub:"simulacra · libidinal economy", group:"genealogies"},
  {id:"plant", name:"Sadie Plant", sub:"cyberfeminism", group:"genealogies"},
  {id:"land", name:"Nick Land", sub:"accelerationism", group:"genealogies"},
  {id:"fisher", name:"Mark Fisher", sub:"capitalist realism", group:"genealogies"},
  {id:"ccruTrio", name:"Eshun · Mackay · Grant", sub:"theory-fiction", group:"genealogies"},
  {id:"leftAccel", name:"Left-accelerationism", sub:"Srnicek & Williams", group:"genealogies"},
  {id:"acidXeno", name:"Acid Communism / Xenofeminism", sub:"", group:"genealogies"},
  {id:"berardiDean", name:"Berardi · Dean", sub:"semiocapitalism", group:"genealogies"},
  {id:"lukacs", name:"Lukács", sub:"reification", group:"constellations"},
  {id:"gramsci", name:"Gramsci", sub:"hegemony", group:"constellations"},
  {id:"benjamin", name:"Benjamin", sub:"aura · dialectical image", group:"constellations"},
  {id:"bloch", name:"Bloch", sub:"non-synchronism", group:"constellations"},
  {id:"brecht", name:"Brecht", sub:"epic theater", group:"constellations"},
  {id:"scholem", name:"Scholem", sub:"Kabbalah · messianism", group:"constellations"},
  {id:"kracauer", name:"Kracauer", sub:"mass ornament", group:"constellations"},
  {id:"debord", name:"Debord", sub:"society of the spectacle", group:"constellations"},
  {id:"williamsR", name:"Raymond Williams", sub:"structure of feeling", group:"constellations"},
  {id:"hall", name:"Stuart Hall", sub:"encoding / decoding", group:"constellations"},
  {id:"jameson", name:"Jameson", sub:"cognitive mapping", group:"constellations"},
  {id:"anderson", name:"Perry Anderson", sub:"coins Western Marxism", group:"constellations"},
  {id:"harvey", name:"David Harvey", sub:"time-space compression", group:"constellations"},
  {id:"eagleton", name:"Terry Eagleton", sub:"popularizer", group:"constellations"},
  {id:"cUnconscious", name:"the unconscious / repression", sub:"", group:"concept"},
  {id:"cIdeology", name:"ideology", sub:"", group:"concept"},
  {id:"cRecog", name:"desire & recognition", sub:"", group:"concept"},
  {id:"cReif", name:"reification / commodity fetishism", sub:"", group:"concept"},
  {id:"cHardProb", name:"the hard problem / subject as gap", sub:"", group:"concept"},
  {id:"cGenMethod", name:"genealogy as method", sub:"", group:"concept"},
  {id:"cHegemony", name:"hegemony", sub:"", group:"concept"}
];

const GROUP_LABELS = { grounding: "Grounding the Unconscious", genealogies: "Genealogies of Desire", constellations: "Constellations of History", concept: "Shared concepts" };

function normalizeSearch(str) {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const statusEl = document.getElementById("mapStatus");
const target = document.getElementById("mmd-target");
const sidebarList = document.getElementById("mapSidebarList");
const searchInput = document.getElementById("mapSearch");

mermaid.initialize({ startOnLoad: false, securityLevel: "loose", flowchart: { htmlLabels: true, curve: "basis" }, theme: "base", themeVariables: { background: "transparent", primaryColor: "transparent", primaryBorderColor: pal.line, primaryTextColor: pal.ink, lineColor: pal.muted, clusterBkg: "transparent", clusterBorder: pal.line, fontFamily: "inherit" } });

let panZoomInstance = null;

function buildSidebar() {
  const frag = document.createDocumentFragment();
  let lastGroup = null;
  for (const n of NODE_INDEX) {
    if (n.group !== lastGroup) {
      const label = document.createElement("div");
      label.className = "grp-label";
      label.textContent = GROUP_LABELS[n.group] || n.group;
      frag.appendChild(label);
      lastGroup = n.group;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = n.id;
    btn.dataset.filter = normalizeSearch(n.name + " " + n.sub);
    btn.textContent = n.sub ? `${n.name} — ${n.sub}` : n.name;
    btn.addEventListener("click", () => centerOnNode(n.id));
    frag.appendChild(btn);
  }
  sidebarList.appendChild(frag);
}

function centerOnNode(id) {
  if (!panZoomInstance) return;
  const svg = target.querySelector("svg");
  const marker = `-${id}-`;
  const nodeEl = [...svg.querySelectorAll(".node")].find((el) => el.id.includes(marker));
  if (!nodeEl) return;
  const bbox = nodeEl.getBBox();
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const sizes = panZoomInstance.getSizes();
  const z = Math.max(sizes.realZoom, 1.4);
  panZoomInstance.zoom(z);
  panZoomInstance.pan({ x: sizes.width / 2 - cx * z, y: sizes.height / 2 - cy * z });
}

searchInput.addEventListener("input", () => {
  const q = normalizeSearch(searchInput.value.trim());
  const buttons = sidebarList.querySelectorAll("button");
  const labels = sidebarList.querySelectorAll(".grp-label");
  buttons.forEach((b) => { b.hidden = q.length > 0 && !b.dataset.filter.includes(q); });
  labels.forEach((l) => {
    let sib = l.nextElementSibling;
    let anyVisible = false;
    while (sib && sib.tagName === "BUTTON") { if (!sib.hidden) anyVisible = true; sib = sib.nextElementSibling; }
    l.hidden = q.length > 0 && !anyVisible;
  });
});

mermaid.render("mmdGraph", graphSrc).then(({ svg }) => {
  target.innerHTML = svg;
  const svgEl = target.querySelector("svg");
  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");
  svgEl.style.width = "100%";
  svgEl.style.height = "100%";

  panZoomInstance = window.svgPanZoom(svgEl, {
    zoomEnabled: true, panEnabled: true, controlIconsEnabled: false,
    fit: true, center: true, minZoom: 0.2, maxZoom: 20, zoomScaleSensitivity: 0.35
  });

  buildSidebar();
  statusEl.textContent = "81 nodes, 121 edges · scroll/pinch to zoom, drag to pan, or use the index on the left.";
}).catch((err) => {
  statusEl.textContent = "Diagram failed to render: " + err.message;
  console.error(err);
});

document.getElementById("zoomIn").addEventListener("click", () => panZoomInstance && panZoomInstance.zoomIn());
document.getElementById("zoomOut").addEventListener("click", () => panZoomInstance && panZoomInstance.zoomOut());
document.getElementById("zoomFit").addEventListener("click", () => { if (panZoomInstance) { panZoomInstance.fit(); panZoomInstance.center(); } });
document.getElementById("zoomReset").addEventListener("click", () => { if (panZoomInstance) { panZoomInstance.reset(); panZoomInstance.fit(); panZoomInstance.center(); } });

window.addEventListener("resize", () => { if (panZoomInstance) { panZoomInstance.resize(); panZoomInstance.fit(); panZoomInstance.center(); } });
