import { useState, useRef, useEffect } from 'react';
import { useAppStore, type StatusLedConditionType } from '../store/useAppStore';
import { haService } from '../utils/haService';
import { Zap, Plus, Trash2, Lightbulb, Activity, GripVertical, Trash, Upload, CheckCircle2, Clock, ChevronRight, CloudRain, LayoutDashboard } from 'lucide-react';
import { parseICS, type TempCalendarEvent } from '../utils/icsParser';

export default function SmarthomeSettingsPanel() {
    const currentUser = useAppStore(state => state.currentUser());
    const { addSmarthomeDevice, removeSmarthomeDevice, updateSmarthomeDevice,
        updateStatusLedConfig, updateWeatherEntityId, addStatusLedRule, removeStatusLedRule, updateStatusLedRule, reorderStatusLedRules, importEvents } = useAppStore();

    const devices = currentUser.smarthomeDevices || [];
    const ledConfig = currentUser.statusLed || { entityId: '', rules: [], defaultColor: '#000000' };

    const [activeTab, setActiveTab] = useState<'dashboard' | 'devices' | 'led' | 'abfall'>('dashboard');

    // --- Entity Fetching ---
    const [haEntities, setHaEntities] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'dashboard' || activeTab === 'devices' || activeTab === 'led') {
            haService.getEntities().then(entities => {
                if (Array.isArray(entities)) {
                    setHaEntities(entities.map(e => ({ id: e.entity_id, name: e.attributes?.friendly_name || e.entity_id })));
                }
            });
        }
    }, [activeTab]);

    // --- Device Handlers ---
    const handleAddDevice = () => {
        addSmarthomeDevice({ name: 'Neues Gerät', entityId: '', type: 'light' });
    };

    // --- Abfallkalender / ICS Wizard Handlers ---
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedIcsEvents, setParsedIcsEvents] = useState<TempCalendarEvent[] | null>(null);

    // Default wizard config
    const [wizardConfig, setWizardConfig] = useState({
        vortagFrom: '18:00',
        vortagTo: '23:59',
        heuteFrom: '06:00',
        heuteTo: '12:00',
        trashTypes: [] as Array<{ keyword: string, enabled: boolean, colorVortag: string, colorHeute: string }>
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const parsedEvents = parseICS(content);
                setParsedIcsEvents(parsedEvents);

                // Auto-detect trash types from summaries
                const uniqueSummaries = Array.from(new Set(parsedEvents.map(ev => ev.summary)));
                const defaultColors: Record<string, string> = {
                    'bio': '#8b4513', 'papier': '#3b82f6', 'gelb': '#eab308', 'rest': '#ffffff', 'baum': '#22c55e'
                };

                const initialTypes = uniqueSummaries.map(summary => {
                    const s = summary.toLowerCase();
                    let color = '#a855f7'; // default purple
                    if (s.includes('bio')) color = defaultColors['bio'];
                    else if (s.includes('papier')) color = defaultColors['papier'];
                    else if (s.includes('gelb') || s.includes('leicht')) color = defaultColors['gelb'];
                    else if (s.includes('rest') || s.includes('grau')) color = defaultColors['rest'];
                    else if (s.includes('weihnacht') || s.includes('baum')) color = defaultColors['baum'];

                    return { keyword: summary, enabled: true, colorVortag: color, colorHeute: color };
                });

                setWizardConfig(prev => ({ ...prev, trashTypes: initialTypes }));
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = () => {
        if (!parsedIcsEvents) return;

        // 1. Import Events to Calendar
        const calEvents = parsedIcsEvents.map(ev => ({
            title: ev.summary,
            date: ev.date,
            type: 'other' as const,
            isAllDay: ev.isAllDay
        }));
        importEvents(calEvents);

        // 2. Generate Led Rules
        let addedRules = 0;
        wizardConfig.trashTypes.filter(t => t.enabled).forEach(tt => {
            // Vortag Rule
            addStatusLedRule({
                name: `Müll Vortag: ${tt.keyword}`,
                type: 'calendar_event_tomorrow',
                conditionValue: tt.keyword,
                color: tt.colorVortag,
                enabled: true,
                activeFromTime: wizardConfig.vortagFrom,
                activeToTime: wizardConfig.vortagTo
            });
            // Heute Rule
            addStatusLedRule({
                name: `Müll Heute: ${tt.keyword}`,
                type: 'calendar_event_today',
                conditionValue: tt.keyword,
                color: tt.colorHeute,
                enabled: true,
                activeFromTime: wizardConfig.heuteFrom,
                activeToTime: wizardConfig.heuteTo
            });
            addedRules += 2;
        });

        setParsedIcsEvents(null); // Close wizard
        setImportSuccess(`${parsedIcsEvents.length} Termine importiert. ${addedRules} LED-Regeln angelegt.`);
        setTimeout(() => setImportSuccess(null), 5000);
    };

    // --- LED Rules Handlers ---
    const handleAddRule = () => {
        addStatusLedRule({
            name: 'Neue Regel',
            type: 'calendar_event_today',
            conditionValue: '',
            color: '#10b981', // Default emerald
            enabled: true
        });
    };

    const conditionLabels: Record<StatusLedConditionType, string> = {
        'calendar_event_today': 'Wenn Termin Heute (Suchwort)',
        'calendar_event_tomorrow': 'Wenn Termin Morgen (Suchwort)',
        'task_keyword': 'Wenn offene Aufgabe (Suchwort)',
        'ha_state': 'Wenn HA Entity == Wert (entity:value)',
        'ha_state_not': 'Wenn HA Entity != Wert (entity:value)',
    };

    return (
        <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 text-white max-w-2xl w-full shadow-2xl max-h-[85vh] flex flex-col">
            <datalist id="ha-entities">
                {haEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </datalist>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10 shrink-0">
                <div className="p-3 rounded-full bg-amber-500/20 text-amber-300">
                    <Zap size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Smarthome & Status LED</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Zentrale Gerätesteuerung</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 shrink-0 bg-white/5 p-1 rounded-xl overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <LayoutDashboard size={16} />
                    Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('devices')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'devices' ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Activity size={16} />
                    Steuergeräte
                </button>
                <button
                    onClick={() => setActiveTab('led')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'led' ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    Status LED Regeln
                </button>
                <button
                    onClick={() => setActiveTab('abfall')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'abfall' ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Trash size={16} />
                    Abfallkalender
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                                <CloudRain size={16} className="text-cyan-400" /> Wetter Anzeige
                            </h4>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                                    Home Assistant Wetter Entity ID
                                </label>
                                <input
                                    type="text"
                                    value={currentUser.weatherEntityId || ''}
                                    onChange={(e) => updateWeatherEntityId(e.target.value)}
                                    placeholder="Standard: weather.home"
                                    list="ha-entities"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                />
                                <p className="text-[10px] text-gray-500 mt-2 pl-1">Gib hier die ID deiner Wetter-Integration ein (z.B. weather.dwd_aachen).</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'devices' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-sm text-gray-400">Hier kannst du Lichter, Steckdosen und Sensoren (z.B. Waschmaschine) anlegen. Sie erscheinen dann im Mission Control.</p>
                            <button onClick={handleAddDevice} className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-500/30 transition-colors">
                                <Plus size={14} /> Gerät Hinzufügen
                            </button>
                        </div>

                        {devices.length === 0 && (
                            <div className="text-center py-10 bg-white/5 rounded-xl border border-white/5">
                                <Lightbulb className="mx-auto text-gray-600 mb-2" size={32} />
                                <p className="text-gray-400 text-sm">Noch keine Geräte konfiguriert.</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {devices.map((device) => (
                                <div key={device.id} className="p-3 bg-black/40 border border-white/10 rounded-xl relative group">
                                    <div className="flex gap-3 items-start">
                                        <div className="shrink-0 pt-1">
                                            <select
                                                value={device.type}
                                                onChange={(e) => updateSmarthomeDevice(device.id, { type: e.target.value as any })}
                                                className="bg-white/5 border border-white/10 rounded text-xs text-amber-300 focus:outline-none p-1"
                                            >
                                                <option value="light">Licht</option>
                                                <option value="switch">Schalter</option>
                                                <option value="sensor">Sensor</option>
                                                <option value="cover">Gardine/Rollo</option>
                                                <option value="climate">Thermostat</option>
                                                <option value="washer">Waschmaschine</option>
                                                <option value="dishwasher">Spülmaschine</option>
                                                <option value="pc">PC / Mac</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Anzeigename</label>
                                                <input
                                                    type="text"
                                                    value={device.name}
                                                    onChange={(e) => updateSmarthomeDevice(device.id, { name: e.target.value })}
                                                    placeholder="z.B. Deckenlampe"
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Home Assistant Entity ID</label>
                                                <input
                                                    type="text"
                                                    value={device.entityId}
                                                    onChange={(e) => updateSmarthomeDevice(device.id, { entityId: e.target.value })}
                                                    placeholder="z.B. light.wohnzimmer"
                                                    list="ha-entities"
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeSmarthomeDevice(device.id)}
                                            className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors mt-5"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    {device.type === 'sensor' && (
                                        <p className="text-[10px] text-gray-500 mt-2 pl-2">Sensoren zeigen eine Benachrichtigung an, wenn ihr Status "on", "finished", "clean" oder "done" ist.</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'led' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                            <h4 className="text-indigo-300 text-sm font-bold mb-2">Master Configuration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Status LED Entity ID (RGB Lampe)</label>
                                    <input
                                        type="text"
                                        value={ledConfig.entityId}
                                        onChange={(e) => updateStatusLedConfig({ entityId: e.target.value })}
                                        placeholder="z.B. light.status_led"
                                        list="ha-entities"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Standard Farbe (Fallback)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={ledConfig.defaultColor}
                                            onChange={(e) => updateStatusLedConfig({ defaultColor: e.target.value })}
                                            className="w-10 h-10 rounded border-0 bg-transparent cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={ledConfig.defaultColor}
                                            onChange={(e) => updateStatusLedConfig({ defaultColor: e.target.value })}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white uppercase font-mono focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <div>
                                    <h4 className="text-gray-200 text-sm font-bold">Prioritäten-Regeln</h4>
                                    <p className="text-xs text-gray-500">Das System prüft von oben nach unten. Die erste zutreffende Regel bestimmt die Farbe.</p>
                                </div>
                                <button onClick={handleAddRule} className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 transition-colors">
                                    <Plus size={14} /> Regel Hinzufügen
                                </button>
                            </div>

                            {(!ledConfig.rules || ledConfig.rules.length === 0) ? (
                                <div className="text-center py-8 bg-white/5 rounded-xl border border-white/5">
                                    <Activity className="mx-auto text-gray-600 mb-2" size={24} />
                                    <p className="text-gray-400 text-sm">Noch keine Regeln definiert.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {ledConfig.rules.map((rule, index) => (
                                        <div key={rule.id} className={`p-3 border rounded-xl relative flex items-start gap-3 transition-colors ${rule.enabled ? 'bg-black/40 border-white/10' : 'bg-black/20 border-white/5 opacity-50'}`}>
                                            <div className="flex flex-col gap-2 pt-1 items-center">
                                                <button
                                                    className="text-gray-500 hover:text-white cursor-grab active:cursor-grabbing"
                                                    title="Reihenfolge ändern (ziehen)"
                                                    onClick={() => {
                                                        // Simple move up for prototype
                                                        if (index > 0) reorderStatusLedRules(index, index - 1);
                                                    }}
                                                >
                                                    <GripVertical size={16} />
                                                </button>
                                                <span className="text-[10px] font-mono text-gray-600">#{index + 1}</span>
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                <div className="flex justify-between items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={rule.name}
                                                        onChange={(e) => updateStatusLedRule(rule.id, { name: e.target.value })}
                                                        placeholder="Regel-Name"
                                                        className="bg-transparent text-sm font-bold text-white focus:outline-none w-1/2"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <label className="flex items-center gap-1 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={rule.enabled}
                                                                onChange={(e) => updateStatusLedRule(rule.id, { enabled: e.target.checked })}
                                                                className="sr-only"
                                                            />
                                                            <div className={`w-8 h-4 rounded-full transition-colors relative ${rule.enabled ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                                                            </div>
                                                        </label>
                                                        <button
                                                            onClick={() => removeStatusLedRule(rule.id)}
                                                            className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pb-1">
                                                    <div className="md:col-span-5">
                                                        <select
                                                            value={rule.type}
                                                            onChange={(e) => updateStatusLedRule(rule.id, { type: e.target.value as StatusLedConditionType })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-indigo-300 focus:outline-none"
                                                        >
                                                            {(Object.keys(conditionLabels) as StatusLedConditionType[]).map(key => (
                                                                <option key={key} value={key}>{conditionLabels[key]}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-5 relative">
                                                        <input
                                                            type="text"
                                                            value={rule.conditionValue}
                                                            onChange={(e) => updateStatusLedRule(rule.id, { conditionValue: e.target.value })}
                                                            placeholder={rule.type.includes('ha_state') ? "entity.id:wert" : "Suchbegriff..."}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 flex justify-end">
                                                        <div className="flex gap-1 items-center bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                                                            <input
                                                                type="color"
                                                                value={rule.color}
                                                                onChange={(e) => updateStatusLedRule(rule.id, { color: e.target.value })}
                                                                className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer p-0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Time Limits */}
                                                <div className="flex items-center gap-2 pt-1 mt-1 border-t border-white/5">
                                                    <Clock size={12} className="text-gray-500" />
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Aktiv von:</span>
                                                    <input
                                                        type="time"
                                                        value={rule.activeFromTime || ''}
                                                        onChange={(e) => updateStatusLedRule(rule.id, { activeFromTime: e.target.value })}
                                                        className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none"
                                                    />
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider ml-1">Bis:</span>
                                                    <input
                                                        type="time"
                                                        value={rule.activeToTime || ''}
                                                        onChange={(e) => updateStatusLedRule(rule.id, { activeToTime: e.target.value })}
                                                        className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'abfall' && (
                    <div className="space-y-6">
                        <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-white text-base font-bold mb-2 flex items-center gap-2">
                                <Trash className="text-amber-500" size={20} /> Abfallkalender Import (.ics)
                            </h4>
                            <p className="text-sm text-gray-400 mb-6">
                                Lade hier die Jahresübersicht deines lokalen Entsorgers als .ics Datei hoch.
                                Wir tragen alle Termine automatisch für dich in den Kalender ein und erstellen intelligente
                                <strong> Status LED Regeln</strong> für den Vor- und Abholtag.
                            </p>

                            {!parsedIcsEvents ? (
                                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:bg-white/5 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept=".ics,text/calendar"
                                        onChange={handleFileUpload}
                                    />
                                    <Upload className="mx-auto text-gray-500 mb-3" size={32} />
                                    <p className="text-sm font-bold text-gray-300">Klicken, um .ics Datei auszuwählen</p>
                                    <p className="text-xs text-gray-500 mt-1">Oder Datei per Drag & Drop hier ablegen</p>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                                        <h5 className="font-bold text-indigo-300 mb-2">1. Uhrzeiten für die LED Erinnerung konfigurieren</h5>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-gray-400 uppercase block mb-1">Vortrag (Erinnerung) Aktiv:</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="time" value={wizardConfig.vortagFrom} onChange={e => setWizardConfig({ ...wizardConfig, vortagFrom: e.target.value })} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full" />
                                                    <span className="text-gray-500">-</span>
                                                    <input type="time" value={wizardConfig.vortagTo} onChange={e => setWizardConfig({ ...wizardConfig, vortagTo: e.target.value })} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 uppercase block mb-1">Heute (Abholtag) Aktiv:</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="time" value={wizardConfig.heuteFrom} onChange={e => setWizardConfig({ ...wizardConfig, heuteFrom: e.target.value })} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full" />
                                                    <span className="text-gray-500">-</span>
                                                    <input type="time" value={wizardConfig.heuteTo} onChange={e => setWizardConfig({ ...wizardConfig, heuteTo: e.target.value })} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 className="font-bold text-gray-300 mb-2">2. Gefundene Abfallarten zuordnen ({parsedIcsEvents.length} Termine)</h5>
                                        <div className="space-y-2">
                                            {wizardConfig.trashTypes.map((tt, idx) => (
                                                <div key={idx} className={`p-3 border rounded-xl flex items-center gap-3 transition-colors ${tt.enabled ? 'bg-white/5 border-white/10' : 'bg-black/20 border-white/5 opacity-50'}`}>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={tt.enabled} onChange={e => {
                                                            const newTypes = [...wizardConfig.trashTypes];
                                                            newTypes[idx].enabled = e.target.checked;
                                                            setWizardConfig({ ...wizardConfig, trashTypes: newTypes });
                                                        }} className="w-4 h-4 rounded border-gray-600 bg-black/40 text-emerald-500" />
                                                    </label>
                                                    <div className="flex-1 text-sm font-bold">{tt.keyword}</div>

                                                    <div className="flex items-center gap-4 text-[10px] text-gray-400 uppercase">
                                                        <label className="flex items-center gap-2">
                                                            Vortag:
                                                            <input type="color" value={tt.colorVortag} onChange={e => {
                                                                const newTypes = [...wizardConfig.trashTypes];
                                                                newTypes[idx].colorVortag = e.target.value;
                                                                setWizardConfig({ ...wizardConfig, trashTypes: newTypes });
                                                            }} className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer p-0" disabled={!tt.enabled} />
                                                        </label>
                                                        <label className="flex items-center gap-2">
                                                            Heute:
                                                            <input type="color" value={tt.colorHeute} onChange={e => {
                                                                const newTypes = [...wizardConfig.trashTypes];
                                                                newTypes[idx].colorHeute = e.target.value;
                                                                setWizardConfig({ ...wizardConfig, trashTypes: newTypes });
                                                            }} className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer p-0" disabled={!tt.enabled} />
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setParsedIcsEvents(null)} className="flex-1 py-2 text-sm font-bold text-gray-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Abbrechen</button>
                                        <button onClick={handleConfirmImport} className="flex-[2] flex items-center justify-center gap-2 py-2 text-sm font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors">
                                            Importieren & Regeln erstellen <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {importSuccess && (
                                <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg flex items-center gap-2 text-emerald-300 text-sm animate-in fade-in slide-in-from-bottom-2">
                                    <CheckCircle2 size={16} />
                                    {importSuccess}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
