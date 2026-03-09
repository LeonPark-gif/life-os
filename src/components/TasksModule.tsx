import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { RecipeProfile } from '../store/useAppStore';
import { Plus, MoreHorizontal, CheckCircle2, Circle, Trash2, Edit3, Layers, Clock, Calendar, Square, Play, Sparkles, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function TasksModule() {
    const activeList = useAppStore(state => state.activeList());
    const addTask = useAppStore(state => state.addTask);
    const toggleTask = useAppStore(state => state.toggleTask);
    const updateTask = useAppStore(state => state.updateTask);
    const moveTask = useAppStore(state => state.moveTask);
    const deleteTask = useAppStore(state => state.deleteTask);

    const activeFocusTaskId = useAppStore(state => state.activeFocusTaskId);
    const startFocusMode = useAppStore(state => state.startFocusMode);
    const stopFocusMode = useAppStore(state => state.stopFocusMode);

    const [newTaskText, setNewTaskText] = useState('');
    const [activeTab, setActiveTab] = useState<'tasks' | 'focus' | 'history'>('tasks');
    const [showListMenu, setShowListMenu] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListSharedWith, setNewListSharedWith] = useState<string[]>([]);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
    const [taskMenuId, setTaskMenuId] = useState<string | null>(null);

    const activeUserId = useAppStore(state => state.activeUserId);
    const currentUser = useAppStore(state => state.currentUser());
    const allLists = useAppStore(state => state.lists);
    const lists = allLists.filter(l => l.ownerId === activeUserId || (l.sharedWith && l.sharedWith.length > 0));
    const selectList = useAppStore(state => state.selectList);
    const addList = useAppStore(state => state.addList);
    const addSubtask = useAppStore(state => state.addSubtask);
    const toggleSubtask = useAppStore(state => state.toggleSubtask);

    // Smart Lists
    const getRecipeSuggestion = useAppStore(state => state.getRecipeSuggestion);
    const learnRecipePreferences = useAppStore(state => state.learnRecipePreferences);

    const [suggestedRecipe, setSuggestedRecipe] = useState<RecipeProfile | null>(null);
    const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
    const [rejectedIngredients, setRejectedIngredients] = useState<Set<string>>(new Set());

    // Check for recipe suggestions when typing
    useEffect(() => {
        if (newTaskText.length > 2) {
            const suggestion = getRecipeSuggestion(newTaskText);
            if (suggestion && suggestion.id !== suggestedRecipe?.id) {
                setSuggestedRecipe(suggestion);
                // Auto-select previously accepted ingredients, ignoring rejected ones
                const prepopulated = new Set(suggestion.ingredients.filter(i => !suggestion.rejectedIngredients.includes(i)));
                setSelectedIngredients(prepopulated);
                setRejectedIngredients(new Set(suggestion.rejectedIngredients));
            } else if (!suggestion) {
                setSuggestedRecipe(null);
            }
        } else {
            setSuggestedRecipe(null);
        }
    }, [newTaskText, getRecipeSuggestion]);

    const toggleIngredient = (ingredient: string) => {
        setSelectedIngredients(prev => {
            const next = new Set(prev);
            if (next.has(ingredient)) {
                next.delete(ingredient);
                setRejectedIngredients(r => new Set(r).add(ingredient)); // Mark as rejected for learning
            } else {
                next.add(ingredient);
                setRejectedIngredients(r => {
                    const newR = new Set(r);
                    newR.delete(ingredient); // Remove from rejected
                    return newR;
                });
            }
            return next;
        });
    };

    const handleAcceptRecipe = () => {
        if (!suggestedRecipe || !newTaskText.trim()) return;

        // 1. Add the main task
        addTask(activeList.id, newTaskText);

        // 2. We need the ID of the task we just added. 
        // A slightly hacky way in this synchronous flow is to let the store update, 
        // but Zustand addTask doesn't return the ID. 
        // For a robust implementation, `addTask` should return the generated string ID.
        // Assuming we update `addTask` to return ID later, or we find it by text:
        setTimeout(() => {
            const latestList = useAppStore.getState().lists.find(l => l.id === activeList.id);
            const addedTask = latestList?.tasks.find(t => t.text === newTaskText && !t.completed);

            if (addedTask) {
                // Add all selected ingredients as subtasks
                selectedIngredients.forEach(ing => {
                    useAppStore.getState().addSubtask(activeList.id, addedTask.id, ing);
                });

                // Learn from this interaction
                learnRecipePreferences(
                    suggestedRecipe.id,
                    Array.from(selectedIngredients),
                    Array.from(rejectedIngredients)
                );
            }
        }, 100);

        setNewTaskText('');
        setSuggestedRecipe(null);
    };

    const toggleExpand = (taskId: string) => {
        setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    const handleCreateList = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim()) return;
        addList(newListName, 'blue', newListSharedWith);
        setNewListName('');
        setNewListSharedWith([]);
        setIsCreatingList(false);
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (suggestedRecipe) {
            handleAcceptRecipe();
            return;
        }
        if (!newTaskText.trim()) return;

        const taskText = newTaskText.trim();
        addTask(activeList.id, taskText);
        setNewTaskText('');

        // Background AI processing (Proactive Help)
        const lowerTitle = taskText.toLowerCase();
        const isTodoIdea = lowerTitle.match(/kaufen|besorgen|anrufen|termin|buchen|reservieren|planen|geburtstag|geschenk|abklären/i);

        if (isTodoIdea) {
            try {
                const storeState = useAppStore.getState();
                const list = storeState.lists.find(l => l.id === activeList.id);
                const newTask = list?.tasks[list.tasks.length - 1];
                const recentTodos = list?.tasks.slice(-5).map(t => t.text).join(', ') || '';

                let suggestion;
                const aiSettings = storeState.currentUser().aiSettings;
                if (aiSettings?.geminiApiKey) {
                    const { ollamaService } = await import('../utils/ollamaService');
                    suggestion = await ollamaService.analyzeEntryStructured(taskText, 'task', recentTodos);
                } else {
                    const { haService } = await import('../utils/haService');
                    suggestion = await haService.analyzeEntry(taskText, 'task', recentTodos, aiSettings?.agentId);
                }

                if (suggestion && suggestion.action !== 'none') {
                    storeState.setSparkSuggestion({
                        ...suggestion,
                        targetId: newTask?.id,
                        listId: activeList.id
                    });
                    storeState.setShowSparkBubble(true);
                }
            } catch (err) {
                console.error("Proactive help failed silently", err);
            }
        }
    };

    const activeTasks = activeList.tasks.filter(t => !t.completed);
    const completedTasks = activeList.tasks.filter(t => t.completed);

    return (
        <div className="w-full h-full p-8 flex flex-col text-[#f3f4f6] overflow-hidden">

            {/* Top Tabs */}
            <div className="flex justify-center mb-10 w-full relative z-60 shrink-0">
                <div className="flex gap-1 bg-[#2a2b30] p-1.5 rounded-2xl border border-white/5 shadow-xl">
                    <button
                        onClick={() => setShowListMenu(!showListMenu)}
                        className="px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-bold text-[#3b82f6] hover:bg-white/5 transition-all border border-white/5"
                    >
                        <Layers size={18} />
                        <span className="truncate max-w-[120px]">{activeList.name}</span>
                    </button>
                    <div className="w-px h-6 bg-white/10 self-center mx-1" />
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'tasks' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                    >
                        Aufgaben
                    </button>
                    <button
                        onClick={() => setActiveTab('focus')}
                        className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'focus' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                    >
                        Fokus
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
                    >
                        Verlauf
                    </button>
                </div>

                {/* List Switcher Overlay */}
                <AnimatePresence>
                    {showListMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowListMenu(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute top-14 left-1/2 -translate-x-1/2 w-64 bg-[#1a1b1e] border border-white/10 rounded-[24px] shadow-2xl p-4 z-50 backdrop-blur-3xl"
                            >
                                <div className="border-b border-white/5 pb-4 mb-4">
                                    {isCreatingList ? (
                                        <form onSubmit={handleCreateList} className="space-y-4">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newListName}
                                                onChange={(e) => setNewListName(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                                                placeholder="Listenname..."
                                            />
                                            <div className="space-y-2">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Teilen mit</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {useAppStore.getState().users.filter(u => !u.isHidden && u.id !== activeUserId).map(u => {
                                                        const isSelected = newListSharedWith.includes(u.id);
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={u.id}
                                                                onClick={() => {
                                                                    setNewListSharedWith(prev =>
                                                                        isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                                                    );
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                                                            >
                                                                {u.avatar} {u.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="submit" className="flex-1 bg-[#3b82f6] text-white rounded-lg py-2 text-xs font-bold">Speichern</button>
                                                <button type="button" onClick={() => {
                                                    setIsCreatingList(false);
                                                    setNewListSharedWith([]);
                                                }} className="px-3 py-2 text-gray-400 text-xs font-bold">Abbrechen</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button
                                            onClick={() => setIsCreatingList(true)}
                                            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-xs font-bold text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all border border-[#3b82f6]/20"
                                        >
                                            <span>Neue Liste erstellen</span>
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {lists.map(list => (
                                        <button
                                            key={list.id}
                                            onClick={() => {
                                                selectList(list.id);
                                                setShowListMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${activeList.id === list.id ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            <span className="font-semibold text-sm">{list.name}</span>
                                            {list.sharedWith?.length > 0 && <span className="text-[10px] uppercase font-bold text-emerald-400">Geteilt</span>}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            <div className="w-full max-w-4xl mx-auto flex-1 overflow-y-auto custom-scrollbar pb-24">

                {activeTab === 'tasks' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-4">
                            <span className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                                OFFEN ({activeTasks.length})
                            </span>
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleAddTask} className="mb-6 relative">
                            <div className={`bg-[#2a2b30]/80 border transition-all shadow-sm flex items-center gap-4 p-4 z-20 relative
                                ${suggestedRecipe ? 'rounded-t-2xl border-[#3b82f6]/50 ring-1 ring-[#3b82f6]/50' : 'rounded-2xl border-white/5 focus-within:border-[#3b82f6] focus-within:ring-1 focus-within:ring-[#3b82f6]'}`}>
                                <Plus size={20} className={suggestedRecipe ? "text-[#3b82f6]" : "text-gray-400"} />
                                <input
                                    type="text"
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    placeholder="Aufgabe hinzufügen..."
                                    className="flex-1 bg-transparent border-none text-[15px] font-medium placeholder-gray-500 focus:outline-none focus:ring-0 text-white"
                                />
                                {suggestedRecipe && (
                                    <button type="submit" className="bg-[#3b82f6] text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors">
                                        <Sparkles size={16} /> Erstellen
                                    </button>
                                )}
                            </div>

                            {/* Smart Suggestions Dropdown */}
                            <AnimatePresence>
                                {suggestedRecipe && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -20, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                                        exit={{ opacity: 0, y: -20, height: 0 }}
                                        className="absolute top-full left-0 right-0 bg-[#252836] border border-t-0 border-[#3b82f6]/50 rounded-b-2xl shadow-[0_10px_30px_rgba(59,130,246,0.15)] z-10 overflow-hidden"
                                    >
                                        <div className="p-5">
                                            <div className="flex items-center gap-2 text-[#3b82f6] mb-3">
                                                <Sparkles size={16} />
                                                <span className="text-sm font-bold uppercase tracking-wider">Rezept erkannt: {suggestedRecipe.originalName}</span>
                                            </div>
                                            <p className="text-sm text-gray-400 mb-4">Wähle die Zutaten aus, die du auf die Einkaufsliste (als Unterschritte) setzen möchtest. Das System lernt deine Vorlieben!</p>

                                            <div className="flex flex-wrap gap-2">
                                                {/* Combine all known ingredients from this profile */}
                                                {Array.from(new Set([...suggestedRecipe.ingredients, ...suggestedRecipe.rejectedIngredients])).map(ing => {
                                                    const isSelected = selectedIngredients.has(ing);
                                                    return (
                                                        <button
                                                            key={ing}
                                                            type="button"
                                                            onClick={() => toggleIngredient(ing)}
                                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border 
                                                                ${isSelected
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                    : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                                                        >
                                                            {isSelected ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                                                            {ing}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </form>

                        {/* Task List */}
                        <div className="space-y-4">
                            <AnimatePresence>
                                {activeTasks.map(task => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        key={task.id}
                                        className={`group flex items-start gap-4 p-4 rounded-2xl transition-all border ${activeFocusTaskId === task.id ? 'bg-[#252836] border-blue-500/30 shadow-[0_4px_20px_rgba(59,130,246,0.1)]' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                                    >
                                        <button
                                            onClick={() => toggleTask(activeList.id, task.id)}
                                            className="mt-1 text-gray-500 hover:text-[#3b82f6] transition-colors shrink-0"
                                        >
                                            <Circle size={22} strokeWidth={1.5} />
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <h3 className={`text-[15px] font-medium leading-relaxed ${activeFocusTaskId === task.id ? 'text-white' : 'text-gray-200'}`}>
                                                    {task.text}
                                                </h3>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative">
                                                    <button onClick={() => toggleExpand(task.id)} className="text-gray-500 hover:text-white shrink-0 p-1">
                                                        <Layers size={18} />
                                                    </button>
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setTaskMenuId(taskMenuId === task.id ? null : task.id)}
                                                            className={`shrink-0 p-1 transition-colors ${taskMenuId === task.id ? 'text-[#3b82f6]' : 'text-gray-500 hover:text-white'}`}
                                                        >
                                                            <MoreHorizontal size={18} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {taskMenuId === task.id && (
                                                                <>
                                                                    <motion.div
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{ opacity: 1 }}
                                                                        exit={{ opacity: 0 }}
                                                                        className="fixed inset-0 z-30"
                                                                        onClick={() => setTaskMenuId(null)}
                                                                    />
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                                        className="absolute right-0 mt-2 w-56 bg-[#1a1b1e] border border-white/10 rounded-xl shadow-2xl z-40 p-2 overflow-hidden"
                                                                    >
                                                                        <button
                                                                            onClick={() => {
                                                                                deleteTask(activeList.id, task.id);
                                                                                setTaskMenuId(null);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                                                        >
                                                                            <Trash2 size={14} /> Löschen
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const newText = prompt("Aufgabe bearbeiten:", task.text);
                                                                                if (newText && newText !== task.text) {
                                                                                    updateTask(activeList.id, task.id, { text: newText });
                                                                                }
                                                                                setTaskMenuId(null);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-gray-400 hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 rounded-lg transition-all"
                                                                        >
                                                                            <Edit3 size={14} /> Bearbeiten
                                                                        </button>

                                                                        <div className="h-px bg-white/5 my-1" />
                                                                        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Verschieben nach</div>
                                                                        {lists.filter(l => l.id !== activeList.id).map(l => (
                                                                            <button
                                                                                key={l.id}
                                                                                onClick={() => {
                                                                                    moveTask(activeList.id, l.id, task.id);
                                                                                    setTaskMenuId(null);
                                                                                }}
                                                                                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                                            >
                                                                                <span className="truncate">{l.name}</span>
                                                                                <ChevronRight size={12} />
                                                                            </button>
                                                                        ))}
                                                                    </motion.div>
                                                                </>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tags / Metadata */}
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2b30] border border-white/5 text-[11px] font-medium text-gray-400">
                                                    <Clock size={12} className="text-[#3b82f6]" />
                                                    {activeFocusTaskId === task.id ? 'Fokus läuft...' : `${task.subtasks?.filter(s => s.completed).length || 0}/${task.subtasks?.length || 0} Unterschritte`}
                                                </div>

                                                {task.dueDate && (
                                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2b30] border border-white/5 text-[11px] font-medium text-rose-400">
                                                        <Calendar size={12} />
                                                        {format(new Date(task.dueDate), 'dd. MMM')}
                                                    </div>
                                                )}

                                                {/* Start/Stop Focus Button */}
                                                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {activeFocusTaskId === task.id ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); stopFocusMode(); }}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider px-3 py-1 bg-rose-500/10 rounded-lg"
                                                        >
                                                            <Square size={10} fill="currentColor" /> Fokus stoppen
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startFocusMode(task.id, 25); }}
                                                            disabled={activeFocusTaskId !== null}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-[#3b82f6] hover:text-blue-400 uppercase tracking-wider px-3 py-1 bg-blue-500/10 rounded-lg disabled:opacity-50"
                                                        >
                                                            <Play size={10} fill="currentColor" /> Fokus starten
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Subtasks UI */}
                                            <AnimatePresence>
                                                {expandedTasks[task.id] && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden mt-4 space-y-3"
                                                    >
                                                        <div className="pl-4 border-l-2 border-white/5 space-y-2">
                                                            {task.subtasks?.map(sub => (
                                                                <div key={sub.id} className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => toggleSubtask(activeList.id, task.id, sub.id)}
                                                                        className={`shrink-0 ${sub.completed ? 'text-emerald-500' : 'text-gray-600'}`}
                                                                    >
                                                                        {sub.completed ? <CheckCircle2 size={16} fill="currentColor" /> : <Circle size={16} />}
                                                                    </button>
                                                                    <span className={`text-sm ${sub.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{sub.text}</span>
                                                                </div>
                                                            ))}
                                                            <form
                                                                onSubmit={(e) => {
                                                                    e.preventDefault();
                                                                    const input = e.currentTarget.elements.namedItem('subtask') as HTMLInputElement;
                                                                    if (input.value.trim()) {
                                                                        addSubtask(activeList.id, task.id, input.value);
                                                                        input.value = '';
                                                                    }
                                                                }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <Plus size={14} className="text-gray-500" />
                                                                <input
                                                                    name="subtask"
                                                                    type="text"
                                                                    placeholder="Unterschritt hinzufügen..."
                                                                    className="bg-transparent border-none text-sm placeholder-gray-600 focus:outline-none focus:ring-0 text-white w-full"
                                                                />
                                                            </form>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
                        <div className="mb-6">
                            <span className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                                ERLEDIGT ({completedTasks.length})
                            </span>
                        </div>

                        <div className="space-y-2">
                            <AnimatePresence>
                                {completedTasks.map(task => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        key={task.id}
                                        className="group flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <button onClick={() => toggleTask(activeList.id, task.id)} className="text-[#10b981] hover:text-[#059669] transition-colors shrink-0">
                                                <CheckCircle2 size={22} fill="currentColor" className="text-emerald-900 border-none bg-emerald-500 rounded-full" />
                                            </button>
                                            <h3 className="text-[15px] font-medium text-gray-500 line-through truncate">
                                                {task.text}
                                            </h3>
                                        </div>
                                        <button onClick={() => deleteTask(activeList.id, task.id)} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-500 shrink-0">
                                            <Trash2 size={16} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {completedTasks.length === 0 && (
                                <div className="text-center py-20 text-gray-500 text-sm">
                                    Noch keine erledigten Aufgaben. Weiter so!
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'focus' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center min-h-[400px] text-center">
                        <div className="w-48 h-48 rounded-full border-4 border-[#2a2b30] border-t-[#3b82f6] flex items-center justify-center mb-8 relative">
                            {activeFocusTaskId ? (
                                <div className="absolute inset-0 rounded-full border-4 border-t-[#3b82f6] border-r-[#3b82f6] border-b-transparent border-l-transparent animate-spin opacity-50" />
                            ) : null}
                            <div className="text-5xl font-light tracking-tighter text-white">
                                {activeFocusTaskId ? '24:59' : '25:00'}
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold mb-2">Tiefenfokus-Modus</h2>
                        <p className="text-gray-400 mb-8 max-w-sm">
                            {activeFocusTaskId
                                ? `Aktueller Fokus auf: "${activeList.tasks.find(t => t.id === activeFocusTaskId)?.text}"`
                                : "Wähle eine Aufgabe aus deiner Liste, um eine Pomodoro-Sitzung zu starten. Benachrichtigungen werden pausiert."}
                        </p>

                        {activeFocusTaskId ? (
                            <button
                                onClick={() => stopFocusMode()}
                                className="flex items-center gap-2 px-8 py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-rose-500/20"
                            >
                                <Square size={20} fill="currentColor" /> Fokus-Sitzung beenden
                            </button>
                        ) : (
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className="flex items-center gap-2 px-8 py-4 bg-[#2a2b30] hover:bg-[#3b82f6] text-white font-semibold rounded-2xl transition-all border border-white/5"
                            >
                                Aufgabe wählen
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
