import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Cloud, Sun, Droplets, CloudRain, Snowflake, CloudLightning, Calendar, CheckSquare, Zap, Lightbulb, Plus, Calendar as CalendarIcon, Check, Settings, ArrowLeft, ArrowRight, Maximize2, Activity, Shirt, Utensils, Power, Blinds, Thermometer, Monitor, AlertTriangle, CloudDownload, Loader2, Coffee, Clock } from 'lucide-react';
import { getHonestWeatherMessage, type WeatherCondition } from '../data/weatherMessages';
import { haService } from '../utils/haService';
import AIChatWidget from './AIChatWidget';
import SmarthomeSettingsPanel from './SmarthomeSettingsPanel';
import AdminPanel from './AdminPanel';
import UnreadMailPanel from './UnreadMailPanel';

import BriefingOverlay from './BriefingOverlay';
import ImmichWidget from './ImmichWidget';
import { motion } from 'framer-motion';

const WidgetWrapper = ({
    id,
    size,
    editMode,
    onMove,
    onResize,
    children
}: {
    id: string;
    size: 'small' | 'medium' | 'large';
    editMode: boolean;
    onMove: (id: string, dir: 'left' | 'right') => void;
    onResize: (id: string) => void;
    children: React.ReactNode;
}) => {
    const colSpanClass = {
        small: 'col-span-1',
        medium: 'col-span-1 md:col-span-2',
        large: 'col-span-1 md:col-span-2 lg:col-span-3'
    }[size];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={`${colSpanClass} bg-[#2a2b30]/60 backdrop-blur-2xl rounded-[32px] border border-white/5 p-8 flex flex-col relative overflow-hidden min-h-[320px] transition-all duration-500 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50 ${editMode ? 'ring-2 ring-[#3b82f6]/50 scale-[0.98]' : ''}`}
        >
            {children}
            {editMode && (
                <div className="absolute inset-0 bg-[#1a1b1e]/80 flex items-center justify-center gap-4 z-50 backdrop-blur-sm animate-in fade-in rounded-[32px]">
                    <button onClick={() => onMove(id, 'left')} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 hover:text-[#3b82f6] transition-colors"><ArrowLeft size={24} /></button>
                    <button onClick={() => onResize(id)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 hover:text-[#3b82f6] flex flex-col items-center transition-colors">
                        <Maximize2 size={24} />
                        <span className="text-[10px] uppercase font-bold mt-2 tracking-widest">{size}</span>
                    </button>
                    <button onClick={() => onMove(id, 'right')} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 hover:text-[#3b82f6] transition-colors"><ArrowRight size={24} /></button>
                </div>
            )}
        </motion.div>
    );
};

export default function MissionControl() {
    // --- STORE DATA ---
    const events = useAppStore(state => state.events);
    const lists = useAppStore(state => state.lists);
    const activeListId = useAppStore(state => state.activeListId);
    const persistenceError = useAppStore(state => state.persistenceError);
    const setPersistenceError = useAppStore(state => state.setPersistenceError);
    const isSyncing = useAppStore(state => state.isSyncing);
    const syncWithHA = useAppStore(state => state.syncWithHA);
    const addTask = useAppStore(state => state.addTask);
    const toggleTask = useAppStore(state => state.toggleTask);
    const currentUser = useAppStore(state => state.currentUser);
    const updateUserLayout = useAppStore(state => state.updateUserLayout);
    const activeStatusLedRule = useAppStore(state => state.activeStatusLedRule);
    const statusLedAcknowledgedRuleId = useAppStore(state => state.statusLedAcknowledgedRuleId);
    const acknowledgeActiveStatusLedRule = useAppStore(state => state.acknowledgeActiveStatusLedRule);

    // --- RESPONSIVE LAYOUT HOOK ---
    const [currentBreakpoint, setCurrentBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

    useEffect(() => {
        const checkBreakpoint = () => {
            if (window.innerWidth >= 1024) setCurrentBreakpoint('desktop');
            else if (window.innerWidth >= 768) setCurrentBreakpoint('tablet');
            else setCurrentBreakpoint('mobile');
        };

        checkBreakpoint(); // Initial check
        window.addEventListener('resize', checkBreakpoint);
        return () => window.removeEventListener('resize', checkBreakpoint);
    }, []);

    // LED Status State - Moved to consolidated selector above

    const user = currentUser();
    const permissions = user?.permissions;
    const allowedZonesJson = JSON.stringify(permissions?.allowedZones || []);
    const rawDevicesJson = JSON.stringify(user?.smarthomeDevices || []);

    const smarthomeDevices = useMemo(() => {
        const devices = JSON.parse(rawDevicesJson);
        const allowedZones = JSON.parse(allowedZonesJson);
        // Default allow if no permissions exist or 'all' is explicitly listed
        if (!allowedZones || allowedZones.length === 0 || allowedZones.includes('all')) return devices;
        return devices.filter((d: any) => d.zone && allowedZones.includes(d.zone));
    }, [rawDevicesJson, allowedZonesJson]);

    // Derived Data
    const activeList = useMemo(() => {
        return lists.find(l => l.id === activeListId) || lists[0];
    }, [lists, activeListId]);

    const pendingTasks = useMemo(() => {
        if (!activeList) return [];
        return [...activeList.tasks]
            .filter(t => !t.completed)
            .sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            })
            .slice(0, 5);
    }, [activeList]);

    // Sort events by date and take next 3
    const upcomingEvents = [...events]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .filter(e => new Date(e.date).getTime() >= new Date().setHours(0, 0, 0, 0))
        .slice(0, 3);

    const getEventColor = (event: any) => {
        if (!event.label) return event.color || 'blue';
        const userLabels = user?.colorLabels || {};
        const matchedColor = Object.entries(userLabels).find(([_, label]) => label === event.label)?.[0];
        return matchedColor || 'stone';
    };

    // --- CLOCK & WEATHER STATE ---
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number; condition: WeatherCondition; label: string }>({
        temp: 22,
        condition: 'sun',
        label: 'Sonnig'
    });
    const [message, setMessage] = useState('');

    // --- SMARTHOME STATE ---
    // Instead of fixed 'light1'/'light2', we track state by entityId
    const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});

    const toggleDevice = async (entityId: string) => {
        if (!entityId) return;

        const currentState = deviceStates[entityId] || false;
        const newState = !currentState;
        setDeviceStates(prev => ({ ...prev, [entityId]: newState }));

        try {
            const domain = entityId.split('.')[0] || 'light';
            let service = newState ? 'turn_on' : 'turn_off';
            if (domain === 'cover') {
                service = newState ? 'open_cover' : 'close_cover';
            }

            await haService.callService(domain, service, {
                entity_id: entityId
            });
        } catch (e) {
            console.error(`Home Assistant Toggle failed for ${entityId}`, e);
            // Revert state on failure
            setDeviceStates(prev => ({ ...prev, [entityId]: !newState }));
        }
    };

    const turnOffStatusLed = async () => {
        const entityId = user?.statusLed?.entityId;
        if (entityId) {
            try {
                const domain = entityId.split('.')[0] || 'light';
                await haService.callService(domain, 'turn_off', { entity_id: entityId });
            } catch (e) {
                console.error("Failed to turn off status LED", e);
            }
        }
        acknowledgeActiveStatusLedRule();
    };

    // --- SENSOR POLLING ---
    const [sensorStates, setSensorStates] = useState<Record<string, { done: boolean, time: string | null }>>({});

    useEffect(() => {
        const pollableTypes = ['sensor', 'washer', 'dishwasher'];
        const sensors = smarthomeDevices.filter(d => pollableTypes.includes(d.type) && d.entityId);
        if (sensors.length === 0) return;

        const checkSensors = async () => {
            const newStates = { ...sensorStates };
            let updated = false;

            for (const sensor of sensors) {
                try {
                    const state = await haService.getEntityState(sensor.entityId);
                    if (state && typeof state.state === 'string') {
                        const status = state.state.toLowerCase();
                        if (['on', 'finished', 'clean', 'done'].includes(status)) {
                            if (!newStates[sensor.entityId]?.done) {
                                newStates[sensor.entityId] = { done: true, time: 'Gerade eben' };
                                updated = true;
                            }
                        } else {
                            if (newStates[sensor.entityId]?.done) {
                                newStates[sensor.entityId] = { done: false, time: null };
                                updated = true;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to poll sensor", error);
                }
            }
            if (updated) setSensorStates(newStates);
        };

        checkSensors();
        const interval = setInterval(checkSensors, 30000);
        return () => clearInterval(interval);
    }, [smarthomeDevices]);

    // --- NEW TASK STATE ---
    const [newTaskText, setNewTaskText] = useState('');

    // --- ADMIN / LAYOUT STATE ---
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showSmarthomeSettings, setShowSmarthomeSettings] = useState(false);
    const [showBriefing, setShowBriefing] = useState(false);
    const defaultOrder = ['status', 'smarthome', 'focus', 'calendar', 'photos', 'mail'];
    const defaultSizes: Record<string, 'small' | 'medium' | 'large'> = {
        status: 'medium', smarthome: 'small', focus: 'medium', calendar: 'medium', photos: 'medium', mail: 'medium'
    };

    // Get current layout based on breakpoint, fallback to legacy, then defaults
    const activeLayout = user.layouts?.[currentBreakpoint] || {
        displayOrder: user.displayOrder || defaultOrder,
        widgetSizes: user.widgetSizes || defaultSizes
    };

    const currentOrder = activeLayout.displayOrder;
    const currentSizes = activeLayout.widgetSizes;

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setMessage((prev) => getHonestWeatherMessage(weather.temp, weather.condition, prev));
    }, [weather.temp, weather.condition]);

    useEffect(() => {
        const fetchWeather = async () => {
            if (!user) return;
            const entityId = user.weatherEntityId || 'weather.home';
            const state = await haService.getEntityState(entityId);
            if (state) {
                const conditionMap: Record<string, { cat: WeatherCondition, de: string }> = {
                    'clear-night': { cat: 'sun', de: 'Klar' },
                    'cloudy': { cat: 'cloud', de: 'Bewölkt' },
                    'exceptional': { cat: 'storm', de: 'Ausnahmezustand' },
                    'fog': { cat: 'cloud', de: 'Nebel' },
                    'hail': { cat: 'rain', de: 'Hagel' },
                    'lightning': { cat: 'storm', de: 'Gewitter' },
                    'lightning-rainy': { cat: 'storm', de: 'Gewitter & Regen' },
                    'partlycloudy': { cat: 'sun', de: 'Heiter' },
                    'pouring': { cat: 'rain', de: 'Starkregen' },
                    'rainy': { cat: 'rain', de: 'Regen' },
                    'snowy': { cat: 'snow', de: 'Schnee' },
                    'snowy-rainy': { cat: 'snow', de: 'Schneeregen' },
                    'sunny': { cat: 'sun', de: 'Sonnig' },
                    'windy': { cat: 'cloud', de: 'Windig' },
                    'windy-variant': { cat: 'cloud', de: 'Windig' }
                };
                const haCondition = String(state.state).toLowerCase();
                const mapped = conditionMap[haCondition] || { cat: 'cloud', de: 'Bewölkt' };
                const temp = state.attributes.temperature ? Math.round(Number(state.attributes.temperature)) : 22;
                setWeather({ temp, condition: mapped.cat, label: mapped.de });
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 15 * 60 * 1000); // Check every 15 minutes
        return () => clearInterval(interval);
    }, [user?.weatherEntityId]);

    const hours = time.getHours();
    const isNight = hours < 6 || hours > 20;

    const WeatherIcon = () => {
        switch (weather.condition) {
            case 'rain': return <CloudRain className="text-blue-400" size={24} />;
            case 'snow': return <Snowflake className="text-white" size={24} />;
            case 'storm': return <CloudLightning className="text-purple-400" size={24} />;
            case 'cloud': return <Cloud className="text-gray-400" size={24} />;
            default: return isNight ? <Cloud className="text-indigo-300" size={24} /> : <Sun className="text-amber-300" size={24} />;
        }
    };

    const handleAddTask = () => {
        if (!newTaskText.trim()) return;
        addTask(activeList.id, newTaskText, undefined);
        setNewTaskText('');
    };

    // --- LAYOUT HANDLERS ---
    const moveWidget = (id: string, direction: 'left' | 'right') => {
        const index = currentOrder.indexOf(id);
        const newOrder = [...currentOrder];
        if (direction === 'left' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'right' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        updateUserLayout(currentBreakpoint, newOrder, currentSizes);
    };

    const resizeWidget = (id: string) => {
        const sizes = ['small', 'medium', 'large'] as const;
        const currentSize = currentSizes[id] || 'small';
        const nextSize = sizes[(sizes.indexOf(currentSize) + 1) % sizes.length];
        updateUserLayout(currentBreakpoint, currentOrder, { ...currentSizes, [id]: nextSize });
    };

    // --- WIDGET RENDERERS ---
    const renderWidget = (id: string) => {
        const size = currentSizes[id] || 'small';

        switch (id) {
            case 'status': return (
                <WidgetWrapper key={id} id={id} size={size} editMode={editMode} onMove={moveWidget} onResize={resizeWidget}>
                    <div className="flex flex-col justify-between h-full relative group">
                        <div className="z-10 cursor-pointer flex justify-between items-start">
                            <div>
                                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 select-none">Zustand</h2>
                                <div className="text-5xl md:text-6xl font-semibold tracking-tighter text-white select-none">
                                    {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-sm text-[#3b82f6] font-medium mt-2">
                                    {time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-3xl border border-white/5 backdrop-blur-md w-16 h-16 flex items-center justify-center text-3xl">
                                {currentUser()?.avatar.startsWith('http') ? (
                                    <img src={currentUser()?.avatar} className="w-full h-full object-cover rounded-2xl" />
                                ) : (
                                    <span>{currentUser()?.avatar}</span>
                                )}
                            </div>
                        </div>

                        <div
                            className="flex items-center gap-5 bg-white/5 p-5 rounded-2xl z-10 mt-8 border border-white/5 backdrop-blur-md"
                        >
                            <WeatherIcon />
                            <div>
                                <div className="text-3xl font-semibold leading-none text-white">{weather.temp}°</div>
                                <div className="text-sm text-gray-400 mt-1 font-medium">{weather.label}</div>
                            </div>
                        </div>

                        <div className="mt-4 z-10 flex-1 flex flex-col justify-end text-right overflow-hidden min-h-0">
                            <div className="overflow-y-auto custom-scrollbar max-h-full">
                                <p className="text-lg text-gray-300 font-medium leading-relaxed max-w-xs ml-auto">
                                    {message}
                                </p>
                            </div>
                        </div>

                        {/* Background Decor */}
                        <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[100px] opacity-10 pointer-events-none transition-colors duration-1000 
                            ${weather.condition === 'sun' ? 'bg-amber-500' : 'bg-[#3b82f6]'}`} />

                        {/* Version Indicator */}
                        <div className="absolute bottom-6 right-6 text-[9px] text-gray-600 font-mono tracking-widest select-none">
                            Life OS 2.0
                        </div>
                    </div>
                </WidgetWrapper>
            );
            case 'smarthome': return (
                <WidgetWrapper key={id} id={id} size={size} editMode={editMode} onMove={moveWidget} onResize={resizeWidget}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest select-none">Smarthome</h2>
                        <button onClick={() => setShowSmarthomeSettings(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group border border-white/5 hover:border-white/10">
                            <Zap size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>

                    {smarthomeDevices.filter(d => ['sensor', 'washer', 'dishwasher'].includes(d.type)).map(sensor => {
                        const state = sensorStates[sensor.entityId];
                        if (!state?.done) return null;

                        let Icon = Droplets;
                        if (sensor.type === 'washer') Icon = Shirt;
                        else if (sensor.type === 'dishwasher') Icon = Utensils;
                        else if (sensor.type === 'sensor') Icon = Activity;

                        return (
                            <div key={sensor.id} className="mb-6 p-4 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-start gap-4 relative group transition-all hover:bg-[#3b82f6]/20">
                                <div className="bg-[#3b82f6]/20 p-3 rounded-xl text-[#3b82f6] shrink-0">
                                    <Icon size={20} />
                                </div>
                                <div className="flex-1 pt-1">
                                    <p className="text-[#3b82f6] font-semibold text-sm">{sensor.name} ist fertig!</p>
                                    <p className="text-[#3b82f6]/60 text-xs mt-1">{state.time || 'Gerade eben'}</p>
                                </div>
                                <button
                                    onClick={() => setSensorStates(prev => ({ ...prev, [sensor.entityId]: { done: false, time: null } }))}
                                    className="absolute top-4 right-4 p-2 text-[#3b82f6]/60 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#3b82f6]/20 rounded-lg hover:text-[#3b82f6]"
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        );
                    })}

                    <div className="grid grid-cols-2 gap-4">
                        {smarthomeDevices.filter(d => ['light', 'switch', 'cover', 'climate', 'pc'].includes(d.type)).map(device => {
                            const isOn = deviceStates[device.entityId] || false;

                            let Icon = Power;
                            let activeColorClass = 'text-[#3b82f6]';
                            let bgActive = 'bg-white/10 border-white/20 shadow-lg';
                            let dotClass = 'bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.6)]';

                            switch (device.type) {
                                case 'light': Icon = Lightbulb; break;
                                case 'switch': Icon = Power; break;
                                case 'cover':
                                    Icon = Blinds;
                                    break;
                                case 'climate':
                                    Icon = Thermometer;
                                    activeColorClass = 'text-rose-400';
                                    dotClass = 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
                                    break;
                                case 'pc':
                                    Icon = Monitor;
                                    break;
                            }

                            return (
                                <button
                                    key={device.id}
                                    onClick={() => toggleDevice(device.entityId)}
                                    disabled={!device.entityId}
                                    className={`p-5 rounded-2xl transition-all text-left flex flex-col justify-between h-[110px] relative overflow-hidden group border
                                        ${!device.entityId ? 'opacity-40 cursor-not-allowed bg-black/20 border-white/5' :
                                            isOn ? bgActive : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                                >
                                    <div className="flex justify-between items-start mb-2 relative z-10 w-full">
                                        <Icon size={22} className={isOn ? activeColorClass : "text-gray-500 transition-colors group-hover:text-gray-400"} />
                                        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isOn ? dotClass : 'bg-transparent'}`} />
                                    </div>
                                    <div className="relative z-10">
                                        <div className={`text-sm font-semibold truncate transition-colors ${isOn ? 'text-white' : 'text-gray-300 group-hover:text-gray-200'}`}>
                                            {device.name}
                                        </div>
                                        <div className={`text-[11px] font-medium tracking-wide mt-1 transition-colors ${isOn ? 'text-white/60' : 'text-gray-500'}`}>
                                            {!device.entityId ? 'Einrichten' : isOn ? (device.type === 'cover' ? 'Geöffnet' : 'Aktiv') : (device.type === 'cover' ? 'Geschlossen' : 'Inaktiv')}
                                        </div>
                                    </div>
                                    {isOn && <div className={`absolute inset-0 bg-gradient-to-tr from-${activeColorClass.split('-')[1]}-500/10 to-transparent pointer-events-none opacity-50`} />}
                                </button>
                            );
                        })}
                        {smarthomeDevices.filter(d => d.type === 'light' || d.type === 'switch').length === 0 && (
                            <div className="col-span-2 text-center p-6 border border-white/5 border-dashed rounded-2xl text-gray-500 text-sm font-medium">
                                Keine Geräte konfiguriert<br /><span className="text-xs text-gray-600 mt-1 block">Tippe auf das Blitz-Icon</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 flex justify-start">
                        <button
                            onClick={turnOffStatusLed}
                            title="Status LED ausschalten und Benachrichtigung quittieren"
                            className="flex items-center gap-2 text-[11px] uppercase font-bold tracking-widest text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-rose-500/20 px-4 py-2.5 rounded-xl border border-white/5 hover:border-rose-500/30 group"
                        >
                            <Power size={14} className="group-hover:text-rose-400 transition-colors" />
                            LED Reset
                        </button>
                    </div>
                </WidgetWrapper>
            );
            case 'focus': return (
                <WidgetWrapper key={id} id={id} size={size} editMode={editMode} onMove={moveWidget} onResize={resizeWidget}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest truncate max-w-[200px]">Fokus: {activeList?.name}</h2>
                        <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-colors">
                            <CheckSquare size={16} className="text-[#3b82f6]" />
                        </button>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar mb-6">
                        {pendingTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                <Check size={32} className="mb-3 opacity-20 text-[#3b82f6]" />
                                <span className="text-sm font-medium">Alle Aufgaben erledigt.</span>
                                <span className="text-xs mt-1">Gut gemacht!</span>
                            </div>
                        ) : (
                            pendingTasks.map(task => (
                                <div key={task.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-4 group hover:bg-white/10 transition-all cursor-pointer">
                                    <button
                                        onClick={() => toggleTask(activeList.id, task.id)}
                                        className="mt-0.5 w-5 h-5 rounded-md border border-white/20 flex items-center justify-center hover:border-[#3b82f6] hover:bg-[#3b82f6]/20 transition-all shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[15px] font-medium text-gray-200 group-hover:text-white block leading-snug">
                                            {task.text}
                                        </span>
                                        {task.dueDate && (
                                            <span className={`text-[11px] font-medium flex items-center gap-1.5 mt-2 ${new Date(task.dueDate) < new Date() ? 'text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md w-fit' : 'text-gray-500'}`}>
                                                <CalendarIcon size={12} />
                                                {format(new Date(task.dueDate), 'dd.MM.')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center gap-3">
                        <input
                            type="text"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-medium text-white placeholder-gray-500 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/10 transition-all"
                            placeholder="Schnell hinzufügen..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        />
                        <button
                            onClick={handleAddTask}
                            disabled={!newTaskText.trim()}
                            className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-[#3b82f6] hover:border-[#3b82f6] transition-all disabled:opacity-50 disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-gray-400"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </WidgetWrapper>
            );
            case 'calendar': return (
                <WidgetWrapper key={id} id={id} size={size} editMode={editMode} onMove={moveWidget} onResize={resizeWidget}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Nächste Termine</h2>
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <Calendar size={16} className="text-emerald-400" />
                        </div>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                        {upcomingEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                <span className="text-sm font-medium">Dein Kalender ist leer.</span>
                                <span className="text-xs mt-1">Zeit zum Entspannen.</span>
                            </div>
                        ) : (
                            upcomingEvents.map(event => {
                                const isToday = isSameDay(new Date(event.date), new Date());
                                return (
                                    <div key={event.id} className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex flex-col cursor-pointer">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-semibold text-[15px] text-gray-100 group-hover:text-white leading-snug pr-4">
                                                {event.title}
                                            </div>
                                            <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-${getEventColor(event)}-500 shadow-[0_0_8px_rgba(var(--tw-colors-${getEventColor(event)}-500),_0.6)]`} />
                                        </div>
                                        <div className="text-[12px] font-medium text-gray-500 flex items-center gap-1.5">
                                            <Clock size={12} className={isToday ? 'text-emerald-400' : 'text-gray-500'} />
                                            {isToday
                                                ? <span className="text-emerald-400">Heute {event.time ? ' • ' + event.time : ''}</span>
                                                : format(new Date(event.date), 'EEEE, dd.MM., HH:mm', { locale: de })
                                            }
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </WidgetWrapper>
            );
            case 'photos': return (
                <WidgetWrapper key={id} id={id} size={size} editMode={editMode} onMove={moveWidget} onResize={resizeWidget}>
                    <ImmichWidget />
                </WidgetWrapper>
            );
            default: return null;
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden relative p-8">
            {/* TOP BAR: SYSTEM SETTINGS (TABBIE STYLE) */}
            <div className="flex justify-end items-center mb-8 z-10">
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            if (persistenceError) {
                                alert(persistenceError);
                                setPersistenceError(null);
                            } else {
                                syncWithHA(true);
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all border
                            ${persistenceError
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 hover:bg-rose-500/30'
                                : isSyncing
                                    ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20 animate-pulse cursor-wait'
                                    : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white cursor-pointer'}
                        `}
                    >
                        {persistenceError ? <AlertTriangle size={14} /> : isSyncing ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
                        <span className="hidden sm:inline">
                            {persistenceError ? 'Sync Fehler' : isSyncing ? 'Lade...' : 'Sync'}
                        </span>
                    </button>

                    <button
                        onClick={() => setShowBriefing(true)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30`}
                    >
                        <Coffee size={14} />
                        <span className="hidden sm:inline">Briefing</span>
                    </button>


                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all border
                            ${editMode ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-lg shadow-blue-500/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white'}
                        `}
                    >
                        <Settings size={14} />
                        {editMode ? 'Fertig' : 'Layout'}
                    </button>
                </div>
            </div>

            {/* LED Status Banner */}
            {activeStatusLedRule && activeStatusLedRule.id !== statusLedAcknowledgedRuleId && (
                <div className="mx-2 md:mx-0 mb-4 p-4 rounded-xl bg-black/40 border border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4 backdrop-blur-xl z-20 shadow-2xl animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div
                            className="w-5 h-5 rounded-full animate-pulse shrink-0 border border-white/20"
                            style={{
                                backgroundColor: activeStatusLedRule.color,
                                boxShadow: `0 0 15px ${activeStatusLedRule.color}`
                            }}
                        />
                        <div>
                            <h4 className="text-white font-bold text-sm">Status LED Signal: {activeStatusLedRule.name}</h4>
                            <p className="text-xs text-gray-400">Auslöser: "{activeStatusLedRule.conditionValue}"</p>
                        </div>
                    </div>
                    <button
                        onClick={acknowledgeActiveStatusLedRule}
                        className="w-full sm:w-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 border border-white/10"
                    >
                        Nachricht bekommen (Aus)
                    </button>
                </div>
            )}

            <UnreadMailPanel />

            <div
                className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 overflow-y-auto pb-32 no-scrollbar"
            >
                {currentOrder.map(id => renderWidget(id))}
            </div>

            {/* Smarthome Settings Overlay */}
            {showSmarthomeSettings && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowSmarthomeSettings(false)}>
                    <div onClick={e => e.stopPropagation()} className="animate-in zoom-in-95 duration-200 w-full max-w-2xl">
                        <SmarthomeSettingsPanel />
                    </div>
                </div>
            )}

            {/* Admin Settings Overlay */}
            {showAdminPanel && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in" onClick={() => setShowAdminPanel(false)}>
                    <div onClick={e => e.stopPropagation()} className="animate-in zoom-in-95 duration-200 w-full max-w-md">
                        <AdminPanel />
                    </div>
                </div>
            )}

            {showBriefing && (
                <BriefingOverlay onClose={() => setShowBriefing(false)} />
            )}

            {/* AI Chat Widget */}
            <AIChatWidget />
        </div>
    );
}
