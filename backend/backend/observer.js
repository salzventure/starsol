'use strict';

const ISS_ID = 25544;
const ISS_ALTITUDE_KM = 420;
const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function validateLatLon(req) {
    const lat = num(req.query.lat, NaN);
    const lon = num(req.query.lon, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat: clamp(lat, -90, 90), lon: ((((lon + 180) % 360) + 360) % 360) - 180 };
}

function ecefFromLatLonAlt(latDeg, lonDeg, altKm) {
    const r = EARTH_RADIUS_KM + altKm;
    const lat = latDeg * DEG;
    const lon = lonDeg * DEG;
    const cosLat = Math.cos(lat);
    return {
        x: r * cosLat * Math.cos(lon),
        y: r * cosLat * Math.sin(lon),
        z: r * Math.sin(lat),
    };
}

function elevationDeg(observerLat, observerLon, satLat, satLon, satAltKm) {
    const obs = ecefFromLatLonAlt(observerLat, observerLon, 0);
    const sat = ecefFromLatLonAlt(satLat, satLon, satAltKm || ISS_ALTITUDE_KM);
    const rx = sat.x - obs.x;
    const ry = sat.y - obs.y;
    const rz = sat.z - obs.z;
    const lat = observerLat * DEG;
    const lon = observerLon * DEG;
    const up = {
        x: Math.cos(lat) * Math.cos(lon),
        y: Math.cos(lat) * Math.sin(lon),
        z: Math.sin(lat),
    };
    const range = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (!range) return -90;
    return Math.asin((rx * up.x + ry * up.y + rz * up.z) / range) * RAD;
}

function sunElevationDeg(date, latDeg, lonDeg) {
    const dayMs = 86400000;
    const jd = date.getTime() / dayMs + 2440587.5;
    const n = jd - 2451545.0;
    const g = (357.529 + 0.98560028 * n) * DEG;
    const q = (280.459 + 0.98564736 * n) * DEG;
    const l = q + (1.915 * DEG) * Math.sin(g) + (0.020 * DEG) * Math.sin(2 * g);
    const e = (23.439 - 0.00000036 * n) * DEG;
    const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
    const dec = Math.asin(Math.sin(e) * Math.sin(l));
    const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
    const lst = (gmst * 15 + lonDeg) * DEG;
    const ha = lst - ra;
    const lat = latDeg * DEG;
    return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) * RAD;
}

function moonPhase(date) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const cycle = 29.53058867;
    const phase = ((jd - 2451550.1) % cycle + cycle) % cycle;
    const illum = Math.round((1 - Math.cos((phase / cycle) * 2 * Math.PI)) / 2 * 100);
    let name = 'Waning Crescent';
    if (phase < 1.85) name = 'New Moon';
    else if (phase < 7.38) name = 'Waxing Crescent';
    else if (phase < 9.22) name = 'First Quarter';
    else if (phase < 14.77) name = 'Waxing Gibbous';
    else if (phase < 16.61) name = 'Full Moon';
    else if (phase < 22.15) name = 'Waning Gibbous';
    else if (phase < 23.99) name = 'Last Quarter';
    return { name, illumination: illum };
}

function fallbackSubpoint(timestampMs) {
    const minutes = timestampMs / 60000;
    const period = 92.68;
    const phase = ((minutes % period) / period) * 2 * Math.PI;
    const inclination = 51.6;
    const lat = Math.sin(phase) * inclination;
    const lon = ((((minutes * 360 / period) - (timestampMs / 240000)) % 360) + 540) % 360 - 180;
    return {
        latitude: lat,
        longitude: lon,
        altitude: ISS_ALTITUDE_KM,
        timestamp: Math.floor(timestampMs / 1000),
        source: 'approximation',
    };
}

async function issPositions(startMs, minutesAhead) {
    const stepSec = 120;
    const timestamps = [];
    for (let t = startMs; t <= startMs + minutesAhead * 60000; t += stepSec * 1000) {
        timestamps.push(Math.floor(t / 1000));
    }
    try {
        const positions = [];
        for (let i = 0; i < timestamps.length; i += 40) {
            const chunk = timestamps.slice(i, i + 40);
            const url = `https://api.wheretheiss.at/v1/satellites/${ISS_ID}/positions?timestamps=${chunk.join(',')}&units=kilometers`;
            const resp = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!resp.ok) throw new Error(`iss_http_${resp.status}`);
            const data = await resp.json();
            if (Array.isArray(data)) positions.push(...data);
        }
        if (positions.length) return positions.map(p => ({ ...p, source: 'wheretheiss.at' }));
    } catch (err) {
        console.warn('[observer] ISS positions fallback:', err.message);
    }
    return timestamps.map(ts => fallbackSubpoint(ts * 1000));
}

