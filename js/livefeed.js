// LiveFeed.js
// Živá data: polohy a zpoždění vozidel IDS JMK z oficiální mapy provozu
// KORDIS (mapa.idsjmk.cz). Aktualizace zdroje ≈ každých 10 s.
// Port LiveFeed.swift do prohlížeče.
//
// Rozdíl oproti iOS: prohlížeč vynucuje CORS a mapa.idsjmk.cz posílá data
// bez hlavičky Access-Control-Allow-Origin. Přímý požadavek proto ze stránky
// na github.io neprojde. Feed zkouší po řadě několik cest (viz config.js);
// když neuspěje ani jedna, appka jede jen podle jízdního řádu.

import { PROXIES } from './config.js';

const ORIGIN = 'https://mapa.idsjmk.cz';
/** Konečná zastávka spojů jedoucích z Líšně do centra. */
const TOWARDS_CENTRE_FINAL_STOP = 'Nemocnice Bohunice';

/** Trať v Líšni ve směru do centra: Mifkova → Jírova → Kotlanova → Masarova */
const PATH = [
  { lat: 49.20726, lng: 16.69238 }, // Líšeň, Mifkova (konečná)
  { lat: 49.20856, lng: 16.68669 }, // Jírova
  { lat: 49.20980, lng: 16.68120 }, // Kotlanova
  { lat: 49.20699, lng: 16.67752 }, // Masarova
];

/** Tolerance vzdálenosti od trati v metrech. */
const CORRIDOR_METERS = 260;

const TIMEOUT_MS = 8000;

export class LiveFeed {
  constructor() {
    this.accessToken = null;
    /** Index proxy, která naposledy fungovala — zkouší se jako první. */
    this.route = 0;
  }

  /**
   * @returns {Promise<{ok: true, trams: Array}|{ok: false, message: string}>}
   */
  async fetchApproachingTrams(line = '8') {
    try {
      const vehicles = await this.#fetchVehicles(true);

      const trams = vehicles
        .filter((v) => v.LineName === line && !v.IsInactive && v.FinalStopName === TOWARDS_CENTRE_FINAL_STOP)
        .map((v) => {
          const projection = project({ lat: v.Lat, lng: v.Lng });
          if (projection.offTrack > CORRIDOR_METERS) return null; // není na líšeňské trati
          return {
            id: String(v.ID),
            distanceMeters: Math.round(projection.remaining),
            delayMinutes: Math.round(v.Delay),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      return { ok: true, trams };
    } catch (error) {
      return { ok: false, message: error?.feedMessage || 'Zdroj živých dat je nedostupný' };
    }
  }

  // --- API mapy provozu (mapa.idsjmk.cz) ---------------------------------

  async #fetchVehicles(allowTokenRefresh) {
    const token = await this.#currentToken();

    const response = await this.#request('/api/vehicles', { 'X-Access-Token': token });

    // Prošlý token — získej nový a zkus to ještě jednou.
    if ((response.status === 401 || response.status === 403) && allowTokenRefresh) {
      this.accessToken = null;
      return this.#fetchVehicles(false);
    }
    if (response.status !== 200) throw feedError('Zdroj živých dat je nedostupný');

    const text = stripBOM(await response.text());
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw feedError('Zdroj živých dat vrátil neplatná data');
    }
    return parsed.Vehicles || [];
  }

  async #currentToken() {
    if (this.accessToken) return this.accessToken;

    const response = await this.#request('/');
    if (response.status !== 200) throw feedError('Nepodařilo se získat přístup k živým datům');

    const html = await response.text();
    const match = html.match(/initializeApplication\('([^']+)'\)/);
    if (!match) throw feedError('Nepodařilo se získat přístup k živým datům');

    this.accessToken = match[1];
    return this.accessToken;
  }

  /** Zkusí trasy v pořadí, začíná tou, která fungovala naposledy. */
  async #request(path, headers = {}) {
    const order = [];
    for (let i = 0; i < PROXIES.length; i++) {
      order.push(PROXIES[(this.route + i) % PROXIES.length]);
    }

    let lastError = null;
    for (const proxy of order) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(proxy.build(ORIGIN + path), {
          headers: proxy.forwardsHeaders ? headers : {},
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timer);
        // Proxy může být sama nedostupná — zkus další.
        if (response.status >= 500 || response.status === 429) {
          lastError = feedError('Zdroj živých dat je přetížený');
          continue;
        }
        this.route = PROXIES.indexOf(proxy);
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error?.name === 'AbortError'
          ? feedError('Zdroj živých dat neodpovídá')
          : feedError('Zdroj živých dat je nedostupný');
      }
    }
    throw lastError || feedError('Zdroj živých dat je nedostupný');
  }
}

function feedError(message) {
  const e = new Error(message);
  e.feedMessage = message;
  return e;
}

/** Odpověď API začíná UTF-8 BOM, který by dekódování JSON rozbil. */
function stripBOM(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// --- Geometrie ----------------------------------------------------------

const EARTH_R = 6371000;
const DEG = Math.PI / 180;

function distance(a, b) {
  // Haversine
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Promítne polohu vozu na trať.
 * @returns {{offTrack: number, remaining: number}} vzdálenost od trati
 *          a zbývající metry po trati k Masarově
 */
export function project(p) {
  const segmentLengths = [];
  for (let i = 0; i < PATH.length - 1; i++) {
    segmentLengths.push(distance(PATH[i], PATH[i + 1]));
  }
  const total = segmentLengths.reduce((a, b) => a + b, 0);

  let best = null;
  let cumulative = 0;

  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const scale = Math.cos(a.lat * DEG) * EARTH_R * DEG;
    const latScale = EARTH_R * DEG;

    const bx = (b.lng - a.lng) * scale;
    const by = (b.lat - a.lat) * latScale;
    const px = (p.lng - a.lng) * scale;
    const py = (p.lat - a.lat) * latScale;

    const len2 = bx * bx + by * by;
    let u = len2 > 0 ? (px * bx + py * by) / len2 : 0;
    u = Math.min(Math.max(u, 0), 1);

    const off = Math.hypot(px - u * bx, py - u * by);
    const along = cumulative + u * segmentLengths[i];

    if (best === null || off < best.off) best = { off, along };
    cumulative += segmentLengths[i];
  }

  const b = best || { off: Number.MAX_VALUE, along: 0 };
  return { offTrack: b.off, remaining: Math.max(0, total - b.along) };
}
