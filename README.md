# Orbit TV (Windows)

IPTV plejer za Xtream Codes / XUI.ONE servise: TV uživo, TV vodič sa sličicama, catch-up (arhiva),
premotavanje emisije koja još traje, sličice dok premotavaš, filmovi i serije.
Aplikacija je "gola": nema nikakav sadržaj, korisnik se prijavljuje svojim podacima.

## Prijava

- **Kod**: kod iz OrbitModul-a (prodavnica `orbit-modul.info`). Aplikacija sama dobije server, username i lozinku.
- **Username i lozinka**: adresa servera (npr. `http://line.server.com:8080`), username i lozinka linije.

## Šta zna

| Funkcija | Kako radi |
|---|---|
| TV uživo | Plejer je mpv (libmpv). TS ili HLS, automatsko ponovno spajanje kad stream zastane. |
| Premotavanje uživo | ← / → pomjeraju sličicu po traci, plejer skoči kad pustiš. Unutar onoga što je već učitano skok je trenutan, dalje ide iz arhive servera. |
| Od početka | Emisija koja još traje kreće od početka (Home). Kad stigneš do "sada" vraća se uživo. |
| Catch-up | TV vodič 7 dana unazad: klikni prošlu emisiju → gledaj iz arhive. |
| Sličice | Trenutni kadrovi sa kanala, sličice emisija u vodiču (iz slike koju si gledao ili iz arhive, ako linija ima 2+ konekcije). |
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
| Home | Emisija od početka |
| End / U | Nazad uživo |
| A | Zvuk, titlovi, format slike |
| F / F11 / dupli klik | Cijeli ekran |
| M, + / −, točkić miša | Zvuk |
| Esc | Nazad |

## Build (GitHub Actions)

Svaki push na `main` pokreće `.github/workflows/windows.yml`:
analiza koda → testovi → `flutter build windows` → portable `.zip` + instalacija `OrbitTV-Setup-x.y.z.exe`
(Actions → zadnji run → Artifacts). Tag `v1.0.0` pravi i GitHub Release.

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
