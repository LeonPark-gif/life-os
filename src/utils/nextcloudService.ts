export interface NextcloudFile {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size: number;
    lastmod: string;
}

export const nextcloudService = {
    async listFiles(path: string = '/'): Promise<NextcloudFile[]> {
        try {
            const res = await fetch('/api/nextcloud/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!res.ok) throw new Error('Failed to list files');
            const data = await res.json();
            return data.files || [];
        } catch (e) {
            console.error('[Nextcloud] listFiles error:', e);
            return [];
        }
    },

    async getFileContent(path: string): Promise<string | null> {
        try {
            const res = await fetch('/api/nextcloud/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!res.ok) throw new Error('Failed to read file');
            const data = await res.json();
            return data.content || null;
        } catch (e) {
            console.error('[Nextcloud] getFileContent error:', e);
            return null;
        }
    }
};
