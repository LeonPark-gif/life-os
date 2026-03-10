import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Calendar, CheckCircle2, Circle, Clock, MessageSquare, Mic } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import MACSAvatar from './MACSAvatar';
// @ts-ignore
import { ResponsiveGridLayout as _ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import MediaController from './MediaController';

const ResponsiveGridLayout = _ResponsiveGridLayout as any;

export default function TabletDashboard() {
    const user = useAppStore(state => state.currentUser());
    const allEvents = useAppStore(state => state.getVisibleEvents());
    const checklists = useAppStore(state => state.lists);
    const updateGridLayouts = useAppStore(state => state.updateGridLayouts);

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Helper functions
    const userEvents = allEvents.filter(e =>
        (e.ownerId === user.id || e.sharedWith.includes(user.id) || e.sharedWith.includes('all')) &&
        (isSameDay(new Date(e.date), time) || isSameDay(new Date(e.date), new Date(time.getTime() + 86400000)))
    ).slice(0, 5);

    const userTasks = checklists
        .filter(l => l.ownerId === user.id || l.sharedWith.includes(user.id))
        .flatMap(l => l.tasks)
        .filter(t => !t.completed)
        .slice(0, 5);

    // Grid Layout Configuration
    const defaultLayout = [
        { i: 'clock', x: 0, y: 0, w: 2, h: 2, static: true },
        { i: 'avatar', x: 2, y: 0, w: 2, h: 2, static: true },
        { i: 'calendar', x: 0, y: 2, w: 2, h: 3 },
        { i: 'tasks', x: 2, y: 2, w: 2, h: 3 },
        { i: 'media', x: 4, y: 0, w: 2, h: 3 }
    ];

    const currentLayout = user.gridLayouts?.tablet || defaultLayout;

    const onLayoutChange = (newLayout: any) => {
        updateGridLayouts(user.id, 'tablet', newLayout);
    };

    return (
        <div className="w-full h-full bg-[#0f1115] text-white flex flex-col p-8 overflow-hidden relative selection:bg-cyan-500/30">
            <div className="flex-1 overflow-hidden relative">
                <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: currentLayout }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 6, md: 6, sm: 4, xs: 2, xxs: 1 }}
                    rowHeight={100}
                    onLayoutChange={(_layout: any, allLayouts: any) => onLayoutChange(allLayouts.lg || _layout)}
                    isDraggable={true}
                    isResizable={true}
                    margin={[24, 24]}
                >
                    {/* 1. Clock Widget */}
                    <div key="clock" className="flex flex-col justify-center">
                        <h1 className="text-6xl font-light tracking-tighter text-white/90">
                            {format(time, 'HH:mm')}
                        </h1>
                        <p className="text-xl text-gray-400 font-medium">
                            {format(time, 'EEEE, d. MMMM', { locale: de })}
                        </p>
                    </div>

                    {/* 2. Avatar Widget */}
                    <div key="avatar" className="relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full scale-150" />
                        <MACSAvatar />
                    </div>

                    {/* 3. Calendar Widget */}
                    <div key="calendar" className="flex flex-col bg-[#1a1b1e]/80 border border-white/5 rounded-[32px] p-6 backdrop-blur-xl overflow-hidden cursor-move">
                        <h3 className="text-[11px] font-bold tracking-widest text-emerald-500 uppercase flex items-center gap-2 mb-4 shrink-0">
                            <Calendar size={14} /> Termine
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {userEvents.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">Keine anstehenden Termine.</p>
                            ) : (
                                userEvents.map(evt => (
                                    <div key={evt.id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                        <p className="font-semibold text-sm text-gray-200 truncate">{evt.title}</p>
                                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                                            {isSameDay(new Date(evt.date), time) ? (
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
                                ))
                            )}
                        </div>
                    </div>

                    {/* 4. Tasks Widget */}
                    <div key="tasks" className="flex flex-col bg-[#1a1b1e]/80 border border-white/5 rounded-[32px] p-6 backdrop-blur-xl overflow-hidden cursor-move">
                        <h3 className="text-[11px] font-bold tracking-widest text-blue-400 uppercase flex items-center gap-2 mb-4 shrink-0">
                            <CheckCircle2 size={14} /> Aufgaben
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                            {userTasks.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">Alles erledigt!</p>
                            ) : (
                                userTasks.map(task => (
                                    <div key={task.id} className="flex items-start gap-3 bg-transparent p-2 rounded-xl group">
                                        <Circle size={16} className="text-gray-600 mt-0.5 shrink-0" />
                                        <span className="text-sm text-gray-300 font-medium leading-snug">{task.text}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 5. Media Controller Widget */}
                    <div key="media" className="cursor-move">
                        <MediaController entityId={user.smarthomeDevices?.find(d => d.type === 'pc')?.entityId || 'media_player.spotify'} />
                    </div>
                </ResponsiveGridLayout>
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

