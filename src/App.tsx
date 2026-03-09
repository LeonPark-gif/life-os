import { useState, useRef, useEffect } from 'react';
import ParticleBackground from './components/ParticleBackground';
import MissionControl from './components/MissionControl';
import Chronosphere from './components/Chronosphere';
import AdminDashboard from './components/AdminDashboard';
import TasksModule from './components/TasksModule';
import HabitsModule from './components/HabitsModule';
import WorkspacesModule from './components/WorkspacesModule';
import { Camera, X, Settings as SettingsIcon, FileUp, Sparkles, Cpu, Calendar } from 'lucide-react';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { parseICS } from './utils/icsImport';
import GlobalSparkBubble from './components/GlobalSparkBubble';
import { StatusLedEngine } from './components/StatusLedEngine';
import { SSEEngine } from './components/SSEEngine';
import TabbieLayout from './components/TabbieLayout';
import ScreentimeModule from './components/ScreentimeModule';
import MailApp from './components/MailApp';
import TabletDashboard from './components/TabletDashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState<'mission' | 'tasks' | 'habits' | 'chrono' | 'workspaces' | 'screentime' | 'mail' | 'admin'>('mission');

  // Store Connection - Individual Selectors to prevent re-render loops
  const activeUserId = useAppStore(state => state.activeUserId);
  const updateUser = useAppStore(state => state.updateUser);
  const importEvents = useAppStore(state => state.importEvents);
  const syncWithHA = useAppStore(state => state.syncWithHA);
  const isHydrated = useAppStore(state => state.isHydrated);
  const user = useAppStore(state => state.users.find(u => u.id === state.activeUserId) || state.users[0]);

  // 1. Mandatory Hooks at Top Level
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);

  // Background Sync Effect
  useEffect(() => {
    if (!isHydrated) return;
    const interval = setInterval(() => {
      console.log('[App] Triggering periodic background sync...');
      syncWithHA();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] Tab became visible. Triggering sync...');
        syncWithHA();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isHydrated, syncWithHA]);

  // Daily Auto-Backup Effect
  // Runs once after hydration. Checks if a backup was already created today.
  // If not, it silently POSTs the current store data to the addon backup API.
  useEffect(() => {
    if (!isHydrated) return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastBackupDate = localStorage.getItem('life-os-last-backup-date');
    if (lastBackupDate === today) return; // Already backed up today

    const runAutoBackup = async () => {
      try {
        const { getAddonUrl } = await import('./utils/mailBridgeUrl');
        const state = useAppStore.getState();
        const mailBridgeUrl = state.users.find(u => u.mailConfig?.mailBridgeUrl)?.mailConfig?.mailBridgeUrl;
        const addonUrl = getAddonUrl(mailBridgeUrl);

        const backupData = {
          users: state.users,
          activeUserId: state.activeUserId,
          lists: state.lists,
          events: state.events,
          people: state.people,
        };

        const res = await fetch(`${addonUrl}/api/backup/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData),
        });

        if (res.ok) {
          localStorage.setItem('life-os-last-backup-date', today);
          console.log('[AutoBackup] Daily backup created successfully.');
        } else {
          console.warn('[AutoBackup] Backup API returned error – will retry tomorrow.');
        }
      } catch (e) {
        // Addon not reachable (e.g. dev mode) – that's fine, just skip silently
        console.warn('[AutoBackup] Backup skipped (addon not reachable):', e);
      }
    };

    // Small delay so HA sync has time to complete first
    const timer = setTimeout(runAutoBackup, 5000);
    return () => clearTimeout(timer);
  }, [isHydrated]);

  // AI Smart Reminders Effect
  useEffect(() => {
    if (!isHydrated) return;

    // Check every 30 minutes
    const interval = setInterval(() => {
      useAppStore.getState().checkSmartHabitReminders();
    }, 1800000);

    // Initial check
    useAppStore.getState().checkSmartHabitReminders();

    return () => clearInterval(interval);
  }, [isHydrated]);

  // 2. Hydration Guard (After all hooks)
  if (!isHydrated) {
    return (
      <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center space-y-4">
        <StatusLedEngine />
        <div className="text-cyan-500 animate-pulse">
          <Sparkles size={48} />
        </div>
        <div className="text-gray-500 font-mono text-xs uppercase tracking-[0.2em]">
          DaSilva OS wird geladen...
        </div>
      </div>
    );
  }

  // 3. Early User Check (Safe after hooks)
  if (!user) {
    return (
      <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500">
        Kein Benutzerprofil gefunden. Bitte Seite neu laden.
      </div>
    );
  }

  // 4. Component Logic / Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateUser(user.id, { avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleICSImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const events = parseICS(content, activeUserId);
        if (events.length > 0) {
          importEvents(events);
          alert(`${events.length} Termine erfolgreich importiert!`);
          setShowSettingsModal(false);
        }
      };
      reader.readAsText(file);
    }
  };
  const isTabletMode = new URLSearchParams(window.location.search).get('tablet') === 'true';

  if (isTabletMode) {
    return (
      <div className="relative w-full h-screen overflow-hidden text-white font-sans selection:bg-cyan-500/30">
        <StatusLedEngine />
        <SSEEngine />
        <GlobalSparkBubble />
        <TabletDashboard />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans selection:bg-cyan-500/30">

      {/* Background Engines */}
      <StatusLedEngine />
      <SSEEngine />

      {/* Global AI Spark */}
      <GlobalSparkBubble />

      {/* Background Layer (Admin gets a red tint) */}
      <div className={`absolute inset-0 z-0 transition-colors duration-1000 ${activeUserId === 'admin' ? 'bg-red-950/20' : 'bg-[#0f1115]'}`}>
        <GlobalErrorBoundary componentName="Background Particles">
          <ParticleBackground />
        </GlobalErrorBoundary>
      </div>

      <TabbieLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setShowSettingsModal(true)}
      >
        {/* Dynamic Content Area */}
        <div className="h-full w-full bg-[#1a1b1e]/50 overflow-hidden relative">
          {activeTab === 'mission' && (
            <GlobalErrorBoundary componentName="Mission Control">
              <MissionControl />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'tasks' && (
            <GlobalErrorBoundary componentName="Tasks Module">
              <TasksModule />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'habits' && (
            <GlobalErrorBoundary componentName="Habits Module">
              <HabitsModule />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'chrono' && (
            <GlobalErrorBoundary componentName="Chronosphäre">
              <Chronosphere />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'workspaces' && (
            <GlobalErrorBoundary componentName="Workspaces Module">
              <WorkspacesModule />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'screentime' && (
            <GlobalErrorBoundary componentName="Screentime Module">
              <ScreentimeModule />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'mail' && (
            <GlobalErrorBoundary componentName="Mail App">
              <MailApp />
            </GlobalErrorBoundary>
          )}

          {activeTab === 'admin' && activeUserId === 'admin' && (
            <GlobalErrorBoundary componentName="Admin Dashboard">
              <AdminDashboard />
            </GlobalErrorBoundary>
          )}
        </div>
      </TabbieLayout>

      {/* --- SETTINGS MODAL --- */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowSettingsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1a1b1e] border border-white/10 p-8 rounded-3xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <X size={20} />
              </button>

              <h2 className="text-3xl font-light mb-8 flex items-center gap-3 shrink-0">
                <SettingsIcon className="text-gray-400" />
                Einstellungen
              </h2>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                  {/* Section 1: Import */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-indigo-300">
                      <FileUp size={20} /> Kalender Import
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Lade eine .ics Datei von Google Calendar oder Outlook hoch, um deine Termine zu importieren.
                    </p>
                    <button
                      onClick={() => icsInputRef.current?.click()}
                      className="w-full py-3 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-xl text-indigo-300 font-bold uppercase tracking-wide transition-all"
                    >
                      Datei auswählen & Importieren
                    </button>
                    <input
                      type="file"
                      ref={icsInputRef}
                      className="hidden"
                      accept=".ics"
                      onChange={handleICSImport}
                    />
                  </div>

                  {/* Section 2: Personalization */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-300">
                      <Sparkles size={20} /> Personalisierung
                    </h3>

                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Passwort / PIN (4 Stellen)</label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="Keine PIN"
                          value={user.pin || ''}
                          onChange={(e) => useAppStore.getState().updateUserPin(user.id, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Primäre Akzentfarbe (UI Highlights)</label>
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
                            const isSelected = user.color === c.text;

                            return (
                              <button
                                key={c.name}
                                onClick={() => useAppStore.getState().updateUser(user.id, { color: c.text })}
                                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                title={c.name}
                              >
                                <div className={`w-6 h-6 rounded-full shadow-inner ${c.bg} ${c.name === 'black' ? 'border border-white/10' : ''}`} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Glow & Partikel Farbe (Effekt)</label>
                        <div className="flex flex-wrap gap-2">
                          {['#00ffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                            <button
                              key={color}
                              onClick={() => useAppStore.getState().updateThemeConfig({ accentColor: color })}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${user.themeConfig?.accentColor === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Hintergrundbild URL</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={user.themeConfig?.wallpaper || ''}
                          onChange={(e) => useAppStore.getState().updateThemeConfig({ wallpaper: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Dock Position</label>
                        <div className="flex gap-2">
                          <button onClick={() => useAppStore.getState().updateThemeConfig({ dockPosition: 'left' })} className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${user.themeConfig?.dockPosition === 'left' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>Links</button>
                          <button onClick={() => useAppStore.getState().updateThemeConfig({ dockPosition: 'bottom' })} className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${!user.themeConfig?.dockPosition || user.themeConfig?.dockPosition === 'bottom' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>Unten</button>
                          <button onClick={() => useAppStore.getState().updateThemeConfig({ dockPosition: 'right' })} className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${user.themeConfig?.dockPosition === 'right' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>Rechts</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: AI Settings */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-400">
                      <Cpu size={20} /> KI-Steuerung (Jarvis)
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-gray-300">Gedankenblitz</h4>
                          <p className="text-[10px] text-gray-500">Proaktive Hilfe & Vorschläge</p>
                        </div>
                        <input type="checkbox"
                          checked={user.aiSettings?.proactiveHelp || false}
                          onChange={(e) => useAppStore.getState().updateAiSettings({ proactiveHelp: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-black/40 text-indigo-500" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-gray-300">Kontext-Awareness</h4>
                          <p className="text-[10px] text-gray-500">KI darf Kalender/Aufgaben lesen</p>
                        </div>
                        <input type="checkbox"
                          checked={user.aiSettings?.contextAwareness || false}
                          onChange={(e) => useAppStore.getState().updateAiSettings({ contextAwareness: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-black/40 text-indigo-500" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-gray-300">Chat Interface</h4>
                          <p className="text-[10px] text-gray-500">Direkter Chat mit der KI erlauben</p>
                        </div>
                        <input type="checkbox"
                          checked={user.aiSettings?.chatEnabled || false}
                          onChange={(e) => useAppStore.getState().updateAiSettings({ chatEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-black/40 text-indigo-500" />
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">HA Agent ID (Optional)</label>
                        <input
                          type="text"
                          placeholder="conversation.openai_conversation"
                          value={user.aiSettings?.agentId || ''}
                          onChange={(e) => useAppStore.getState().updateAiSettings({ agentId: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">KI-Provider</label>
                        <select
                          value={user.aiSettings?.provider || 'local'}
                          onChange={(e) => useAppStore.getState().updateAiSettings({ provider: e.target.value as any })}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none mb-3"
                        >
                          <option value="local">Lokal (Ollama)</option>
                          <option value="openai">OpenAI (GPT-4)</option>
                          <option value="gemini">Google Gemini</option>
                        </select>

                        {user.aiSettings?.provider === 'openai' && (
                          <div className="space-y-2">
                            <label className="text-[9px] text-gray-500 uppercase tracking-wider block">OpenAI API Key</label>
                            <input
                              type="password"
                              placeholder="sk-..."
                              value={user.aiSettings?.cloudApiKey || ''}
                              onChange={(e) => useAppStore.getState().updateAiSettings({ cloudApiKey: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                            />
                          </div>
                        )}

                        {user.aiSettings?.provider === 'gemini' && (
                          <div className="space-y-2">
                            <label className="text-[9px] text-gray-500 uppercase tracking-wider block">Gemini API Key</label>
                            <input
                              type="password"
                              placeholder="AIza..."
                              value={user.aiSettings?.geminiApiKey || ''}
                              onChange={(e) => useAppStore.getState().updateAiSettings({ geminiApiKey: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Calendar Labels */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors md:col-span-2">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyan-300">
                      <Calendar size={20} /> Kalender Kategorien & Farben
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['rose', 'blue', 'green', 'emerald', 'cyan', 'sky', 'indigo', 'violet', 'purple', 'amber', 'orange', 'red', 'slate', 'stone', 'gray', 'zinc'].map(color => (
                        <div key={color} className="flex flex-col gap-1.5 bg-black/20 p-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-${color}-500 shadow-lg`} />
                            <span className="text-[10px] text-gray-500 uppercase font-mono">{color}</span>
                          </div>
                          <input
                            type="text"
                            value={user.colorLabels?.[color] || ''}
                            onChange={(e) => useAppStore.getState().updateColorLabel(user.id, color, e.target.value)}
                            placeholder="Bezeichnung..."
                            className="bg-transparent border-none p-0 text-xs text-white focus:outline-none placeholder:text-gray-700"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 5: Info */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 md:col-span-2">
                    <h3 className="text-xl font-bold mb-2 text-gray-300">Über DaSilva OS</h3>
                    <div className="space-y-2 text-sm text-gray-400">
                      <p>Version: <span className="text-white">Family v9.5 (DaSilva)</span></p>
                      <p>User: <span className="text-white">{user.name}</span></p>
                      <p>Datenbank: <span className="text-emerald-400">Lokal (Browser)</span></p>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PROFILE SETTINGS MODAL --- */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowProfileModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1a1b1e] border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl relative"
            >
              <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold mb-6 text-center">Profil bearbeiten</h3>

              <div className="flex flex-col items-center gap-6">
                {/* Current Avatar */}
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-white/5 flex items-center justify-center text-4xl">
                    {user.avatar.startsWith('data:') || user.avatar.startsWith('http') ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{user.avatar}</span>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-3 bg-blue-500 rounded-full hover:bg-blue-400 transition-colors shadow-lg"
                  >
                    <Camera size={20} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>

                {/* Name Input */}
                <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 text-center">Name</label>
                  <input
                    type="text"
                    value={user.name}
                    onChange={e => updateUser(user.id, { name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-center text-xl font-bold text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                {/* Presets */}
                <div className="w-full">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2 text-center">Oder Emoji wählen</label>
                  <div className="flex justify-center gap-2">
                    {['🦁', '🦊', '🍆', '🍑', '👽', '🤖', '👾', '🎃'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => updateUser(user.id, { avatar: emoji })}
                        className="text-2xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
