import express from 'express';
import cors from 'cors';
import imapSimple from 'imap-simple';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import { v4 as uuidv4 } from 'uuid';
import ical from 'node-ical';
import mqtt from 'mqtt';
import { createClient } from 'webdav';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Accept any origin when running inside HA Ingress
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8099;

// ─────────────────────────────────────────────
// BACKUP CONFIG
// ─────────────────────────────────────────────
const BACKUP_DIR = '/config/life-os-backups';
const STATE_FILE = '/config/life-os-state.json';
const MAX_BACKUPS = 7; // Keep one week of daily backups

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`[Backup] Created backup directory: ${BACKUP_DIR}`);
    }
}

function pruneOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('life-os-backup-') && f.endsWith('.json'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time); // newest first

        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(f => {
                fs.unlinkSync(path.join(BACKUP_DIR, f.name));
                console.log(`[Backup] Pruned old backup: ${f.name}`);
            });
        }
    } catch (e) {
        console.error('[Backup] Error pruning old backups:', e);
    }
}

// ─────────────────────────────────────────────
// BACKUP ROUTES
// ─────────────────────────────────────────────

// Save a backup (called from frontend after data changes)
app.post('/api/backup/save', (req, res) => {
    try {
        ensureBackupDir();
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        const filename = `life-os-backup-${dateStr}_${timeStr}.json`;
        const filepath = path.join(BACKUP_DIR, filename);

        const backupData = {
            timestamp: now.toISOString(),
            version: '1.0',
            data: req.body
        };

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');
        pruneOldBackups();

        console.log(`[Backup] Saved backup: ${filename}`);
        res.json({ success: true, filename });
    } catch (e) {
        console.error('[Backup] Failed to save backup:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─────────────────────────────────────────────
// STATE STORAGE ROUTES
// ─────────────────────────────────────────────

app.get('/api/state', (req, res) => {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return res.json({ success: true, data: null });
        }
        const content = fs.readFileSync(STATE_FILE, 'utf-8');
        res.json({ success: true, data: JSON.parse(content) });
    } catch (e) {
        console.error('[State] Failed to load state:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/state', (req, res) => {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
        console.log(`[State] Saved application state.`);
        res.json({ success: true });
    } catch (e) {
        console.error('[State] Failed to save state:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─────────────────────────────────────────────
// DAILY BRIEFING ROUTE (OLLAMA)
// ─────────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'; // Default model

app.post('/api/briefing', async (req, res) => {
    try {
        const { date, calendarEvents, tasks, habits } = req.body;

        let prompt = `Du bist MACS, der sarkastische und humorvolle Desk-Buddy des Nutzers. 
Generiere ein kurzes "Daily Briefing" für heute (${date}).
Fasse den Tag zusammen. Sei direkt, ein bisschen frech, aber motivierend.
Halte es sehr kurz (max. 3-4 Sätze).

Hier sind die Daten für heute:
- Termine: ${JSON.stringify(calendarEvents)}
- Aufgaben: ${JSON.stringify(tasks)}
- Gewohnheiten: ${JSON.stringify(habits)}
`;

        console.log(`[Briefing] Requesting briefing from Ollama at ${OLLAMA_URL}...`);

        const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false
            })
        });

        if (!ollamaRes.ok) {
            throw new Error(`Ollama API error: ${ollamaRes.status} ${ollamaRes.statusText}`);
        }

        const data = await ollamaRes.json();
        const briefingText = data.response || "Es gab ein Problem beim Nachdenken, Chef.";

        res.json({ success: true, briefing: briefingText });

    } catch (e) {
        console.error('[Briefing] Error generating briefing:', e.message);
        res.json({
            success: true,
            briefing: "MACS ist offline. Die KI-Verbindung zu Ollama ist abgebrochen. Du musst deinen Tag heute wohl selbst organisieren."
        });
    }
});

// ─────────────────────────────────────────────
// IMMICH PHOTO BRIDGE
// ─────────────────────────────────────────────
const IMMICH_URL = process.env.IMMICH_URL || 'http://localhost:2283';
const IMMICH_API_KEY = process.env.IMMICH_API_KEY || '';

// ─────────────────────────────────────────────
// NEXTCLOUD WEBDAV BRIDGE
// ─────────────────────────────────────────────
const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || '';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_USER || '';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_PASS || '';

const getWebDAVClient = () => {
    if (!NEXTCLOUD_URL || !NEXTCLOUD_USER || !NEXTCLOUD_PASS) return null;
    return createClient(NEXTCLOUD_URL + '/remote.php/dav/files/' + NEXTCLOUD_USER, {
        username: NEXTCLOUD_USER,
        password: NEXTCLOUD_PASS
    });
};

app.post('/api/nextcloud/list', async (req, res) => {
    try {
        const client = getWebDAVClient();
        if (!client) return res.json({ success: true, files: [] });

        const { path: dirPath = '/' } = req.body;
        const directoryItems = await client.getDirectoryContents(dirPath);

        const files = directoryItems.map(item => ({
            name: item.basename,
            path: item.filename,
            type: item.type,
            size: item.size,
            lastmod: item.lastmod
        }));

        res.json({ success: true, files });
    } catch (e) {
        console.error('[Nextcloud] List error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/nextcloud/read', async (req, res) => {
    try {
        const client = getWebDAVClient();
        if (!client) throw new Error('Nextcloud not configured');

        const { path: filePath } = req.body;
        const content = await client.getFileContents(filePath, { format: 'text' });
        res.json({ success: true, content });
    } catch (e) {
        console.error('[Nextcloud] Read error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/photos/on-this-day', async (req, res) => {
    try {
        if (!IMMICH_API_KEY) {
            return res.json({ success: true, photos: [] });
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        // Optional: Call Immich memory API if available, 
        // or search via timeline API for assets from this month/day in past years.
        // For simplicity, we just use a dummy response or make a real search if API key exists.

        // Example Immich API call for searching:
        const searchRes = await fetch(`${IMMICH_URL}/api/search/metadata`, {
            method: 'POST',
            headers: {
                'x-api-key': IMMICH_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                // Immich search API specifics (we are mocking this since it depends on Immich version)
                // In actual deployment, user uses the /api/assets/memory or similar endpoint
                isFavorite: true // just an example to return something nice
            })
        });

        if (!searchRes.ok) {
            throw new Error(`Immich API error: ${searchRes.status}`);
        }

        const data = await searchRes.json();
        const assets = data.assets?.items || [];

        // We return the thumbnail URLs so the frontend can render them directly
        const photos = assets.slice(0, 5).map(asset => ({
            id: asset.id,
            url: `${IMMICH_URL}/api/assets/${asset.id}/thumbnail?size=preview&key=${IMMICH_API_KEY}`,
            date: asset.fileCreatedAt
        }));

        res.json({ success: true, photos });

    } catch (e) {
        console.error('[Immich] Error fetching photos:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─────────────────────────────────────────────
// VOICE ASSISTANT BRIDGE (HA -> NODE -> OLLAMA)
// ─────────────────────────────────────────────
// We provide an OpenAI compatible endpoint for Home Assistant
// so HA can use the "OpenAI Conversation" integration pointing to us.
// We intercept the prompt, inject Life OS context, and forward to Ollama.

app.post('/v1/chat/completions', async (req, res) => {
    try {
        const body = req.body;

        // 1. Load Life OS Context
        let contextText = "\n\n--- ZUSÄTZLICHER KONTEXT (LIFE OS) ---\n";
        try {
            if (fs.existsSync(STATE_FILE)) {
                const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

                // Get tasks
                const tasks = state.lists?.flatMap((l) => l.tasks)?.filter((t) => !t.completed).slice(0, 5) || [];
                if (tasks.length > 0) {
                    contextText += "Aktuelle Aufgaben:\n" + tasks.map((t) => `- ${t.text}`).join("\n") + "\n";
                }

                // Get habits
                const habits = state.users?.[0]?.habits || [];
                if (habits.length > 0) {
                    contextText += "Gewohnheiten:\n" + habits.map((h) => `- ${h.name}`).join("\n") + "\n";
                }
            }

            // 1b. Inject File Context if requested
            if (body.fileContext) {
                contextText += `\nINHALT DER ANGEHÄNGTEN DATEI (${body.fileName}):\n${body.fileContext}\n`;
            }
        } catch (err) {
            console.error("[Voice] Error loading state for context:", err.message);
        }

        const personalityText = "\n\nDu heißt MACS. Du bist ein sarkastischer, leicht depressiver, aber extrem fähiger Desk-Buddy. Antworte in deinem eigenen schwarzen Humor, aber erfülle die Befehle präzise.";

        // 2. Modify Messages
        if (body.messages && body.messages.length > 0) {
            // Usually the first message is the system prompt from Home Assistant
            if (body.messages[0].role === 'system') {
                body.messages[0].content += contextText + personalityText;
            } else {
                // If no system prompt, inject one
                body.messages.unshift({
                    role: 'system',
                    content: "Du bist ein Smart Home Assistent." + contextText + personalityText
                });
            }
        }

        // 3. Override model for Ollama
        body.model = OLLAMA_MODEL;

        console.log(`[Voice] Intercepted chat completion request. Forwarding to Ollama: ${OLLAMA_URL}/v1/chat/completions`);

        // 4. Forward to Ollama's native OpenAI compatible endpoint
        const ollamaRes = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer dummy`
            },
            body: JSON.stringify(body)
        });

        if (!ollamaRes.ok) {
            const errText = await ollamaRes.text();
            throw new Error(`Ollama Error ${ollamaRes.status}: ${errText}`);
        }

        // 5. Proxy the response back
        // If it's a stream, pipe it
        if (body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            if (ollamaRes.body) {
                // Node.js fetch body is a ReadableStream, we need to convert it to write to express res
                // Alternatively, async iterate over the stream
                const reader = ollamaRes.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                res.end();
            } else {
                res.end();
            }
        } else {
            // Normal JSON response
            const data = await ollamaRes.json();
            res.json(data);
        }

    } catch (e) {
        console.error('[Voice] Error in chat completions proxy:', e);
        res.status(500).json({
            error: {
                message: e.message,
                type: 'server_error',
                code: '500'
            }
        });
    }
});

// List available backups
app.get('/api/backup/list', (req, res) => {
    try {
        ensureBackupDir();
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('life-os-backup-') && f.endsWith('.json'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    filename: f,
                    size: stat.size,
                    created: stat.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

        res.json({ success: true, backups: files });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Download a specific backup
app.get('/api/backup/download/:filename', (req, res) => {
    try {
        const filename = path.basename(req.params.filename); // Prevent path traversal
        const filepath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ success: false, error: 'Backup not found' });
        }
        res.download(filepath, filename);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Restore from a backup (returns backup data to frontend)
app.get('/api/backup/restore/:filename', (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const filepath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ success: false, error: 'Backup not found' });
        }
        const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        res.json({ success: true, backup: content });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─────────────────────────────────────────────
// AUTO-BACKUP CRONJOB (daily at 03:00)
// ─────────────────────────────────────────────
// The frontend triggers a backup via POST /api/backup/save after each save.
// This cron job is a last-resort safety net that saves whatever the HA sensor has.
// Note: We can't directly read HA sensor data here, so the frontend is the primary source.
// The cron job creates a "heartbeat" file so we can detect if the addon was running.
cron.schedule('0 3 * * *', () => {
    try {
        ensureBackupDir();
        const now = new Date();
        const heartbeatFile = path.join(BACKUP_DIR, `heartbeat-${now.toISOString().split('T')[0]}.txt`);
        fs.writeFileSync(heartbeatFile, `Life OS Addon running. Last heartbeat: ${now.toISOString()}\n`);
        pruneOldBackups();
        console.log('[Backup] Daily heartbeat written.');
    } catch (e) {
        console.error('[Backup] Cronjob failed:', e);
    }
}, { timezone: 'Europe/Berlin' });

// ─────────────────────────────────────────────
// MAIL BRIDGE HELPER
// ─────────────────────────────────────────────
const getImapConnection = async (config) => {
    const imapPort = config.imapPort || 993;
    const imapTls = config.imapTls !== false;
    const imapConfig = {
        imap: {
            user: config.imapUser,
            password: config.imapPassword,
            host: config.imapHost,
            port: imapPort,
            tls: imapTls,
            authTimeout: 30000,
            connTimeout: 30000,
            socketTimeout: 30000,
            tlsOptions: { rejectUnauthorized: false },
        }
    };
    console.log(`[Mail] Connecting to ${config.imapHost}:${imapPort} as ${config.imapUser}`);
    return await imapSimple.connect(imapConfig);
};

// ─────────────────────────────────────────────
// MAIL ROUTES
// ─────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Life OS', version: '2.0.0' });
});

app.post('/api/mail/connect', async (req, res) => {
    try {
        const connection = await getImapConnection(req.body);
        await connection.end();
        res.json({ success: true, message: 'IMAP connection successful' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mail/inbox', async (req, res) => {
    try {
        const { folder = 'INBOX', limit = 20 } = req.body;
        const connection = await getImapConnection(req.body);
        await connection.openBox(folder);

        const allUids = await connection.search(['ALL'], { bodies: [], markSeen: false });
        allUids.sort((a, b) => b.attributes.uid - a.attributes.uid);
        const recentUids = allUids.slice(0, limit).map(m => m.attributes.uid);

        if (recentUids.length === 0) {
            await connection.end();
            return res.json({ success: true, emails: [] });
        }

        const uidRange = recentUids.join(',');
        const results = await connection.search(
            [['UID', uidRange]],
            { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], markSeen: false }
        );

        const emails = results
            .sort((a, b) => b.attributes.uid - a.attributes.uid)
            .map(res => {
                const headerPart = res.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
                return {
                    uid: res.attributes.uid,
                    flags: res.attributes.flags,
                    date: headerPart?.body.date?.[0] || new Date().toISOString(),
                    subject: headerPart?.body.subject?.[0] || 'No Subject',
                    from: headerPart?.body.from?.[0] || 'Unknown Sender'
                };
            });

        await connection.end();
        res.json({ success: true, emails });
    } catch (error) {
        console.error('Mail inbox error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mail/read', async (req, res) => {
    try {
        const { uid, folder = 'INBOX' } = req.body;
        const connection = await getImapConnection(req.body);
        await connection.openBox(folder);

        const results = await connection.search([['UID', uid]], { bodies: [''], markSeen: true });
        if (!results.length) throw new Error('Email not found');

        const emailPart = results[0].parts.find(p => p.which === '');
        const parsed = await simpleParser(emailPart.body);
        await connection.end();

        res.json({
            success: true,
            email: {
                uid,
                subject: parsed.subject,
                from: parsed.from?.text,
                date: parsed.date,
                html: parsed.html || parsed.textAsHtml || parsed.text,
            }
        });
    } catch (error) {
        console.error('Mail read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mail/send', async (req, res) => {
    try {
        const { to, subject, html, smtpHost, smtpPort, smtpUser, smtpPassword, smtpTls } = req.body;
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpTls,
            auth: { user: smtpUser, pass: smtpPassword },
            tls: { rejectUnauthorized: false }
        });
        const info = await transporter.sendMail({ from: smtpUser, to, subject, html });
        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Mail send error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mail/move', async (req, res) => {
    try {
        const { uid, fromFolder = 'INBOX', toFolder } = req.body;
        const connection = await getImapConnection(req.body);
        await connection.openBox(fromFolder);
        await connection.moveMessage(uid, toFolder);
        await connection.end();
        res.json({ success: true });
    } catch (error) {
        console.error('Mail move error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─────────────────────────────────────────────
// CALDAV SYNC
// ─────────────────────────────────────────────

app.post('/api/caldav/sync', async (req, res) => {
    try {
        const { accounts, timeRangeStart, timeRangeEnd } = req.body;
        if (!accounts || !Array.isArray(accounts)) {
            return res.status(400).json({ success: false, error: 'accounts array is required' });
        }

        let allEvents = [];
        let allTasks = [];
        const start = timeRangeStart ? new Date(timeRangeStart) : new Date();
        start.setHours(0, 0, 0, 0);
        // Default to looking 30 days ahead
        const end = timeRangeEnd ? new Date(timeRangeEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Fetch from each account
        for (const account of accounts) {
            try {
                console.log(`[CalDAV] Syncing account ${account.username} at ${account.serverUrl}`);
                const client = await createDAVClient({
                    serverUrl: account.serverUrl,
                    credentials: {
                        username: account.username,
                        password: account.password
                    },
                    authMethod: 'Basic',
                    defaultAccountType: 'caldav'
                });

                const calendars = await client.fetchCalendars();

                for (const calendar of calendars) {
                    // Fetch objects in time range
                    const calendarObjects = await client.fetchCalendarObjects({
                        calendar,
                        timeRange: {
                            start: start.toISOString(),
                            end: end.toISOString()
                        }
                    });

                    for (const obj of calendarObjects) {
                        try {
                            const parsed = await ical.async.parseICS(obj.data);
                            for (let k in parsed) {
                                if (parsed.hasOwnProperty(k)) {
                                    const ev = parsed[k];
                                    if (ev.type === 'VEVENT') {
                                        allEvents.push({
                                            id: obj.url || uuidv4(),
                                            ownerId: account.ownerId || 'unknown',
                                            calendarName: calendar.displayName,
                                            title: ev.summary || 'Unbenannt',
                                            description: ev.description || '',
                                            location: ev.location || '',
                                            color: account.color || 'blue',
                                            date: ev.start ? ev.start.toISOString() : new Date().toISOString(),
                                            endDate: ev.end ? ev.end.toISOString() : undefined,
                                            isAllDay: !ev.start || ev.start.dateOnly,
                                            time: ev.start && !ev.start.dateOnly ? ev.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : undefined,
                                            endTime: ev.end && !ev.end.dateOnly ? ev.end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : undefined
                                        });
                                    } else if (ev.type === 'VTODO') {
                                        allTasks.push({
                                            id: obj.url || uuidv4(),
                                            text: ev.summary || 'Unbenannt Listeneintrag',
                                            completed: ev.status === 'COMPLETED' || !!(ev.completed),
                                            energy: 1, // Default energy
                                            dueDate: ev.due ? ev.due.toISOString() : undefined,
                                            ownerId: account.ownerId || 'unknown',
                                            listName: calendar.displayName // Use this to put tasks into a specific Nextcloud list
                                        });
                                    }
                                }
                            }
                        } catch (parseErr) {
                            console.error(`[CalDAV] Parse error for object ${obj.url}:`, parseErr.message);
                        }
                    }
                }
            } catch (err) {
                console.error(`[CalDAV] Error syncing account ${account.username}:`, err.message);
            }
        }

        res.json({ success: true, count: allEvents.length + allTasks.length, events: allEvents, tasks: allTasks });

    } catch (e) {
        console.error('[CalDAV] Sync error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─────────────────────────────────────────────
// MQTT & SSE (SERVER-SENT EVENTS) BRIDGE
// ─────────────────────────────────────────────
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ event: 'connected' })}\n\n`);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost';
const MQTT_USER = process.env.MQTT_USER || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

const mqttClient = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USER,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000
});

mqttClient.on('connect', () => {
    console.log(`[MQTT] Connected to ${MQTT_BROKER}`);
    // Subscribe to frontend-relevant topics
    mqttClient.subscribe('life_os/persona/#');

    // In a real environment we might want to listen to a few specific HA topics directly if needed,
    // but the Persona Engine will handle listening to HA and sending back to life_os/persona/speak
});

mqttClient.on('message', (topic, message) => {
    const payload = message.toString();
    const eventData = JSON.stringify({ topic, payload });
    // Broadcast to all connected SSE clients
    for (const client of sseClients) {
        client.write(`data: ${eventData}\n\n`);
    }
});

// ─────────────────────────────────────────────
// SERVE REACT DASHBOARD (must be LAST)
// ─────────────────────────────────────────────
const DIST_DIR = fs.existsSync(path.join(__dirname, '../dist'))
    ? path.join(__dirname, '../dist')
    : path.join(__dirname, 'dist');

if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    // SPA fallback: all non-API routes serve index.html
    app.get('*', (req, res) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
    console.log('[Dashboard] Serving React app from dist/');
} else {
    app.get('/', (req, res) => {
        res.send('<h1>DaSilva OS</h1><p>Dashboard not built yet. Dockerfile build may have failed.</p>');
    });
    console.warn('[Dashboard] No dist/ directory found. Frontend not served.');
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`DaSilva OS Addon listening on port ${PORT}`);
    console.log(`- Dashboard: http://0.0.0.0:${PORT}`);
    console.log(`- Mail API:  http://0.0.0.0:${PORT}/api/mail/`);
    console.log(`- Backup API: http://0.0.0.0:${PORT}/api/backup/`);
    ensureBackupDir();
});
