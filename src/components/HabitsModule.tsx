import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Habit, ThemeColor } from '../store/useAppStore';
import { Flame, Plus, Check, Undo, X, Trophy, Activity, Droplets, Dumbbell, BookOpen, Coffee, Sun, Moon, Target, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendNotification } from '../utils/notifications';

// Helper Map for available icons
const ICON_MAP: Record<string, React.ReactNode> = {
    'flame': <Flame size={18} />,
    'droplets': <Droplets size={18} />,
    'dumbbell': <Dumbbell size={18} />,
    'book': <BookOpen size={18} />,
    'coffee': <Coffee size={18} />,
    'sun': <Sun size={18} />,
    'moon': <Moon size={18} />,
    'activity': <Activity size={18} />,
    'target': <Target size={18} />
};

// Tabbie pastel/modern palette
const THEME_COLORS: Record<string, string> = {
    rose: 'bg-rose-500', pink: 'bg-pink-500', fuchsia: 'bg-fuchsia-500', purple: 'bg-purple-500',
    indigo: 'bg-indigo-500', blue: 'bg-[#3b82f6]', sky: 'bg-sky-500', cyan: 'bg-cyan-500',
    teal: 'bg-teal-500', emerald: 'bg-emerald-500', green: 'bg-green-500', lime: 'bg-lime-500',
    yellow: 'bg-yellow-400', amber: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500',
    stone: 'bg-stone-500', slate: 'bg-slate-500'
};