function buildPasses(positions, lat, lon) {
    const samples = positions.map(p => {
        const ts = Number(p.timestamp || 0) * 1000;
        const elevation = elevationDeg(lat, lon, p.latitude, p.longitude, p.altitude);
        const observerSun = sunElevationDeg(new Date(ts), lat, lon);
        return {
            timestamp: ts,
            elevationDeg: elevation,
            observerSunDeg: observerSun,
            potentiallyVisible: elevation >= 10 && observerSun <= -4,
            source: p.source || 'wheretheiss.at',
        };
    });
    const passes = [];
    let current = null;
    for (const sample of samples) {
        if (sample.elevationDeg >= 5) {
            if (!current) current = { samples: [] };
            current.samples.push(sample);
        } else if (current) {
            passes.push(current);
            current = null;
        }
    }
    if (current) passes.push(current);
    return passes.map(pass => {
        const peak = pass.samples.reduce((a, b) => b.elevationDeg > a.elevationDeg ? b : a, pass.samples[0]);
        const visible = pass.samples.some(s => s.potentiallyVisible);
        const start = pass.samples[0];
        const end = pass.samples[pass.samples.length - 1];
        return {
            startTime: new Date(start.timestamp).toISOString(),
            endTime: new Date(end.timestamp).toISOString(),
            peakTime: new Date(peak.timestamp).toISOString(),
            maxElevationDeg: Math.round(peak.elevationDeg),
            visible,
            label: `Peak max ${Math.round(peak.elevationDeg)}°`,
            caveat: visible
                ? 'Potentially visible if clouds and local horizon cooperate'
                : 'Likely daylight/low-visibility pass; use as planning context',
            source: peak.source,
        };
    }).filter(pass => pass.maxElevationDeg >= 10).slice(0, 5);
}

async function fetchAurora(lat) {
    try {
        const resp = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', {
            headers: { Accept: 'application/json' },
        });
        if (!resp.ok) throw new Error(`kp_http_${resp.status}`);
        const rows = await resp.json();
        const last = Array.isArray(rows) ? rows.filter(r => Array.isArray(r) && r.length >= 2).pop() : null;
        const kp = last ? Number(last[1]) : NaN;
        if (!Number.isFinite(kp)) throw new Error('kp_missing');
        const absLat = Math.abs(lat);
        const threshold = absLat >= 60 ? 4 : absLat >= 50 ? 5 : absLat >= 40 ? 7 : 8;
        const watch = kp >= threshold;
        return {
            status: watch ? 'watch' : 'quiet',
            kp,
            label: watch ? `Aurora watch · Kp ${kp.toFixed(1)}` : `Quiet aurora outlook · Kp ${kp.toFixed(1)}`,
            source: 'NOAA SWPC planetary K-index',
            caveat: 'Kp is global; clouds, light pollution, and latitude still matter',
        };
    } catch (err) {
        return {
            status: 'unavailable',
            label: 'Aurora forecast unavailable',
            source: 'NOAA SWPC',
            caveat: 'Forecast source could not be reached',
        };
    }
}

async function observerSummary(req, res) {
    const loc = validateLatLon(req);
    if (!loc) return res.status(400).json({ error: 'invalid_lat_lon' });
    const now = Date.now();
    const [positions, aurora] = await Promise.all([
        issPositions(now, 12 * 60),
        fetchAurora(loc.lat),
    ]);
    const passes = buildPasses(positions, loc.lat, loc.lon);
    const nextPass = passes.find(p => p.visible) || passes[0] || null;
    const phase = moonPhase(new Date(now));
    res.json({
        ok: true,
        generatedAt: new Date(now).toISOString(),
        location: { lat: loc.lat, lon: loc.lon },
        iss: {
            status: nextPass ? 'ready' : 'no_pass_found',
            nextPass,
            passes,
            nextPassLabel: nextPass ? null : 'No useful pass found in next 12 hours',
            visibility: nextPass?.visible ? 'Potentially visible' : 'Planning context',
            caveat: nextPass?.caveat || 'Check again later; ISS pass windows change quickly',
            source: nextPass?.source || 'wheretheiss.at',
        },
        aurora,
        darkSky: {
            label: phase.illumination <= 35 ? 'Dark-sky window' : phase.illumination >= 75 ? 'Bright moonlight' : 'Mixed moonlight',
            moon: `${phase.name} · ${phase.illumination}%`,
            caveat: 'Moonlight guidance only; clouds and local lights still matter',
        },
    });
}

async function issPasses(req, res) {
    const loc = validateLatLon(req);
    if (!loc) return res.status(400).json({ error: 'invalid_lat_lon' });
    const positions = await issPositions(Date.now(), 12 * 60);
    res.json({ ok: true, location: loc, passes: buildPasses(positions, loc.lat, loc.lon) });
}

module.exports = { observerSummary, issPasses };
