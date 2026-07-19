# Tram 8 — Masarova → centrum

Webová verze iOS aplikace. Ukazuje, za kolik minut jede tramvaj 8 ze zastávky
Masarova směr centrum, s živým zpožděním z mapy provozu IDS JMK.

Funguje jako PWA — dá se přidat na plochu iPhonu a chová se pak jako běžná
aplikace (celá obrazovka, vlastní ikona, žádný adresní řádek).

---

## 1. Nasazení na GitHub Pages

1. Založ nový repozitář, např. `tram8`.
2. Nahraj do něj obsah této složky (`index.html` musí být v kořeni repozitáře).
3. V repozitáři: **Settings → Pages**.
4. **Source**: `Deploy from a branch`, **Branch**: `main`, složka `/ (root)`. Ulož.
5. Po minutě běží na `https://TVUJ-UCET.github.io/tram8/`.

Soubor `.nojekyll` už je přiložený — bez něj by GitHub ignoroval složky
začínající podtržítkem a občas dělal neplechu s cachováním.

## 2. Přidání na plochu iPhonu

1. Otevři adresu **v Safari** (ne v Chromu — přidání na plochu umí jen Safari).
2. Tlačítko Sdílet → **Přidat na plochu**.
3. Potvrď název „Tram 8“.

Ikona se objeví mezi ostatními aplikacemi. Po spuštění běží na celou obrazovku
bez prohlížeče. Jízdní řád funguje i bez signálu (uložený service workerem),
živá data pochopitelně jen online.

## 2b. Apple Watch — Shortcuts + JSON API

Aplikace má speciální režim pro Apple Watch:

- **Watch.html** — ultra-minimalistické zobrazení pro Safari na Watch
  - URL: `https://TVUJ-UCET.github.io/tram8/watch.html`
  - Jen LED číslo, jednotka, status (🔵 ŽIVĚ / ⚫ Jízdní řád)

- **Zkratky** — nativní Watch appka bez Safari
  - JSON API vrátí údaje strukturovaně
  - Zkratky si to samy zobrazí v native UI
  - Spuštění: Siri „Zkratky, Tram 8" nebo Watch appka Zkratky

**Návod** → viz soubor **SHORTCUTS.md**. Trvá to pět minut k nastavení.

---

## 3. Živá data a CORS — přečti si to

Na iOS aplikace sáhla na `mapa.idsjmk.cz` přímo. V prohlížeči to nejde:
server neposílá hlavičku `Access-Control-Allow-Origin`, takže požadavek
ze stránky na `github.io` prohlížeč zablokuje.

Aplikace proto zkouší cesty v pořadí podle `js/config.js`: přímo → veřejné
CORS proxy → když neuspěje nic, přepne se na režim **„Živá data nedostupná –
jízdní řád“** a dál ukazuje plánované časy.

Veřejné proxy jsou zdarma, ale pomalé, s limity a občas prostě nefungují.
**Na denní používání si udělej vlastní** — trvá to pět minut a je zdarma.

### Vlastní proxy na Cloudflare Workers

1. Založ účet na [dash.cloudflare.com](https://dash.cloudflare.com) (zdarma).
2. **Workers & Pages → Create → Worker**, pojmenuj `tram8-proxy`, **Deploy**.
3. **Edit code**, smaž obsah a vlož:

```js
const ALLOWED = 'https://mapa.idsjmk.cz';

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'X-Access-Token, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target || !target.startsWith(ALLOWED)) {
      return new Response('Nepovolená adresa', { status: 400, headers: cors });
    }

    const headers = new Headers();
    const token = request.headers.get('X-Access-Token');
    if (token) headers.set('X-Access-Token', token);
    headers.set('User-Agent', 'Mozilla/5.0');

    const upstream = await fetch(target, { headers, cf: { cacheTtl: 0 } });
    const response = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  },
};
```

4. **Deploy**. Dostaneš adresu typu `https://tram8-proxy.tvuj-ucet.workers.dev`.
5. V `js/config.js` ji vlož do `MY_PROXY`:

```js
export const MY_PROXY = 'https://tram8-proxy.tvuj-ucet.workers.dev';
```

6. Nahraj změnu na GitHub. Hotovo — proxy se používá jako první volba.

Worker je omezený jen na `mapa.idsjmk.cz`, takže ho nikdo nezneužije jako
otevřenou proxy.

---

## 4. Co je kde

| Soubor | Obsah |
|---|---|
| `js/timetable.js` | Jízdní řád linky 8 od 27. 6. 2026, svátky, Velikonoce, prázdniny, pražská časová zóna |
| `js/livefeed.js` | Stahování poloh vozů, token, promítnutí GPS na líšeňskou trať |
| `js/app.js` | Spojení jízdního řádu se zpožděním, odpočet, vykreslení |
| `js/config.js` | Proxy, interval obnovy, počet odjezdů — jediné, co se běžně mění |
| `sw.js` | Offline provoz jízdního řádu |
| `styles.css` | Paleta a rozměry z původního SwiftUI |

## 5. Chování stažené z iOS verze

- Odpočet se přepočítává každou sekundu, živá data každých 10 s.
- Stahování běží jen když je aplikace na obrazovce — na pozadí se zastaví,
  aby nežrala data.
- K-tá nejbližší přijíždějící tramvaj se páruje s k-tým nejbližším spojem.
- Vůz nemůže dorazit dřív, než k tomu stihne dojet (5 s pod 60 m, jinak 30 s).
- Pod minutu bliká místo čísla puntík a nápis „přijíždí“.
- Klepnutí na tabuli vynutí okamžitou obnovu (v iOS verzi nebylo).

## 6. Aktualizace jízdního řádu

Časy jsou v `js/timetable.js` jako odjezdy z **Líšeň, Mifkova**; Masarova se
dopočítává jako Mifkova + 3 minuty (`STOP_OFFSET_MINUTES`). Při změně řádu
přepiš pole `WORKDAY`, `WORKDAY_HOLIDAY` a `WEEKEND` a v `sw.js` zvyš verzi
cache (`tram8-v1` → `tram8-v2`), aby si telefony stáhly novou verzi.

Prázdninové dny mimo červenec a srpen jsou napevno v `isSchoolBreak()` —
tam patří ředitelská volna a podzimní prázdniny pro daný školní rok.
