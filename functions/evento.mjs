// First-party analytics: increments daily totals. No IPs, cookies or user IDs.
import { getStore } from '@netlify/blobs';
import { ALLOWED, bucketKey, clean, loadDay, parseBody, today } from './lib.mjs';

export default async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
        body = await parseBody(req);
    } catch (error) {
        return new Response('Bad Request', { status: 400 });
    }

    const event = clean(body?.event, 40);
    if (!ALLOWED.has(event)) {
        return new Response('Unknown event', { status: 400 });
    }

    const day = today();
    const key = bucketKey({ ...body, event });
    const device = body?.device === 'mobile' ? 'mobile' : 'desktop';
    const store = getStore('analytics');
    const dayData = await loadDay(store, day);

    if (!dayData[event]) dayData[event] = {};
    if (!dayData[event][key]) dayData[event][key] = { total: 0, mobile: 0, desktop: 0 };
    dayData[event][key].total += 1;
    dayData[event][key][device] += 1;

    await store.setJSON(day, dayData);
    return new Response(null, { status: 204 });
};

export const config = {
    path: '/api/evento',
};
