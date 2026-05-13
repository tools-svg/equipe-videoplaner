// ============================================
// FIREBASE-KONFIGURATION
// ============================================
//
// SO RICHTEST DU DAS EIN (einmalig, ~5 Min):
//
// 1. Auf https://console.firebase.google.com gehen, mit Google-Account einloggen
// 2. "Projekt hinzufügen" → Name: "equipe-videoplaner" → weiter, weiter, fertig
// 3. Im Projekt: links auf "Build" → "Firestore Database" → "Datenbank erstellen"
//    → Startmodus "Im Produktionsmodus starten" → Standort: "europe-west3" (Frankfurt)
// 4. Links "Build" → "Authentication" → "Loslegen" → Tab "Sign-in method"
//    → "E-Mail/Passwort" aktivieren → speichern
//    → Tab "Anonym" aktivieren (für Mitarbeiter ohne Login)
// 5. Im Projekt: Zahnrad-Icon oben links → "Projekteinstellungen"
//    → Reiter "Allgemein" → ganz unten "Web-App hinzufügen" (Symbol </>)
//    → App-Name: "Videoplaner" → "App registrieren"
// 6. Es erscheint ein Code-Block mit "firebaseConfig = { ... }"
//    → DIESEN Block unten ersetzen
// 7. Reiter "Authentication" → "Users" → "Nutzer hinzufügen"
//    → DEINE E-Mail + ein Passwort eingeben (das wird dein Admin-Login)
//    → die User-UID kopieren und in ADMIN_UIDS unten eintragen
//
// FERTIG. App synct dann automatisch.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBlPfCyNOEdMd1Lm0r4fhdCtBKmlxuONQ0",
  authDomain: "equipe-videoplaner.firebaseapp.com",
  projectId: "equipe-videoplaner",
  storageBucket: "equipe-videoplaner.firebasestorage.app",
  messagingSenderId: "165105073978",
  appId: "1:165105073978:web:4351f984b5aecda5449a03"
};

// Admin-UIDs - nur diese Nutzer dürfen bearbeiten
// (User-UID findest du in Firebase Console → Authentication → Users)
const ADMIN_UIDS = [
  "p62iVkFqP5M7p78qLI7AuAEfSJi1"
];

// Wenn FIREBASE_CONFIG.apiKey leer ist, läuft die App im Offline-Modus (nur localStorage)
const FIREBASE_ENABLED = !!FIREBASE_CONFIG.apiKey;
