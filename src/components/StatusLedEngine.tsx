import { useEffect, useRef } from 'react';
import { useAppStore, type StatusLedRule } from '../store/useAppStore';
import { haService } from '../utils/haService';
import { isSameDay, addDays } from 'date-fns';

/**
 * Converts a hex color string (e.g. "#ff0000") to an RGB array ([255, 0, 0])
 */
function hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

export function StatusLedEngine() {
    // Keep track of the last set state ('off' or a color hex) so we don't spam Home Assistant
    const lastColorRef = useRef<string | 'off' | null>(null);

    useEffect(() => {
        const evaluateRules = async () => {
            const state = useAppStore.getState();
            const currentUser = state.currentUser ? state.currentUser() : null;
            const ledConfig = currentUser?.statusLed;

            if (!ledConfig || !ledConfig.entityId) return;

            const rules = (ledConfig.rules || []).filter(r => r.enabled);
            let activeRule: StatusLedRule | null = null;

            const events = state.getVisibleEvents();
            const tasks = state.getVisibleLists().flatMap(l => l.tasks).filter(t => !t.completed);

            const evaluateTimeConstraint = (rule: StatusLedRule) => {
                if (!rule.activeFromTime && !rule.activeToTime) return true;

                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                const parseTime = (timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                };

                const fromMinutes = rule.activeFromTime ? parseTime(rule.activeFromTime) : 0;
                const toMinutes = rule.activeToTime ? parseTime(rule.activeToTime) : 24 * 60;

                return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
            };

            for (const rule of rules) {
                if (!evaluateTimeConstraint(rule)) continue;

                try {
                    const match = await evaluateRule(rule, events, tasks);
                    if (match) {
                        activeRule = rule;
                        break; // Stop evaluating, highest priority won
                    }
                } catch (e) {
                    console.error(`Error evaluating rule ${rule.name}`, e);
                }
            }

            const currentActiveRule = state.activeStatusLedRule;

            // Update transient store state if the active rule changes (including if it becomes null)
            if (activeRule?.id !== currentActiveRule?.id) {
                state.setActiveStatusLedRule(activeRule);
                state.clearStatusLedAcknowledgment(); // New rule (or no rule) -> reset acknowledgment
            }

            // Fetch the freshly potentially cleared ack id
            const freshAckId = useAppStore.getState().statusLedAcknowledgedRuleId;

            // Determine if LED should be ON or OFF
            let targetAction: 'on' | 'off' = 'off';
            let targetColor: string | null = null;

            if (activeRule && activeRule.id !== freshAckId) {
                targetAction = 'on';
                targetColor = activeRule.color;
            } else {
                // If there's no active rule, or the rule is acknowledged, turn it OFF.
                targetAction = 'off';
            }

            // String representation for tracking changes
            const stateString = targetAction === 'on' && targetColor ? targetColor : 'off';

            // If we found a color/state and it changed since last check, send to HA
            if (stateString && stateString !== lastColorRef.current) {
                lastColorRef.current = stateString;

                if (targetAction === 'off') {
                    haService.callService('light', 'turn_off', {
                        entity_id: ledConfig.entityId
                    }).catch(e => console.error("Failed to turn off status LED", e));
                } else if (targetColor) {
                    const rgb = hexToRgb(targetColor);
                    if (rgb) {
                        haService.callService('light', 'turn_on', {
                            entity_id: ledConfig.entityId,
                            rgb_color: rgb,
                            brightness: 255 // Make sure it's fully bright for status
                        }).catch(e => console.error("Failed to turn on status LED", e));
                    }
                }
            }
        };

        const interval = setInterval(evaluateRules, 30000); // Check every 30s
        evaluateRules(); // Check immediately on mount/update

        return () => clearInterval(interval);
    }, []);

    // This component renders nothing, it's just a logical engine
    return null;
}

async function evaluateRule(rule: StatusLedRule, events: any[], tasks: any[]): Promise<boolean> {
    const term = rule.conditionValue.toLowerCase();

    switch (rule.type) {
        case 'calendar_event_today': {
            const today = new Date();
            return events.some(e =>
                isSameDay(new Date(e.date), today) &&
                e.title.toLowerCase().includes(term)
            );
        }
        case 'calendar_event_tomorrow': {
            const tomorrow = addDays(new Date(), 1);
            return events.some(e =>
                isSameDay(new Date(e.date), tomorrow) &&
                e.title.toLowerCase().includes(term)
            );
        }
        case 'task_keyword': {
            return tasks.some(t => t.text.toLowerCase().includes(term));
        }
        case 'ha_state':
        case 'ha_state_not': {
            const [entityId, expectedValue] = rule.conditionValue.split(':');
            if (!entityId || !expectedValue) return false;

            const state = await haService.getEntityState(entityId.trim());
            if (!state) return false;

            const actualValue = String(state.state).toLowerCase();
            const target = expectedValue.trim().toLowerCase();

            if (rule.type === 'ha_state') {
                return actualValue === target;
            } else {
                return actualValue !== target;
            }
        }
        default:
            return false;
    }
}
