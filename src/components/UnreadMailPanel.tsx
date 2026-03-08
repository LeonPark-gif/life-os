import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MailWarning } from 'lucide-react';
import { getMailBridgeUrl } from '../utils/mailBridgeUrl';

interface Email {
    uid: number;
    subject: string;
    from: string;
    date: string;
    flags: string[];
}

export default function UnreadMailPanel() {
    const currentUser = useAppStore(state => state.currentUser);
    const userObj = currentUser();
    const userId = userObj?.id;
    const mailEnabled = userObj?.mailConfig?.enabled ?? false;

    const [unreadEmails, setUnreadEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Read config fresh from the store inside effect to avoid object reference issues
        const config = useAppStore.getState().currentUser()?.mailConfig;

        if (!config || !config.enabled || userId === 'admin') {
            setLoading(false);
            return;
        }

        const checkMail = async () => {
            // Re-read config fresh each time to pick up changes
            const freshConfig = useAppStore.getState().currentUser()?.mailConfig;
            const bridgeUrl = getMailBridgeUrl(freshConfig?.mailBridgeUrl);
            try {
                const res = await fetch(`${bridgeUrl}/api/mail/inbox`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(freshConfig)
                });
                const text = await res.text();
                if (text.trim().startsWith('<')) {
                    // HTML response = add-on not running or wrong URL
                    console.warn('[UnreadMailPanel] Mail Bridge nicht erreichbar (HTML-Antwort).');
                    setLoading(false);
                    return;
                }
                const data = JSON.parse(text);
                if (data.success) {
                    const unread = data.emails.filter((e: any) => !e.flags.includes('\\Seen'));
                    setUnreadEmails(unread.slice(0, 5)); // zeige nur die top 5 an zur Übersicht
                }
            } catch (err: any) {
                console.error("Failed to fetch unread mails", err);
            } finally {
                setLoading(false);
            }
        };

        checkMail();
        const interval = setInterval(checkMail, 2 * 60 * 1000); // Check every 2 minutes
        return () => clearInterval(interval);
    }, [userId, mailEnabled]); // Use stable primitives, not the config object

    if (!mailEnabled || userId === 'admin') return null;
    if (loading && unreadEmails.length === 0) return null;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    return (
        <div className="mx-2 md:mx-0 mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-3 backdrop-blur-xl z-20 shadow-xl animate-in slide-in-from-top-4">
            <div className="flex items-center gap-2">
                <MailWarning size={18} className="text-amber-400" />
                <h4 className="text-amber-400 font-bold text-sm">Ungelesene E-Mails ({unreadEmails.length})</h4>
            </div>
            {unreadEmails.length === 0 ? (
                <div className="text-amber-200/70 text-sm italic py-2">
                    Keine ungelesenen E-Mails.
                </div>
            ) : (
                <div className="space-y-2">
                    {unreadEmails.map(email => (
                        <div key={email.uid} className="p-3 bg-black/40 border border-amber-500/10 rounded-lg flex flex-col md:flex-row md:items-center gap-2 md:gap-4 md:justify-between text-amber-100">
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm truncate">{email.from.split('<')[0].replace(/"/g, '').trim()}</div>
                                <div className="text-xs text-amber-200/70 truncate">{email.subject}</div>
                            </div>
                            <div className="text-[10px] text-amber-500/60 font-mono shrink-0">
                                {formatDate(email.date)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
