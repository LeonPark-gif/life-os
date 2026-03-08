export const explosionEvents = new EventTarget();

export function triggerExplosion(x: number, y: number, color: string = '#ef4444') {
    explosionEvents.dispatchEvent(new CustomEvent('explode', { detail: { x, y, color } }));
}
