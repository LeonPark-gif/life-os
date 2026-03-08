import type { CalendarEvent } from '../store/useAppStore';

// Helper to parse ICS date strings (e.g. 20230101T120000Z)
const parseICSDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    // Remove 'Z' if present, handle T
    const cleanStr = dateStr.replace('Z', '');
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    const hour = parseInt(cleanStr.substring(9, 11) || '0');
    const minute = parseInt(cleanStr.substring(11, 13) || '0');

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    return new Date(year, month, day, hour, minute);
};

export const parseICS = (icsContent: string, ownerId: string): Partial<CalendarEvent>[] => {
    const events: Partial<CalendarEvent>[] = [];
    const lines = icsContent.split(/\r\n|\n|\r/);

    let inEvent = false;
    let currentEvent: any = {};

    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            currentEvent = {};
            continue;
        }

        if (line.startsWith('END:VEVENT')) {
            inEvent = false;
            // Validate and push
            if (currentEvent.dtstart && currentEvent.summary) {
                const date = parseICSDate(currentEvent.dtstart);
                if (date) {
                    const endDate = currentEvent.dtend ? parseICSDate(currentEvent.dtend) : undefined;

                    // Format time string HH:MM
                    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

                    events.push({
                        title: currentEvent.summary,
                        description: currentEvent.description || '',
                        location: currentEvent.location || '',
                        date: date,
                        endDate: endDate || undefined, // Explicit undefined if null
                        time: time,
                        color: 'indigo', // Default import color
                        ownerId: ownerId,
                        sharedWith: [],
                        participantIds: [],
                        recurrence: { type: 'none' } // Simple import for now, complex parsing of RRULE is hard
                    });
                }
            }
            continue;
        }

        if (inEvent) {
            if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
            if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12);
            if (line.startsWith('LOCATION:')) currentEvent.location = line.substring(9);
            if (line.startsWith('DTSTART')) {
                // Handle DTSTART;VALUE=DATE:2023... vs DTSTART:2023...
                const parts = line.split(':');
                if (parts.length > 1) currentEvent.dtstart = parts[1];
            }
            if (line.startsWith('DTEND')) {
                const parts = line.split(':');
                if (parts.length > 1) currentEvent.dtend = parts[1];
            }
        }
    }

    return events;
};
