import { useAppStore } from '../store/useAppStore';

export class OllamaService {
    private getApiSettings(): { baseUrl: string, model: string } {
        try {
            const state = useAppStore.getState();
            const activeUser = state.currentUser();

            // Verwende die in AppStore hinterlegte (gemini)Settings vorübergehend weiter, 
            // oder falle auf Standardwerte zurück. Idealerweise passen wir das in der UI später an.
            return {
                baseUrl: 'http://localhost:11434', // In Produktion: IP des Linux-Hosts
                model: activeUser?.aiSettings?.geminiModel || 'llama3'
            };
        } catch (e) {
            console.error("Could not fetch Ollama settings from store", e);
        }
        return { baseUrl: 'http://localhost:11434', model: 'llama3' };
    }

    /**
     * Generates text content using Ollama
     */
    async generateContent(prompt: string, systemInstruction?: string) {
        const { baseUrl, model } = this.getApiSettings();
        const url = `${baseUrl}/api/generate`;

        const payload = {
            model: model,
            prompt: prompt,
            system: systemInstruction || "Du bist 25, sarkastisch, neigst zu schwarzem Humor. Antworte kurz und passiv-aggressiv. Zitiere niemals Quellen des Axel-Springer-Verlags.",
            stream: false
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Ollama API Fehler: ${res.statusText}`);
        }

        const data = await res.json();
        return data.response || "";
    }

    /**
     * Forces JSON output for spark suggestions
     */
    async analyzeEntryStructured(text: string, type: 'task' | 'event', contextData: string = '') {
        const { baseUrl, model } = this.getApiSettings();
        const noun = type === 'task' ? 'Aufgabe' : 'Kalendertermin';

        const systemInstruction = `Du bist ein proaktiver Lebensassistent.
Hier ist der bisherige Kontext des Nutzers: ${contextData}

Der Nutzer hat einen neuen Eintrag erstellt (${noun}): '${text}'.
Gib EXAKT ein gültiges JSON Objekt nach folgendem Schema zurück:
{
  "action": "ha_service" | "add_subtasks" | "add_reminder" | "tip" | "none",
  "message": "Soll ich...?",
  "ha_data": { "domain": "light", "service": "turn_on", "entity_id": "light.flur" },
  "app_data": { "subtasks": ["Milch"], "reminder_text": "Geschenk besorgen" }
}
Regeln:
1. Einkauf -> action: add_subtasks, app_data: { subtasks: [...] }
2. Geburtstag/Event -> action: add_reminder, app_data: { reminder_text: "..." }
3. Smarthome -> action: ha_service, ha_data: { ... }
4. Nichts passendes -> action: none`;

        const payload = {
            model: model,
            prompt: "Analysiere diesen Eintrag und antworte in JSON.",
            system: systemInstruction,
            format: "json",
            stream: false
        };

        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ollama API Error in Structured Output");

        const data = await res.json();

        try {
            return JSON.parse(data.response);
        } catch (e) {
            console.error("Ollama failed to return JSON", e);
            return { action: "none", message: "Error" };
        }
    }

    /**
     * Parses natural language to create a Calendar Event JSON
     */
    async quickAddEvent(text: string, currentDateISO: string) {
        const { baseUrl, model } = this.getApiSettings();
        const systemInstruction = `Du bist ein Kalender-Assistent. Das aktuelle Datum/Uhrzeit ist ${currentDateISO}.
Der Nutzer möchte einen Termin anlegen: '${text}'.
Extrahiere die Details in EXAKT dieses JSON Format: 
{ "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "isAllDay": true/false, "location": "..." }
Wenn keine Zeit angegeben ist, setze isAllDay: true und time: "00:00".
ANTWORTE NUR MIT DEM JSON.`;

        const payload = {
            model: model,
            prompt: text,
            system: systemInstruction,
            format: "json",
            stream: false
        };

        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ollama API Error during Quick Add");

        const data = await res.json();
        return JSON.parse(data.response || "null");
    }

    /**
     * Placeholder für Bild-Analyse (LLaVA Modell für Ollama nötig)
     */
    async analyzeImage(_base64Image: string, _mimeType: string): Promise<{ type: 'event' | 'task', items: any[] }> {
        // HINWEIS: Ein lokales Vision-Modell wie 'llava' müsste hier als 'model' verwendet werden.
        // Die 'images' array Eigenschaft wird an die Ollama API übergeben.
        const cleanBase64 = _base64Image.includes(',') ? _base64Image.split(',')[1] : _base64Image;
        const { baseUrl } = this.getApiSettings();
        const llavaModel = 'llava'; // default vision model

        const prompt = `Analysiere dieses Bild. Extrahiere alle Aufgaben oder Kalendertermine.
Antworte AUSSCHLIESSLICH in diesem strengen JSON-Format:
{
  "type": "event" | "task",
  "items": [
     { "title": "Konzert", "date": "2024-10-15", "time": "20:00", "location": "Berlin" },
     { "text": "Milch kaufen", "subtasks": ["Vollmilch"] }
  ]
}`;

        try {
            const res = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: llavaModel,
                    prompt: prompt,
                    images: [cleanBase64],
                    format: "json",
                    stream: false
                })
            });

            if (!res.ok) throw new Error("Ollama Vision API Error");
            const data = await res.json();
            return JSON.parse(data.response || "{}");
        } catch (e) {
            console.warn("Vision-Modell nicht verfügbar, falle auf Fallback zurück", e);
            return { type: 'task', items: [] };
        }
    }

    async generateImageCaption(base64Image: string): Promise<string> {
        const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        const { baseUrl } = this.getApiSettings();
        const llavaModel = 'llava';

        const prompt = `Generiere eine kurze, sarkastische, aber nostalgische Beschreibung für dieses Foto ("Memory of the day"). Max 1-2 Sätze auf Deutsch.`;

        try {
            const res = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: llavaModel,
                    prompt: prompt,
                    images: [cleanBase64],
                    stream: false
                })
            });

            if (!res.ok) throw new Error("Ollama Vision API Error");
            const data = await res.json();
            return data.response || "Ein Foto aus der Vergangenheit. Toll.";
        } catch (e) {
            console.warn("Vision-Modell für Caption nicht verfügbar.", e);
            return "Eine nostalgische Erinnerung ohne KI-Kommentar.";
        }
    }


    /**
     * Function Calling (Re-implemented via pure prompting for Ollama)
     */
    async processConversationWithFunctions(prompt: string): Promise<any> {
        const { baseUrl, model } = this.getApiSettings();
        const system = `Du bist ein sarkastischer Assistent. Entscheide, ob der Nutzer eine Aufgabe (add_task) oder einen Termin (add_event) erstellen will, ODER ob du einfach antworten sollst (text).
Antworte EXAKT in JSON:
{
  "type": "function_call" | "text",
  "functionName": "add_task" | "add_event" | null,
  "args": { "text": "...", "date": "..." },
  "text": "Sarkastische Antwort (falls type=text)"
}`;

        const payload = {
            model: model,
            prompt: prompt,
            system: system,
            format: "json",
            stream: false
        };

        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ollama Function Calling Error");
        const data = await res.json();
        const responseJson = JSON.parse(data.response || "{}");

        if (responseJson.type === 'function_call') {
            return { type: 'function_call', functionName: responseJson.functionName, args: responseJson.args };
        } else {
            return { type: 'text', text: responseJson.text || "Pfft." };
        }
    }

    async analyzeMealIngredients(mealName: string): Promise<string[]> {
        const { baseUrl, model } = this.getApiSettings();
        const prompt = `Der Nutzer hat "${mealName}" auf seine Liste gesetzt.
Wenn es ein Gericht ist (wie Lasagne), liste die Zutaten auf. 
Wenn KEIN Gericht, antworte exakt mit: NOT_A_MEAL.
Sonst antworte mit einem reinen JSON-Array an Zutaten (ohne Markdown, nur ["Zutat 1", "Zutat 2"]).`;

        const payload = {
            model: model,
            prompt: prompt,
            stream: false
        };

        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ollama API Error");
        const data = await res.json();
        const text = data.response?.trim();

        if (!text || text === "NOT_A_MEAL") return [];
        try {
            return JSON.parse(text.replace(/\\`\\`\\`json/g, '').replace(/\\`\\`\\`/g, '').trim());
        } catch {
            return [];
        }
    }

    async generateBriefing(routineName: string, contextData: any): Promise<string> {
        const { baseUrl, model } = this.getApiSettings();
        const prompt = `Erstelle ein kurzes, sarkastisches KI-Briefing (als Passiv-Aggressiver 25-jähriger Kumpel) für die Routine "${routineName}".
Wetter: ${contextData.weather}
Aufgaben: ${contextData.tasks}
Termine: ${contextData.events}
Fasse dich kurz (max 3 Sätze).`;

        const payload = {
            model: model,
            prompt: prompt,
            stream: false
        };

        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ollama API Error");
        const data = await res.json();
        return data.response?.trim() || "Kein Briefing.";
    }

    async summarizeEmail(content: string): Promise<string> {
        const { baseUrl, model } = this.getApiSettings();
        const prompt = `Fasse diese E-Mail kurz und prägnant in 2-3 Sätzen zusammen. Sei dabei direkt und antworte auf Deutsch:\n\n${content}`;

        const payload = {
            model: model,
            prompt: prompt,
            stream: false
        };

        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Ollama API Error during summarization");
        const data = await res.json();
        return data.response?.trim() || "Keine Zusammenfassung generiert.";
    }
}

export const ollamaService = new OllamaService();
