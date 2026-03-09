import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ShieldAlert, Plus, Trash2, User as UserIcon, Settings, Server, Mail, Save, Database, Download, RefreshCw, CheckCircle, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { getAddonUrl } from '../utils/mailBridgeUrl';

interface BackupInfo {
    filename: string;
    size: number;
    created: string;
}

export default function AdminPanel() {
    const { users, addUser, removeUser, updateMailConfig } = useAppStore();
    const activeUser = useAppStore(state => state.users.find(u => u.id === state.activeUserId) || state.users[0]);
    const [newName, setNewName] = useState('');
    const [newAvatar, setNewAvatar] = useState('🧑');
    const [newColor, setNewColor] = useState<string>('text-indigo-400');
    const [newPin, setNewPin] = useState('');
    const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'system' | 'mail' | 'cloud' | 'calendar' | 'backup' | 'ai'>('profile');
    const [selectedMailUserId, setSelectedMailUserId] = useState<string>('admin');
    const [selectedCloudUserId, setSelectedCloudUserId] = useState<string>('admin');
    const displayUsers = users.filter(u => !u.isHidden);
    const selectedMailUser = users.find(u => u.id === selectedMailUserId) || activeUser;
    const selectedCloudUser = users.find(u => u.id === selectedCloudUserId) || activeUser;

    // Backup state
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupStatus, setBackupStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [backupMessage, setBackupMessage] = useState('');

    const addonUrl = getAddonUrl(activeUser.mailConfig?.mailBridgeUrl);

    useEffect(() => {
        if (activeTab === 'backup') {
            fetchBackupList();
        }
    }, [activeTab]);

    const fetchBackupList = async () => {
        setBackupLoading(true);
        try {
            const res = await fetch(`${addonUrl}/api/backup/list`);
            const data = await res.json();
            if (data.success) setBackups(data.backups);
        } catch (e) {
            console.error('Failed to fetch backups:', e);
        } finally {
            setBackupLoading(false);
        }
    };

    const handleManualBackup = async () => {
        setBackupLoading(true);
        setBackupStatus('idle');
        try {
            const storeState = useAppStore.getState();
            const backupData = {
                users: storeState.users,
                activeUserId: storeState.activeUserId,
                lists: storeState.lists,
                events: storeState.events,
                people: storeState.people,
            };
            const res = await fetch(`${addonUrl}/api/backup/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backupData)
            });
            const data = await res.json();
            if (data.success) {
                setBackupStatus('success');
                setBackupMessage(`Gespeichert: ${data.filename}`);
                fetchBackupList();
            } else {
                setBackupStatus('error');
                setBackupMessage(data.error);
            }
        } catch (e: any) {
            setBackupStatus('error');
            setBackupMessage(e.message);
        } finally {
            setBackupLoading(false);
            setTimeout(() => setBackupStatus('idle'), 4000);
        }
    };

    const handleRestoreBackup = async (filename: string) => {
        if (!confirm(`Wirklich aus Backup "${filename}" wiederherstellen? Alle aktuellen Daten werden überschrieben!`)) return;
        try {
            const res = await fetch(`${addonUrl}/api/backup/restore/${encodeURIComponent(filename)}`);
            const data = await res.json();
            if (data.success && data.backup?.data) {
                useAppStore.getState().importState(data.backup.data);
                alert('Wiederhergestellt! Die Seite wird neu geladen.');
                window.location.reload();
            } else {
                alert('Fehler beim Wiederherstellen: ' + data.error);
            }
        } catch (e: any) {
            alert('Fehler: ' + e.message);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    const formatDate = (iso: string) => new Intl.DateTimeFormat('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));

    const handleAddUser = () => {
        if (!newName.trim()) return;
        addUser(newName.trim(), newAvatar, newColor);
        if (newPin && newPin.length === 4) {
            // Find the user we just added and set their pin
            // Since addUser is async in some stores but here it is state-based
            // We can rely on the fact that addUser generates an ID
        }
        setNewName('');
        setNewAvatar('🧑');
        setNewPin('');
    };

    const handleExport = () => {
        const data = JSON.stringify(useAppStore.getState());
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dasilva-os-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleImport = (jsonData: string) => {
        try {
            const parsed = JSON.parse(jsonData);
            useAppStore.getState().importState(parsed);
            alert("Daten erfolgreich importiert!");
        } catch (e) {
            alert("Fehler beim Importieren der Daten.");
        }
    };

    return (
        <div className="bg-black/80 backdrop-blur-2xl border border-rose-500/30 rounded-3xl p-6 text-white max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-rose-500/20 shrink-0">
                <div className="p-3 rounded-full bg-rose-500/20 text-rose-500">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-rose-100">Life OS Admin</h3>
                    <p className="text-xs text-rose-400 uppercase tracking-widest">Systemverwaltung</p>
                </div>
            </div>

            <div className="flex gap-1 mb-6 shrink-0 bg-white/5 p-1 rounded-xl overflow-x-auto no-scrollbar">
                {[
                    { id: 'profile', icon: <UserIcon size={14} />, label: 'Profil' },
                    { id: 'users', icon: <UserIcon size={14} />, label: 'Nutzer' },
                    { id: 'system', icon: <Server size={14} />, label: 'System' },
                    { id: 'mail', icon: <Mail size={14} />, label: 'Mail' },
                    { id: 'cloud', icon: <Database size={14} />, label: 'Cloud' },
                    { id: 'calendar', icon: <CalendarIcon size={14} />, label: 'Kalender' },
                    { id: 'backup', icon: <Database size={14} />, label: 'Backup' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 px-2 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${activeTab === tab.id ? 'bg-white/10 text-white shadow' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pr-2 pb-10">
                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <h4 className="text-sm font-bold text-gray-300 mb-4">Mein Account</h4>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center text-3xl shadow-xl">{activeUser.avatar}</div>
                                <div>
                                    <div className={`text-xl font-bold ${activeUser.color}`}>{activeUser.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{activeUser.id}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Passwort / PIN ändern (4 Stellen)</label>
                                    <input
                                        type="password"
                                        maxLength={4}
                                        value={activeUser.pin || ''}
                                        onChange={(e) => useAppStore.getState().updateUserPin(activeUser.id, e.target.value)}
                                        placeholder="Keine PIN gesetzt"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-2 italic">Achtung: Dies ist dein Zugangscode für dein Profil.</p>
                                </div>

                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">Primäre Akzentfarbe (UI Highlights)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { name: 'rose', bg: 'bg-rose-400', text: 'text-rose-400' },
                                            { name: 'blue', bg: 'bg-blue-400', text: 'text-blue-400' },
                                            { name: 'green', bg: 'bg-green-400', text: 'text-green-400' },
                                            { name: 'emerald', bg: 'bg-emerald-400', text: 'text-emerald-400' },
                                            { name: 'teal', bg: 'bg-teal-400', text: 'text-teal-400' },
                                            { name: 'cyan', bg: 'bg-cyan-400', text: 'text-cyan-400' },
                                            { name: 'sky', bg: 'bg-sky-400', text: 'text-sky-400' },
                                            { name: 'indigo', bg: 'bg-indigo-400', text: 'text-indigo-400' },
                                            { name: 'violet', bg: 'bg-violet-400', text: 'text-violet-400' },
                                            { name: 'purple', bg: 'bg-purple-400', text: 'text-purple-400' },
                                            { name: 'fuchsia', bg: 'bg-fuchsia-400', text: 'text-fuchsia-400' },
                                            { name: 'pink', bg: 'bg-pink-400', text: 'text-pink-400' },
                                            { name: 'red', bg: 'bg-red-400', text: 'text-red-400' },
                                            { name: 'orange', bg: 'bg-orange-400', text: 'text-orange-400' },
                                            { name: 'amber', bg: 'bg-amber-400', text: 'text-amber-400' },
                                            { name: 'yellow', bg: 'bg-yellow-400', text: 'text-yellow-400' },
                                            { name: 'lime', bg: 'bg-lime-400', text: 'text-lime-400' },
                                            { name: 'gray', bg: 'bg-gray-400', text: 'text-gray-400' },
                                            { name: 'slate', bg: 'bg-slate-400', text: 'text-slate-400' },
                                            { name: 'stone', bg: 'bg-stone-400', text: 'text-stone-400' },
                                            { name: 'black', bg: 'bg-black', text: 'text-black' },
                                            { name: 'white', bg: 'bg-white', text: 'text-white' }
                                        ].map(c => {
                                            const isSelected = activeUser.color === c.text;

                                            return (
                                                <button
                                                    key={c.name}
                                                    onClick={() => useAppStore.getState().updateUser(activeUser.id, { color: c.text })}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                    title={c.name}
                                                >
                                                    <div className={`w-6 h-6 rounded-full shadow-inner ${c.bg} ${c.name === 'black' ? 'border border-white/10' : ''}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <h4 className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">Status</h4>
                            <p className="text-xs text-emerald-200/70">Dein Profil ist aktiv und geschützt.</p>
                        </div>
                    </div>
                )}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                                <UserIcon size={16} /> Neuen Account anlegen
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Name</label>
                                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                                        placeholder="z.B. Maria"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Avatar (Emoji)</label>
                                        <input type="text" value={newAvatar} onChange={(e) => setNewAvatar(e.target.value)}
                                            maxLength={2}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-center text-xl focus:outline-none focus:border-rose-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Farbschema</label>
                                        <select value={newColor} onChange={(e) => setNewColor(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                                            <option value="text-indigo-400">Indigo</option>
                                            <option value="text-cyan-400">Cyan</option>
                                            <option value="text-emerald-400">Emerald</option>
                                            <option value="text-amber-400">Amber</option>
                                            <option value="text-rose-400">Rose</option>
                                            <option value="text-purple-400">Purple</option>
                                            <option value="text-gray-400">Grau</option>
                                            <option value="text-stone-400">Stone</option>
                                            <option value="text-slate-400">Slate</option>
                                            <option value="text-white">Weiß</option>
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleAddUser} disabled={!newName.trim()}
                                    className="w-full mt-2 py-2 flex items-center justify-center gap-2 bg-rose-500/20 text-rose-300 rounded-lg hover:bg-rose-500/30 transition-colors disabled:opacity-50 font-bold text-sm">
                                    <Plus size={16} /> Account Erstellen
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Aktive Accounts</h4>
                            <div className="space-y-3">
                                {users.map(u => (
                                    <div key={u.id} className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-xl">{u.avatar}</div>
                                                <div>
                                                    <div className={`font-bold ${u.color}`}>{u.name}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{u.id}</div>
                                                </div>
                                            </div>
                                            {!u.isHidden && (
                                                <button onClick={() => { if (confirm(`Nutzer ${u.name} wirklich löschen?`)) removeUser(u.id); }}
                                                    className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Passwort (4-stellige PIN)</label>
                                                <input
                                                    type="text"
                                                    maxLength={4}
                                                    value={u.pin || ''}
                                                    onChange={(e) => useAppStore.getState().updateUserPin(u.id, e.target.value)}
                                                    placeholder="Kein Schutz"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">HA Person ID</label>
                                                <input
                                                    type="text"
                                                    value={u.personEntityId || ''}
                                                    onChange={(e) => useAppStore.getState().updateUser(u.id, { personEntityId: e.target.value })}
                                                    placeholder="person.valentin"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500/50"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Zugriffszonen (Kommata)</label>
                                            <input
                                                type="text"
                                                value={u.permissions?.allowedZones?.join(', ') || ''}
                                                onChange={(e) => {
                                                    const zones = e.target.value.split(',').map(z => z.trim()).filter(Boolean);
                                                    useAppStore.getState().updatePermissions(u.id, { allowedZones: zones });
                                                }}
                                                placeholder="z.B. Wohnung_1, Gemeinsam"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500/50"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                            <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2"><Save size={16} /> Datensicherung</h4>
                            <p className="text-xs text-gray-400 leading-relaxed">JSON-Export/Import für manuelle Sicherung deiner Konfiguration.</p>
                            <div className="flex gap-2">
                                <button onClick={handleExport} className="flex-1 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg">Exportieren</button>
                                <button onClick={() => { const d = prompt("JSON einfügen:"); if (d) handleImport(d); }} className="flex-1 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg">Importieren</button>
                            </div>
                        </div>

                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                            <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2"><Settings size={16} /> Demo / Reset</h4>
                            <p className="text-xs text-amber-200/70 leading-relaxed"><strong className="text-amber-200">Achtung: Überschreibt alle aktuellen Daten!</strong></p>
                            <button onClick={() => { if (confirm("Wirklich alle Daten überschreiben?")) alert('Demo Funktion deaktiviert.'); }}
                                className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg text-sm border border-amber-500/50 transition-colors">
                                Demo Daten laden (Reset)
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'mail' && (
                    <div className="space-y-6">
                        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10 uppercase tracking-widest text-[10px] font-bold">
                            {displayUsers.map(u => (
                                <button key={u.id} onClick={() => setSelectedMailUserId(u.id)}
                                    className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${selectedMailUserId === u.id ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-white'}`}>
                                    <span>{u.avatar}</span> {u.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Mail className={selectedMailUser.mailConfig?.enabled ? 'text-emerald-400' : 'text-gray-500'} size={24} />
                                <div>
                                    <h4 className="font-bold text-sm text-white">Mail App aktivieren</h4>
                                    <p className="text-xs text-gray-400">Für {selectedMailUser.name}</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={selectedMailUser.mailConfig?.enabled || false}
                                    onChange={(e) => updateMailConfig(selectedMailUserId, { enabled: e.target.checked })} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className={`space-y-6 transition-opacity duration-300 ${selectedMailUser.mailConfig?.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="text-sm font-bold text-cyan-300 mb-4 border-b border-white/10 pb-2">IMAP (Empfang)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Host / Server</label>
                                        <input type="text" value={selectedMailUser.mailConfig?.imapHost || ''} placeholder="imap.example.com"
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapHost: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Port</label>
                                        <input type="number" value={selectedMailUser.mailConfig?.imapPort || 993}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapPort: parseInt(e.target.value) })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedMailUser.mailConfig?.imapTls ?? true}
                                                onChange={(e) => updateMailConfig(selectedMailUserId, { imapTls: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-600 bg-black/40 text-cyan-500 focus:ring-cyan-500" />
                                            <span className="text-sm tracking-wider text-gray-300">SSL/TLS</span>
                                        </label>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Benutzername / E-Mail</label>
                                        <input type="text" value={selectedMailUser.mailConfig?.imapUser || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapUser: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Passwort</label>
                                        <input type="password" value={selectedMailUser.mailConfig?.imapPassword || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapPassword: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="text-sm font-bold text-amber-300 mb-4 border-b border-white/10 pb-2">SMTP (Versand)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Host / Server</label>
                                        <input type="text" value={selectedMailUser.mailConfig?.smtpHost || ''} placeholder="smtp.example.com"
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpHost: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Port</label>
                                        <input type="number" value={selectedMailUser.mailConfig?.smtpPort || 465}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpPort: parseInt(e.target.value) })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedMailUser.mailConfig?.smtpTls ?? true}
                                                onChange={(e) => updateMailConfig(selectedMailUserId, { smtpTls: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-600 bg-black/40 text-amber-500 focus:ring-amber-500" />
                                            <span className="text-sm tracking-wider text-gray-300">SSL/TLS</span>
                                        </label>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Benutzername / E-Mail</label>
                                        <input type="text" value={selectedMailUser.mailConfig?.smtpUser || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpUser: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Passwort</label>
                                        <input type="password" value={selectedMailUser.mailConfig?.smtpPassword || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpPassword: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'cloud' && (
                    <div className="space-y-6">
                        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10 uppercase tracking-widest text-[10px] font-bold">
                            {displayUsers.map(u => (
                                <button key={u.id} onClick={() => setSelectedCloudUserId(u.id)}
                                    className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${selectedCloudUserId === u.id ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-white'}`}>
                                    <span>{u.avatar}</span> {u.name}
                                </button>
                            ))}
                        </div>

                        {/* Nextcloud Section */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-sky-400">
                                    <Database size={16} /> Nextcloud (Dateien)
                                </h4>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={selectedCloudUser.nextcloudConfig?.enabled || false}
                                        onChange={(e) => useAppStore.getState().updateNextcloudConfig(selectedCloudUserId, { enabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                                </label>
                            </div>

                            <div className={`grid grid-cols-2 gap-4 transition-opacity duration-300 ${selectedCloudUser.nextcloudConfig?.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Server URL</label>
                                    <input type="text" value={selectedCloudUser.nextcloudConfig?.url || ''} placeholder="https://nextcloud.example.com"
                                        onChange={(e) => useAppStore.getState().updateNextcloudConfig(selectedCloudUserId, { url: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Benutzername</label>
                                    <input type="text" value={selectedCloudUser.nextcloudConfig?.username || ''}
                                        onChange={(e) => useAppStore.getState().updateNextcloudConfig(selectedCloudUserId, { username: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">App-Passwort</label>
                                    <input type="password" value={selectedCloudUser.nextcloudConfig?.password || ''}
                                        onChange={(e) => useAppStore.getState().updateNextcloudConfig(selectedCloudUserId, { password: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                                </div>
                            </div>
                        </div>

                        {/* Immich Section */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-rose-400">
                                    <Server size={16} /> Immich (Fotos)
                                </h4>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={selectedCloudUser.immichConfig?.enabled || false}
                                        onChange={(e) => useAppStore.getState().updateImmichConfig(selectedCloudUserId, { enabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                                </label>
                            </div>

                            <div className={`grid grid-cols-2 gap-4 transition-opacity duration-300 ${selectedCloudUser.immichConfig?.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Server URL</label>
                                    <input type="text" value={selectedCloudUser.immichConfig?.url || ''} placeholder="https://immich.example.com"
                                        onChange={(e) => useAppStore.getState().updateImmichConfig(selectedCloudUserId, { url: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">API Key</label>
                                    <input type="password" value={selectedCloudUser.immichConfig?.apiKey || ''}
                                        onChange={(e) => useAppStore.getState().updateImmichConfig(selectedCloudUserId, { apiKey: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'calendar' && (
                    <div className="space-y-6">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <h4 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <CalendarIcon size={16} className="text-emerald-400" /> Multi-User CalDAV Sync
                            </h4>
                            <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                Verbinde externe Kalender (z.B. Nextcloud, iCloud) für jeden Nutzer.
                            </p>

                            <div className="space-y-4">
                                {users.filter(u => !u.isHidden).map(u => (
                                    <div key={u.id} className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{u.avatar}</span>
                                            <span className="font-bold text-sm">{u.name}</span>
                                        </div>

                                        <div className="space-y-2">
                                            {(u.calDavAccounts || []).map((acc, idx) => (
                                                <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between items-center group">
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-mono text-emerald-400 truncate">{acc.serverUrl}</div>
                                                        <div className="text-xs text-white mt-0.5">{acc.username}</div>
                                                    </div>
                                                    <button onClick={() => {
                                                        const newUsers = users.map(user => {
                                                            if (user.id !== u.id) return user;
                                                            const newAccounts = [...(user.calDavAccounts || [])];
                                                            newAccounts.splice(idx, 1);
                                                            return { ...user, calDavAccounts: newAccounts };
                                                        });
                                                        useAppStore.setState({ users: newUsers });
                                                    }} className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button onClick={() => {
                                            const url = prompt("Server URL (z.B. https://nextcloud.local/remote.php/dav/):");
                                            const user = prompt("Benutzername:");
                                            const pass = prompt("Passwort:");
                                            if (url && user && pass) {
                                                const newUsers = users.map(userItem => {
                                                    if (userItem.id !== u.id) return userItem;
                                                    const newAccounts = [...(userItem.calDavAccounts || []), {
                                                        enabled: true,
                                                        serverUrl: url,
                                                        username: user,
                                                        password: pass,
                                                        color: 'emerald'
                                                    }];
                                                    return { ...userItem, calDavAccounts: newAccounts };
                                                });
                                                useAppStore.setState({ users: newUsers });
                                            }
                                        }} className="w-full py-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 transition-all">
                                            <Plus size={14} /> Kalender hinzufügen
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">Info</h4>
                            <p className="text-[10px] text-blue-200/60 leading-relaxed italic">
                                Die Kalender werden automatisch alle paar Minuten synchronisiert. Die Bezeichnungen der Farben kannst du nun direkt in den Haupt-Einstellungen (Zahnrad) ändern.
                            </p>
                        </div>
                    </div>
                )}

                {
                    activeTab === 'backup' && (
                        <div className="space-y-6">
                            {/* Manual Backup Trigger */}
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
                                <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                                    <Database size={16} /> Backup erstellen
                                </h4>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Speichert alle Daten als JSON-Datei im HA-Konfigurationsordner (<code className="text-emerald-400">/config/life-os-backups/</code>). Max. 7 Backups werden behalten.
                                </p>

                                {backupStatus === 'success' && (
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 rounded-lg p-3">
                                        <CheckCircle size={14} /> {backupMessage}
                                    </div>
                                )}
                                {backupStatus === 'error' && (
                                    <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 rounded-lg p-3">
                                        <AlertCircle size={14} /> {backupMessage}
                                    </div>
                                )}

                                <button onClick={handleManualBackup} disabled={backupLoading}
                                    className="w-full py-3 flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold rounded-xl transition-all text-sm border border-emerald-500/30 disabled:opacity-50">
                                    {backupLoading ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                                    Jetzt sichern
                                </button>
                            </div>

                            {/* Backup List */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Gespeicherte Backups</h4>
                                    <button onClick={fetchBackupList} disabled={backupLoading}
                                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                        <RefreshCw size={14} className={backupLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>

                                {backups.length === 0 ? (
                                    <div className="text-center text-gray-600 text-sm py-8">
                                        {backupLoading ? 'Lade...' : 'Noch keine Backups vorhanden. Erstelle jetzt das erste!'}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {backups.map(b => (
                                            <div key={b.filename} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-xs text-white font-mono truncate">{b.filename.replace('life-os-backup-', '')}</div>
                                                    <div className="text-[10px] text-gray-500">
                                                        {formatDate(b.created)} · {formatFileSize(b.size)}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <a href={`${addonUrl}/api/backup/download/${encodeURIComponent(b.filename)}`}
                                                        className="p-2 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Herunterladen">
                                                        <Download size={14} />
                                                    </a>
                                                    <button onClick={() => handleRestoreBackup(b.filename)}
                                                        className="px-3 py-1.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors">
                                                        Wiederherstellen
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }


            </div >
        </div >
    );
}
