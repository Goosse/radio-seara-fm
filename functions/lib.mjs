// Shared helpers for the analytics Netlify functions.
export const ALLOWED = new Set([
    'pagina',
    'episodio_play',
    'episodio_25',
    'episodio_50',
    'episodio_75',
    'episodio_fim',
    'ao_vivo_inicio',
    'ao_vivo_fim',
    'ao_vivo_5min',
    'lista',
    'compartilhar',
    'baixar',
]);

export function clean(value, max = 200) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
}

export function today() {
    return new Date().toISOString().slice(0, 10);
}

export function bucketKey(body) {
    const event = body.event;
    if (event === 'pagina') {
        return clean(body.path, 300) || '/';
    }
    if (event.startsWith('ao_vivo')) {
        const station = clean(body.station, 10) || '?';
        const hour = clean(String(body.hour ?? ''), 2);
        const program = clean(body.program, 80) || 'outros';
        return hour ? `${station}|${hour}|${program}` : `${station}|${program}`;
    }
    const program = clean(body.program, 80);
    const episode = clean(body.episode || body.path, 120);
    return (program && episode) ? `${program}|${episode}` : (episode || program || 'desconhecido');
}

export async function loadDay(store, day) {
    try {
        const data = await store.get(day, { type: 'json' });
        return data && typeof data === 'object' ? data : {};
    } catch (error) {
        return {};
    }
}

export async function parseBody(req) {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
}

export function daysBetween(from, to) {
    const days = [];
    const start = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) return days;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}
