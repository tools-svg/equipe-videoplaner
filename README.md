# equipe Videoplaner

Mobile-First Web-App (PWA) zur Planung des Videografen-Teams bei equipe One AG. Im Dark-Mode-CI von equipe.

## Team-Struktur

- **Videografen Fix:** Giovanni, Jonas, Senad, Aksel
- **Head of Content:** Matus (Schnitt-Einträge werden automatisch als Notfall-Einsatz markiert)
- **Freelance-Pool:** Nicci, Cody (zuweisbar über das Plus-Element der Freelance-Sektion)
- **Ehemalige:** Amir, Aless (read-only sichtbar für historische Einträge)

## 5 Ansichten

### 1. Tag
Detaillierte Tagesübersicht mit horizontalem Datums-Streifen. Auslastungs-Indikator zeigt, wie viele Fix-Videografen heute eingeteilt sind (z.B. 3/4). Drei Sektionen: Videografen Fix, Head of Content, Freelance.

### 2. Woche
Heatmap-Grid: Personen × 7 Tage. Jede Zelle farbcodiert.
- **Teal "D"**: Dreh
- **Gelb "S"**: Schnitt
- **Gelb mit ⚠**: Notfall-Einsatz von Matus
- **Grau "F"/"★"/"–"**: Ferien / Feiertag / Kompensation
- **Dunkel**: frei

Oben drei Karten: Anzahl Drehs, Schnitt, freie Slots in dieser Woche (Mo-Fr).

### 3. Monat
Kalender mit Mini-Balken pro Tag (1 Segment pro Fix-Videograf). Auf einen Blick: Welche Tage sind voll? Welche frei? Zusätzlich Monats-Stats.

### 4. Auslastung
Prognose pro Person über 7/14/30/60 Tage. Farbcodierte Schwellen:
- **Unter 60%**: grün (entspannt)
- **60–90%**: gelb (eng)
- **Über 90%**: rot (überlastet)

Team-Gesamt + pro Person mit Dreh/Schnitt/Abwesend-Breakdown. Automatische Hinweise unten: Wer ist überlastet? Wer hat Kapazität? Wie viele Notfall-Einsätze hat Matus?

### 5. Setup
Drei Untertabs:
- **Statistik**: Auslastung pro Person, Top-Projekte, Notfall-Übersicht (filterbar nach Monat)
- **Team**: Mitarbeiter verwalten, Notifications aktivieren, Install-Anleitung
- **Daten**: Export/Import als JSON, historische Daten laden, alle Daten löschen

## Daten

Beim ersten Start werden 113 Tage historische Daten (Januar–Mai 2026) automatisch geladen. Über Setup → Daten lassen sich diese jederzeit neu laden oder eigene JSON-Backups importieren. Alle Daten bleiben lokal im Browser (localStorage).

## Installation auf iPhone

1. App auf einem Server bereitstellen (z.B. GitHub Pages, lokal mit `python3 -m http.server`)
2. URL in **Safari** öffnen (nicht Chrome!)
3. Teilen-Button antippen
4. "Zum Home-Bildschirm" wählen
5. App-Icon erscheint, tippen zum Starten
6. In Setup → Team → Notifications aktivieren (iOS 16.4+)

## Tech-Stack

Reine HTML/CSS/JS, kein Build-Prozess. Lato via Google Fonts. PWA-fähig (manifest.json + Service Worker). Offline-fähig nach erstem Laden.

© equipe One AG
