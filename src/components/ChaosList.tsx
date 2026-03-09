import { useState, useMemo } from 'react';

import { useAppStore, type ThemeColor, type Task } from '../store/useAppStore';
import { Plus, Trash2, Archive, Check, X, Share2, Users, CheckSquare, Calendar as CalendarIcon, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { haService } from '../utils/haService';
import { ollamaService } from '../utils/ollamaService';

// Helper for Theme Colors


const themeColors: Record<ThemeColor, string> = {
    cyan: 'from-cyan-500/20 to-blue-600/20 border-cyan-500/30 text-cyan-100',
    rose: 'from-rose-500/20 to-pink-600/20 border-rose-500/30 text-rose-100',
    amber: 'from-amber-500/20 to-orange-600/20 border-amber-500/30 text-amber-100',
    emerald: 'from-emerald-500/20 to-green-600/20 border-emerald-500/30 text-emerald-100',
    violet: 'from-violet-500/20 to-purple-600/20 border-violet-500/30 text-violet-100',
    // Fallbacks for missing themes in themeColors
    scifi: 'from-cyan-900/20 to-blue-900/20 border-cyan-500/30 text-blue-100',
    mint: 'from-emerald-900/20 to-teal-900/20 border-emerald-500/30 text-emerald-100',
    peach: 'from-orange-900/20 to-rose-900/20 border-orange-500/30 text-orange-100',
    lavender: 'from-purple-900/20 to-indigo-900/20 border-purple-500/30 text-purple-100',
    sky: 'from-sky-900/20 to-blue-900/20 border-sky-500/30 text-sky-100',
    blue: 'from-blue-900/20 to-indigo-900/20 border-blue-500/30 text-blue-100',
    green: 'from-green-900/20 to-emerald-900/20 border-green-500/30 text-green-100',
    purple: 'from-purple-900/20 to-fuchsia-900/20 border-purple-500/30 text-purple-100',
    orange: 'from-orange-900/20 to-red-900/20 border-orange-500/30 text-orange-100',
    gray: 'from-gray-900/20 to-slate-900/20 border-gray-500/30 text-gray-100',
    black: 'from-black/40 to-black/60 border-gray-800/50 text-gray-300',
    white: 'from-white/10 to-white/5 border-white/20 text-white',
    stone: 'from-stone-900/20 to-zinc-900/20 border-stone-500/30 text-stone-100',
    slate: 'from-slate-900/20 to-gray-900/20 border-slate-500/30 text-slate-100',
};

export default function ChaosList() {
    // Store - Individual Selectors (prevents re-render loops)
    const lists = useAppStore(state => state.lists);
    const activeUserId = useAppStore(state => state.activeUserId);
    const activeListId = useAppStore(state => state.activeListId);
    const currentUser = useAppStore(state => state.currentUser);
    const addList = useAppStore(state => state.addList);
    const updateList = useAppStore(state => state.updateList);
    const removeList = useAppStore(state => state.removeList);
    const selectList = useAppStore(state => state.selectList);
    const addTask = useAppStore(state => state.addTask);
    const toggleTask = useAppStore(state => state.toggleTask);
    const deleteTask = useAppStore(state => state.deleteTask);
    const toggleListSharing = useAppStore(state => state.toggleListSharing);
    const archiveTask = useAppStore(state => state.archiveTask);

    // Derived Logic - Stable Filtering
    const visibleLists = useMemo(() => {
        return lists.filter(l =>
            l.ownerId === activeUserId ||
            (l.sharedWith && l.sharedWith.length > 0)
        );
    }, [lists, activeUserId]);

    // Local State
    const [newListMode, setNewListMode] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState<string>(''); // ISO Date String for input

    // Subtask Input State
    const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
    const [subtaskInput, setSubtaskInput] = useState('');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    // Select Active List from Store State (Reactive now)
    const userObj = currentUser();
    const activeList = visibleLists.find((l) => l.id === activeListId) || visibleLists[0];

    // Effect: If activeList is missing (e.g. deleted), select default
    // This is handled in the removeList action usually, but good for safety

    const handleAddList = (theme: ThemeColor) => {
        if (!newListName.trim()) return;
        addList(newListName, theme);
        setNewListName('');
        setNewListMode(false);
    };

    const handleUpdateList = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeList && editName.trim()) {
            updateList(activeList.id, { name: editName });
            setIsEditing(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskText.trim() || !activeList) return;

        const date = newTaskDueDate ? new Date(newTaskDueDate) : undefined;
        addTask(activeList.id, newTaskText, date);
        const addedTaskText = newTaskText;

        setNewTaskText('');
        setNewTaskDueDate('');

        // Proactive Help Trigger (Keyword Pre-filtering & Context Reduction)
        if (userObj.aiSettings?.enabled && userObj.aiSettings?.proactiveHelp) {
            const lowerText = addedTaskText.toLowerCase();
            const isGrocery = lowerText.match(/einkauf|rewe|lidl|aldi|edeka|netto|kaufland|dm|rossmann/);
            const isSmartHome = lowerText.match(/licht|lampe|schalte|mach|heizung|rollo/);

            if (isGrocery || isSmartHome) {
                const storeState = useAppStore.getState();
                let recentContext = '';

                if (isGrocery) {
                    // Reduce context to ONLY past grocery items to save tokens
                    const groceryTasks = storeState.lists.flatMap(l => l.tasks).filter(t => t.text.match(/einkauf|rewe|lidl|aldi|edeka|kaufland|netto|dm|rossmann/i));
                    const pastItems = groceryTasks.flatMap(t => t.subtasks?.map(s => s.text) || []);
                    recentContext = [...new Set(pastItems)].slice(0, 20).join(', ');
                } else {
                    // Minimal context for smart home
                    recentContext = 'SmartHome Command';
                }

                let suggestion;
                // Use Gemini directly for Structured Outputs if key is present
                if (userObj?.aiSettings?.geminiApiKey) {
                    suggestion = await ollamaService.analyzeEntryStructured(addedTaskText, 'task', recentContext);
                } else {
                    // Fallback to HA Conversation API
                    suggestion = await haService.analyzeEntry(addedTaskText, 'task', recentContext, userObj?.aiSettings?.agentId);
                }

                if (suggestion && suggestion.action !== 'none') {
                    // Find the ID of the task we just added (appended to the end)
                    const updatedList = storeState.lists.find(l => l.id === activeList.id);
                    const newTask = updatedList?.tasks[updatedList.tasks.length - 1];

                    storeState.setSparkSuggestion({
                        ...suggestion,
                        targetId: newTask?.id,
                        listId: activeList.id
                    });
                    storeState.setShowSparkBubble(true);
                }
            }
        }
    };

    // --- VISION API (Image Upload) ---
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userObj?.aiSettings?.geminiApiKey || !activeList) return;

        setIsUploadingImage(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                const result = await ollamaService.analyzeImage(base64, file.type);

                if (result.type === 'task' && result.items.length > 0) {
                    // Add the discovered tasks to the active list
                    result.items.forEach(task => {
                        useAppStore.getState().addTask(activeList.id, {
                            text: task.title,
                            dueDate: task.date ? new Date(task.date).toISOString() : undefined,
                            color: 'purple' // Visual indicator it came from AI
                        } as any);
                    });
                }
                setIsUploadingImage(false);
            };
            reader.onerror = () => setIsUploadingImage(false);
        } catch (error) {
            console.error("Image upload failed", error);
            setIsUploadingImage(false);
        }
    };

    const submitSubtask = (taskId: string) => {
        if (!subtaskInput.trim()) {
            setAddingSubtaskTo(null);
            return;
        }
        useAppStore.getState().addSubtask(activeList.id, taskId, subtaskInput);
        setSubtaskInput(''); // Clear for next one
        // Note: We stay in adding mode to allow rapid entry
    };

    // Calculate Progress or default
    const listTasks = activeList?.tasks || [];
    const activeTasks = listTasks.filter(t => !t.completed);



    return (
        <div className="h-full flex flex-col md:flex-row gap-6 w-full relative">
            {/* --- SIDEBAR (List Selection) --- */}
            <div className="w-full md:w-1/3 flex flex-col gap-4 bg-black/60 rounded-2xl p-4 border border-white/5 overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">
                        LISTEN
                    </h2>
                    <button
                        onClick={() => setNewListMode(!newListMode)}
                        className={`p-2 rounded-lg transition-all ${newListMode ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                        {newListMode ? <X size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {/* NEW LIST FORM */}
                    <AnimatePresence>
                        {newListMode && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2 overflow-hidden"
                            >
                                <input
                                    type="text"
                                    placeholder="Listenname..."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white mb-3 focus:outline-none focus:border-cyan-500/50"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex justify-between gap-1 overflow-x-auto pb-2">
                                    {(Object.keys(themeColors) as ThemeColor[]).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => handleAddList(t)}
                                            className={`w-6 h-6 rounded-full bg-gradient-to-br ${themeColors[t]} border border-white/20 hover:scale-110 transition-transform flex-shrink-0`}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* LISTS */}
                    {visibleLists.map((list) => {
                        const isShared = list.sharedWith && list.sharedWith.length > 0;
                        const isOwner = list.ownerId === userObj?.id;

                        return (
                            <motion.button
                                key={list.id}
                                layout
                                onClick={() => selectList(list.id)}
                                className={`
                                    w-full p-4 rounded-xl text-left border transition-all duration-300 relative group overflow-hidden
                                    ${activeList?.id === list.id ? `bg-gradient-to-r ${themeColors[list.theme] || themeColors.scifi} border-white/20 shadow-lg` : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400'}
                                `}
                            >
                                <div className="flex justify-between items-start relative z-10">
                                    <span className={`font-bold truncate pr-6 ${activeList?.id === list.id ? 'text-white' : ''}`}>{list.name}</span>

                                    {isShared && (
                                        <div title="Geteilt mit Familie" className="absolute right-0 top-0 p-1">
                                            <Users size={14} className={activeList?.id === list.id ? 'text-white/80' : 'text-gray-500'} />
                                        </div>
                                    )}
                                </div>
                                <div className="mt-1 flex justify-between items-center text-xs opacity-60">
                                    <span>{list.tasks.filter(t => !t.completed).length} offen</span>
                                    {!isOwner && <span className="text-[10px] uppercase border border-white/20 px-1 rounded">Shared</span>}
                                </div>

                                {/* Hover Delete (Only Owner) */}
                                {isOwner && (
                                    <div
                                        className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                        onClick={(e) => { e.stopPropagation(); removeList(list.id); }}
                                    >
                                        <Trash2 size={14} className="text-red-400 hover:text-red-200" />
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* --- MAIN CONTENT (Tasks) --- */}
            <div className="flex-1 bg-black/60 rounded-2xl p-6 border border-white/5 flex flex-col relative overflow-hidden">
                {activeList ? (
                    <>
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                            <div className="flex-1">
                                {isEditing ? (
                                    <form onSubmit={handleUpdateList} className="flex flex-col gap-4">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="text-3xl font-bold bg-transparent border-b border-white/20 focus:border-white focus:outline-none w-full pb-2"
                                            autoFocus
                                            onBlur={() => {
                                                if (editName.trim()) {
                                                    updateList(activeList.id, { name: editName });
                                                }
                                                setIsEditing(false);
                                            }}
                                        />
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {(Object.keys(themeColors) as ThemeColor[]).map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => updateList(activeList.id, { theme: t })}
                                                    className={`
                                                        w-8 h-8 rounded-full bg-gradient-to-br ${themeColors[t]} 
                                                        border-2 transition-transform hover:scale-110
                                                        ${activeList.theme === t ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}
                                                    `}
                                                />
                                            ))}
                                        </div>
                                    </form>
                                ) : (
                                    <div
                                        onClick={() => {
                                            if (!userObj) return;
                                            const canEdit = activeList.ownerId === userObj.id || (activeList.sharedWith && activeList.sharedWith.length > 0);
                                            if (canEdit) {
                                                setEditName(activeList.name);
                                                setIsEditing(true);
                                            }
                                        }}
                                        className={`group cursor-pointer ${userObj && (activeList.ownerId === userObj.id || (activeList.sharedWith && activeList.sharedWith.length > 0)) ? 'hover:opacity-80' : ''}`}
                                        title={userObj && activeList.ownerId === userObj.id ? "Klicken zum Bearbeiten" : "Geteilte Liste bearbeiten"}
                                    >
                                        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
                                            {activeList.name}
                                            {activeList.sharedWith?.length > 0 && <Users size={24} className="text-white/30" />}
                                        </h1>
                                        <p className="text-sm text-gray-400">
                                            {(() => {
                                                const count = (tasks: Task[]): { total: number; done: number } => tasks.reduce((acc, t) => {
                                                    const sub = t.subtasks ? count(t.subtasks) : { total: 0, done: 0 };
                                                    return {
                                                        total: acc.total + 1 + sub.total,
                                                        done: acc.done + (t.completed ? 1 : 0) + sub.done
                                                    };
                                                }, { total: 0, done: 0 });
                                                const stats = count(activeList.tasks);
                                                return `${stats.done} / ${stats.total} erledigt`;
                                            })()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                {/* Vision Upload Button */}
                                {userObj.aiSettings?.geminiApiKey && (
                                    <div className="relative overflow-hidden group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            disabled={isUploadingImage}
                                        />
                                        <div className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all
                                            ${isUploadingImage ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-white/5 text-gray-400 border-white/10 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 group-hover:border-indigo-500/30'}
                                        `}>
                                            {isUploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            {isUploadingImage ? 'Analysiert...' : 'Scannen'}
                                        </div>
                                    </div>
                                )}
                                {/* Delete List (Owner) */}
                                {activeList.ownerId === userObj.id && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Liste "${activeList.name}" wirklich löschen?`)) {
                                                removeList(activeList.id);
                                                selectList('default'); // Fallback to default
                                            }
                                        }}
                                        className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                                        title="Liste löschen"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}

                                {/* Sharing Toggle (Owner Only) */}
                                {userObj && activeList.ownerId === userObj.id && !isEditing && (
                                    <button
                                        onClick={() => toggleListSharing(activeList.id)}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                                            ${activeList.sharedWith?.length > 0
                                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30'
                                                : 'bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/10'}
                                        `}
                                    >
                                        <Share2 size={12} />
                                        {activeList.sharedWith?.length > 0 ? 'Geteilt' : 'Privat'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Add Task */}
                        <form onSubmit={handleAddTask} className="mb-6 relative flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Neue Aufgabe..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-12 text-white focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all font-medium placeholder:text-gray-600"
                                    value={newTaskText}
                                    onChange={e => setNewTaskText(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={!newTaskText.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-0 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            <input
                                type="date"
                                className="bg-white/5 border border-white/10 rounded-xl px-3 text-white focus:outline-none focus:bg-white/10 focus:border-white/20 text-sm w-auto"
                                value={newTaskDueDate}
                                onChange={e => setNewTaskDueDate(e.target.value)}
                                title="Fälligkeitsdatum (Optional)"
                            />
                        </form>

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            <AnimatePresence mode='popLayout'>
                                {activeTasks.map((task) => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className={`
                                            group flex flex-col gap-2 p-3 rounded-xl border transition-all select-none
                                            bg-[#1a1a1a] border-white/5 hover:border-white/20 hover:bg-black/40
                                        `}
                                    >
                                        {/* Main Task Row */}
                                        <div className="flex items-center gap-3 w-full cursor-pointer" onClick={() => toggleTask(activeList.id, task.id)}>
                                            <div className={`
                                                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                                                border-gray-600 group-hover:border-white/50
                                            `}>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <span className="text-lg text-gray-200 block truncate">
                                                    {task.text}
                                                </span>
                                                {/* Meta Info */}
                                                {task.dueDate && (
                                                    <div className={`flex items-center gap-1.5 text-xs mt-0.5 ${new Date(task.dueDate) < new Date() ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                                                        <CalendarIcon size={12} />
                                                        {format(new Date(task.dueDate), 'dd.MM.')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const dateStr = prompt("Fälligkeitsdatum (YYYY-MM-DD):", task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '');
                                                        // Handle date update
                                                        if (dateStr !== null) { // if not cancelled
                                                            const newDate = dateStr ? new Date(dateStr) : undefined;
                                                            // Use store action directly as it's not bound in props
                                                            useAppStore.getState().updateTask(activeList.id, task.id, { dueDate: newDate });
                                                        }
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-emerald-300 transition-colors"
                                                    title="Datum setzen"
                                                >
                                                    <CalendarIcon size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddingSubtaskTo(task.id);
                                                        setSubtaskInput('');
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-blue-300 transition-colors"
                                                    title="Unteraufgabe hinzufügen"
                                                >
                                                    <Plus size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm("Archivieren?")) archiveTask(task.id);
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-indigo-400 transition-colors"
                                                    title="Archivieren"
                                                >
                                                    <Archive size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteTask(activeList.id, task.id); }}
                                                    className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                                                    title="Löschen"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Subtasks Render */}
                                        {((task.subtasks && task.subtasks.length > 0) || addingSubtaskTo === task.id) && (
                                            <div className="pl-10 space-y-1 mt-1">
                                                {task.subtasks?.map(st => (
                                                    <div key={st.id} className="flex items-center gap-3 group/sub">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); useAppStore.getState().toggleSubtask(activeList.id, task.id, st.id); }}
                                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-emerald-400'}`}
                                                        >
                                                            {st.completed && <Check size={10} className="text-white" />}
                                                        </button>
                                                        <span className={`text-sm flex-1 ${st.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                                            {st.text}
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); useAppStore.getState().deleteSubtask(activeList.id, task.id, st.id); }}
                                                            className="opacity-0 group-hover/sub:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-opacity"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Inline Input */}
                                                {addingSubtaskTo === task.id && (
                                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                                        <div className="w-4 h-4 rounded border border-white/10 shrink-0 border-dashed"></div>
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            className="flex-1 bg-transparent border-b border-blue-500/50 text-sm text-white focus:outline-none placeholder:text-gray-600"
                                                            placeholder="Unteraufgabe... (Enter für nächste)"
                                                            value={subtaskInput}
                                                            onChange={(e) => setSubtaskInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') submitSubtask(task.id);
                                                                if (e.key === 'Escape') setAddingSubtaskTo(null);
                                                            }}
                                                            onBlur={() => {
                                                                // Optional: Auto-save on blur if value exists? 
                                                                // Or just close. Let's just close for now to avoid accidental saves.
                                                                // Actually let's NOT close on blur immediately to allow clicking away? 
                                                                // Better to let user close explicitly or by typing nothing + Enter.
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Completed Tasks (Separate?) or Mixed? Design asks for mixed usually but let's just show active first above. 
                                Actually, user might want to see completed. 
                                Let's show completed at bottom.
                            */}
                            {listTasks.filter(t => t.completed).length > 0 && (
                                <div className="mt-8 pt-4 border-t border-white/5">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Erledigt</h3>
                                    {listTasks.filter(t => t.completed).map(task => (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 p-3 rounded-xl opacity-50 bg-white/5 border border-transparent"
                                            onClick={() => toggleTask(activeList.id, task.id)}
                                        >
                                            <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center text-black">
                                                <Check size={14} strokeWidth={4} />
                                            </div>
                                            <span className="flex-1 text-lg line-through text-gray-500">{task.text}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteTask(activeList.id, task.id); }}
                                                className="p-2 text-gray-600 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeList.tasks.length === 0 && (
                                <div className="text-center text-gray-600 mt-20">
                                    <p className="text-lg">Liste leer</p>
                                    <p className="text-xs uppercase tracking-widest opacity-50">Zeit für Chaos</p>
                                </div>
                            )}
                        </div>

                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                        <CheckSquare size={64} strokeWidth={0.5} className="mb-4" />
                        <p className="text-xl font-light">Wähle eine Liste</p>
                    </div>
                )}
            </div>
        </div >
    );
}
