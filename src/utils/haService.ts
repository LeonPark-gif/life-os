export class HAService {
    private url: string;
    private token: string;
    private entityId = 'sensor.life_os_data';

    constructor() {
        // Use injected window.ENV if available (from Docker server.js), fallback to import.meta.env
        const envUrl = (window as any).ENV?.VITE_HA_URL || import.meta.env.VITE_HA_URL || '';
        this.url = import.meta.env.DEV ? '' : envUrl;

        // Remove trailing slash if present to prevent double slashes in fetch
        if (this.url.endsWith('/')) {
            this.url = this.url.slice(0, -1);
        }

        this.token = (window as any).ENV?.VITE_HA_TOKEN || import.meta.env.VITE_HA_TOKEN || '';

        if (!this.token) {
            console.warn('[HAService] No VITE_HA_TOKEN found. Smarthome features and persistence will not work.');
        }
    }

    // Reduced from 15000 to 10000 to safely stay under HA's 16KB attribute limit
    // after JSON encoding overhead is accounted for.
    private CHUNK_SIZE = 10000;

    private async safeParseJson(response: Response) {
        const text = await response.text();
        if (text.trim().startsWith('<')) {
            // This is likely HTML (404 page, login page, etc.)
            console.error('[HAService] Received HTML instead of JSON:', text.substring(0, 100));
            throw new Error('Home Assistant antwortet mit einer Webseite statt Daten. Prüfe deine VITE_HA_URL und ob du eingeloggt bist.');
        }
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('[HAService] JSON Parse Error:', e, 'Raw text:', text.substring(0, 100));
            throw new Error('Die Daten von Home Assistant konnten nicht gelesen werden (Ungültiges Format).');
        }
    }

    // Cache the last known state to detect external changes
    public lastSync: string | null = null;

    async getState(includeMeta = false) {
        if (!this.token) return null;
        try {
            console.log(`[HAService] Fetching state from HA (Chunking enabled)...`);
            const res = await fetch(`${this.url}/api/states/${this.entityId}_0`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error('Home Assistant Token ungültig oder abgelaufen (401).');
                if (res.status === 404 && this.url === '' && import.meta.env.DEV) {
                    throw new Error('VITE_HA_URL ist leer. Im Entwicklungsmodus (npm run dev) muss die URL gesetzt sein!');
                }

                const legacyRes = await fetch(`${this.url}/api/states/${this.entityId}`, {
                    headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                });
                if (!legacyRes.ok) {
                    if (legacyRes.status === 404) return null;
                    throw new Error(`HA API Error: ${legacyRes.status}`);
                }
                const legacyData = await this.safeParseJson(legacyRes);
                return legacyData.attributes.data;
            }

            const masterData = await this.safeParseJson(res);
            const totalChunks = masterData.attributes.total_chunks || 1;
            let fullJsonString = masterData.attributes.data_chunk || '';

            // Update lastSync timestamp from HA metadata
            this.lastSync = masterData.attributes.last_updated;

            // Read exactly totalChunks - 1 more chunks (chunk 0 is already read).
            // Each chunk is fetched individually with its own error handling to prevent
            // stale chunks from corrupting the full JSON string.
            for (let i = 1; i < totalChunks; i++) {
                try {
                    const chunkRes = await fetch(`${this.url}/api/states/${this.entityId}_${i}`, {
                        headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                    });
                    if (!chunkRes.ok) throw new Error(`Fehler beim Laden von Daten-Teil ${i} (HTTP ${chunkRes.status})`);
                    const chunkData = await this.safeParseJson(chunkRes);
                    fullJsonString += (chunkData.attributes.data_chunk || '');
                } catch (chunkError) {
                    console.error(`[HAService] Failed to load chunk ${i}:`, chunkError);
                    throw new Error(`Daten-Teil ${i} konnte nicht geladen werden. Bitte Seite neu laden.`);
                }
            }

            const parsed = JSON.parse(fullJsonString);
            return includeMeta ? { data: parsed, last_updated: masterData.attributes.last_updated } : parsed;

        } catch (error) {
            console.error('[HAService] Failed to fetch state:', error);
            throw error;
        }
    }

    async saveState(appState: any) {
        if (!this.token) throw new Error('Kein Home Assistant Token konfiguriert.');
        try {
            const jsonString = JSON.stringify(appState);
            const newTotalChunks = Math.ceil(jsonString.length / this.CHUNK_SIZE);
            const syncTimestamp = new Date().toISOString();

            console.log(`[HAService] Saving state. Chunks needed: ${newTotalChunks}, total chars: ${jsonString.length}`);

            // Write all new chunks
            for (let i = 0; i < newTotalChunks; i++) {
                const chunkData = jsonString.substring(i * this.CHUNK_SIZE, (i + 1) * this.CHUNK_SIZE);
                const currentEntityId = `${this.entityId}_${i}`;

                const payload = {
                    state: "active",
                    attributes: {
                        data_chunk: chunkData,
                        chunk_index: i,
                        total_chunks: newTotalChunks,
                        last_updated: syncTimestamp,
                        friendly_name: `Life OS Data Store (Part ${i + 1}/${newTotalChunks})`,
                        icon: "mdi:brain"
                    }
                };

                const response = await fetch(`${this.url}/api/states/${currentEntityId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error(`Speicherfehler in Home Assistant (${response.status})`);
            }

            // Invalidate any stale chunks from a previous save that had MORE chunks.
            // We try to clean up up to 10 old chunks beyond what we just wrote.
            // This prevents stale chunks from being read back and corrupting the JSON.
            for (let i = newTotalChunks; i < newTotalChunks + 10; i++) {
                const staleEntityId = `${this.entityId}_${i}`;
                try {
                    const checkRes = await fetch(`${this.url}/api/states/${staleEntityId}`, {
                        headers: { 'Authorization': `Bearer ${this.token}` },
                    });
                    if (checkRes.status === 404) break; // No more stale chunks exist, stop
                    if (!checkRes.ok) break;

                    // Overwrite stale chunk with an empty/obsolete sentinel
                    await fetch(`${this.url}/api/states/${staleEntityId}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            state: "obsolete",
                            attributes: {
                                data_chunk: '',
                                chunk_index: i,
                                total_chunks: 0,
                                friendly_name: `Life OS Data Store (Obsolete Part ${i + 1})`,
                                icon: "mdi:brain"
                            }
                        })
                    });
                    console.log(`[HAService] Cleaned up stale chunk: ${staleEntityId}`);
                } catch {
                    break; // Stop cleanup on error, don't fail the whole save
                }
            }

            this.lastSync = syncTimestamp;
            console.log(`[HAService] Save success. (${newTotalChunks} chunks)`);

        } catch (error) {
            console.error('[HAService] Save error:', error);
            throw error;
        }
    }


    // New: Get specific entity state
    async getEntityState(entityId: string) {
        if (!this.token) return null;
        try {
            const res = await fetch(`${this.url}/api/states/${entityId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (error) {
            console.error(`[HAService] Failed to fetch ${entityId}:`, error);
            return null;
        }
    }

    // New: Get all entities
    async getEntities() {
        if (!this.token) return [];
        try {
            console.log(`[HAService] Fetching all entities`);
            const res = await fetch(`${this.url}/api/states`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (error) {
            console.error(`[HAService] Failed to fetch entities:`, error);
            return [];
        }
    }

    // New: Call a service (turn_on, turn_off, etc.)
    async callService(domain: string, service: string, serviceData: any = {}) {
        if (!this.token) return;
        try {
            console.log(`[HAService] Calling service ${domain}.${service}`, serviceData);
            const res = await fetch(`${this.url}/api/services/${domain}/${service}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(serviceData)
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            console.log(`[HAService] Service call success`, data);
            return data;
        } catch (error) {
            console.error(`[HAService] Service call failed:`, error);
        }
    }

    // New: Process text with HA Conversation API (Gemini or Local)
    async processConversation(text: string, agentId?: string) {
        if (!this.token) return null;
        try {
            const bodyData: any = {
                text: text,
                language: "de"
            };
            if (agentId) {
                bodyData.agent_id = agentId;
            }

            const res = await fetch(`${this.url}/api/conversation/process`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyData)
            });

            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            return data; // Returns { speech: { plain: { speech: "..." } } } usually
        } catch (error) {
            console.error('[HAService] Conversation failed:', error);
            return null;
        }
    }
    // Proactive Help: Analyze a task or event to suggest actions
    async analyzeEntry(text: string, type: 'task' | 'event', contextData: string = '', agentId?: string) {
        const noun = type === 'task' ? 'Aufgabe' : 'Kalendertermin';
        const prompt = `Hier ist der bisherige Kontext des Nutzers (alte Einkäufe, Historie): ${contextData}

Der Nutzer hat einen neuen Eintrag erstellt (${noun}): '${text}'.
Analysiere das proaktiv und hilf ihm.

REGELN FÜR AKTIONEN:
1. "Einkauf" (z.B. Rewe, Lidl, Aldi): Schlage basierend auf der Historie oder Logik typische Einkäufe als Unteraufgaben vor. (action: "add_subtasks", app_data: { subtasks: ["Milch", "Eier"] })
2. "Geburtstag / Event": Frage ob eine Erinnerung oder Geschenksuche als Aufgabe angelegt werden soll. (action: "add_reminder", app_data: { reminder_text: "Geschenk für ... besorgen" })
3. "Smarthome": (action: "ha_service", ha_data: { domain: "light", service: "turn_on", entity_id: "light.flur" })
4. "Genereller Tipp": (action: "tip")
5. "Nichts Relevantes": (action: "none")

ANTWORTE STRICKT IM JSON FORMAT:
{
  "action": "ha_service" | "add_subtasks" | "add_reminder" | "tip" | "none",
  "message": "Soll ich...? (z.B. 'Soll ich folgende Dinge auf die Einkaufsliste setzen: Milch, Brot?')",
  "ha_data": { "domain": "", "service": "", "entity_id": "" },
  "app_data": { "subtasks": [], "reminder_text": "" }
}
WICHTIG: GIB AUSSCHLIESSLICH VALIDES JSON ZURÜCK. KEIN MARKDOWN. KEIN TEXT DAVOR ODER DANACH.`;
        const res = await this.processConversation(prompt, agentId);

        try {
            const speech = res?.response?.speech?.plain?.speech || res?.speech?.plain?.speech;
            if (speech) {
                // Robust JSON extraction: find the first { and last }
                const match = speech.match(/\{[\s\S]*\}/);
                if (match) {
                    return JSON.parse(match[0]);
                }
            }
        } catch (e) {
            console.error('[HAService] analyzeEntry JSON parse error:', e, 'Raw:', res);
        }
        return { action: 'none', message: '' };
    }

    // Quick Add Calendar: Parse natural language into event
    async quickAddEvent(text: string, agentId?: string) {
        const now = new Date();
        const prompt = `Today is ${now.toISOString()}. User typed event quick-add: '${text}'. Extract event details in strict JSON format: { "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "isAllDay": boolean, "location": "..." }. If time is not specified, set isAllDay: true and time: "00:00". Return ONLY valid JSON.`;
        const res = await this.processConversation(prompt, agentId);

        try {
            const speech = res?.response?.speech?.plain?.speech || res?.speech?.plain?.speech;
            if (speech) {
                const jsonStr = speech.replace(/```json|```/g, '').trim();
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            console.error('[HAService] quickAddEvent JSON parse error:', e, 'Raw:', res);
        }
        return null;
    }

    // Historical Analysis (Deep Scan)
    async analyzeHistory(contextData: string, agentId?: string) {
        const prompt = `Hier sind alle historischen und zukünftigen Daten des Nutzers (Aufgaben, Termine): ${contextData}. Analysiere diese Daten. Gibt es wiederkehrende Muster, vergessene wichtige Aufgaben oder bevorstehende kritische Dinge (wie Geburtstage)? Gib EINE einzige wertvolle Erkenntnis als Tipp zurück. Striktes JSON Format: { "action": "tip" | "none", "entity_id": "", "message": "Deine Erkenntnis oder Erinnerung" }. Gib "none" zurück, wenn es nichts Wichtiges gibt. GIB NUR VALIDES JSON aus.`;
        const res = await this.processConversation(prompt, agentId);

        try {
            const speech = res?.response?.speech?.plain?.speech || res?.speech?.plain?.speech;
            if (speech) {
                const jsonStr = speech.replace(/```json|```/g, '').trim();
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            console.error('[HAService] analyzeHistory JSON parse error:', e, 'Raw:', res);
        }
        return { action: 'none' };
    }
}

export const haService = new HAService();
