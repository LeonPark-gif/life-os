
import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Download, Upload, Trash2, UserPlus, Database, Shield, AlertTriangle, RefreshCw, Mail } from 'lucide-react';

export default function AdminDashboard() {
    const users = useAppStore(state => state.users);
    const addUser = useAppStore(state => state.addUser);
    const removeUser = useAppStore(state => state.removeUser);
    const importState = useAppStore(state => state.importState);
    const clearAllCompletedTasks = useAppStore(state => state.clearAllCompletedTasks);
    const updateMailConfig = useAppStore(state => state.updateMailConfig);

    const [jsonError, setJsonError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [newUserValues, setNewUserValues] = useState({ name: '', avatar: '👶', color: 'text-gray-400' });

    // Mail Config State
    const displayUsers = users.filter(u => !u.isHidden && u.id !== 'admin');
    const [selectedMailUserId, setSelectedMailUserId] = useState<string>(displayUsers[0]?.id || 'valentin');
    const selectedMailUser = users.find(u => u.id === selectedMailUserId) || displayUsers[0];

    const handleExport = () => {
        const state = useAppStore.getState();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `life-os-backup-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                // Basic Validation
                if (!json.users || !json.lists) throw new Error("Invalid Backup File");

                if (window.confirm("⚠️ ACHTUNG: Dies wird den aktuellen Zustand komplett überschreiben. Fortfahren?")) {
                    importState(json);
                    alert("Backup erfolgreich wiederhergestellt!");
                }
            } catch (err) {
                setJsonError("Fehler beim Lesen der Datei: " + (err as Error).message);
            }
        };
        reader.readAsText(file);
    };

    const handleAddUser = () => {
        if (!newUserValues.name) return;
        addUser(newUserValues.name, newUserValues.avatar, newUserValues.color);
        setNewUserValues({ name: '', avatar: '👶', color: 'text-gray-400' });
    };

    return (
        <div className="h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar p-2">

            {/* Header */}
            <div className="flex items-center gap-4 border-b border-red-500/20 pb-6">
                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                    <Shield size={32} className="text-red-500" />
                </div>
                <div>
                    <h2 className="text-3xl font-light text-white">System Verwaltung</h2>
                    <p className="text-red-400/60 font-mono text-sm">RESTRICTED ACCESS • LEVEL 5</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 1. DATA MANAGEMENT */}
                <div className="bg-black/20 border border-white/5 rounded-3xl p-6 flex flex-col gap-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-300">
                        <Database size={20} /> Datensicherung
                    </h3>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleExport}
                            className="flex items-center justify-between p-4 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-xl transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <Download className="text-gray-400 group-hover:text-indigo-300" />
                                <span className="font-bold text-gray-300 group-hover:text-white">Backup erstellen</span>
                            </div>
                            <span className="text-xs font-mono text-gray-600 group-hover:text-indigo-300">.JSON</span>
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <Upload className="text-gray-400 group-hover:text-emerald-300" />
                                    <span className="font-bold text-gray-300 group-hover:text-white">Backup wiederherstellen</span>
                                </div>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".json"
                                onChange={handleImport}
                            />
                        </div>
                        {jsonError && <p className="text-xs text-red-400 mt-2">{jsonError}</p>}
                    </div>
                </div>

                {/* 2. DANGER ZONE */}
                <div className="bg-red-950/10 border border-red-500/10 rounded-3xl p-6 flex flex-col gap-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
                        <AlertTriangle size={20} /> Gefahrenzone
                    </h3>

                    <button
                        onClick={() => {
                            if (window.confirm("Wirklich alle erledigten Aufgaben aus ALLEN Listen unwiderruflich löschen?")) {
                                clearAllCompletedTasks();
                                alert("Bereinigt.");
                            }
                        }}
                        className="flex items-center gap-3 p-4 bg-red-500/5 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500 rounded-xl transition-all text-red-300 hover:text-red-100"
                    >
                        <Trash2 size={20} />
                        <div className="text-left">
                            <div className="font-bold">Erledigte Aufgaben löschen</div>
                            <div className="text-[10px] opacity-60">Entfernt 'completed' Tasks aus allen Listen</div>
                        </div>
                    </button>

                    <button
                        onClick={async () => {
                            if (window.confirm("⚠️ SYSTEM RESET\n\nDies löscht ALLES und setzt die App auf Werkseinstellungen zurück.\n\nSicher?")) {
                                localStorage.clear();
                                // Also clear HA State
                                try {
                                    const { haService } = await import('../utils/haService');
                                    await haService.saveState({ 'life-os-store': null });
                                } catch (e) {
                                    console.error("Failed to clear HA state:", e);
                                }
                                window.location.reload();
                            }
                        }}
                        className="flex items-center gap-3 p-4 bg-red-500/5 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500 rounded-xl transition-all text-red-300 hover:text-red-100"
                    >
                        <RefreshCw size={20} />
                        <div className="text-left">
                            <div className="font-bold">System Reset (Werkseinstellung)</div>
                            <div className="text-[10px] opacity-60">Löscht LocalStorage komplett</div>
                        </div>
                    </button>
                </div>

                {/* 3. USER MANAGEMENT */}
                <div className="lg:col-span-2 bg-black/20 border border-white/5 rounded-3xl p-6 flex flex-col gap-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-cyan-300">
                        <UserPlus size={20} /> Benutzerverwaltung
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map(u => (
                            <div key={u.id} className="relative p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 group hover:bg-white/10 transition-colors">
                                <div className="text-3xl">{u.avatar}</div>
                                <div>
                                    <div className="font-bold text-white">{u.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{u.id}</div>
                                </div>
                                {u.id !== 'admin' && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Benutzer ${u.name} wirklich löschen?`)) removeUser(u.id);
                                        }}
                                        className="absolute top-2 right-2 p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}

                        {/* Add User Form */}
                        <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl flex flex-col gap-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={newUserValues.name}
                                    onChange={e => setNewUserValues({ ...newUserValues, name: e.target.value })}
                                    className="flex-1 bg-black/20 border border-cyan-500/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Emoji"
                                    maxLength={2}
                                    value={newUserValues.avatar}
                                    onChange={e => setNewUserValues({ ...newUserValues, avatar: e.target.value })}
                                    className="w-12 bg-black/20 border border-cyan-500/30 rounded-lg px-2 py-1 text-sm text-center text-white focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={handleAddUser}
                                className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold uppercase rounded-lg transition-colors border border-cyan-500/30"
                            >
                                + User anlegen
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. MAIL CONFIGURATION */}
                {selectedMailUser && (
                    <div className="lg:col-span-2 bg-indigo-950/20 border border-indigo-500/20 rounded-3xl p-6 flex flex-col gap-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                            <Mail size={20} /> Mail Server Konfiguration
                        </h3>

                        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10 uppercase tracking-widest text-[10px] font-bold overflow-x-auto no-scrollbar">
                            {displayUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => setSelectedMailUserId(u.id)}
                                    className={`flex-1 py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap min-w-[120px] ${selectedMailUserId === u.id ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    <span className="text-lg">{u.avatar}</span> {u.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Mail className={selectedMailUser.mailConfig?.enabled ? 'text-emerald-400' : 'text-gray-500'} size={24} />
                                <div>
                                    <h4 className="font-bold text-sm text-white">Mail App aktivieren</h4>
                                    <p className="text-xs text-gray-400">Schaltet das E-Mail Feature für {selectedMailUser.name} frei.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedMailUser.mailConfig?.enabled || false}
                                    onChange={(e) => updateMailConfig(selectedMailUserId, { enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className={`space-y-6 transition-opacity duration-300 ${selectedMailUser.mailConfig?.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                            {/* Mail Bridge URL */}
                            <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                                <h4 className="text-sm font-bold text-violet-300 mb-1">Mail Bridge URL</h4>
                                <p className="text-xs text-gray-500 mb-3">
                                    HA Add-on (empfohlen, überall erreichbar):{' '}
                                    <code className="text-violet-300 bg-black/40 px-1 rounded">/api/hassio_ingress/life_os_mail_bridge</code>
                                    <br />
                                    Lokal (nur Heimnetz):{' '}
                                    <code className="text-violet-300 bg-black/40 px-1 rounded">http://192.168.1.x:3001</code>
                                </p>
                                <input
                                    type="text"
                                    value={selectedMailUser.mailConfig?.mailBridgeUrl || ''}
                                    onChange={(e) => updateMailConfig(selectedMailUserId, { mailBridgeUrl: e.target.value })}
                                    placeholder="/api/hassio_ingress/life_os_mail_bridge"
                                    className="w-full bg-black/40 border border-violet-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60 font-mono"
                                />
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="text-sm font-bold text-cyan-300 mb-4 border-b border-white/10 pb-2">IMAP (Empfang)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Host / Server</label>
                                        <input
                                            type="text"
                                            value={selectedMailUser.mailConfig?.imapHost || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapHost: e.target.value })}
                                            placeholder="imap.example.com"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Port</label>
                                        <input
                                            type="number"
                                            value={selectedMailUser.mailConfig?.imapPort || 993}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapPort: parseInt(e.target.value) })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedMailUser.mailConfig?.imapTls ?? true}
                                                onChange={(e) => updateMailConfig(selectedMailUserId, { imapTls: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-600 bg-black/40 text-cyan-500 focus:ring-cyan-500"
                                            />
                                            <span className="text-sm tracking-wider text-gray-300">SSL/TLS</span>
                                        </label>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Benutzername / E-Mail</label>
                                        <input
                                            type="text"
                                            value={selectedMailUser.mailConfig?.imapUser || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapUser: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Passwort</label>
                                        <input
                                            type="password"
                                            value={selectedMailUser.mailConfig?.imapPassword || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { imapPassword: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="text-sm font-bold text-amber-300 mb-4 border-b border-white/10 pb-2">SMTP (Versand)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Host / Server</label>
                                        <input
                                            type="text"
                                            value={selectedMailUser.mailConfig?.smtpHost || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpHost: e.target.value })}
                                            placeholder="smtp.example.com"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Port</label>
                                        <input
                                            type="number"
                                            value={selectedMailUser.mailConfig?.smtpPort || 465}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpPort: parseInt(e.target.value) })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedMailUser.mailConfig?.smtpTls ?? true}
                                                onChange={(e) => updateMailConfig(selectedMailUserId, { smtpTls: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-600 bg-black/40 text-amber-500 focus:ring-amber-500"
                                            />
                                            <span className="text-sm tracking-wider text-gray-300">SSL/TLS</span>
                                        </label>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Benutzername / E-Mail</label>
                                        <input
                                            type="text"
                                            value={selectedMailUser.mailConfig?.smtpUser || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpUser: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Passwort</label>
                                        <input
                                            type="password"
                                            value={selectedMailUser.mailConfig?.smtpPassword || ''}
                                            onChange={(e) => updateMailConfig(selectedMailUserId, { smtpPassword: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
