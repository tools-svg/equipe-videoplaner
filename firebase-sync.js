// ============================================
// FIREBASE SYNC LAYER
// ============================================
// Kapselt die gesamte Firebase-Kommunikation.
// Funktioniert auch ohne Firebase (dann nur localStorage).

let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;
let currentUser = null;
let isAdmin = false;
let unsubscribeEntries = null;
let unsubscribeTeam = null;
let onSyncCallback = null;
let onAuthCallback = null;
let pendingWrites = 0;

// Status-Funktion: zeigt der App ob sync grad läuft
function setSyncStatus(state) {
  // state: 'connected' | 'syncing' | 'offline' | 'disabled'
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.className = `sync-status ${state}`;
  const labels = {
    'connected': 'Synchronisiert',
    'syncing': 'Synchronisiere...',
    'offline': 'Offline',
    'disabled': 'Lokal'
  };
  el.querySelector('.sync-status-label').textContent = labels[state] || state;
}

async function initFirebase() {
  if (!FIREBASE_ENABLED) {
    setSyncStatus('disabled');
    isAdmin = true; // Im Offline-Modus darf jeder bearbeiten
    return false;
  }

  try {
    // Firebase Modules dynamisch laden (ESM via CDN)
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js');
    const { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, enableIndexedDbPersistence } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut } =
      await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');

    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firebaseDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);

    // Funktionen global verfügbar machen
    window._fb = { doc, setDoc, deleteDoc, onSnapshot, collection, signInWithEmailAndPassword, signInAnonymously, signOut };

    // Offline-Persistenz aktivieren
    try {
      await enableIndexedDbPersistence(firebaseDb);
    } catch (err) {
      console.warn('Persistenz nicht verfügbar:', err.code);
    }

    setSyncStatus('syncing');

    // Auth-Status überwachen
    onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        currentUser = user;
        isAdmin = !user.isAnonymous && ADMIN_UIDS.includes(user.uid);
        console.log(`Eingeloggt: ${user.email || 'Anonym'} | Admin: ${isAdmin}`);
        startListening();
      } else {
        // Niemand eingeloggt → anonym einloggen für Lesezugriff
        currentUser = null;
        isAdmin = false;
        try {
          await signInAnonymously(firebaseAuth);
        } catch (err) {
          console.error('Anonymer Login fehlgeschlagen:', err);
          setSyncStatus('offline');
        }
      }
      if (onAuthCallback) onAuthCallback();
    });

    return true;
  } catch (err) {
    console.error('Firebase Init Fehler:', err);
    setSyncStatus('offline');
    isAdmin = true; // Fallback
    return false;
  }
}

function startListening() {
  if (!firebaseDb || !currentUser) return;

  // Bestehende Listener aufräumen
  if (unsubscribeEntries) unsubscribeEntries();
  if (unsubscribeTeam) unsubscribeTeam();

  const { doc, onSnapshot, collection } = window._fb;

  // Auf Team-Doc hören (single doc)
  unsubscribeTeam = onSnapshot(doc(firebaseDb, 'config', 'team'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.fix && data.head && data.freelance) {
        state.team = { ...DEFAULT_TEAM, ...data };
        if (!state.team.ex) state.team.ex = [...DEFAULT_TEAM.ex];
        // Lokal cachen
        localStorage.setItem(TEAM_KEY, JSON.stringify(state.team));
      }
    }
  }, (err) => console.error('Team listen:', err));

  // Auf alle Einträge hören (collection)
  unsubscribeEntries = onSnapshot(collection(firebaseDb, 'entries'), (snap) => {
    const newEntries = {};
    snap.forEach(d => {
      const data = d.data();
      // Doc-ID Format: "2026-05-13_Giovanni"
      const id = d.id;
      const idx = id.lastIndexOf('_');
      if (idx === -1) return;
      const dateKey = id.substring(0, idx);
      const person = id.substring(idx + 1);
      if (!newEntries[dateKey]) newEntries[dateKey] = {};
      newEntries[dateKey][person] = data;
    });
    state.entries = newEntries;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    setSyncStatus(pendingWrites > 0 ? 'syncing' : 'connected');
    if (onSyncCallback) onSyncCallback();
  }, (err) => {
    console.error('Entries listen:', err);
    setSyncStatus('offline');
  });
}

async function fbSetEntry(dateKey, person, entry) {
  if (!firebaseDb || !isAdmin) return false;
  const { doc, setDoc } = window._fb;
  pendingWrites++;
  setSyncStatus('syncing');
  try {
    const id = `${dateKey}_${person}`;
    await setDoc(doc(firebaseDb, 'entries', id), {
      ...entry,
      _editedBy: currentUser?.email || 'unknown',
      _editedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.error('Save entry failed:', err);
    showToast('Speichern fehlgeschlagen');
    return false;
  } finally {
    pendingWrites--;
    if (pendingWrites === 0) setSyncStatus('connected');
  }
}

async function fbDeleteEntry(dateKey, person) {
  if (!firebaseDb || !isAdmin) return false;
  const { doc, deleteDoc } = window._fb;
  pendingWrites++;
  setSyncStatus('syncing');
  try {
    const id = `${dateKey}_${person}`;
    await deleteDoc(doc(firebaseDb, 'entries', id));
    return true;
  } catch (err) {
    console.error('Delete failed:', err);
    return false;
  } finally {
    pendingWrites--;
    if (pendingWrites === 0) setSyncStatus('connected');
  }
}

async function fbSaveTeam(team) {
  if (!firebaseDb || !isAdmin) return false;
  const { doc, setDoc } = window._fb;
  try {
    await setDoc(doc(firebaseDb, 'config', 'team'), team);
    return true;
  } catch (err) {
    console.error('Team save failed:', err);
    return false;
  }
}

async function fbSignIn(email, password) {
  if (!firebaseAuth) return { ok: false, error: 'Firebase nicht initialisiert' };
  const { signInWithEmailAndPassword } = window._fb;
  try {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { ok: true };
  } catch (err) {
    let msg = 'Login fehlgeschlagen';
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Falsches Passwort';
    if (err.code === 'auth/user-not-found') msg = 'E-Mail nicht gefunden';
    if (err.code === 'auth/invalid-email') msg = 'Ungültige E-Mail-Adresse';
    if (err.code === 'auth/too-many-requests') msg = 'Zu viele Versuche, kurz warten';
    return { ok: false, error: msg };
  }
}

async function fbSignOut() {
  if (!firebaseAuth) return;
  const { signOut } = window._fb;
  await signOut(firebaseAuth);
  isAdmin = false;
}

// Bulk-Upload für historische Daten (einmalig)
async function fbBulkUploadEntries(entriesMap) {
  if (!firebaseDb || !isAdmin) return false;
  const { doc, setDoc } = window._fb;
  let count = 0;
  for (const [dateKey, dayMap] of Object.entries(entriesMap)) {
    for (const [person, entry] of Object.entries(dayMap)) {
      const id = `${dateKey}_${person}`;
      try {
        await setDoc(doc(firebaseDb, 'entries', id), {
          ...entry,
          _editedBy: currentUser?.email || 'bulk-upload',
          _editedAt: Date.now()
        });
        count++;
      } catch (err) {
        console.error(`Bulk-Upload Fehler bei ${id}:`, err);
      }
    }
  }
  return count;
}