export default function HabitsModule() {
    const allHabits = useAppStore(state => state.habits);
    const activeUserId = useAppStore(state => state.activeUserId);
    const habits = allHabits.filter(h => h.ownerId === activeUserId);

    const addHabit = useAppStore(state => state.addHabit);
    const logHabit = useAppStore(state => state.logHabit);
    const unlogHabit = useAppStore(state => state.unlogHabit);
    const removeHabit = useAppStore(state => state.removeHabit);
    const currentUser = useAppStore(state => state.currentUser());

    const [showAddModal, setShowAddModal] = useState(false);
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitIcon, setNewHabitIcon] = useState('flame');
    const [newHabitColor, setNewHabitColor] = useState<ThemeColor>('blue');
    const [newHabitTarget, setNewHabitTarget] = useState(1);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [aiSmartReminders, setAiSmartReminders] = useState(false);

    const [activeTab, setActiveTab] = useState<'habits' | 'stats'>('habits');

    const todayStr = new Date().toISOString().split('T')[0];

    // Past 7 Days for Mini-Graph
    const last7Days = useMemo(() => {
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }, []);

    const handleAddHabit = () => {
        if (!newHabitName.trim()) return;
        addHabit({
            name: newHabitName,
            ownerId: currentUser.id,
            icon: newHabitIcon,
            color: newHabitColor,
            frequency: 'daily',
            targetCount: newHabitTarget,
            notificationsEnabled: notificationsEnabled,
            aiSmartReminders: aiSmartReminders
        });
        setNewHabitName('');
        setAiSmartReminders(false);
        setShowAddModal(false);
    };

    const calculateStreak = (habit: Habit) => {
        let streak = 0;
        let d = new Date();
        let checkDateStr = d.toISOString().split('T')[0];
        let isTodayDone = (habit.completedDates[checkDateStr] || 0) >= habit.targetCount;

        if (!isTodayDone) {
            d.setDate(d.getDate() - 1);
        }

        while (true) {
            checkDateStr = d.toISOString().split('T')[0];
            const count = habit.completedDates[checkDateStr] || 0;
            if (count >= habit.targetCount) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }
        if (isTodayDone) streak++;
        return streak;
    };

    return (
        <div className="w-full h-full p-8 flex flex-col text-white overflow-hidden font-sans">

            {/* Top Tabs */}
            <div className="flex justify-center mb-10 w-full relative z-10 shrink-0">
                <div className="flex gap-1 bg-[#2a2b30] p-1.5 rounded-2xl border border-white/5 shadow-xl">
                    <button
                        onClick={() => setActiveTab('habits')}
                        className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'habits' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                    >
                        Gewohnheiten
                    </button>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'stats' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                    >
                        Statistiken
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-end mb-8 relative z-10 shrink-0 px-2 lg:px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Deine Gewohnheiten</h2>
                    <p className="text-gray-400">Baue tägliche Routinen auf, um deine Ziele zu erreichen</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Plus size={16} /> Neue Gewohnheit
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 lg:px-8 custom-scrollbar pb-24">
                {activeTab === 'habits' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {habits.length === 0 ? (
                                <div className="col-span-1 xl:col-span-2 flex flex-col items-center justify-center p-16 bg-[#2a2b30] border border-white/5 rounded-[24px] text-gray-500 h-64">
                                    <Target size={48} className="mb-4 opacity-30" />
                                    <p className="text-[15px] font-medium text-white/80">Noch keine Gewohnheiten erfasst.</p>
                                    <p className="text-sm mt-1 text-gray-500">Fang klein an: 10 Seiten lesen, Wasser trinken oder täglich programmieren.</p>
                                </div>
                            ) : (
                                habits.map(habit => {
                                    const todayCount = habit.completedDates[todayStr] || 0;
                                    const isDoneToday = todayCount >= habit.targetCount;
                                    const progressPct = Math.min(100, Math.round((todayCount / habit.targetCount) * 100));
                                    const streak = calculateStreak(habit);

                                    return (
                                        <motion.div
                                            key={habit.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={`bg-[#1e1f23] rounded-[24px] p-6 border transition-all duration-300 relative overflow-hidden group hover:border-white/10
                                            ${isDoneToday ? 'border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.1)]' : 'border-white/5'}`}
                                        >
                                            {/* Progress Background */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out opacity-5"
                                                style={{ width: `${progressPct}%`, backgroundColor: isDoneToday ? '#10b981' : THEME_COLORS[habit.color].replace('bg-', '') }}
                                            />

                                            <div className="relative z-10 flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center transition-all ${isDoneToday ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#2a2b30] text-gray-400'}`}>
                                                        {ICON_MAP[habit.icon] || <Flame size={20} />}
                                                    </div>
                                                    <div>
                                                        <h3 className={`text-[17px] font-semibold transition-colors ${isDoneToday ? 'text-white' : 'text-gray-200'}`}>{habit.name}</h3>
                                                        <div className="flex items-center gap-2 text-[12px] text-gray-400 mt-1 font-medium">
                                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${streak > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-gray-500'}`}>
                                                                <Trophy size={10} />
                                                                {streak} Tage in Folge
                                                            </div>
                                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-gray-500">
                                                                <Target size={10} /> {habit.targetCount}/Tag
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => removeHabit(habit.id)}
                                                    className="p-2 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <div className="relative z-10 flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        if (isDoneToday) {
                                                            unlogHabit(habit.id, todayStr, habit.targetCount);
                                                        } else {
                                                            logHabit(habit.id, todayStr, 1);
                                                            if (todayCount + 1 >= habit.targetCount && habit.notificationsEnabled) {
                                                                sendNotification("Gewohnheit geschafft! 🎉", `Glückwunsch! Du hast dein Ziel für "${habit.name}" erreicht.`);
                                                            }
                                                        }
                                                    }}
                                                    className={`flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[15px] transition-all duration-200 transform active:scale-95 border
                                                        ${isDoneToday
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                            : 'bg-[#3b82f6] text-white border-blue-500 shadow-lg shadow-blue-500/20 hover:bg-[#2563eb]'
                                                        }`}
                                                >
                                                    {isDoneToday ? (
                                                        <><Check size={18} /> Erledigt</>
                                                    ) : (
                                                        <><Plus size={18} /> Fortschritt loggen ({todayCount}/{habit.targetCount})</>
                                                    )}
                                                </button>

                                                {habit.targetCount > 1 && todayCount > 0 && !isDoneToday && (
                                                    <button
                                                        onClick={() => unlogHabit(habit.id, todayStr, 1)}
                                                        className="w-12 h-[52px] flex items-center justify-center bg-[#2a2b30] hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl border border-white/5 transition-colors shrink-0"
                                                        title="Letzten Log rückgängig machen"
                                                    >
                                                        <Undo size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-[#1e1f23] rounded-[24px] border border-white/5 p-8 mb-6">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6">7-Tage Übersicht</h3>
                            {habits.length === 0 ? (
                                <p className="text-gray-500 text-sm">Keine Gewohnheiten zum Analysieren.</p>
                            ) : (
                                <div className="space-y-6">
                                    {habits.map(habit => (
                                        <div key={habit.id} className="flex items-center gap-4">
                                            <div className="w-1/4">
                                                <div className="text-[13px] font-semibold text-gray-200 truncate pr-2">{habit.name}</div>
                                            </div>
                                            <div className="flex-1 flex gap-2 justify-between items-center">
                                                {last7Days.map(date => {
                                                    const count = habit.completedDates[date] || 0;
                                                    const done = count >= habit.targetCount;
                                                    const dayName = new Date(date).toLocaleDateString('de-DE', { weekday: 'narrow' });
                                                    return (
                                                        <div key={date} className="flex flex-col items-center gap-1.5 flex-1 max-w-[32px]">
                                                            <span className="text-[9px] font-bold text-gray-600 uppercase">{dayName}</span>
                                                            <div
                                                                className={`w-full aspect-square rounded-[8px] flex items-center justify-center transition-all text-white
                                                                    ${done ? 'bg-emerald-500/80 border border-emerald-400' : 'bg-[#2a2b30] border border-white/5'}`}
                                                                title={`${date}: ${count}/${habit.targetCount}`}
                                                            >
                                                                {done && <Check size={12} strokeWidth={3} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ADD HABIT MODAL */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#1e1f23] border border-white/10 p-8 rounded-[32px] w-full max-w-lg shadow-2xl relative text-white"
                        >
                            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 p-2 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all">
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-bold mb-8">Gewohnheit erstellen</h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Name der Gewohnheit</label>
                                    <input
                                        type="text"
                                        value={newHabitName}
                                        onChange={e => setNewHabitName(e.target.value)}
                                        placeholder="z.B. 20 Seiten lesen"
                                        className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Tagesziel</label>
                                    <div className="flex items-center gap-4 bg-[#2a2b30] p-4 rounded-xl border border-white/5">
                                        <input
                                            type="number"
                                            min="1"
                                            value={newHabitTarget}
                                            onChange={e => setNewHabitTarget(Math.max(1, Number(e.target.value)))}
                                            className="flex-1 bg-transparent text-white focus:outline-none"
                                        />
                                        <div className="w-10 h-10 flex items-center justify-center rounded-[10px] bg-white/5 font-bold text-[#3b82f6]">
                                            {newHabitTarget}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-2">Wie oft du diese Gewohnheit pro Tag erfassen möchtest.</p>
                                </div>

                                <div className="flex items-center justify-between bg-[#2a2b30] p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${notificationsEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                                            <Activity size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Push-Benachrichtigungen</p>
                                            <p className="text-[10px] text-gray-500">Info bei Zielerreichung (Smartphone)</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!notificationsEnabled) {
                                                // Try to request permission if enabling
                                                if ("Notification" in window && Notification.permission !== "granted") {
                                                    Notification.requestPermission();
                                                }
                                            }
                                            setNotificationsEnabled(!notificationsEnabled);
                                        }}
                                        className={`w-12 h-6 rounded-full transition-all relative ${notificationsEnabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between bg-[#2a2b30] p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${aiSmartReminders ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-500'}`}>
                                            <Sparkles size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-indigo-200">KI Smart Reminders</p>
                                            <p className="text-[10px] text-gray-500">KI entscheidet über Zeitpunkt & Motivations-Text</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAiSmartReminders(!aiSmartReminders)}
                                        className={`w-12 h-6 rounded-full transition-all relative ${aiSmartReminders ? 'bg-indigo-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${aiSmartReminders ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Icon</label>
                                    <div className="flex gap-2 flex-wrap bg-[#2a2b30] p-2.5 rounded-xl border border-white/5">
                                        {Object.keys(ICON_MAP).map(iconName => (
                                            <button
                                                key={iconName}
                                                onClick={() => setNewHabitIcon(iconName)}
                                                className={`p-2.5 rounded-[10px] transition-all ${newHabitIcon === iconName ? 'bg-[#3b82f6] text-white shadow-md shadow-blue-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                            >
                                                {ICON_MAP[iconName]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Farbe</label>
                                    <div className="flex gap-2 flex-wrap bg-[#2a2b30] p-2.5 rounded-xl border border-white/5">
                                        {(Object.keys(THEME_COLORS) as ThemeColor[]).slice(0, 10).map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewHabitColor(color)}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${THEME_COLORS[color]} ${newHabitColor === color ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:scale-105 hover:opacity-100'}`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddHabit}
                                    disabled={!newHabitName.trim()}
                                    className="w-full py-4 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-[15px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
                                >
                                    Gewohnheit speichern
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
