/**
 * Returns the correct Life OS Addon URL depending on the environment.
 *
 * Priority:
 * 1. Nabu Casa (*.ui.nabu.casa) → HA Ingress URL for the unified life_os addon
 * 2. All other environments → use the manually configured URL or the default port
 */
export function getMailBridgeUrl(configuredUrl?: string): string {
    const host = window.location.hostname;

    // Running through Nabu Casa remote access – use the unified addon's Ingress path
    if (host.endsWith('.ui.nabu.casa')) {
        return `${window.location.origin}/api/hassio_ingress/life_os`;
    }

    // All other environments: use explicit config or the default local port
    return configuredUrl || 'http://homeassistant.local:8099';
}

/**
 * Returns the base URL for all Life OS addon API endpoints (mail + backup).
 * This is the same as getMailBridgeUrl – unified addon, one URL.
 */
export function getAddonUrl(configuredUrl?: string): string {
    return getMailBridgeUrl(configuredUrl);
}
