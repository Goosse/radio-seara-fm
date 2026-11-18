// Summary API for the /estatisticas/ dashboard. Returns daily aggregated totals only.
import { getStore } from '@netlify/blobs';
import { daysBetween, loadDay, today } from './lib.mjs';

function mergeCounts(into, from) {
    for (const [event, buckets] of Object.entries(from || {})) {
        if (!into[event]) into[event] = {};
        for (const [key, counts] of Object.entries(buckets || {})) {
            if (!into[event][key]) into[event][key] = { total: 0, mobile: 0, desktop: 0 };
            into[event][key].total += counts.total || 0;
            into[event][key].mobile += counts.mobile || 0;
            into[event][key].desktop += counts.desktop || 0;
        }
    }
}

function topEntries(buckets, limit = 20) {
    return Object.entries(buckets || {})
        .map(([key, counts]) => ({ key, ...counts }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
}

function completionRates(merged) {
    const plays = merged.episodio_play || {};
    const finished = merged.episodio_fim || {};
    return Object.keys(plays)
        .map(key => {
            const play = plays[key]?.total || 0;
            const fim = finished[key]?.total || 0;
            return {
                key,
                plays: play,
                finished: fim,
                rate: play ? Math.round((fim / play) * 100) : 0,
            };
        })
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 20);
}

function liveByStationHour(merged) {
    const rows = [];
    for (const [event, buckets] of Object.entries(merged)) {
        if (!event.startsWith('ao_vivo')) continue;
        for (const [key, counts] of Object.entries(buckets || {})) {
            const [station, hour, ...programParts] = key.split('|');
            const program = programParts.join('|') || hour;
            const realHour = programParts.length ? hour : '';
            rows.push({
                event,
                station,
                hour: realHour,
                program: programParts.length ? program : hour,
                minutes: event === 'ao_vivo_5min' ? (counts.total || 0) * 5 : counts.total || 0,
                total: counts.total || 0,
            });
        }
    }
    return rows.sort((a, b) => b.minutes - a.minutes || b.total - a.total);
}

export default async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }
    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(req.url);
    const to = url.searchParams.get('ate') || today();
    const from = url.searchParams.get('de') || to;
    const days = daysBetween(from, to);
    if (!days.length) {
        return Response.json({ error: 'Intervalo inválido' }, { status: 400 });
    }

    const store = getStore('analytics');
    const byDay = {};
    const merged = {};
    for (const day of days) {
        const data = await loadDay(store, day);
        byDay[day] = data;
        mergeCounts(merged, data);
    }

    return Response.json({
        de: from,
        ate: to,
        pages: topEntries(merged.pagina),
        episodes: completionRates(merged),
        live: liveByStationHour(merged),
        lista: topEntries(merged.lista),
        compartilhar: topEntries(merged.compartilhar),
        baixar: topEntries(merged.baixar),
        totals: {
            pagina: Object.values(merged.pagina || {}).reduce((n, c) => n + (c.total || 0), 0),
            episodio_play: Object.values(merged.episodio_play || {}).reduce((n, c) => n + (c.total || 0), 0),
            ao_vivo_5min: Object.values(merged.ao_vivo_5min || {}).reduce((n, c) => n + (c.total || 0), 0),
            lista: Object.values(merged.lista || {}).reduce((n, c) => n + (c.total || 0), 0),
            compartilhar: Object.values(merged.compartilhar || {}).reduce((n, c) => n + (c.total || 0), 0),
            baixar: Object.values(merged.baixar || {}).reduce((n, c) => n + (c.total || 0), 0),
        },
        byDay,
    });
};

export const config = {
    path: '/api/estatisticas',
};
