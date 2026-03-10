import { useState, useMemo, useEffect } from 'react';
import { useAppStore, type CalendarEvent } from '../store/useAppStore';
import { format, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Users, Calendar as CalendarIcon, MapPin, Clock, ToggleLeft, ToggleRight, Trash2, Sparkles, Loader2, ImagePlus } from 'lucide-react';
import { haService } from '../utils/haService';
import { ollamaService } from '../utils/ollamaService';

export default function Chronosphere() {
    // --- STORE ---
    const addEvent = useAppStore(state => state.addEvent);
    const updateEvent = useAppStore(state => state.updateEvent);
    const removeEvent = useAppStore(state => state.removeEvent);
    const allEvents = useAppStore(state => state.events);
    const activeUserId = useAppStore(state => state.activeUserId);
    const currentUser = useAppStore(state => state.currentUser);
    const allLists = useAppStore(state => state.lists);
    const lists = allLists.filter(l => l.ownerId === activeUserId || (l.sharedWith && l.sharedWith.length > 0));
    const holidays = useAppStore(state => state.holidays);
    const fetchHolidays = useAppStore(state => state.fetchHolidays);

    const user = currentUser();
    const rawEvents = allEvents.filter(e =>
        e.ownerId === activeUserId ||
        e.sharedWith.includes('all') ||
        e.sharedWith.includes(activeUserId)
    );

    // Merge system holidays if enabled
    const events = useMemo(() => {
        if (!user || !user.showSchoolHolidays) return rawEvents;
        return [...rawEvents, ...holidays];
    }, [rawEvents, holidays, user?.showSchoolHolidays]);

    // Fetch holidays if enabled
    useEffect(() => {
        if (user?.showSchoolHolidays) {
            fetchHolidays();
        }
    }, [user?.showSchoolHolidays, fetchHolidays]);

    // Get all pending tasks with due dates
    const tasksWithDates = useMemo(() => {
        return lists.flatMap(l => l.tasks)
            .filter(t => !t.completed && t.dueDate)
            .map(t => ({
                ...t,
                date: new Date(t.dueDate!),
                color: 'emerald' // Tasks are emerald
            }));
    }, [lists]);

    // --- STATE ---
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    // Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    // AI Quick Add State
    const [quickAddText, setQuickAddText] = useState('');
    const [isQuickAdding, setIsQuickAdding] = useState(false);

    // --- FORM STATE ---
    const [eventForm, setEventForm] = useState<Partial<CalendarEvent>>({
        title: '',
        description: '',
        location: '',
        time: '08:00', // Default start time
        endTime: '',
        isAllDay: false,
        endDate: undefined,
        color: 'blue',
        participantIds: [],
        sharedWith: [],
        recurrence: { type: 'none' }
    });

    // --- Tabbie UI Color Palette ---
    const colorMap: Record<string, string> = {
        rose: 'bg-rose-500', pink: 'bg-pink-500', fuchsia: 'bg-fuchsia-500', purple: 'bg-purple-500',
        indigo: 'bg-indigo-500', blue: 'bg-[#3b82f6]', sky: 'bg-sky-500', cyan: 'bg-cyan-500',
        teal: 'bg-teal-500', emerald: 'bg-emerald-500', green: 'bg-green-500', lime: 'bg-lime-500',
        yellow: 'bg-yellow-400', amber: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500',
        stone: 'bg-stone-500', slate: 'bg-slate-500'
    };

    // --- UTILS ---
    const doesEventOccurOn = (event: CalendarEvent, day: Date) => {
        const start = new Date(event.date);
        const dayTime = new Date(day).setHours(0, 0, 0, 0);
        const startTime = new Date(start).setHours(0, 0, 0, 0);

        if (dayTime < startTime) return false;

        const end = event.endDate ? new Date(event.endDate) : start;
        const endTime = new Date(end).setHours(23, 59, 59, 999);

        if (dayTime >= startTime && dayTime <= endTime) return true;

        if (!event.recurrence || event.recurrence.type === 'none') return false;

        const type = event.recurrence.type;
        const recurrenceEndDate = event.recurrence.endDate ? new Date(event.recurrence.endDate).setHours(23, 59, 59, 999) : null;

        if (recurrenceEndDate && dayTime > recurrenceEndDate) return false;

        const diffTime = dayTime - startTime;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (type === 'daily') return true;
        if (type === 'weekly') return diffDays % 7 === 0;
        if (type === 'biweekly') return diffDays % 14 === 0;
        if (type === 'monthly') return start.getDate() === day.getDate();
        if (type === 'yearly') return start.getDate() === day.getDate() && start.getMonth() === day.getMonth();

        return false;
    };

    const getEventsForDay = (day: Date) => {
        const dayEvents = events.filter(e => doesEventOccurOn(e, day));
        const dayTasks = tasksWithDates.filter(t => isSameDay(t.date, day));
        return { events: dayEvents, tasks: dayTasks };
    };

    const getEventColor = (event: CalendarEvent) => {
        if (!event.label) return event.color;

        // Try to find if current user has a mapping for this category label
        const userLabels = user?.colorLabels || {};
        const matchedColor = Object.entries(userLabels).find(([_, label]) => label === event.label)?.[0];

        // placeholder color
        return matchedColor || event.color || 'stone';
    };

    const isWasteEvent = (item: any) => {
        const title = (item.title || item.text || '').toLowerCase();
        return title.includes('müll') || title.includes('abfall') || title.includes('tonne') || title.includes('wertstoff') || title.includes('bioabfall');
    };

    const handleEditEvent = (event: CalendarEvent) => {
        setEditingEventId(event.id);
        setEventForm({
            ...event,
            date: new Date(event.date),
            endDate: event.endDate ? new Date(event.endDate) : undefined,
            endTime: event.endTime || '',
            isAllDay: event.isAllDay || false
        });
        setShowAddModal(true);
    };

    const handleDeleteEvent = () => {
        if (editingEventId && window.confirm('Termin wirklich löschen?')) {
            removeEvent(editingEventId);
            setShowAddModal(false);
            setEditingEventId(null);
        }
    };

    const handleSaveEvent = async () => {
        if (!eventForm.title) return;

        const payload = {
            ...eventForm as any,
            date: selectedDate,
            ownerId: user?.id,
        };

        const isNew = !editingEventId;
        const savedTitle = eventForm.title;

        if (editingEventId) updateEvent(editingEventId, payload);
        else addEvent(payload);

        setShowAddModal(false);
        setEditingEventId(null);
        setEventForm({
            title: '', description: '', location: '', time: '08:00', endTime: '', isAllDay: false, endDate: undefined, color: 'blue', participantIds: [], sharedWith: [], recurrence: { type: 'none' }
        });

        // Background AI processing (Proactive Help)
        if (isNew) {
            const lowerTitle = savedTitle.toLowerCase();
            const isEventIdea = lowerTitle.match(/geburtstag|hochzeit|feier|party|jubiläum|jahrestag|geschenk|besuch/i);

            if (isEventIdea) {
                (async () => {
                    try {
                        const storeState = useAppStore.getState();
                        const recentEvents = storeState.getVisibleEvents().slice(0, 10).map(e => e.title).join(', ');

                        let suggestion;
                        if (user?.aiSettings?.enabled && user?.aiSettings?.proactiveHelp) {
                            const { ollamaService } = await import('../utils/ollamaService');
                            suggestion = await ollamaService.analyzeEntryStructured(savedTitle, 'event', recentEvents);
                        } else if (user?.aiSettings?.enabled) {
                            const { haService } = await import('../utils/haService');
                            suggestion = await haService.analyzeEntry(savedTitle, 'event', recentEvents, user.aiSettings?.agentId);
                        }

                        if (suggestion && suggestion.action !== 'none') {
                            const allEvents = storeState.events;
                            const newEvent = allEvents[allEvents.length - 1];
                            storeState.setSparkSuggestion({
                                ...suggestion,
                                targetId: newEvent?.id
                            });
                            storeState.setShowSparkBubble(true);
                        }
                    } catch (err) {
                        console.error("Proactive help failed silently", err);
                    }
                })();
            }
        }
    };

    // --- VISION API (Image Upload) ---
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.aiSettings?.geminiApiKey) return;

        setIsUploadingImage(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                try {
                    const result = await ollamaService.analyzeImage(base64, file.type);
                    if (result.type === 'event' && result.items.length > 0) {
                        const evt = result.items[0];
                        setEventForm({
                            ...eventForm,
                            title: evt.title || eventForm.title,
                            date: evt.date ? new Date(evt.date) : eventForm.date || selectedDate,
                            time: evt.time || eventForm.time,
                            location: evt.location || eventForm.location
                        });
                        setShowAddModal(true);
                    }
                } catch (apiError: any) {
                    alert(`Error parsing image: ${apiError.message}`);
                } finally {
                    setIsUploadingImage(false);
                }
            };
            reader.onerror = () => { setIsUploadingImage(false); alert("Error reading file."); };
        } catch (error) { setIsUploadingImage(false); }
    };

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickAddText.trim() || isQuickAdding) return;
        setIsQuickAdding(true);

        try {
            let eventData = null;
            if (user?.aiSettings?.enabled) {
                const { ollamaService } = await import('../utils/ollamaService');
                eventData = await ollamaService.quickAddEvent(quickAddText, new Date().toISOString());
            } else {
                eventData = await haService.quickAddEvent(quickAddText, user?.aiSettings?.agentId);
            }

            if (eventData) {
                setEditingEventId(null);
                setEventForm({
                    title: eventData.title || '',
                    date: eventData.date ? new Date(eventData.date) : selectedDate,
                    time: eventData.time || '08:00',
                    isAllDay: eventData.isAllDay || false,
                    location: eventData.location || '',
                    description: '',
                    endTime: '',
                    endDate: undefined,
                    color: 'blue',
                    participantIds: [],
                    sharedWith: [],
                    recurrence: { type: 'none' }
                });
                setShowAddModal(true);
            }
        } catch (error: any) {
            alert(`AI processing error: ${error.message}`);
        } finally {
            setIsQuickAdding(false);
            setQuickAddText('');
        }
    };

    // --- CALCULATIONS ---
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthStartDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const monthEndDate = addDays(monthEnd, 6 - monthEnd.getDay() + 1);
    const monthDays = useMemo(() => eachDayOfInterval({ start: monthStartDate, end: monthEndDate }), [currentDate]);

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    const { events: selectedDayEvents, tasks: dayTasks } = getEventsForDay(selectedDate);

    // --- RENDER ---
    return (
        <div className="h-full flex flex-col w-full text-white relative overflow-hidden font-sans p-8">

            {/* HEADER - TABBIE STYLE */}
            <div className="flex justify-between items-center mb-8 relative z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-2xl font-bold tracking-tight text-white w-48 text-center flex items-center justify-center gap-2">
                            {format(currentDate, 'MMMM', { locale: de })} <span className="text-gray-500 font-normal">{format(currentDate, 'yyyy')}</span>
                        </h2>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Top Center Tabs */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0">
                    <div className="flex gap-1 bg-[#2a2b30] p-1.5 rounded-2xl border border-white/5 shadow-xl">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'month' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                        >
                            Monat
                        </button>
                        <button
                            onClick={() => { setViewMode('week'); setSelectedDate(new Date()); }}
                            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'week' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                        >
                            Woche
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Vision Upload */}
                    {user.aiSettings?.geminiApiKey && (
                        <div className="relative overflow-hidden group">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={isUploadingImage}
                                title="Scan image to generate calendar events"
                            />
                            <button className={`
                                flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border
                                ${isUploadingImage ? 'bg-[#3b82f6]/20 text-blue-400 border-blue-500/50' : 'bg-[#2a2b30] text-gray-300 border-white/5 hover:bg-white/10 hover:text-white'}
                            `}>
                                {isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                                <span className="hidden sm:inline">{isUploadingImage ? 'Scanne...' : 'Bild scannen'}</span>
                            </button>
                        </div>
                    )}

                    <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); setViewMode('month'); }} className="px-4 py-2 text-sm font-semibold bg-[#2a2b30] hover:bg-white/10 text-gray-300 rounded-xl transition-all border border-white/5">
                        Heute
                    </button>

                    <button onClick={() => { setEditingEventId(null); setShowAddModal(true); }} className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
                        <Plus size={16} /> Neuer Termin
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {/* --- MONTH VIEW --- */}
                    {viewMode === 'month' && (
                        <motion.div
                            key="month"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="absolute inset-0 flex flex-col h-full bg-[#1e1f23] rounded-[24px] border border-white/5 overflow-hidden"
                        >
                            <div className="grid grid-cols-7 border-b border-white/5 bg-[#2a2b30]/50 shrink-0">
                                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                                    <div key={day} className="text-center py-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest">{day}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-white/5 gap-[1px]">
                                {monthDays.map(day => {
                                    const isToday = isSameDay(day, new Date());
                                    const { events: dayEvents, tasks: dayTasks } = getEventsForDay(day);
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const allItems = [...dayEvents.map(e => ({ ...e, isTask: false })), ...dayTasks.map(t => ({ ...t, isTask: true }))];

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            onClick={() => { setSelectedDate(day); setViewMode('week'); }}
                                            className={`
                                                relative bg-[#1e1f23] hover:bg-[#2a2b30] transition-colors p-2 flex flex-col overflow-hidden cursor-pointer group
                                                ${!isCurrentMonth ? 'opacity-40 hover:opacity-100' : ''}
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[13px] w-6 h-6 flex items-center justify-center rounded-full font-medium ${isToday ? 'bg-[#3b82f6] text-white shadow-md shadow-blue-500/20' : 'text-gray-400'}`}>
                                                    {format(day, 'd')}
                                                </span>
                                            </div>

                                            {/* Event/Task Visuals */}
                                            <div className="flex-1 flex flex-col gap-[2px] overflow-hidden">
                                                {/* Waste Items as dots first for visibility */}
                                                <div className="flex flex-wrap gap-1 mb-1">
                                                    {allItems.filter(isWasteEvent).map((item, idx) => (
                                                        <div
                                                            key={`waste-${idx}`}
                                                            className={`w-2 h-2 rounded-full ${item.isTask ? 'bg-indigo-500' : (colorMap[getEventColor(item as CalendarEvent)] || 'bg-blue-500')}`}
                                                            title={(item as any).title || (item as any).text}
                                                        />
                                                    ))}
                                                </div>

                                                {/* Regular Items as bars */}
                                                {allItems.filter(item => !isWasteEvent(item)).slice(0, 3).map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded truncate text-white/90 font-medium ${item.isTask ? 'bg-indigo-500/80' : (colorMap[getEventColor(item as CalendarEvent)] || 'bg-blue-500/80')}`}
                                                    >
                                                        {(item as any).title || (item as any).text}
                                                    </div>
                                                ))}
                                                {allItems.filter(item => !isWasteEvent(item)).length > 3 && (
                                                    <div className="text-[10px] text-gray-500 pl-1 font-medium mt-1">
                                                        +{allItems.filter(item => !isWasteEvent(item)).length - 3} weitere
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* --- WEEK VIEW --- */}
                    {viewMode === 'week' && (
                        <motion.div
                            key="week"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="absolute inset-0 flex flex-col md:flex-row gap-6 h-full overflow-hidden"
                        >
                            {/* Week Strip */}
                            <div className="flex md:flex-col gap-2 md:w-[72px] shrink-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0 custom-scrollbar">
                                {weekDays.map(day => {
                                    const isSelected = isSameDay(day, selectedDate);
                                    const isToday = isSameDay(day, new Date());
                                    const { events: hasEvents, tasks: hasTasks } = getEventsForDay(day);
                                    const anyActivity = hasEvents.length > 0 || hasTasks.length > 0;

                                    return (
                                        <button
                                            key={day.toISOString()}
                                            onClick={() => setSelectedDate(day)}
                                            className={`
                                                flex-1 md:flex-none md:h-[84px] rounded-[18px] flex flex-col items-center justify-center border transition-all duration-300
                                                ${isSelected ? 'bg-[#3b82f6] text-white border-blue-500 shadow-lg shadow-blue-500/20 scale-105 z-10' : 'bg-[#2a2b30] border-transparent text-gray-400 hover:bg-white/10 hover:text-white'}
                                                ${isToday && !isSelected ? 'text-[#3b82f6] border-blue-500/30' : ''}
                                            `}
                                        >
                                            <span className={`text-[11px] uppercase font-bold tracking-wider ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>{format(day, 'EEE', { locale: de })}</span>
                                            <span className={`text-xl font-semibold mt-0.5 ${isSelected ? 'text-white' : ''}`}>{format(day, 'd')}</span>
                                            {anyActivity && !isSelected && <div className="w-[5px] h-[5px] bg-blue-500 rounded-full mt-2" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Detail Panel */}
                            <div className="flex-1 bg-[#2a2b30] rounded-[24px] border border-white/5 p-8 relative overflow-hidden flex flex-col">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h3 className="text-3xl font-bold tracking-tight text-white mb-1 flex items-baseline gap-3">
                                            {format(selectedDate, 'EEEE', { locale: de })}
                                        </h3>
                                        <p className="text-gray-400">{format(selectedDate, 'd. MMMM yyyy', { locale: de })}</p>
                                    </div>

                                    {/* AI Quick Add directly in daily view header */}
                                    {user?.aiSettings?.enabled && (
                                        <form onSubmit={handleQuickAdd} className="relative hidden md:block">
                                            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                                            <input
                                                value={quickAddText}
                                                onChange={e => setQuickAddText(e.target.value)}
                                                placeholder="Termin per KI hinzufügen..."
                                                disabled={isQuickAdding}
                                                className="bg-[#1e1f23] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-[#3b82f6] w-56 focus:w-72 transition-all placeholder-gray-500 disabled:opacity-50"
                                            />
                                            {isQuickAdding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 animate-spin" size={16} />}
                                        </form>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-10">
                                    {selectedDayEvents.length === 0 && dayTasks.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                            <CalendarIcon size={48} strokeWidth={1} className="mb-4 text-gray-600" />
                                            <p className="text-lg font-medium">Keine Termine für diesen Tag.</p>
                                            <p className="text-sm">Genieß deine freie Zeit!</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* TASKS SECTION */}
                                            {dayTasks.length > 0 && (
                                                <div className="mb-8">
                                                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Clock size={12} /> Aufgaben
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {dayTasks.map(task => (
                                                            <div key={task.id} className="flex items-center gap-3 p-4 rounded-2xl bg-[#1e1f23] border border-white/5 hover:border-white/10 transition-colors">
                                                                <div className="w-[18px] h-[18px] rounded-[5px] border-2 border-indigo-500/50 flex items-center justify-center" />
                                                                <span className="text-gray-200 font-medium text-[15px]">{task.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* EVENTS SECTION */}
                                            {selectedDayEvents.length > 0 && (
                                                <div>
                                                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <CalendarIcon size={12} /> Geplante Termine
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {selectedDayEvents.map((event) => {
                                                            const isShared = event.sharedWith?.length > 0;
                                                            return (
                                                                <motion.div
                                                                    key={event.id}
                                                                    onClick={() => handleEditEvent(event)}
                                                                    className="group relative bg-[#1e1f23] border border-white/5 p-5 rounded-2xl hover:bg-white/5 transition-all cursor-pointer hover:border-white/10 flex items-start gap-4"
                                                                >
                                                                    {/* Color Dot Indicator instead of bar */}
                                                                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${colorMap[getEventColor(event)] || 'bg-blue-500'}`} />

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex justify-between items-start gap-4 mb-1">
                                                                            <h4 className="text-[16px] font-bold text-white truncate">{event.title}</h4>
                                                                            <div className="flex items-center gap-2 text-gray-500 shrink-0">
                                                                                {isShared && <Users size={14} className="text-indigo-400" />}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-wrap gap-2 text-[12px] font-medium text-gray-400">
                                                                            {!event.isAllDay && event.time && (
                                                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2b30] border border-white/5">
                                                                                    <Clock size={12} className="text-[#3b82f6]" />
                                                                                    {event.time}
                                                                                    {event.endTime && ` - ${event.endTime}`}
                                                                                </span>
                                                                            )}
                                                                            {event.isAllDay && (
                                                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2b30] border border-white/5 text-purple-400">
                                                                                    Ganztägig
                                                                                </span>
                                                                            )}
                                                                            {event.location && (
                                                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2b30] border border-white/5">
                                                                                    <MapPin size={12} /> {event.location}
                                                                                </span>
                                                                            )}
                                                                            {event.endDate && !isSameDay(new Date(event.date), new Date(event.endDate)) && (
                                                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2b30] border border-white/5 text-emerald-400">
                                                                                    Bis {format(new Date(event.endDate), 'd. MMM')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {event.description && (
                                                                            <p className="mt-3 text-[13px] text-gray-500 line-clamp-2 leading-relaxed">{event.description}</p>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- MODAL (CREATE / EDIT) --- */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#1e1f23] border border-white/10 p-8 rounded-[32px] w-full max-w-[500px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-white">

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold">{editingEventId ? 'Termin bearbeiten' : 'Neuer Termin'}</h3>
                                {editingEventId && (
                                    <button onClick={handleDeleteEvent} className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors">
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-4 flex-1">
                                <div>
                                    <label className="text-sm font-medium text-gray-400 block mb-2">Titel des Termins</label>
                                    <input type="text" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] transition-colors" placeholder="z.B. Team Meeting" autoFocus />
                                </div>

                                {/* All Day Toggle */}
                                <div className="flex items-center justify-between bg-[#2a2b30] p-4 rounded-xl border border-white/5">
                                    <span className="text-sm font-medium text-gray-300">Ganztägiges Ereignis</span>
                                    <button
                                        onClick={() => setEventForm({ ...eventForm, isAllDay: !eventForm.isAllDay })}
                                        className={`transition-colors flex items-center ${eventForm.isAllDay ? 'text-[#3b82f6]' : 'text-gray-600'}`}
                                    >
                                        {eventForm.isAllDay ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                                    </button>
                                </div>

                                {!eventForm.isAllDay && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-400 block mb-2">Startzeit</label>
                                            <input type="time" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] transition-colors" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-400 block mb-2">Endzeit</label>
                                            <input type="time" value={eventForm.endTime} onChange={e => setEventForm({ ...eventForm, endTime: e.target.value })} className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] transition-colors" />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-medium text-gray-400 block mb-2">Ort</label>
                                    <div className="relative">
                                        <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input type="text" value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 pl-11 text-white focus:outline-none focus:border-[#3b82f6]" placeholder="Ort hinzufügen..." />
                                    </div>
                                </div>

                                {/* Recurrence Options */}
                                <div>
                                    <label className="text-sm font-medium text-gray-400 block mb-2">Wiederholung</label>
                                    <select
                                        value={eventForm.recurrence?.type || 'none'}
                                        onChange={e => setEventForm({ ...eventForm, recurrence: { type: e.target.value as any } })}
                                        className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                                    >
                                        <option value="none">Keine</option>
                                        <option value="daily">Täglich</option>
                                        <option value="weekly">Wöchentlich</option>
                                        <option value="biweekly">Alle 2 Wochen</option>
                                        <option value="monthly">Monatlich</option>
                                        <option value="yearly">Jährlich</option>
                                    </select>
                                </div>

                                {/* Sharing Toggle */}
                                <div>
                                    <label className="text-sm font-medium text-gray-400 block mb-2">Teilen</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setEventForm({ ...eventForm, sharedWith: [] })}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${eventForm.sharedWith?.length === 0 ? 'bg-[#3b82f6] text-white border-blue-500 shadow-md shadow-blue-500/20' : 'bg-[#2a2b30] text-gray-400 border-white/5 hover:bg-white/5'}`}
                                        >
                                            Nur für mich
                                        </button>
                                        <button
                                            onClick={() => setEventForm({ ...eventForm, sharedWith: ['all'] })}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border flex items-center gap-2 ${eventForm.sharedWith?.includes('all') ? 'bg-[#10b981] text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-[#2a2b30] text-gray-400 border-white/5 hover:bg-white/5'}`}
                                        >
                                            <Users size={14} /> Alle Profile
                                        </button>

                                        {/* Individual User Selection */}
                                        <div className="w-full mt-2 flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                            {useAppStore.getState().users.filter(u => !u.isHidden && u.id !== activeUserId).map(u => {
                                                const isSelected = eventForm.sharedWith?.includes(u.id);
                                                return (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => {
                                                            const current = eventForm.sharedWith || [];
                                                            const next = isSelected
                                                                ? current.filter(id => id !== u.id)
                                                                : [...current.filter(id => id !== 'all'), u.id];
                                                            setEventForm({ ...eventForm, sharedWith: next });
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${isSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-[#2a2b30] text-gray-500 border-white/5 hover:bg-white/5'}`}
                                                    >
                                                        <span>{u.avatar}</span> {u.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 block mb-2">Farbe / Kategorie</label>
                                    <div className="flex flex-wrap gap-2 bg-[#2a2b30] p-2.5 rounded-xl border border-white/5">
                                        {Object.keys(colorMap).slice(0, 10).map(c => {
                                            const isSelected = eventForm.color === c;
                                            const customLabel = user?.colorLabels?.[c];
                                            return (
                                                <button
                                                    key={c}
                                                    onClick={() => setEventForm({ ...eventForm, color: c, label: user?.colorLabels?.[c] })}
                                                    className={`
                                                        relative flex items-center gap-2 px-3 py-1.5 rounded-md border-2 transition-all duration-200
                                                        ${isSelected ? 'border-white/50 bg-white/10 shadow-md' : 'border-transparent opacity-80 hover:bg-white/5 hover:opacity-100'}
                                                    `}
                                                    title={c}
                                                >
                                                    <div className={`w-3 h-3 rounded-full ${colorMap[c]}`} />
                                                    {customLabel && (
                                                        <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                                            {customLabel}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-400 block mb-2">Notizen</label>
                                    <textarea
                                        value={eventForm.description}
                                        onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                                        className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] min-h-[100px] resize-none"
                                        placeholder="Beschreibung hinzufügen..."
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/5 flex gap-3 mt-auto">
                                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3.5 bg-transparent border border-white/10 text-white font-semibold rounded-xl hover:bg-white/5 transition-colors">Abbrechen</button>
                                <button onClick={handleSaveEvent} className="flex-1 py-3.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-xl transition-colors shadow-lg">Speichern</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
