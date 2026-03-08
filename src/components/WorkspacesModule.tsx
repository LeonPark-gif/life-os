import { useState } from 'react';
import { useAppStore, type ThemeColor } from '../store/useAppStore';
import { Plus, X, Home, Music, Film, Power, Zap, MonitorPlay, Gamepad2, Wrench, Shield, Folder, Code, Terminal, Github, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { haService } from '../utils/haService';

const ICON_MAP: Record<string, React.ReactNode> = {
    'home': <Home size={20} />,
    'music': <Music size={20} />,
    'film': <Film size={20} />,
    'power': <Power size={20} />,
    'zap': <Zap size={20} />,
    'monitor': <MonitorPlay size={20} />,
    'gamepad': <Gamepad2 size={20} />,
    'wrench': <Wrench size={20} />,
    'shield': <Shield size={20} />,
    'folder': <Folder size={20} />,
    'code': <Code size={20} />,
    'terminal': <Terminal size={20} />,
    'github': <Github size={20} />,
    'globe': <Globe size={20} />
};

export default function WorkspacesModule() {
    const user = useAppStore(state => state.currentUser());
    const permissions = user?.permissions;
    const workspaceItems = useAppStore(state => state.workspaceItems);

    const filteredWorkspaceItems = workspaceItems.filter(item => {
        if (!permissions?.allowedZones || permissions.allowedZones.includes('all')) return true;
        return !item.zone || permissions.allowedZones.includes(item.zone);
    });

    const addWorkspaceItem = useAppStore(state => state.addWorkspaceItem);
    const removeWorkspaceItem = useAppStore(state => state.removeWorkspaceItem);

    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newIcon, setNewIcon] = useState('zap');
    const [newType, setNewType] = useState<'ha_entity' | 'url'>('url');
    const [newValue, setNewValue] = useState('');

    const [activeCategory, setActiveCategory] = useState<'all' | 'url' | 'ha_entity'>('all');

    const handleExecute = async (type: 'ha_entity' | 'url', value: string) => {
        if (type === 'url') {
            window.open(value, '_blank');
        } else if (type === 'ha_entity') {
            try {
                const parts = value.split('.');
                if (parts.length === 2) {
                    const domain = parts[0];
                    const service = domain === 'scene' ? 'turn_on' : domain === 'script' ? parts[1] : 'turn_on';
                    const entity_id = domain === 'script' ? undefined : value;
                    await haService.callService(domain, service, entity_id ? { entity_id } : {});
                }
            } catch (e) {
                console.error("Failed to execute workspace action", e);
            }
        }
    };

    const handleSave = () => {
        if (!newName.trim() || !newValue.trim()) return;
        addWorkspaceItem({
            name: newName,
            icon: newIcon,
            color: 'blue' as ThemeColor,
            type: newType,
            value: newValue
        });
        setNewName('');
        setNewValue('');
        setShowAddModal(false);
    };

    const filteredItems = filteredWorkspaceItems.filter(item => activeCategory === 'all' || item.type === activeCategory);

    return (
        <div className="w-full h-full p-8 flex flex-col overflow-y-auto custom-scrollbar text-white">

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#f3f4f6] mb-1">Bereiche</h1>
                    <p className="text-[#9ca3af] text-[15px]">Starte Apps, Browser-Tabs und Ordner gemeinsam</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> Neues Item
                </button>
            </div>

            {/* Categories */}
            <div className="flex gap-2 mb-8 bg-[#2a2b30] p-1.5 rounded-2xl w-fit border border-white/5">
                <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                    Alle Items
                </button>
                <div className="w-px h-6 bg-white/10 my-auto mx-1" />
                <button
                    onClick={() => setActiveCategory('url')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeCategory === 'url' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                    <Globe size={16} className={activeCategory === 'url' ? 'text-white' : 'text-purple-400'} />
                    Web Apps <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs opacity-60">{workspaceItems.filter(i => i.type === 'url').length}</span>
                </button>
                <button
                    onClick={() => setActiveCategory('ha_entity')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeCategory === 'ha_entity' ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                    <Power size={16} className={activeCategory === 'ha_entity' ? 'text-white' : 'text-emerald-400'} />
                    Smart Home <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs opacity-60">{workspaceItems.filter(i => i.type === 'ha_entity').length}</span>
                </button>
            </div>

            {/* Active Workspace Banner (Tabbie Style) */}
            <div className="bg-[#2a2b30] rounded-[24px] p-6 mb-8 border border-white/5 flex justify-between items-center group relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-bold text-white">Dashboard-Elemente</h2>
                        <span className="bg-white/10 text-gray-400 text-xs px-2 py-1 rounded-md">Gerade verwendet</span>
                    </div>
                    <p className="text-gray-400 text-sm">Vollständige Umgebung mit Apps, Smart-Triggern und URLs</p>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                    <button className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                        <Wrench size={18} />
                    </button>
                    <button className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
                        <MonitorPlay size={18} /> Alle starten
                    </button>
                </div>
            </div>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">ITEMS ({filteredItems.length})</h3>

            {/* Grid of Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence>
                    {filteredItems.map(item => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            key={item.id}
                            className="bg-[#2a2b30] border border-white/5 hover:border-white/10 p-4 rounded-[20px] flex items-center gap-4 group transition-colors cursor-pointer"
                            onClick={() => handleExecute(item.type, item.value)}
                        >
                            {/* Icon Box */}
                            <div className={`w-12 h-12 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-gray-300 group-hover:bg-[#3b82f6] group-hover:text-white transition-colors`}>
                                {ICON_MAP[item.icon] || <Globe size={20} />}
                            </div>

                            {/* Text Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[15px] font-medium text-gray-200 group-hover:text-white truncate">{item.name}</h4>
                                <p className="text-[11px] text-gray-500 uppercase font-semibold mt-0.5 tracking-wider truncate">
                                    {item.type === 'url' ? 'URL' : 'HA APP'}
                                </p>
                            </div>

                            {/* Delete Button (appears on hover) */}
                            <button
                                onClick={(e) => { e.stopPropagation(); removeWorkspaceItem(item.id); }}
                                className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}

                    <motion.div
                        layout
                        onClick={() => setShowAddModal(true)}
                        className="bg-transparent border border-white/10 border-dashed hover:border-blue-500/50 hover:bg-blue-500/5 p-4 rounded-[20px] flex items-center justify-center gap-2 group transition-colors cursor-pointer text-blue-500/70 hover:text-blue-400 h-[82px]"
                    >
                        <Plus size={18} />
                        <span className="font-medium text-[15px]">Hinzufügen</span>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ADD MODAL (Tabbie Restyle) */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#1e1f23] border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative text-white"
                        >
                            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 rounded-full hover:bg-white/5">
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-bold mb-8">Neues Element</h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-gray-400 font-medium mb-2">Name</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="z.B. VS Code"
                                        className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                                        autoFocus
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 font-medium mb-2">Type</label>
                                        <select
                                            value={newType}
                                            onChange={(e: any) => setNewType(e.target.value)}
                                            className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6] appearance-none"
                                        >
                                            <option value="url">Website / URL</option>
                                            <option value="ha_entity">Home Assistant Entität</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 font-medium mb-2">
                                            {newType === 'url' ? 'URL' : 'Entität ID'}
                                        </label>
                                        <input
                                            type="text"
                                            value={newValue}
                                            onChange={e => setNewValue(e.target.value)}
                                            placeholder={newType === 'url' ? 'https://...' : 'scene.kino'}
                                            className="w-full bg-[#2a2b30] border border-white/5 rounded-xl p-3.5 text-white focus:outline-none focus:border-[#3b82f6]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 font-medium mb-2">Icon</label>
                                    <div className="flex gap-2 flex-wrap bg-[#2a2b30] p-2 rounded-xl border border-white/5">
                                        {Object.keys(ICON_MAP).map(iconName => (
                                            <button
                                                key={iconName}
                                                onClick={() => setNewIcon(iconName)}
                                                className={`p-2.5 rounded-lg transition-all ${newIcon === iconName ? 'bg-[#3b82f6] text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                            >
                                                {ICON_MAP[iconName]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={!newName.trim() || !newValue.trim()}
                                    className="w-full py-4 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
                                >
                                    Zum Bereich hinzufügen
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
