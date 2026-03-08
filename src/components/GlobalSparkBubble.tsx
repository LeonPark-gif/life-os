import { useAppStore } from '../store/useAppStore';
import { haService } from '../utils/haService';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

export default function GlobalSparkBubble() {
    const sparkSuggestion = useAppStore(state => state.sparkSuggestion);
    const showSparkBubble = useAppStore(state => state.showSparkBubble);
    const setShowSparkBubble = useAppStore(state => state.setShowSparkBubble);

    return (
        <AnimatePresence>
            {showSparkBubble && sparkSuggestion && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm pointer-events-none"
                >
                    <div className="bg-amber-900/90 backdrop-blur-xl border border-amber-500/50 rounded-2xl p-4 shadow-2xl shadow-amber-900/50 flex items-start gap-4 mx-4 pointer-events-auto">
                        <div className="bg-amber-500/20 p-2 rounded-full shrink-0">
                            <Sparkles className="text-amber-400" size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-amber-100 font-bold mb-1 flex justify-between items-center">
                                Gedankenblitz
                                <button onClick={() => setShowSparkBubble(false)} className="text-amber-500 hover:text-amber-300">
                                    <X size={16} />
                                </button>
                            </h4>
                            <p className="text-amber-200/90 text-sm leading-relaxed mb-3">{sparkSuggestion.message}</p>

                            {sparkSuggestion.action !== 'tip' && sparkSuggestion.action !== 'none' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            const store = useAppStore.getState();

                                            // 1. Home Assistant Service
                                            if (sparkSuggestion.action === 'ha_service' || (!['add_subtasks', 'add_reminder', 'tip', 'none'].includes(sparkSuggestion.action))) {
                                                const domain = sparkSuggestion.ha_data?.domain || sparkSuggestion.entity_id?.split('.')[0] || '';
                                                const service = sparkSuggestion.ha_data?.service || sparkSuggestion.action;
                                                const entity = sparkSuggestion.ha_data?.entity_id || sparkSuggestion.entity_id;
                                                if (domain && entity) {
                                                    await haService.callService(domain, service, { entity_id: entity });
                                                }
                                            }
                                            // 2. Add Subtasks (e.g. Shopping List)
                                            else if (sparkSuggestion.action === 'add_subtasks' && sparkSuggestion.app_data?.subtasks) {
                                                if (sparkSuggestion.listId && sparkSuggestion.targetId) {
                                                    sparkSuggestion.app_data.subtasks.forEach(st => {
                                                        store.addSubtask(sparkSuggestion.listId!, sparkSuggestion.targetId!, st);
                                                    });
                                                }
                                            }
                                            // 3. Add Reminder (e.g. Birthdays)
                                            else if (sparkSuggestion.action === 'add_reminder' && sparkSuggestion.app_data?.reminder_text) {
                                                const targetListId = store.activeListId !== 'default' ? store.activeListId : store.lists[0]?.id;
                                                if (targetListId) {
                                                    store.addTask(targetListId, sparkSuggestion.app_data.reminder_text);
                                                }
                                            }

                                            setShowSparkBubble(false);
                                        }}
                                        className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-amber-950 text-sm font-bold rounded-xl transition-all shadow-lg scale-100 hover:scale-105 active:scale-95"
                                    >
                                        Ja, bitte
                                    </button>
                                    <button
                                        onClick={() => setShowSparkBubble(false)}
                                        className="py-2 px-4 bg-black/40 hover:bg-black/60 text-amber-100 text-sm font-bold rounded-xl transition-colors border border-amber-500/30"
                                    >
                                        Nein
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
