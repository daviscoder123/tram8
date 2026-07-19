// config.js
// Jediné místo, kde se nastavuje cesta k živým datům.
//
// mapa.idsjmk.cz neposílá hlavičku Access-Control-Allow-Origin, takže na ni
// stránka z github.io nesmí sáhnout přímo. Řešením je proxy, která odpověď
// přepošle i s CORS hlavičkou.
//
// Doporučené: vlastní Cloudflare Worker (návod v README, zdarma, spolehlivý).
// Až ho budeš mít, vlož jeho adresu do MY_PROXY níž — tím se stane první
// volbou a veřejné proxy zůstanou jen jako záloha.

/** Adresa vlastní proxy, např. 'https://tram8-proxy.tvuj-ucet.workers.dev'. */
export const MY_PROXY = '';

/**
 * Trasy se zkoušejí v tomto pořadí.
 * forwardsHeaders: proxy přeposílá hlavičku X-Access-Token na cílový server.
 */
export const PROXIES = [
  ...(MY_PROXY
    ? [{
        name: 'vlastní proxy',
        forwardsHeaders: true,
        build: (url) => `${MY_PROXY.replace(/\/$/, '')}/?url=${encodeURIComponent(url)}`,
      }]
    : []),
  {
    // Funguje jen v prostředí bez CORS (např. lokální náhled s vypnutou ochranou).
    name: 'přímo',
    forwardsHeaders: true,
    build: (url) => url,
  },
  {
    name: 'corsproxy.io',
    forwardsHeaders: true,
    build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'codetabs',
    forwardsHeaders: false,
    build: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  },
  {
    name: 'allorigins',
    forwardsHeaders: false,
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
];

/** Jak často se stahují živá data (ms). */
export const LIVE_REFRESH_MS = 10_000;

/** Kolik odjezdů se zobrazuje celkem (první velký + seznam pod ním). */
export const DEPARTURE_COUNT = 4;
