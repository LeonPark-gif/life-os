export interface TempCalendarEvent {
    summary: string;
    date: Date;
    isAllDay: boolean;
}

export const parseICS = (icsString: string): TempCalendarEvent[] => {
    const events: TempCalendarEvent[] = [];
    const lines = icsString.split(/\r\n|\n|\r/);
    let inEvent = false;
    let currentEvent: Partial<TempCalendarEvent> = {};

    for (const line of lines) {
        if (line.trim() === 'BEGIN:VEVENT') {
            inEvent = true;
            currentEvent = {};
        } else if (line.trim() === 'END:VEVENT') {
            inEvent = false;
            if (currentEvent.summary && currentEvent.date) {
                events.push(currentEvent as TempCalendarEvent);
            }
        } else if (inEvent) {
            if (line.startsWith('SUMMARY:')) {
                currentEvent.summary = line.substring(8).trim();
            } else if (line.startsWith('DTSTART;VALUE=DATE:')) {
                // e.g. DTSTART;VALUE=DATE:20260126
                const dateStr = line.substring(19).trim();
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1;
                const day = parseInt(dateStr.substring(6, 8));
                currentEvent.date = new Date(year, month, day);
                currentEvent.isAllDay = true;
            } else if (line.startsWith('DTSTART:')) {
                // e.g. DTSTART:20240101T080000Z
                const dateStr = line.substring(8).trim();
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1;
                const day = parseInt(dateStr.substring(6, 8));
                // simplified parsing for now: just grab the date part
                currentEvent.date = new Date(year, month, day);
                currentEvent.isAllDay = true; // Assume trash is mostly all-day
            }
        }
    }

    return events;
};
