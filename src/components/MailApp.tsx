import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Mail, Inbox, Send, Trash2, AlertOctagon, Edit3, X, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import DOMPurify from 'dompurify';
import { getMailBridgeUrl } from '../utils/mailBridgeUrl';

interface Email {
    uid: number;
    subject: string;
    from: string;
    date: string;
    flags: string[];
    html?: string; // For detail view
}

export default function MailApp() {
    const currentUser = useAppStore(state => state.currentUser);
    const userObj = currentUser();
    const [view, setView] = useState<'inbox' | 'compose' | 'reading'>('inbox');
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Compose state
    const [composeTo, setComposeTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [sending, setSending] = useState(false);

    const config = userObj.mailConfig;

    useEffect(() => {
        if (view === 'inbox') {
            fetchInbox();
        }
    }, [view]);

    // Periodically check for new emails every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            if (view === 'inbox') fetchInbox(false); // Silent fetch
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [view]);

    // Helper: safe JSON fetch — detects non-2xx status and HTML responses (e.g. HA login page)
    const safeJsonFetch = async (url: string, options: RequestInit) => {
        const res = await fetch(url, options);
        const text = await res.text();
        if (!res.ok || text.trim().startsWith('<')) {
            throw new Error(`Mail Bridge nicht erreichbar (HTTP ${res.status}). Prüfe ob das HA Add-on läuft und die Mail Bridge URL im Admin-Panel korrekt ist.`);
        }
        return JSON.parse(text);
    };

    const fetchInbox = async (showLoading = true) => {
        if (!config || !config.enabled) return;
        if (showLoading) setLoading(true);
        setError(null);
        const bridgeUrl = getMailBridgeUrl(config.mailBridgeUrl);
        try {
            const data = await safeJsonFetch(`${bridgeUrl}/api/mail/inbox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Explicitly pass limit:20 to ensure the server returns 20 emails.
                // Without this, the server-side default is used but may be
                // overridden by unexpected fields in the config object.
                body: JSON.stringify({ ...config, limit: 20, folder: 'INBOX' })
            });
            if (data.success) {
                setEmails(data.emails);
            } else {
                setError(data.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleReadEmail = async (uid: number) => {
        if (!config || !config.enabled) return;
        setLoading(true);
        setError(null);
        setView('reading');
        const bridgeUrl = getMailBridgeUrl(config.mailBridgeUrl);
        try {
            const data = await safeJsonFetch(`${bridgeUrl}/api/mail/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, uid })
            });
            if (data.success) {
                setSelectedEmail(data.email);
            } else {
                setError(data.error);
                setView('inbox');
            }
        } catch (err: any) {
            setError(err.message);
            setView('inbox');
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!composeTo || !composeSubject) return;
        setSending(true);
        setError(null);
        try {
            const bridgeUrl = getMailBridgeUrl(config?.mailBridgeUrl);
            const data = await safeJsonFetch(`${bridgeUrl}/api/mail/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    to: composeTo,
                    subject: composeSubject,
                    html: composeBody
                })
            });
            if (data.success) {
                setView('inbox');
                setComposeTo('');
                setComposeSubject('');
                setComposeBody('');
            } else {
                setError(data.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const handleMoveEmail = async (uid: number, destFolder: string) => {
        setError(null);
        // Optimistic UI update – remove from list immediately
        const previousEmails = emails;
        setEmails(prev => prev.filter(e => e.uid !== uid));
        if (view === 'reading') setView('inbox');

        try {
            const bridgeUrl = getMailBridgeUrl(config?.mailBridgeUrl);
            const data = await safeJsonFetch(`${bridgeUrl}/api/mail/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, uid, toFolder: destFolder })
            });
            if (!data.success) {
                // Revert optimistic update on failure
                setEmails(previousEmails);
                setError("Fehler beim Verschieben: " + data.error);
            }
        } catch (err: any) {
            // Revert optimistic update on network error
            setEmails(previousEmails);
            setError("Fehler beim Verschieben: " + err.message);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    if (!config || !config.enabled) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 space-y-6 p-6 text-center bg-black/20 rounded-3xl border border-white/5">
                <div className="p-8 bg-black/40 rounded-full border border-white/10 shadow-2xl">
                    <Mail size={48} className="text-amber-500/50" />
                </div>
                <div>
                    <h3 className="text-2xl font-light text-white mb-2">Mail App inaktiv</h3>
                    <p className="text-sm max-w-sm mx-auto">
                        Dein Postfach ist aktuell nicht konfiguriert. Bitte den System-Administrator, das Mail-Feature für <b>{userObj.name}</b> im Admin Panel freizuschalten.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 flex flex-col shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6 shrink-0">
                <div>
                    <h2 className="text-3xl font-light text-white flex items-center gap-3">
                        <Mail className="text-amber-400" size={32} />
                        Postfach
                    </h2>
                    <p className="text-xs text-amber-500/60 uppercase tracking-widest mt-1 font-mono">
                        {config.imapUser}
                    </p>
                </div>
                <div className="flex gap-3">
                    {view === 'inbox' && (
                        <button
                            onClick={() => fetchInbox()}
                            disabled={loading}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                            title="Posteingang aktualisieren"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    )}
                    {view !== 'compose' && (
                        <button onClick={() => setView('compose')} className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-300 rounded-xl hover:bg-amber-500/30 transition-all font-bold text-sm shadow-lg">
                            <Edit3 size={16} /> Neue E-Mail
                        </button>
                    )}
                    {(view === 'compose' || view === 'reading') && (
                        <button onClick={() => { setView('inbox'); setSelectedEmail(null); }} className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-bold shadow-lg flex items-center gap-2">
                            <X size={16} /> Schließen
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-3">
                    <AlertOctagon size={20} className="shrink-0 mt-0.5" />
                    <span className="text-sm font-mono break-words">{error}</span>
                </div>
            )}

            {/* INBOX VIEW */}
            {view === 'inbox' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {loading && emails.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-amber-500">
                            <Loader2 className="animate-spin" size={32} />
                        </div>
                    ) : emails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                            <Inbox size={48} className="opacity-20" />
                            <p className="text-lg font-light">Dein Posteingang ist leer.</p>
                        </div>
                    ) : (
                        emails.map(email => (
                            <div
                                key={email.uid}
                                onClick={() => handleReadEmail(email.uid)}
                                className={`p-4 rounded-2xl border cursor-pointer hover:scale-[1.01] transition-all shadow-lg flex flex-col md:flex-row md:items-center gap-4 ${!email.flags.includes('\\Seen') ? 'bg-amber-500/10 border-amber-500/30 text-white' : 'bg-black/20 border-white/5 text-gray-300'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1 gap-4">
                                        <span className={`text-base truncate flex-1 ${!email.flags.includes('\\Seen') ? 'font-bold' : ''}`}>
                                            {email.from.split('<')[0].replace(/"/g, '').trim()}
                                        </span>
                                    </div>
                                    <div className={`text-sm truncate ${!email.flags.includes('\\Seen') ? 'text-amber-200 font-medium' : 'text-gray-500'}`}>
                                        {email.subject}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 font-mono shrink-0">
                                    {formatDate(email.date)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* READING VIEW */}
            {view === 'reading' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-black/20 border border-white/5 rounded-2xl">
                    {loading || !selectedEmail ? (
                        <div className="flex justify-center items-center h-full text-amber-500">
                            <Loader2 className="animate-spin" size={32} />
                        </div>
                    ) : (
                        <>
                            <div className="p-6 border-b border-white/10 shrink-0 bg-white/5">
                                <h4 className="text-xl font-bold text-white mb-2">{selectedEmail.subject}</h4>
                                <div className="flex justify-between items-center text-sm text-gray-400">
                                    <span className="truncate pr-4">{selectedEmail.from}</span>
                                    <span className="font-mono">{formatDate(selectedEmail.date)}</span>
                                </div>
                            </div>

                            {/* Email Body – sanitized via DOMPurify to prevent XSS */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-8 text-black text-base md:text-lg email-content-wrapper shadow-inner"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.html || '') }}
                            />

                            {/* Actions */}
                            <div className="p-4 bg-black/40 border-t border-white/10 flex gap-4 shrink-0 justify-end">
                                <button onClick={() => setView('compose')} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg">
                                    <ArrowLeft size={16} /> Antworten
                                </button>
                                <div className="flex gap-2">
                                    <button onClick={() => handleMoveEmail(selectedEmail.uid, 'Trash')} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all shadow-lg flex items-center gap-2" title="Löschen">
                                        <Trash2 size={16} /> <span className="hidden md:inline">Löschen</span>
                                    </button>
                                    <button onClick={() => handleMoveEmail(selectedEmail.uid, 'Junk')} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 shadow-lg rounded-xl transition-all flex items-center gap-2" title="Spam">
                                        <AlertOctagon size={16} /> <span className="hidden md:inline">Spam</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* COMPOSE VIEW */}
            {view === 'compose' && (
                <div className="flex-1 flex flex-col space-y-4 h-full bg-black/20 border border-white/5 rounded-2xl p-6">
                    <input
                        type="text"
                        placeholder="An: email@beispiel.de"
                        value={composeTo}
                        onChange={e => setComposeTo(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-amber-500/50 shadow-inner"
                    />
                    <input
                        type="text"
                        placeholder="Betreff"
                        value={composeSubject}
                        onChange={e => setComposeSubject(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-amber-500/50 shadow-inner"
                    />
                    <textarea
                        className="w-full flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-amber-500/50 resize-none min-h-[250px] shadow-inner font-sans"
                        placeholder="Nachricht schreiben..."
                        value={composeBody}
                        onChange={e => setComposeBody(e.target.value)}
                    ></textarea>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSendEmail}
                            disabled={sending || !composeTo || !composeSubject}
                            className="py-3 px-8 flex items-center justify-center gap-3 bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(251,191,36,0.3)] disabled:opacity-50 disabled:shadow-none font-bold text-base"
                        >
                            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                            {sending ? 'Wird gesendet...' : 'E-Mail senden'}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
