import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Calendar, CheckCircle2, Circle, Clock, MessageSquare, Mic } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import MACSAvatar from './MACSAvatar';

export default function TabletDashboard() {
    const users = useAppStore(state => state.users.filter(u => !u.isHidden && u.id !== 'admin'));
    const allEvents = useAppStore(state => state.getVisibleEvents());
    const checklists = useAppStore(state => state.lists);

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Helper to get today's and tomorrow's events for a user
    const getUserEvents = (userId: string) => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return allEvents.filter(e =>
            (e.ownerId === userId || e.sharedWith.includes(userId) || e.sharedWith.includes('all')) &&
            (isSameDay(new Date(e.date), today) || isSameDay(new Date(e.date), tomorrow))
        ).slice(0, 5);
    };

    // Helper to get open tasks for a user
    const getUserTasks = (userId: string) => {
        const userLists = checklists.filter(l => l.ownerId === userId || l.sharedWith.includes(userId));
        return userLists.flatMap(l => l.tasks).filter(t => !t.completed).slice(0, 5);
    };

    return (
        <div className="w-full h-full bg-[#0f1115] text-white flex flex-col p-8 overflow-hidden relative selection:bg-cyan-500/30">
            {/* Header: Face & Clock */}
            <div className="flex justify-between items-start mb-12">
                <div className="flex flex-col">
                    <h1 className="text-6xl font-light tracking-tighter text-white/90">
                        {format(time, 'HH:mm')}
                    </h1>
                    <p className="text-xl text-gray-400 font-medium">
                        {format(time, 'EEEE, d. MMMM', { locale: de })}
                    </p>
                </div>

                {/* Tabbie Face (Using MACSAvatar scaled up) */}
                <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                    <MACSAvatar />
                </div>
            </div>

            {/* Split Context Columns */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-hidden">
                {users.slice(0, 4).map(user => {
                    const userEvents = getUserEvents(user.id);
                    const userTasks = getUserTasks(user.id);

                    return (
                        <div key={user.id} className="flex flex-col bg-[#1a1b1e]/80 border border-white/5 rounded-[32px] p-6 backdrop-blur-xl overflow-hidden">
                            {/* User Header */}
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
                                <div className="text-3xl bg-white/5 p-3 rounded-2xl shadow-inner border border-white/10">
                                    {user.avatar}
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                    {user.name}
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                                {/* Calendar Section */}
                                <section>
                                    <h3 className="text-[11px] font-bold tracking-widest text-emerald-500 uppercase flex items-center gap-2 mb-4">
                                        <Calendar size={14} /> Termine
                                    </h3>
                                    {userEvents.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">Keine anstehenden Termine.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {userEvents.map(evt => (
                                                <div key={evt.id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                                    <p className="font-semibold text-sm text-gray-200 truncate">{evt.title}</p>
                                                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                                                        {isSameDay(new Date(evt.date), new Date()) ? (
                                                            <span className="text-emerald-400 font-medium">Heute</span>
                                                        ) : (
                                                            <span>Morgen</span>
                                                        )}
                                                        {evt.isAllDay ? (
                                                            <span className="text-purple-400">Ganztägig</span>
                                                        ) : (
                                                            <span className="flex items-center gap-1"><Clock size={10} /> {evt.time}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Tasks Section */}
                                <section>
                                    <h3 className="text-[11px] font-bold tracking-widest text-blue-400 uppercase flex items-center gap-2 mb-4">
                                        <CheckCircle2 size={14} /> Aufgaben
                                    </h3>
                                    {userTasks.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">Alles erledigt!</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {userTasks.map(task => (
                                                <div key={task.id} className="flex items-start gap-3 bg-transparent p-2 rounded-xl group">
                                                    <Circle size={16} className="text-gray-600 mt-0.5 shrink-0" />
                                                    <span className="text-sm text-gray-300 font-medium leading-snug">{task.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* AI Control Bar at the bottom */}
            <div className="mt-8 shrink-0 bg-[#1a1b1e]/90 border border-white/10 rounded-[28px] p-4 flex items-center gap-4 backdrop-blur-2xl">
                <div className="flex-1 px-4 text-gray-500 text-sm font-medium">
                    "Tabbie, schalte das Licht im Flur ein..."
                </div>
                <button className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-gray-300 transition-colors border border-white/5">
                    <MessageSquare size={20} />
                </button>
                <div className="w-px h-8 bg-white/10" />
                <button className="w-12 h-12 bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] rounded-2xl flex items-center justify-center text-cyan-950 transition-colors">
                    <Mic size={20} className="fill-current" />
                </button>
            </div>
        </div>
    );
}
