# Apple Shortcuts pro Tram 8

Dvě možnosti: **Safari na Watch** (jednoduchá) nebo **Shortcuts s JSON** (hezkější UI).

---

## Možnost 1: Safari na Watch (nejjednodušší)

1. Na iPhonu: **Zkratky** → **Automatizace** → **Nová automatizace** → **Při spuštění Siri**
2. Vyber jméno, třeba "Tram 8"
3. Přidej akci: **URL → Získat obsah webové stránky**
4. URL: `https://TVUJ-UCET.github.io/tram8/watch.html`
5. Přidej: **Zobrazit výsledek → Otevřít URL**
6. Ulož
7. Na Watch: **Siri → "Tram 8"** → otevře se watch.html v Safari
8. Klikni na číslo a táhni dolů → obnoví se

---

## Možnost 2: Nativní Watch UI (doporučuju)

To je hezčí, protože Shortcuts si sám stáhne data a zobrazí je v native Watch appce (bez Safari).

### Na iPhonu (Zkratky):

1. **Zkratky** → **+** (nová)
2. **Přidat akci** hledej "URL":
   ```
   Získat obsah webové stránky: https://TVUJ-UCET.github.io/tram8/?format=json
   ```
   (Nahraď `TVUJ-UCET` svým GitHub usernamen, `tram8` jen pokud jsi dal jiný název repozitáře.)

3. Přidej **Text** akci:
   ```
   Parsuj JSON
   Vstup: ← Výstup z "Získej obsah"
   ```

4. Přidej **Zobrazit výsledek**:
   ```
   Zobrazit: 
   "Tramvaj přijede za " + minutes + " min" 
   ```

5. Ulož → pojmenuj "Tram 8"

### Jak to spustit na Watch:

- **Siri**: „Zkratky, Tram 8"
- Nebo: Apple Watch → **Zkratky** appka → „Tram 8"

---

## Propojení s Home Screen

Chceš mít na Watch faci?

1. Na iPhonu v **Zkratkách** → dlouhý tap na zkratku → **Přidat na plochu**
2. Vlož jméno "Tram 8", potvrď
3. Objeví se na Home Screenu iPhonu
4. Synchronizuje se automaticky na Watch

---

## JSON struktura (když si chceš věci přizpůsobit):

```json
{
  "feedState": "live",
  "nextArrival": {
    "minutes": 5,
    "seconds": 23,
    "unit": "min",
    "expectedTime": "14:37",
    "delayMinutes": 2,
    "distanceMeters": 850,
    "isTomorrow": false
  },
  "upcoming": [
    { "expectedTime": "14:47", "minutesRemaining": 15, "delayMinutes": 0 },
    ...
  ],
  "serviceDay": "Pracovní den"
}
```

---

## Bez internetu?

Zkratka se prostě nespustí (API není dostupné). Ale `watch.html` v Safari má offline jízdní řád (přes service worker), takže když si ji jednou otevřeš na Watch a budeš offline, bude to ukazovat aspoň z paměti.
