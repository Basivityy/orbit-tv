# Orbit Player (Windows)

IPTV plejer za Xtream Codes / XUI.ONE servise: TV uživo, TV vodič sa sličicama, catch-up (arhiva),
premotavanje emisije koja još traje, sličice dok premotavaš, filmovi i serije.
Aplikacija je "gola": nema nikakav sadržaj, korisnik se prijavljuje svojim podacima.

## Prijava

- **Kod**: kod iz OrbitModul-a (prodavnica `orbit-modul.info`). Aplikacija sama dobije server, username i lozinku.
- **Username i lozinka**: adresa servera (npr. `http://line.server.com:8080`), username i lozinka linije.

**Licenca (od 1.2.0):** aplikacija radi samo za linije prodavnica koje imaju plaćena mjesta za Orbit Player
u OrbitModul-u (1 linija = 1 mjesto, sve njene uređaje broji jednom). Kod prijave kodom to provjerava
platforma odmah; kod prijave username/lozinkom aplikacija pita `POST /api/app/v1/player/check`.
Ako platforma nije dostupna, aplikacija radi još 7 dana od zadnje uspješne provjere. Dok je upaljena,
provjerava ponovo svakih 6 sati.

## Šta zna

| Funkcija | Kako radi |
|---|---|
| TV uživo | Plejer je mpv (libmpv). TS ili HLS, automatsko ponovno spajanje kad stream zastane. |
| Premotavanje uživo | ← / → pomjeraju sličicu po traci, plejer skoči kad pustiš. Unutar onoga što je već učitano skok je trenutan, dalje ide iz arhive servera. |
| Od početka | Emisija koja još traje kreće od početka (Home). Kad stigneš do "sada" vraća se uživo. |
| Catch-up | TV vodič 7 dana unazad: klikni prošlu emisiju → gledaj iz arhive. |
| Slike emisija | Prvo slika iz EPG-a panela (`xmltv.php`: `<icon>` ili `<image>`; ili polje `image`/`icon` u EPG-u), pa pravi kadar (iz slike koju si gledao ili iz arhive, ako linija ima 2+ konekcije), pa logo kanala. Ako EPG panela nema slike, u Postavke → Napredno upiši drugi XMLTV izvor sa slikama (.xml ili .xml.gz). |
| Filmovi i serije | Nastavljanje gdje si stao, sljedeća epizoda. |

## Prečice na tastaturi (plejer)

| Taster | Radnja |
|---|---|
| Space / K | Pauza / nastavi |
| ← → | Premotavanje (držanjem ide brže) |
| Shift + ← → | ±1 minut odmah |
| ↑ ↓, PageUp/PageDown | Sljedeći / prethodni kanal |
| 0–9 | Broj kanala |
| Enter / L | Lista kanala |
| G / Tab | Vodič kanala (emisije prije/sada/poslije, pusti prošlu iz arhive) |
| Home | Emisija od početka |
| End / U | Nazad uživo |
| A | Zvuk, titlovi, format slike |
| F / F11 / dupli klik | Cijeli ekran |
| M, + / −, točkić miša | Zvuk |
| Esc | Nazad |

## Build (GitHub Actions)

Svaki push na `main` pokreće `.github/workflows/windows.yml`:
analiza koda → testovi → `flutter build windows` → portable `.zip` + instalacija `OrbitPlayer-Setup-x.y.z.exe`
(Actions → zadnji run → Artifacts). Commit sa `[release]` u poruci pravi GitHub Release (instalacija + portable zip).

Lokalno (Windows, Flutter 3.27.4, Visual Studio 2022 sa "Desktop development with C++"):

```
flutter pub get
flutter run -d windows
flutter build windows --release
```

## Struktura

```
lib/app        konfiguracija, tema, servisi (prijava, povezivanje svega)
lib/data       Xtream API, OrbitModul API, EPG, katalog, postavke
lib/media      sličice: kadrovi, disk keš, XMLTV ikone, drugi mpv za arhivu
lib/player     plejer (engine), vremenska linija (uživo/arhiva), ekran plejera
lib/ui         ekrani: početna, TV uživo, TV vodič, filmovi, serije, pretraga, postavke
windows        Windows runner (naziv prozora, ikona, minimalna veličina)
installer      Inno Setup skripta i ikona
```
