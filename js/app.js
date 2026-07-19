// app.js
// Spojuje jízdní řád se živým zpožděním, drží stav obrazovky a vykresluje
// odjezdovou tabuli. Port DepartureStore.swift + DepartureBoardView.swift.

import { LiveFeed } from './livefeed.js';
import { LIVE_REFRESH_MS, DEPARTURE_COUNT } from './config.js';
import {
  nextScheduled, serviceDay, clockText, isOtherDay,
} from './timetable.js';

// --- Stav ---------------------------------------------------------------

const feed = new LiveFeed();

const store = {
  departures: [],
  /** 'loading' | 'live' | 'unavailable' */
  feedState: 'loading',
  fetchedAt: null,
  feedMessage: '',
  serviceDayLabel: '',
  now: new Date(),
  trams: [],
};

let tickTimer = null;
let feedTimer = null;
let feedRunning = false;

// --- Data ---------------------------------------------------------------

async function refreshLive() {
  if (feedRunning) return;
  feedRunning = true;
  try {
    const result = await feed.fetchApproachingTrams();
    if (result.ok) {
      store.trams = result.trams;
      store.feedState = 'live';
      store.fetchedAt = new Date();
    } else {
      store.trams = [];
      store.feedState = 'unavailable';
      store.feedMessage = result.message;
    }
  } finally {
    feedRunning = false;
  }
  recompute();
}

function recompute() {
  const current = new Date();
  store.now = current;
  store.serviceDayLabel = serviceDay(current).label;

  const scheduled = nextScheduled(DEPARTURE_COUNT, current);

  let result = scheduled.map((date) => ({
    scheduled: date,
    expected: date,
    delayMinutes: null,
    distanceMeters: null,
  }));

  // K-tá nejbližší přijíždějící tramvaj odpovídá k-tému nejbližšímu spoji.
  if (store.feedState === 'live') {
    for (let index = 0; index < result.length && index < store.trams.length; index++) {
      const tram = store.trams[index];
      const base = new Date(result[index].scheduled.getTime() + tram.delayMinutes * 60000);
      // Vůz nemůže dorazit dřív, než k tomu stihne dojet.
      const floorSeconds = tram.distanceMeters < 60 ? 5 : 30;
      const earliest = new Date(current.getTime() + floorSeconds * 1000);
      result[index] = {
        scheduled: result[index].scheduled,
        expected: base > earliest ? base : earliest,
        delayMinutes: tram.delayMinutes,
        distanceMeters: tram.distanceMeters,
      };
    }
    result.sort((a, b) => a.expected - b.expected);
  }

  store.departures = result;
  render();
}

const secondsRemaining = (d) => Math.max(0, Math.floor((d.expected - store.now) / 1000));
const minutesRemaining = (d) => Math.floor(secondsRemaining(d) / 60);
const isLive = () => store.feedState === 'live';

// --- Vykreslení ---------------------------------------------------------

const el = {
  statusDot: document.getElementById('status-dot'),
  statusLine: document.getElementById('status-line'),
  statusText: document.getElementById('status-text'),
  bigNumber: document.getElementById('big-number'),
  bigUnit: document.getElementById('big-unit'),
  departLine: document.getElementById('depart-line'),
  liveNote: document.getElementById('live-note'),
  nextList: document.getElementById('next-list'),
  serviceDay: document.getElementById('service-day'),
};

function statusText() {
  switch (store.feedState) {
    case 'loading': return 'Načítám živá data…';
    case 'live': return `Živá data · obnoveno ${clockText(store.fetchedAt)}`;
    default: return 'Živá data nedostupná – jízdní řád';
  }
}

function liveNote(departure) {
  if (departure.delayMinutes === null || departure.distanceMeters === null) {
    return isLive() ? 'tramvaj ještě není na trati v Líšni · čas dle jízdního řádu' : '';
  }
  const delay = departure.delayMinutes;
  let delayText;
  if (delay > 0) delayText = `zpoždění +${delay} min`;
  else if (delay < 0) delayText = `náskok ${-delay} min`;
  else delayText = 'jede včas';

  const distance = departure.distanceMeters;
  const distanceText = distance >= 1000
    ? `${(distance / 1000).toFixed(1)} km`
    : `${distance} m`;

  return `ŽIVĚ · ${delayText} · tramvaj ${distanceText} od zastávky`;
}

function render() {
  el.statusText.textContent = statusText();
  el.statusLine.classList.toggle('is-live', isLive());
  el.statusDot.classList.toggle('is-live', isLive());

  const first = store.departures[0];

  if (!first) {
    el.bigNumber.textContent = '–';
    el.bigNumber.classList.remove('blink', 'arriving');
    el.bigUnit.textContent = '';
    el.departLine.textContent = '';
    el.liveNote.textContent = '';
    el.nextList.innerHTML = '';
    el.serviceDay.textContent = store.serviceDayLabel;
    return;
  }

  const seconds = secondsRemaining(first);
  const minutes = minutesRemaining(first);
  const arriving = seconds < 60;

  el.bigNumber.textContent = arriving ? '●' : String(minutes);
  el.bigNumber.classList.toggle('arriving', arriving);
  el.bigNumber.classList.toggle('blink', arriving);
  el.bigUnit.textContent = arriving ? 'přijíždí' : 'min';

  el.departLine.textContent =
    `odjezd v ${clockText(first.expected)}`
    + (isOtherDay(first.expected, store.now) ? ' (zítra)' : '')
    + ` · za ${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;

  el.liveNote.textContent = liveNote(first);

  // Další odjezdy
  el.nextList.innerHTML = '';
  for (const departure of store.departures.slice(1)) {
    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    left.className = 'row-left';

    const time = document.createElement('span');
    time.className = 'row-time';
    time.textContent = clockText(departure.expected);
    left.appendChild(time);

    if (departure.delayMinutes !== null && departure.delayMinutes > 0) {
      const delay = document.createElement('span');
      delay.className = 'row-delay';
      delay.textContent = `+${departure.delayMinutes}`;
      left.appendChild(delay);
    }
    if (isOtherDay(departure.expected, store.now)) {
      const tomorrow = document.createElement('span');
      tomorrow.className = 'row-tomorrow';
      tomorrow.textContent = 'zítra';
      left.appendChild(tomorrow);
    }

    const right = document.createElement('span');
    right.className = 'row-eta';
    right.textContent = `za ${minutesRemaining(departure)} min`;

    row.append(left, right);
    el.nextList.appendChild(row);
  }

  el.serviceDay.textContent = store.serviceDayLabel;
}

// --- Běh na pozadí obrazovky -------------------------------------------
// Smyčky běží jen dokud je aplikace na obrazovce — na pozadí se stahování
// úplně zastaví, aby aplikace zbytečně nespotřebovávala data.

function start() {
  if (tickTimer) return;
  recompute();
  tickTimer = setInterval(recompute, 1000);
  refreshLive();
  feedTimer = setInterval(refreshLive, LIVE_REFRESH_MS);
}

function stop() {
  clearInterval(tickTimer); tickTimer = null;
  clearInterval(feedTimer); feedTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') start();
  else stop();
});

// Tah dolů na tabuli vynutí okamžitou obnovu.
el.bigNumber.closest('.board').addEventListener('click', () => {
  if (!feedRunning) refreshLive();
});

start();

// --- Service worker (offline provoz jízdního řádu) ----------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
