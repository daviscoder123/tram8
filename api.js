// api.js
// Exportuje funkci, kterou volá app.js ke generování dat.
// Stránka /api.json (speciální route v HTML) používá tohle pro Shortcuts.

import { LiveFeed } from './livefeed.js';
import { nextScheduled, serviceDay, clockText } from './timetable.js';
import { DEPARTURE_COUNT } from './config.js';

const feed = new LiveFeed();

/**
 * Generuje strukturu pro JSON API.
 * @returns {Promise<object>}
 */
export async function getApiData() {
  const now = new Date();
  const scheduled = nextScheduled(DEPARTURE_COUNT, now);

  const result = await feed.fetchApproachingTrams();
  let trams = [];
  let feedState = 'unavailable';
  let feedMessage = '';

  if (result.ok) {
    trams = result.trams;
    feedState = 'live';
  } else {
    feedMessage = result.message;
  }

  let departures = scheduled.map((date) => ({
    scheduled: date.toISOString(),
    expected: date.toISOString(),
    delayMinutes: null,
    distanceMeters: null,
  }));

  // Páruj s tramvajemi
  if (feedState === 'live') {
    for (let i = 0; i < departures.length && i < trams.length; i++) {
      const tram = trams[i];
      const expectedTime = new Date(
        new Date(departures[i].scheduled).getTime() + tram.delayMinutes * 60000
      );
      const floorSec = tram.distanceMeters < 60 ? 5 : 30;
      const earliest = new Date(now.getTime() + floorSec * 1000);
      departures[i] = {
        scheduled: departures[i].scheduled,
        expected: (expectedTime > earliest ? expectedTime : earliest).toISOString(),
        delayMinutes: tram.delayMinutes,
        distanceMeters: tram.distanceMeters,
      };
    }
    departures.sort((a, b) => new Date(a.expected) - new Date(b.expected));
  }

  const first = departures[0];
  const secondsRemaining = first
    ? Math.max(0, Math.floor((new Date(first.expected) - now) / 1000))
    : 0;
  const minutesRemaining = Math.floor(secondsRemaining / 60);

  return {
    timestamp: now.toISOString(),
    feedState,
    feedMessage,
    serviceDay: serviceDay(now).label,
    nextArrival: {
      minutes: minutesRemaining,
      seconds: secondsRemaining % 60,
      unit: secondsRemaining < 60 ? 'přijíždí' : 'min',
      scheduled: first ? first.scheduled : null,
      expected: first ? first.expected : null,
      expectedTime: first ? clockText(new Date(first.expected)) : '–',
      delayMinutes: first ? first.delayMinutes : null,
      distanceMeters: first ? first.distanceMeters : null,
      isTomorrow: first ? !isSameDay(new Date(first.expected), now) : false,
    },
    upcoming: departures.slice(1).map((d) => ({
      expectedTime: clockText(new Date(d.expected)),
      minutesRemaining: Math.floor((new Date(d.expected) - now) / 60000),
      delayMinutes: d.delayMinutes,
      isTomorrow: !isSameDay(new Date(d.expected), now),
    })),
  };
}

function isSameDay(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}
