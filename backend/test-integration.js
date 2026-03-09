import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:8099';

async function testConnections() {
    console.log('--- Life OS Integration Test ---');

    // 1. Test Nextcloud List
    try {
        const ncRes = await fetch(`${BASE_URL}/api/nextcloud/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/' })
        });
        const ncData = await ncRes.json();
        console.log('Nextcloud Connection:', ncData.success ? 'OK (Found ' + ncData.files?.length + ' items)' : 'FAILED: ' + ncData.error);
    } catch (e) {
        console.log('Nextcloud Connection: FAILED (Server unreachable or misconfigured)');
    }

    // 2. Test Ollama
    try {
        const ollamaRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Ping' }],
                stream: false
            })
        });
        const ollamaData = await ollamaRes.json();
        console.log('Ollama (MACS) Connection:', ollamaData.choices ? 'OK' : 'FAILED');
    } catch (e) {
        console.log('Ollama (MACS) Connection: FAILED');
    }

    console.log('-------------------------------');
}

testConnections();
