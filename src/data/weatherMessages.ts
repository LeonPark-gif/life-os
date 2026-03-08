export type WeatherCondition = 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';
export type TempRange = 'freezing' | 'cold' | 'mild' | 'warm' | 'hot';

interface WeatherMessage {
    text: string;
    condition?: WeatherCondition[];
    minTemp?: number;
    maxTemp?: number;
}

const MESSAGES: WeatherMessage[] = [
    // --- HOT (>30°C) ---
    { text: "Es ist heißer als im Schritt vom Teufel. Trink was.", minTemp: 30 },
    { text: "Die Sonne hasst uns heute persönlich. Bleib im Schatten.", minTemp: 30 },
    { text: "Offizielles 'Arschwasser'-Wetter. Sorry.", minTemp: 30 },
    { text: "Asphalt-Schmelz-Alarm. Geh nicht raus, wenn du nicht musst.", minTemp: 30 },
    { text: "Draußen ist Lava. Wortwörtlich.", minTemp: 32 },
    { text: "Ventilator auf Stufe 3 und beten.", minTemp: 30 },
    { text: "Kostenlose Sauna für alle. Ob wir wollen oder nicht.", minTemp: 29 },
    { text: "Schwitz-Flatrate gebucht. Viel Spaß.", minTemp: 28 },
    { text: "Nicht bewegen. Jede Bewegung erzeugt Wärme.", minTemp: 30 },
    { text: "Deo versagt. Hoffnung auch.", minTemp: 31 },

    // --- WARM & SUN (20-30°C) ---
    { text: "Eigentlich ganz geil draußen. Genieß es, bevor der Winter kommt.", minTemp: 20, maxTemp: 29, condition: ['sun'] },
    { text: "Perfektes Biergarten-Wetter. Oder Balkon. Hauptsache Bier.", minTemp: 20, maxTemp: 29, condition: ['sun'] },
    { text: "Vitamin D tanken, du Kellerkind. Raus mit dir.", minTemp: 18, maxTemp: 28, condition: ['sun'] },
    { text: "Sonnenbrille aufsetzen und wichtig aussehen.", minTemp: 18, maxTemp: 28, condition: ['sun'] },
    { text: "Das Leben ist kurz, das Wetter ist gut. Mach was draus.", minTemp: 22, maxTemp: 28 },
    { text: "T-Shirt Wetter! Zeig deine bleiche Haut.", minTemp: 20, maxTemp: 25 },
    { text: "Eis essen gehen ist heute eine medizinische Notwendigkeit.", minTemp: 23, maxTemp: 29, condition: ['sun'] },
    { text: "Sonne lacht, Blende 8. Oder so.", minTemp: 20, maxTemp: 28, condition: ['sun'] },
    { text: "Seltenes Phänomen: Gutes Wetter. Mach ein Foto.", minTemp: 20, maxTemp: 28, condition: ['sun'] },

    // --- MILD / CLOUDY (10-20°C) ---
    { text: "Nicht Fisch, nicht Fleisch. Zieh 'ne Jacke an, oder auch nicht.", minTemp: 10, maxTemp: 19, condition: ['cloud'] },
    { text: "Grau in Grau. Passt zu deiner Seele, oder?", minTemp: 10, maxTemp: 18, condition: ['cloud'] },
    { text: "Perfektes Wetter, um produktiv zu sein. Oder zu schlafen.", minTemp: 12, maxTemp: 19, condition: ['cloud'] },
    { text: "Langweiligstes Wetter ever. Aber immerhin trocken.", minTemp: 10, maxTemp: 18, condition: ['cloud'] },
    { text: "Der Himmel ist so motiviert wie ich: Gar nicht.", minTemp: 10, maxTemp: 18, condition: ['cloud'] },
    { text: "50 Shades of Grey, aber langweilig.", minTemp: 10, maxTemp: 18, condition: ['cloud'] },
    { text: "Wolkig mit Aussicht auf 'Meh'.", minTemp: 10, maxTemp: 18, condition: ['cloud'] },
    { text: "Der Himmel hat heute Ruhetag.", minTemp: 11, maxTemp: 17, condition: ['cloud'] },

    // --- RAIN (Warm > 15°C - Summer Rain) ---
    { text: "Warmer Regen. Fühlt sich an wie Urin, ist aber Wasser. Hoffentlich.", minTemp: 15, condition: ['rain', 'storm'] },
    { text: "Dusch-Wetter. Sparst du dir das Wasser zuhause.", minTemp: 16, condition: ['rain'] },
    { text: "Es regnet, aber zumindest frierst du dir nichts ab.", minTemp: 15, condition: ['rain'] },
    { text: "Tropisches Feeling in Deutschland. Also schwül und nass.", minTemp: 20, condition: ['rain'] },
    { text: "Nass, aber warm. Eklige Kombi, aber leb damit.", minTemp: 18, condition: ['rain'] },
    { text: "Gratis Haarkur 'Frizz' heute.", minTemp: 16, condition: ['rain'] },
    { text: "Die Natur freut sich. Du dich weniger.", minTemp: 15, condition: ['rain'] },

    // --- RAIN (Cold < 10°C - Winter Rain/Shit Weather) ---
    { text: "Es pisst wie Hölle. Bleib bloß drin.", maxTemp: 10, condition: ['rain', 'storm'] },
    { text: "Ekelhaftes Dreckswetter. Mach dir 'nen Tee und heul leise.", maxTemp: 9, condition: ['rain'] },
    { text: "Regenjacke? Eher Taucheranzug heute.", maxTemp: 11, condition: ['rain'] },
    { text: "Der Himmel weint. Wahrscheinlich über deinen Lebensstil.", maxTemp: 10, condition: ['rain'] },
    { text: "Pfützen-Alarm. Deine Sneakers werden es hassen.", maxTemp: 12, condition: ['rain'] },
    { text: "Es schifft. Und kalt ist es auch noch. Doppeltes Pech.", maxTemp: 8, condition: ['rain'] },
    { text: "Grausam. Einfach nur grausam draußen.", maxTemp: 7, condition: ['rain'] },
    { text: "Couch-Wetter. Beweg dich keinen Zentimeter.", maxTemp: 10, condition: ['rain', 'storm'] },
    { text: "Schirm bringt heute auch nichts mehr. Lauf.", maxTemp: 12, condition: ['rain', 'storm'] },
    { text: "Herbst-Blues-Simulator 3000.", maxTemp: 11, condition: ['rain'] },
    { text: "Draußen ist 'Bäh'.", maxTemp: 9, condition: ['rain'] },

    // --- FREEZING (< 2°C) ---
    { text: "Arschkalt. Deine Nippel könnten Glas schneiden.", maxTemp: 2 },
    { text: "Zieh dich an wie eine Zwiebel. Es bringt trotzdem nichts.", maxTemp: 1 },
    { text: "Alles gefroren. Pass auf, dass du dich nicht auf die Fresse legst.", maxTemp: 0 },
    { text: "Glühwein-Zeit. Anders ist das nicht zu ertragen.", maxTemp: 3 },
    { text: "Eiszeit. Wo sind die Mammuts, wenn man sie braucht?", maxTemp: -2 },
    { text: "Deine Heizkostenabrechnung wird wehtun.", maxTemp: 4 },
    { text: "Kälter als das Herz deiner Ex.", maxTemp: 2 },
    { text: "Frostbeulen-Garantie.", maxTemp: 0 },
    { text: "Atmen tut weh. Bleib drin.", maxTemp: -5 },
    { text: "Pinguin-Wetter. Watschle vorsichtig.", maxTemp: 1 },

    // --- STORM ---
    { text: "Fliegende Kühe möglich. Bleib weg von den Fenstern.", condition: ['storm'] },
    { text: "Der Wind stylt deine Frisur neu. Ob du willst oder nicht.", condition: ['storm'] },
    { text: "Weltuntergangs-Stimmung light. Popcorn holen.", condition: ['storm'] },
    { text: "Es windet. Sehr. Halt dich gut fest.", condition: ['storm'] },
    { text: "Mülltonnen-Rennen draußen auf der Straße.", condition: ['storm'] },
    { text: "Sturmfrei? Nee, Sturm drinnen und draußen.", condition: ['storm'] },

    // --- SNOW ---
    { text: "Alles weiß. Schön für 5 Minuten, dann nur noch Matsch.", condition: ['snow'] },
    { text: "Schnee! Zeit für Verkehrschaos.", condition: ['snow'] },
    { text: "Kalt. Nass. Weiß. Yay.", condition: ['snow'] },
    { text: "Gelben Schnee nicht essen. Nur so als Tipp.", condition: ['snow'] },
    { text: "Leise rieselt der Kalk. Nee, Schnee.", condition: ['snow'] },
    { text: "Flocken-Alarm. Alle drehen durch.", condition: ['snow'] },
    { text: "Winter Wonderland, aber mit Schneematsch.", condition: ['snow'] },
    { text: "Schneeballschlacht oder erfrieren. Deine Wahl.", condition: ['snow'] },

    // --- DEFAULT / GENERIC ---
    { text: "Wetter ist halt da. Mach das Beste draus." },
    { text: "Fenster auf, Kopf raus, Realitätscheck." },
    { text: "Könnte schlimmer sein. Könnte regnen... oh, warte." },
    { text: "Irgendwas mit Klima und so." },
    { text: "Frag mich später noch mal, bin auch nur ein Algorithmus." },
    { text: "Guck einfach aus dem Fenster." }
];

export function getHonestWeatherMessage(temp: number, condition: WeatherCondition, lastMessage?: string): string {
    // Filter messages that match criteria
    const candidates = MESSAGES.filter(msg => {
        const matchesTemp = (msg.minTemp === undefined || temp >= msg.minTemp) &&
            (msg.maxTemp === undefined || temp <= msg.maxTemp);

        const matchesCondition = msg.condition === undefined || msg.condition.includes(condition);

        return matchesTemp && matchesCondition;
    });

    if (candidates.length === 0) {
        return "Keine Ahnung, guck raus.";
    }

    // Filter out the last displayed message to verify repetition
    const available = candidates.filter(msg => msg.text !== lastMessage);

    // If we only have 1 message and it was the last one, well, repeat it. 
    // Otherwise use the filtered list.
    const pool = available.length > 0 ? available : candidates;

    // Pick random
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex]?.text || "Wetter ist halt da.";
}
