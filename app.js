// ============================================
// EQUIPE VIDEOPLANER · APP
// ============================================

const STORAGE_KEY = 'equipe_videoplaner_data_v3';
const TEAM_KEY = 'equipe_videoplaner_team_v3';
const NOTIF_KEY = 'equipe_videoplaner_notif_v3';

const DEFAULT_TEAM = {
  fix: ['Giovanni', 'Jonas', 'Senad', 'Aksel'],
  head: ['Matus'],
  freelance: ['Nicci', 'Cody'],
  ex: ['Amir', 'Aless']
};

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAYS_SHORT = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const AVATAR_COLORS = [
  '#269E8A', '#7B61FF', '#D4A03A', '#E07A5F', '#3D7BBF',
  '#9B5FE0', '#5FB0E0', '#E0A85F', '#8FB85F', '#E05F8F'
];

// Auslastungs-Schwellen
const CAP_GREEN = 60;  // unter 60% = grün
const CAP_YELLOW = 90; // 60-90% = gelb, über 90% = rot

let state = {
  entries: {},
  team: { ...DEFAULT_TEAM },
  currentDate: new Date(),
  selectedDate: new Date(),
  monthViewDate: new Date(),
  weekViewDate: new Date(),
  statsMonth: null,
  capacityRange: 30, // Tage in die Zukunft
  setupTab: 'stats',
  editingDate: null,
  editingStaff: null,
  editingRole: null,
  modalSelectedType: 'dreh',
  notifEnabled: false
};

// ============ HELPERS ============
function getRoleOf(name) {
  if (state.team.fix.includes(name)) return 'fix';
  if (state.team.head.includes(name)) return 'head';
  if (state.team.freelance.includes(name)) return 'freelance';
  if (state.team.ex && state.team.ex.includes(name)) return 'ex';
  return null;
}

function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 1000000;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function isWeekend(d) {
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

// ============ STORAGE ============
function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) state.entries = JSON.parse(data);
  } catch(e) { console.warn('Load entries failed', e); }

  try {
    const team = localStorage.getItem(TEAM_KEY);
    if (team) {
      const parsed = JSON.parse(team);
      if (parsed.fix && parsed.head && parsed.freelance) {
        state.team = { ...DEFAULT_TEAM, ...parsed };
        if (!state.team.ex) state.team.ex = [...DEFAULT_TEAM.ex];
      }
    }
  } catch(e) { console.warn('Load team failed', e); }

  try {
    state.notifEnabled = localStorage.getItem(NOTIF_KEY) === '1';
  } catch(e) {}
}

function saveEntries() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries)); }
  catch(e) { showToast('Speichern fehlgeschlagen'); console.error(e); }
}

function saveTeam() {
  try { localStorage.setItem(TEAM_KEY, JSON.stringify(state.team)); }
  catch(e) { console.error(e); }
}

// ============ DATE UTILS ============
function fmtDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateLong(d) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateShort(d) {
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtMonth(d) { return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(d) { return isSameDay(d, new Date()); }

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Montag der Woche zu einem Datum
function getWeekStart(d) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sonntag → -6, Mo=1 → 0, Di=2 → -1
  r.setDate(r.getDate() + diff);
  r.setHours(0,0,0,0);
  return r;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// ============ ENTRY ============
function getEntry(dateKey, staff) {
  return state.entries[dateKey]?.[staff] || null;
}

function setEntry(dateKey, staff, entry) {
  if (!state.entries[dateKey]) state.entries[dateKey] = {};
  const existing = state.entries[dateKey][staff];

  if (staff === 'Matus' && entry.type === 'schnitt') {
    entry.isNotfall = true;
  } else {
    entry.isNotfall = false;
  }

  state.entries[dateKey][staff] = { ...entry, updated: Date.now() };
  saveEntries();

  if (state.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
    const action = existing ? 'aktualisiert' : 'erstellt';
    const d = new Date(dateKey);
    try {
      new Notification(`Eintrag ${action}`, {
        body: `${staff} · ${fmtDateShort(d)}: ${entry.text || entry.type}`,
        icon: 'icon-192.png',
        tag: `${dateKey}-${staff}`
      });
    } catch(e) {}
  }
}

function deleteEntry(dateKey, staff) {
  if (state.entries[dateKey]) {
    delete state.entries[dateKey][staff];
    if (Object.keys(state.entries[dateKey]).length === 0) {
      delete state.entries[dateKey];
    }
  }
  saveEntries();
}

function detectType(text) {
  if (!text) return 'andere';
  const t = text.toLowerCase();
  if (t === 'ferien') return 'ferien';
  if (t.includes('auffahrt') || t.includes('pfingsten') || t.includes('weihnacht') ||
      t.includes('neujahr') || t.includes('ostern') || t.includes('karfreitag')) return 'feiertag';
  if (t.includes('kompensation') || t === 'komp.' || t === 'komp') return 'kompensation';
  // Workshops/Events sind separat, nicht Schnitt
  const workshopOnly = ['workshop', 'brunch', 'übergabe', 'adios', 'geburtstag', 'krank', 'pristina', 'shot list', 'storyboard', 'konzept', 'moodfilm', 'moodfim'];
  if (workshopOnly.some(w => t.includes(w)) && !t.includes('schnitt') && !t.includes('kor')) {
    if (t.includes('shoot')) return 'dreh';
    return 'andere';
  }
  if (t.includes('dreh') || t.includes('event')) return 'dreh';
  // Schnitt-Indikatoren (Postproduktion)
  const schnittKeywords = ['schnitt', 'korrektur', 'kor.', 'übersetzung', 'anpass',
    'hochformat', 'querformat', 'testimonial', 'recap', 'bts', 'thumbnail',
    'self-recorded', 'self recorded', 'video', 'videos', 'bilder'];
  if (schnittKeywords.some(k => t.includes(k))) return 'schnitt';
  return 'andere';
}

function typeLabel(type) {
  return ({ dreh:'Dreh', schnitt:'Schnitt', ferien:'Ferien', feiertag:'Feiertag', kompensation:'Komp.', andere:'Andere' })[type] || '';
}

// ============ CAPACITY LOGIC ============
// Auslastungs-Status einer Person an einem Tag:
// 'off' = Ferien/Feiertag/Komp → nicht verfügbar (zählt nicht zu Auslastung)
// 'ok' = ein Eintrag (dreh/schnitt/andere) → arbeitet
// 'frei' = kein Eintrag → verfügbar
function getDayStatus(dateKey, staff) {
  const e = getEntry(dateKey, staff);
  if (!e) return 'frei';
  const type = e.type || detectType(e.text);
  if (['ferien','feiertag','kompensation'].includes(type)) return 'off';
  return 'ok';
}

// Auslastung einer Person über einen Bereich (n Tage ab startDate)
// Returns: { workdays, busy, off, free, pct, status }
function calcCapacity(staff, startDate, days) {
  let workdays = 0, busy = 0, off = 0, dreh = 0, schnitt = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    if (isWeekend(d)) continue;
    workdays++;
    const key = fmtDateKey(d);
    const status = getDayStatus(key, staff);
    if (status === 'off') off++;
    else if (status === 'ok') {
      busy++;
      const e = getEntry(key, staff);
      const t = e.type || detectType(e.text);
      if (t === 'dreh') dreh++;
      else if (t === 'schnitt') schnitt++;
    }
  }
  const available = Math.max(workdays - off, 0);
  const pct = available > 0 ? Math.round((busy / available) * 100) : 0;
  let status = 'ok';
  if (pct >= CAP_YELLOW) status = 'full';
  else if (pct >= CAP_GREEN) status = 'warn';
  return { workdays, busy, off, free: available - busy, dreh, schnitt, pct, status, available };
}

// ============ TOOLTIP (Hover Desktop / Long-Press Mobile) ============
let tooltipEl = null;
let longPressTimer = null;
let longPressTarget = null;
let suppressNextClick = false;

function ensureTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'entry-tooltip';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(x, y, entry, personName) {
  const tip = ensureTooltip();
  const type = entry.type || detectType(entry.text);
  tip.innerHTML = `
    <div class="entry-tooltip-type ${type}">${typeLabel(type)}</div>
    <div class="entry-tooltip-text">${escapeHtml(entry.text || '—')}</div>
    ${personName ? `<div class="entry-tooltip-person">${escapeHtml(personName)}</div>` : ''}
  `;
  tip.style.left = '0px';
  tip.style.top = '0px';
  tip.classList.add('show');
  // Position berechnen nach Rendering
  requestAnimationFrame(() => {
    const r = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x - r.width / 2;
    let top = y - r.height - 12;
    if (left < 8) left = 8;
    if (left + r.width > vw - 8) left = vw - r.width - 8;
    if (top < 8) top = y + 24; // unter Cursor wenn oben kein Platz
    if (top + r.height > vh - 8) top = vh - r.height - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('show');
  document.querySelectorAll('.week-grid-cell.long-pressing').forEach(el => el.classList.remove('long-pressing'));
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

function attachTooltipEvents(cell, entry, personName) {
  // Hover (Desktop)
  cell.addEventListener('mouseenter', (e) => {
    const r = cell.getBoundingClientRect();
    showTooltip(r.left + r.width / 2, r.top, entry, personName);
  });
  cell.addEventListener('mouseleave', () => hideTooltip());

  // Long-Press (Mobile)
  cell.addEventListener('touchstart', (e) => {
    longPressTarget = cell;
    cell.classList.add('long-pressing');
    longPressTimer = setTimeout(() => {
      const t = e.touches[0];
      showTooltip(t.clientX, t.clientY - 20, entry, personName);
      suppressNextClick = true;
      cell.classList.remove('long-pressing');
      // Haptic Feedback wenn unterstützt
      if (navigator.vibrate) navigator.vibrate(15);
    }, 450);
  }, { passive: true });

  const cancelLongPress = () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    cell.classList.remove('long-pressing');
  };
  cell.addEventListener('touchend', cancelLongPress, { passive: true });
  cell.addEventListener('touchmove', cancelLongPress, { passive: true });
  cell.addEventListener('touchcancel', cancelLongPress, { passive: true });
}

// Global: Tap außerhalb schließt Tooltip
document.addEventListener('touchstart', (e) => {
  if (tooltipEl && tooltipEl.classList.contains('show')) {
    if (!e.target.closest('.entry-tooltip') && !e.target.closest('.week-grid-cell.day-cell')) {
      hideTooltip();
    }
  }
}, { passive: true });

// ============ VIEW SWITCHING ============
function switchView(view) {
  hideTooltip();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`.tab-btn[data-view="${view}"]`).classList.add('active');

  if (view === 'day') renderDay();
  if (view === 'week') renderWeek();
  if (view === 'month') renderMonth();
  if (view === 'capacity') renderCapacity();
  if (view === 'settings') renderSettings();

  document.getElementById('fabAdd').style.display = (view === 'day' || view === 'week') ? 'flex' : 'none';
  window.scrollTo(0, 0);
}

// ============ DATE STRIP ============
function renderDateStrip() {
  const strip = document.getElementById('dateStrip');
  strip.innerHTML = '';
  const center = state.selectedDate;
  for (let offset = -7; offset <= 14; offset++) {
    const d = addDays(center, offset);
    const key = fmtDateKey(d);
    const wd = d.getDay();
    const weekend = wd === 0 || wd === 6;
    const hasEntries = state.entries[key] && Object.keys(state.entries[key]).length > 0;

    const chip = document.createElement('div');
    chip.className = 'date-chip';
    if (weekend) chip.classList.add('weekend');
    if (isToday(d)) chip.classList.add('today');
    if (isSameDay(d, state.selectedDate)) chip.classList.add('selected');
    if (hasEntries) chip.classList.add('has-entries');

    chip.innerHTML = `
      <div class="date-chip-wd">${WEEKDAYS_SHORT[wd]}</div>
      <div class="date-chip-num">${d.getDate()}</div>
      <div class="date-chip-dot"></div>
    `;
    chip.onclick = () => {
      state.selectedDate = d;
      renderDay();
    };
    strip.appendChild(chip);
  }

  setTimeout(() => {
    const selected = strip.querySelector('.date-chip.selected');
    if (selected) selected.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }, 50);
}

// ============ DAY VIEW ============
function renderDay() {
  const d = state.selectedDate;
  const dayKey = fmtDateKey(d);

  document.getElementById('dayTitle').textContent = isToday(d) ? 'Heute' : WEEKDAYS[d.getDay()];
  document.getElementById('daySubtitle').textContent = fmtDateLong(d);
  document.getElementById('headerMeta').textContent = fmtMonth(d).toUpperCase();
  document.getElementById('todayJump').style.display = isToday(d) ? 'none' : 'inline-flex';

  renderDateStrip();
  renderDayCapacity(d);

  // Fix Team
  const fixList = document.getElementById('staffListFix');
  fixList.innerHTML = '';
  let fixFilled = 0;
  state.team.fix.forEach(name => {
    const entry = getEntry(dayKey, name);
    if (entry) fixFilled++;
    fixList.appendChild(buildStaffCard(name, 'fix', entry, d));
  });
  document.getElementById('countFix').textContent = `${fixFilled} / ${state.team.fix.length}`;

  // Head of Content
  const headList = document.getElementById('staffListHead');
  headList.innerHTML = '';
  state.team.head.forEach(name => {
    const entry = getEntry(dayKey, name);
    headList.appendChild(buildStaffCard(name, 'head', entry, d));
  });

  // Freelance
  const flList = document.getElementById('staffListFreelance');
  flList.innerHTML = '';
  state.team.freelance.forEach(name => {
    const entry = getEntry(dayKey, name);
    if (entry) {
      flList.appendChild(buildStaffCard(name, 'freelance', entry, d));
    }
  });
  // Ex-Mitarbeiter mit Eintrag an dem Tag auch zeigen (historisch)
  if (state.team.ex) {
    state.team.ex.forEach(name => {
      const entry = getEntry(dayKey, name);
      if (entry) flList.appendChild(buildStaffCard(name, 'ex', entry, d));
    });
  }
  const emptyCard = document.createElement('div');
  emptyCard.className = 'staff-card is-empty is-freelance';
  emptyCard.innerHTML = `
    <div class="staff-card-head">
      <div class="staff-card-name-wrap">
        <div class="staff-avatar" style="background: var(--g700); color: var(--g400);">+</div>
        <div>
          <div class="staff-name" style="color: var(--g400);">Freelancer einsetzen</div>
        </div>
      </div>
    </div>
  `;
  emptyCard.onclick = () => openFreelanceModal(d);
  flList.appendChild(emptyCard);
}

function renderDayCapacity(d) {
  // Tages-Auslastung: wie viele Fix-Mitarbeiter (Giovanni, Jonas, Senad, Aksel) sind eingeteilt?
  // 4 Slots, jede ist ok/off/frei
  const dayKey = fmtDateKey(d);
  const segs = state.team.fix.map(name => getDayStatus(dayKey, name));
  const busy = segs.filter(s => s === 'ok').length;
  const off = segs.filter(s => s === 'off').length;
  const available = state.team.fix.length - off;
  const pct = available > 0 ? Math.round((busy / available) * 100) : 0;

  const wrap = document.getElementById('dayCapacity');
  if (isWeekend(d)) {
    wrap.innerHTML = `
      <div class="day-capacity-label">Wochenende</div>
      <div class="day-capacity-segments">
        ${segs.map(s => `<div class="day-capacity-seg off"></div>`).join('')}
      </div>
      <div class="day-capacity-pct" style="color: var(--g500);">—</div>
    `;
    return;
  }
  wrap.innerHTML = `
    <div class="day-capacity-label">Fix-Team</div>
    <div class="day-capacity-segments">
      ${segs.map(s => `<div class="day-capacity-seg ${s === 'ok' ? 'ok' : s === 'off' ? 'off' : ''}"></div>`).join('')}
    </div>
    <div class="day-capacity-pct">${busy}/${state.team.fix.length}</div>
  `;
}

function buildStaffCard(name, role, entry, date) {
  const card = document.createElement('div');
  card.className = 'staff-card';
  if (role === 'freelance') card.classList.add('is-freelance');
  if (role === 'ex') card.classList.add('is-freelance');
  if (!entry) card.classList.add('is-empty');
  if (entry && role === 'head' && entry.type === 'schnitt' && name === 'Matus') {
    card.classList.add('is-notfall');
  }

  const color = avatarColor(name);
  const init = initials(name);

  let roleBadge = '';
  if (role === 'head') roleBadge = '<span class="role-badge head">Head</span>';
  else if (role === 'freelance') roleBadge = '<span class="role-badge freelance">Freelance</span>';
  else if (role === 'ex') roleBadge = '<span class="role-badge ex">Ehemalig</span>';

  const isMatusNotfall = name === 'Matus' && entry?.type === 'schnitt';

  let entryHtml;
  if (entry) {
    const type = entry.type || detectType(entry.text);
    const label = typeLabel(type);
    const warning = isMatusNotfall ? '<div class="warning-badge">Notfall-Einsatz</div>' : '';
    entryHtml = `
      <div class="staff-entry">${escapeHtml(entry.text || '—')}</div>
      <div class="entry-meta">
        <div class="type-tag ${type}">${label}</div>
        ${warning}
      </div>
    `;
  } else {
    entryHtml = `<div class="staff-entry empty">Eintrag erfassen</div>`;
  }

  card.innerHTML = `
    <div class="staff-card-head">
      <div class="staff-card-name-wrap">
        <div class="staff-avatar" style="background: ${color};">${init}</div>
        <div>
          <div class="staff-name">${escapeHtml(name)}${roleBadge}</div>
        </div>
      </div>
    </div>
    ${entryHtml}
  `;

  if (role === 'ex') {
    card.style.cursor = 'default';
    card.onclick = () => showToast('Ehemalige Mitarbeiter: nur Anzeige');
  } else {
    card.onclick = () => openModal(date, name, role);
  }
  return card;
}

function openFreelanceModal(date) {
  const dayKey = fmtDateKey(date);
  const dayEntries = state.entries[dayKey] || {};
  const available = state.team.freelance.filter(f => !dayEntries[f]);
  if (available.length === 0) {
    if (confirm('Alle Freelancer aus dem Pool sind bereits eingeteilt. Neuen Freelancer hinzufügen?')) {
      addFreelance();
    }
    return;
  }
  openModal(date, available[0], 'freelance');
}

// ============ WEEK VIEW ============
function renderWeek() {
  const weekStart = getWeekStart(state.weekViewDate);
  const weekEnd = addDays(weekStart, 6);
  const kw = getWeekNumber(weekStart);

  document.getElementById('weekHeadline').textContent = `KW ${kw}`;
  const startMonth = MONTHS_SHORT[weekStart.getMonth()];
  const endMonth = MONTHS_SHORT[weekEnd.getMonth()];
  let sub;
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    sub = `${weekStart.getDate()}.–${weekEnd.getDate()}. ${startMonth} ${weekEnd.getFullYear()}`;
  } else {
    sub = `${weekStart.getDate()}. ${startMonth} – ${weekEnd.getDate()}. ${endMonth} ${weekEnd.getFullYear()}`;
  }
  document.getElementById('weekSubtitle').textContent = sub;
  document.getElementById('headerMeta').textContent = `KW ${kw} · ${weekEnd.getFullYear()}`;

  // Zusammenfassung: Anzahl Drehs / Schnitt / Freie Slots im Fix-Team
  let drehs = 0, schnitts = 0, freie = 0, ferien = 0;
  for (let i = 0; i < 5; i++) { // Mo-Fr
    const d = addDays(weekStart, i);
    const key = fmtDateKey(d);
    state.team.fix.forEach(name => {
      const e = getEntry(key, name);
      if (!e) { freie++; return; }
      const t = e.type || detectType(e.text);
      if (t === 'dreh') drehs++;
      else if (t === 'schnitt') schnitts++;
      else if (t === 'ferien' || t === 'feiertag') ferien++;
    });
  }

  document.getElementById('weekSummary').innerHTML = `
    <div class="week-summary-card accent">
      <div class="week-summary-label">Drehs</div>
      <div class="week-summary-value">${drehs}</div>
      <div class="week-summary-sub">Fix-Team Mo–Fr</div>
    </div>
    <div class="week-summary-card">
      <div class="week-summary-label">Schnitt</div>
      <div class="week-summary-value">${schnitts}</div>
      <div class="week-summary-sub">Fix-Team Mo–Fr</div>
    </div>
    <div class="week-summary-card ${freie > 5 ? 'warn' : ''}">
      <div class="week-summary-label">Frei</div>
      <div class="week-summary-value">${freie}</div>
      <div class="week-summary-sub">offene Slots</div>
    </div>
  `;

  // Heatmap-Grid
  const grid = document.getElementById('weekGrid');
  grid.innerHTML = '';

  // Header-Zeile
  grid.appendChild(makeWeekCell('', 'head'));
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const cell = makeWeekCell('', 'head');
    if (isToday(d)) cell.classList.add('today');
    if (isWeekend(d)) cell.classList.add('weekend');
    cell.innerHTML = `<div class="wd-name">${WEEKDAYS_SHORT[d.getDay()]}</div><div class="wd-num">${d.getDate()}</div>`;
    grid.appendChild(cell);
  }

  // Pro Person eine Zeile (Fix + Head + nur Freelancer mit Einträgen diese Woche)
  const allPeople = [...state.team.fix, ...state.team.head];

  // Freelancer mit Einträgen diese Woche
  const flWithEntries = new Set();
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const key = fmtDateKey(d);
    if (state.entries[key]) {
      Object.keys(state.entries[key]).forEach(p => {
        if (state.team.freelance.includes(p) || (state.team.ex && state.team.ex.includes(p))) {
          flWithEntries.add(p);
        }
      });
    }
  }
  Array.from(flWithEntries).forEach(p => allPeople.push(p));

  allPeople.forEach(name => {
    // Person-Label
    const labelCell = makeWeekCell('', 'person-label');
    const role = getRoleOf(name);
    const shortName = name.length > 7 ? name.substring(0, 6) + '.' : name;
    labelCell.innerHTML = `
      <div class="week-avatar" style="background: ${avatarColor(name)};">${initials(name)}</div>
      <div class="person-name">${escapeHtml(shortName)}</div>
    `;
    grid.appendChild(labelCell);

    // 7 Tageszellen
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const key = fmtDateKey(d);
      const cell = makeWeekCell('', 'day-cell');
      if (isWeekend(d)) cell.classList.add('weekend');

      const status = getDayStatus(key, name);
      const entry = getEntry(key, name);

      let icon = '';
      if (status === 'ok') {
        const t = entry.type || detectType(entry.text);
        if (t === 'dreh') {
          cell.classList.add('ok');
          icon = 'D';
        } else if (t === 'schnitt') {
          cell.classList.add('warn');
          icon = 'S';
          if (name === 'Matus') icon = '⚠';
        } else {
          cell.classList.add('ok');
          icon = '•';
        }
      } else if (status === 'off') {
        cell.classList.add('off');
        const t = entry.type || detectType(entry.text);
        if (t === 'ferien') icon = 'F';
        else if (t === 'feiertag') icon = '★';
        else icon = '–';
      }
      // status === 'frei' → keine Klasse, default frei

      if (icon) {
        cell.innerHTML = `<span class="cell-icon">${icon}</span>`;
      }
      // Tooltip bei Eintrag
      if (entry) {
        attachTooltipEvents(cell, entry, name);
      }
      if (role === 'ex') {
        cell.style.cursor = 'default';
      } else {
        cell.onclick = () => {
          if (suppressNextClick) {
            suppressNextClick = false;
            return;
          }
          hideTooltip();
          openModal(d, name, role);
        };
      }
      grid.appendChild(cell);
    }
  });
}

function makeWeekCell(content, cls) {
  const c = document.createElement('div');
  c.className = `week-grid-cell ${cls}`;
  c.innerHTML = content;
  return c;
}

// ============ CAPACITY VIEW ============
function renderCapacity() {
  document.getElementById('headerMeta').textContent = 'AUSLASTUNG';

  // Range Pills
  const ranges = [
    { d: 7, label: '7 Tage' },
    { d: 14, label: '14 Tage' },
    { d: 30, label: '30 Tage' },
    { d: 60, label: '60 Tage' }
  ];
  const rangeWrap = document.getElementById('capacityRangePills');
  rangeWrap.innerHTML = '';
  ranges.forEach(r => {
    const pill = document.createElement('button');
    pill.className = 'pill' + (state.capacityRange === r.d ? ' active' : '');
    pill.textContent = r.label;
    pill.onclick = () => {
      state.capacityRange = r.d;
      renderCapacity();
    };
    rangeWrap.appendChild(pill);
  });

  const startDate = new Date();
  startDate.setHours(0,0,0,0);

  // Gesamt-Auslastung (Fix-Team)
  let totalWorkdays = 0, totalBusy = 0, totalOff = 0;
  state.team.fix.forEach(name => {
    const c = calcCapacity(name, startDate, state.capacityRange);
    totalWorkdays += c.workdays;
    totalBusy += c.busy;
    totalOff += c.off;
  });
  const totalAvail = totalWorkdays - totalOff;
  const totalPct = totalAvail > 0 ? Math.round((totalBusy / totalAvail) * 100) : 0;

  document.getElementById('capacitySummaryPct').textContent = `${totalPct}%`;
  document.getElementById('capacitySummaryDetail').textContent = `${totalBusy} von ${totalAvail} Slots belegt (${totalOff} abwesend)`;

  const bar = document.getElementById('capacitySummaryBar');
  bar.style.width = `${totalPct}%`;
  bar.classList.remove('warn','full');
  if (totalPct >= CAP_YELLOW) bar.classList.add('full');
  else if (totalPct >= CAP_GREEN) bar.classList.add('warn');

  // Pro Person
  const listDiv = document.getElementById('capacityList');
  listDiv.innerHTML = '';

  // Fix + Head + Freelancer (mit Einträgen im Range)
  const peopleData = [];
  [...state.team.fix, ...state.team.head].forEach(name => {
    peopleData.push({ name, role: getRoleOf(name), cap: calcCapacity(name, startDate, state.capacityRange) });
  });
  state.team.freelance.forEach(name => {
    const cap = calcCapacity(name, startDate, state.capacityRange);
    if (cap.busy > 0) peopleData.push({ name, role: 'freelance', cap });
  });

  peopleData.forEach(({ name, role, cap }) => {
    const card = document.createElement('div');
    card.className = `capacity-card ${cap.status}`;
    const pctClass = cap.status === 'full' ? 'full' : cap.status === 'warn' ? 'warn' : '';
    const fillClass = cap.status === 'full' ? 'full' : cap.status === 'warn' ? 'warn' : '';
    let roleBadge = '';
    if (role === 'head') roleBadge = '<span class="role-badge head">Head</span>';
    else if (role === 'freelance') roleBadge = '<span class="role-badge freelance">FL</span>';

    card.innerHTML = `
      <div class="capacity-card-head">
        <div class="capacity-card-name-wrap">
          <div class="staff-avatar" style="background: ${avatarColor(name)};">${initials(name)}</div>
          <div>
            <div class="capacity-card-name">${escapeHtml(name)} ${roleBadge}</div>
            <div style="font-size: 10px; color: var(--g500); margin-top: 2px;">${cap.busy} belegt · ${cap.free} frei · ${cap.off} abwesend</div>
          </div>
        </div>
        <div class="capacity-card-pct ${pctClass}">${cap.pct}%</div>
      </div>
      <div class="capacity-card-bar">
        <div class="capacity-card-bar-fill ${fillClass}" style="width: ${Math.min(cap.pct, 100)}%"></div>
      </div>
      <div class="capacity-breakdown">
        <div class="capacity-breakdown-item"><span class="capacity-breakdown-dot dot-dreh"></span><strong>${cap.dreh}</strong> Dreh</div>
        <div class="capacity-breakdown-item"><span class="capacity-breakdown-dot dot-schnitt"></span><strong>${cap.schnitt}</strong> Schnitt</div>
        ${cap.off > 0 ? `<div class="capacity-breakdown-item"><span class="capacity-breakdown-dot dot-off"></span><strong>${cap.off}</strong> Abwesend</div>` : ''}
      </div>
    `;
    listDiv.appendChild(card);
  });

  // Insights
  renderCapacityInsights(peopleData, startDate);
}

function renderCapacityInsights(peopleData, startDate) {
  const wrap = document.getElementById('capacityInsights');
  wrap.innerHTML = '';

  const fixData = peopleData.filter(p => p.role === 'fix');
  const insights = [];

  // Überlastete Personen (rot)
  const overloaded = fixData.filter(p => p.cap.status === 'full');
  overloaded.forEach(p => {
    insights.push({
      type: 'full',
      icon: '🔴',
      text: `<strong>${escapeHtml(p.name)}</strong> ist mit ${p.cap.pct}% überlastet. Aufgaben umverteilen oder Freelancer einsetzen.`
    });
  });

  // Enge Personen (gelb)
  const warned = fixData.filter(p => p.cap.status === 'warn');
  warned.forEach(p => {
    insights.push({
      type: 'warn',
      icon: '⚡',
      text: `<strong>${escapeHtml(p.name)}</strong> ist mit ${p.cap.pct}% knapp. Wenig Puffer.`
    });
  });

  // Matus Notfall-Check (immer anzeigen wenn vorhanden)
  const matus = peopleData.find(p => p.name === 'Matus');
  if (matus && matus.cap.schnitt > 0) {
    insights.push({
      type: 'warn',
      icon: '⚠️',
      text: `<strong>Matus</strong> ist für <strong>${matus.cap.schnitt}</strong> Schnitt-Einsatz/Einsätze als Notfall verplant.`
    });
  }

  // Gesamt-Status nur wenn auffällig (überlastet) oder bei wenig Auslastung
  if (fixData.length > 0) {
    const avgPct = Math.round(fixData.reduce((a, p) => a + p.cap.pct, 0) / fixData.length);
    if (avgPct >= CAP_YELLOW) {
      insights.unshift({
        type: 'full',
        icon: '🚨',
        text: `Fix-Team im Schnitt zu <strong>${avgPct}%</strong> ausgelastet. Hohe Engpass-Wahrscheinlichkeit.`
      });
    } else if (avgPct < 30) {
      insights.push({
        type: 'ok',
        icon: '✓',
        text: `Viel Kapazität im Fix-Team (${avgPct}%) – Raum für ungeplante Drehs.`
      });
    }
    // Zwischen 30-90% keine Meldung — das ist normaler Betrieb
  }

  if (insights.length === 0) {
    wrap.innerHTML = '<div class="empty-state">Alles im grünen Bereich – keine Auffälligkeiten.</div>';
    return;
  }

  insights.forEach(i => {
    const div = document.createElement('div');
    div.className = `capacity-insight ${i.type}`;
    div.innerHTML = `
      <div class="capacity-insight-icon">${i.icon}</div>
      <div>${i.text}</div>
    `;
    wrap.appendChild(div);
  });
}

// ============ MODAL ============
function openModal(date, staff, role) {
  state.editingDate = date;
  state.editingStaff = staff;
  state.editingRole = role;
  const dateKey = fmtDateKey(date);
  const existing = getEntry(dateKey, staff);

  document.getElementById('modalDateTitle').textContent = fmtDateShort(date);
  document.getElementById('modalEyebrow').textContent = existing ? 'Eintrag bearbeiten' : 'Neuer Eintrag';

  const staffSelect = document.getElementById('formStaff');
  staffSelect.innerHTML = '';
  let staffPool;
  if (role === 'fix') staffPool = state.team.fix;
  else if (role === 'head') staffPool = state.team.head;
  else if (role === 'freelance') staffPool = state.team.freelance;
  else staffPool = [...state.team.fix, ...state.team.head, ...state.team.freelance];

  staffPool.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === staff) opt.selected = true;
    staffSelect.appendChild(opt);
  });

  const type = existing?.type || (existing ? detectType(existing.text) : 'dreh');
  state.modalSelectedType = type;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  document.getElementById('formText').value = existing?.text || '';
  document.getElementById('formNotes').value = existing?.notes || '';
  document.getElementById('btnDelete').style.display = existing ? 'block' : 'none';

  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  state.editingDate = null;
  state.editingStaff = null;
  state.editingRole = null;
}

function saveModal() {
  const staff = document.getElementById('formStaff').value;
  const text = document.getElementById('formText').value.trim();
  const notes = document.getElementById('formNotes').value.trim();
  const type = state.modalSelectedType;

  if (!text && !['ferien','feiertag','kompensation'].includes(type)) {
    showToast('Bitte Beschreibung eintragen');
    return;
  }

  const dateKey = fmtDateKey(state.editingDate);
  if (staff !== state.editingStaff) {
    deleteEntry(dateKey, state.editingStaff);
  }

  let finalText = text || typeLabel(type);
  setEntry(dateKey, staff, { type, text: finalText, notes });
  closeModal();
  showToast('Gespeichert');

  const activeView = document.querySelector('.tab-btn.active').dataset.view;
  switchView(activeView);
}

function deleteModalEntry() {
  if (!confirm('Eintrag wirklich löschen?')) return;
  const dateKey = fmtDateKey(state.editingDate);
  deleteEntry(dateKey, state.editingStaff);
  closeModal();
  showToast('Eintrag gelöscht');
  const activeView = document.querySelector('.tab-btn.active').dataset.view;
  switchView(activeView);
}

// ============ MONTH VIEW ============
function renderMonth() {
  const d = state.monthViewDate;
  const year = d.getFullYear();
  const month = d.getMonth();

  document.getElementById('monthHeadline').textContent = fmtMonth(d);
  document.getElementById('monthNavTitle').textContent = fmtMonth(d);
  document.getElementById('headerMeta').textContent = fmtMonth(d).toUpperCase();

  const grid = document.getElementById('monthGrid');
  grid.innerHTML = '';
  ['MO','DI','MI','DO','FR','SA','SO'].forEach(wd => {
    const h = document.createElement('div');
    h.className = 'month-day-head';
    h.textContent = wd;
    grid.appendChild(h);
  });

  const firstDay = new Date(year, month, 1);
  let offset = firstDay.getDay() - 1;
  if (offset < 0) offset = 6;
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const empty = document.createElement('div');
    empty.className = 'month-day empty';
    grid.appendChild(empty);
  }

  let monthEntries = 0, monthDays = 0, monthDreh = 0;

  for (let day = 1; day <= lastDay; day++) {
    const cellDate = new Date(year, month, day);
    const key = fmtDateKey(cellDate);
    const wd = cellDate.getDay();
    const cell = document.createElement('div');
    cell.className = 'month-day';
    if (wd === 0 || wd === 6) cell.classList.add('weekend');
    if (isToday(cellDate)) cell.classList.add('today');
    if (isSameDay(cellDate, state.selectedDate)) cell.classList.add('selected');

    const entries = state.entries[key] || {};
    const entryCount = Object.keys(entries).length;
    if (entryCount > 0) {
      monthEntries += entryCount;
      monthDays++;
    }
    Object.values(entries).forEach(e => {
      if (e.type === 'dreh') monthDreh++;
    });

    // Bars: für jeden Fix-Mitarbeiter ein Segment, farbig nach Status
    let bars = '';
    state.team.fix.forEach(name => {
      const status = getDayStatus(key, name);
      let cls = '';
      if (status === 'ok') {
        const e = entries[name];
        const t = e.type || detectType(e.text);
        cls = (t === 'dreh') ? 'ok' : 'warn';
      } else if (status === 'off') cls = 'off';
      bars += `<div class="month-day-bar-seg ${cls}"></div>`;
    });

    cell.innerHTML = `
      <div class="month-day-num">${day}</div>
      <div class="month-day-bar">${bars}</div>
    `;

    cell.onclick = () => {
      state.selectedDate = cellDate;
      switchView('day');
    };
    grid.appendChild(cell);
  }

  document.getElementById('monthStatEntries').textContent = monthEntries;
  document.getElementById('monthStatDays').textContent = `an ${monthDays} Tagen`;
  document.getElementById('monthStatDreh').textContent = monthDreh;
}

// ============ STATS (in Setup) ============
function renderStats() {
  const pillsContainer = document.getElementById('statsMonthPills');
  pillsContainer.innerHTML = '';
  const monthsSet = new Set();
  Object.keys(state.entries).forEach(k => monthsSet.add(k.substring(0, 7)));
  const months = Array.from(monthsSet).sort().reverse();

  const allPill = document.createElement('button');
  allPill.className = `pill ${state.statsMonth === null ? 'active' : ''}`;
  allPill.textContent = 'Alle';
  allPill.onclick = () => { state.statsMonth = null; renderStats(); };
  pillsContainer.appendChild(allPill);

  months.forEach(m => {
    const [y, mo] = m.split('-');
    const label = `${MONTHS_SHORT[parseInt(mo)-1]} ${y.substring(2)}`;
    const pill = document.createElement('button');
    pill.className = `pill ${state.statsMonth === m ? 'active' : ''}`;
    pill.textContent = label;
    pill.onclick = () => { state.statsMonth = m; renderStats(); };
    pillsContainer.appendChild(pill);
  });

  const filteredEntries = [];
  Object.entries(state.entries).forEach(([dateKey, dayMap]) => {
    if (state.statsMonth && !dateKey.startsWith(state.statsMonth)) return;
    Object.entries(dayMap).forEach(([staff, entry]) => {
      filteredEntries.push({ dateKey, staff, entry });
    });
  });

  let total = 0, dreh = 0, schnitt = 0, ferien = 0;
  const staffCounts = {};
  const projectCounts = {};
  const matusNotfaelle = [];

  filteredEntries.forEach(({ dateKey, staff, entry }) => {
    total++;
    const type = entry.type || detectType(entry.text);
    if (type === 'dreh') dreh++;
    if (type === 'schnitt') schnitt++;
    if (type === 'ferien') ferien++;
    staffCounts[staff] = (staffCounts[staff] || 0) + 1;
    if (staff === 'Matus' && type === 'schnitt') matusNotfaelle.push({ dateKey, entry });

    const text = (entry.text || '').toLowerCase().trim();
    if (text && !['ferien','auffahrt','pfingsten','kompensation','karfreitag','ostermontag','pristina'].includes(text)) {
      let projName = text
        .replace(/^(dreh|schnitt|testimonial|korrektur|korrekturen|übersetzung|übersetzungen|anpassungen|hochformat)\s+/i, '')
        .replace(/\s+(dreh|schnitt|prio.*|\(.*\)|anpass.*|self.*|1:1|moodfilm.*|moodfim.*|vorbereitung|workshop|video|konzept|kor)/gi, '')
        .replace(/\s+/g, ' ').trim();

      const normalize = {
        'schweizer fleisch':'Schweizer Fleisch', 'schweizerfleisch':'Schweizer Fleisch',
        'schweizer fl':'Schweizer Fleisch', 'schw. fleisch':'Schweizer Fleisch',
        'economieuisse':'economiesuisse', 'economiesuisse':'economiesuisse',
        'übersetzige ilian':'Übersetzungen Ilian', 'übersetzungen ilian':'Übersetzungen Ilian',
        'ice-co':'Ice-co', 'frey & cie':'Frey & Cie', 'züger frischkäse':'Züger Frischkäse',
        'züger':'Züger Frischkäse', 'swissaccounting':'SwissAccounting',
        'swissaccounting 1':'SwissAccounting', 'swissaccounting schlussfeier':'SwissAccounting',
        'smzh':'smzh', 'swiss':'SWISS', 'spar':'SPAR', 'volenergy':'Volenergy',
        'softcarwash':'Softcarwash', 'sihlcity':'Sihlcity', 'burkhalter':'Burkhalter',
        'ifolor':'ifolor', 'blöchlinger':'Blöchlinger', 'smile':'Smile',
        'smile kor':'Smile', 'eniwa':'Eniwa', 'yuh':'Yuh', 'schenker storen':'Schenker Storen',
        'bamix':'Bamix', 'smg':'SMG', 'pinguin':'Pinguin', 'fitnesspark':'Fitnesspark',
        'oniko':'Oniko', 'a. vogel':'A. Vogel', 'a vogel':'A. Vogel',
        'securitas':'Securitas', 'meister schmuck':'Meister Schmuck', 'meister':'Meister Schmuck',
        'fabio blasi':'Fabio Blasi', 'pristina':'Pristina', 'brunch':'Brunch',
        'shoot smg':'SMG'
      };
      if (normalize[projName]) projName = normalize[projName];
      else if (projName.length > 2) projName = projName.charAt(0).toUpperCase() + projName.slice(1);
      if (projName.length > 2) projectCounts[projName] = (projectCounts[projName] || 0) + 1;
    }
  });

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDreh').textContent = dreh;
  document.getElementById('statSchnitt').textContent = schnitt;
  document.getElementById('statFerien').textContent = ferien;

  const staffStatsDiv = document.getElementById('staffStats');
  staffStatsDiv.innerHTML = '';
  const sortedStaff = [...state.team.fix, ...state.team.head, ...state.team.freelance, ...(state.team.ex || [])];
  const maxStaff = Math.max(...Object.values(staffCounts), 1);

  sortedStaff.forEach(staff => {
    const c = staffCounts[staff] || 0;
    if (c === 0) return;
    const pct = (c / maxStaff) * 100;
    const role = getRoleOf(staff);
    let roleBadge = '';
    if (role === 'head') roleBadge = '<span class="role-badge head" style="margin-left:0">Head</span>';
    else if (role === 'freelance') roleBadge = '<span class="role-badge freelance" style="margin-left:0">FL</span>';
    else if (role === 'ex') roleBadge = '<span class="role-badge ex" style="margin-left:0">Ehem.</span>';

    const row = document.createElement('div');
    row.className = 'stat-bar-row';
    row.innerHTML = `
      <div class="stat-bar-head">
        <div class="stat-bar-name-wrap">
          <div class="stat-bar-avatar" style="background: ${avatarColor(staff)};">${initials(staff)}</div>
          <div>
            <div class="stat-bar-name">${escapeHtml(staff)} ${roleBadge}</div>
          </div>
        </div>
        <div class="stat-bar-count"><strong>${c}</strong> Einträge</div>
      </div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${pct}%"></div></div>
    `;
    staffStatsDiv.appendChild(row);
  });

  const projStatsDiv = document.getElementById('projectStats');
  projStatsDiv.innerHTML = '';
  const sortedProjects = Object.entries(projectCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);
  if (sortedProjects.length === 0) {
    projStatsDiv.innerHTML = '<div class="empty-state">Noch keine Projekte erfasst.</div>';
  } else {
    const maxProj = sortedProjects[0][1];
    sortedProjects.forEach(([name, count], idx) => {
      const pct = (count / maxProj) * 100;
      const row = document.createElement('div');
      row.className = 'stat-bar-row';
      row.innerHTML = `
        <div class="stat-bar-head">
          <div class="stat-bar-name-wrap">
            <div class="stat-bar-avatar" style="background: var(--g700); color: var(--g300);">${idx + 1}</div>
            <div class="stat-bar-name">${escapeHtml(name)}</div>
          </div>
          <div class="stat-bar-count"><strong>${count}</strong>×</div>
        </div>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${pct}%"></div></div>
      `;
      projStatsDiv.appendChild(row);
    });
  }

  const matusDiv = document.getElementById('matusWarnings');
  matusDiv.innerHTML = '';
  if (matusNotfaelle.length === 0) {
    matusDiv.innerHTML = '<div class="empty-state" style="padding: 16px;">Keine Notfall-Einsätze in diesem Zeitraum.</div>';
  } else {
    matusNotfaelle.sort((a,b) => a.dateKey.localeCompare(b.dateKey));
    matusNotfaelle.forEach(({ dateKey, entry }) => {
      const dd = new Date(dateKey);
      const row = document.createElement('div');
      row.className = 'stat-bar-row';
      row.style.borderLeft = '3px solid var(--warn)';
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: var(--white); margin-bottom: 4px;">${escapeHtml(entry.text)}</div>
            <div style="font-size: 11px; color: var(--g400);">${fmtDateShort(dd)}</div>
          </div>
          <div class="warning-badge">Notfall</div>
        </div>
      `;
      matusDiv.appendChild(row);
    });
  }
}

// ============ SETTINGS ============
function renderSettings() {
  document.getElementById('headerMeta').textContent = 'SETUP';
  switchSetupTab(state.setupTab);
}

function switchSetupTab(tab) {
  state.setupTab = tab;
  document.querySelectorAll('#setupTabs .pill').forEach(p => p.classList.toggle('active', p.dataset.setup === tab));
  document.querySelectorAll('.setup-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`setup-${tab}`).classList.add('active');

  if (tab === 'stats') renderStats();
  if (tab === 'team') renderTeamPanel();
  if (tab === 'data') {}
}

function renderTeamPanel() {
  const installWrap = document.getElementById('installBannerWrap');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIOS && !isStandalone) {
    installWrap.innerHTML = `
      <div class="install-banner">
        <div class="install-banner-head">
          <div class="install-banner-icon">↑</div>
          <div class="install-banner-title">Zum Home-Bildschirm hinzufügen</div>
        </div>
        <div class="install-banner-desc">Tippe in Safari auf den Teilen-Button ↑ und wähle "Zum Home-Bildschirm" für die volle App-Erfahrung mit Notifications.</div>
      </div>`;
  } else if (!isStandalone) {
    installWrap.innerHTML = `
      <div class="install-banner">
        <div class="install-banner-head">
          <div class="install-banner-icon">⌂</div>
          <div class="install-banner-title">App installieren</div>
        </div>
        <div class="install-banner-desc">Im Browser-Menü "App installieren" oder "Zum Startbildschirm" wählen.</div>
      </div>`;
  } else {
    installWrap.innerHTML = '';
  }

  const notifStatus = document.getElementById('notifStatus');
  const enableBtn = document.getElementById('enableNotif');
  if (!('Notification' in window)) {
    notifStatus.textContent = 'Browser unterstützt keine Benachrichtigungen.';
    enableBtn.style.display = 'none';
  } else if (Notification.permission === 'granted' && state.notifEnabled) {
    notifStatus.innerHTML = '<span style="color: var(--teal);">● Aktiv</span>';
    enableBtn.textContent = 'Deaktivieren';
    enableBtn.classList.remove('active');
  } else if (Notification.permission === 'denied') {
    notifStatus.innerHTML = '<span style="color: var(--danger);">● Blockiert</span> · In den Browser-Einstellungen erlauben.';
    enableBtn.style.display = 'none';
  } else {
    notifStatus.textContent = '○ Inaktiv';
    enableBtn.textContent = 'Aktivieren';
    enableBtn.classList.add('active');
  }

  renderStaffMgmt('fix', 'staffMgmtFix');
  renderStaffMgmt('head', 'staffMgmtHead');
  renderStaffMgmt('freelance', 'staffMgmtFreelance');
  renderStaffMgmt('ex', 'staffMgmtEx');
}

function renderStaffMgmt(role, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const list = state.team[role] || [];
  if (list.length === 0) {
    container.innerHTML = `<div style="font-size: 12px; color: var(--g500); padding: 8px 4px;">Keine Einträge.</div>`;
    return;
  }
  list.forEach((name, idx) => {
    const row = document.createElement('div');
    row.className = 'staff-mgmt-row' + (role === 'freelance' ? ' freelance' : '') + (role === 'ex' ? ' ex' : '');
    row.innerHTML = `
      <div class="staff-mgmt-info">
        <div class="stat-bar-avatar" style="background: ${avatarColor(name)};">${initials(name)}</div>
        <div class="staff-mgmt-name">${escapeHtml(name)}</div>
      </div>
      <button class="icon-btn" data-idx="${idx}" data-role="${role}">✕</button>
    `;
    row.querySelector('button').onclick = () => removeStaff(role, idx);
    container.appendChild(row);
  });
}

function removeStaff(role, idx) {
  const name = state.team[role][idx];
  if (state.team[role].length === 1 && (role === 'fix' || role === 'head')) {
    showToast(`Mindestens eine Person in "${role}" nötig`);
    return;
  }
  if (confirm(`"${name}" entfernen? Bestehende Einträge bleiben.`)) {
    state.team[role].splice(idx, 1);
    saveTeam();
    renderTeamPanel();
    showToast('Entfernt');
  }
}

function addFix() {
  const name = prompt('Name des Videografen:');
  if (name && name.trim()) {
    state.team.fix.push(name.trim());
    saveTeam();
    renderTeamPanel();
    showToast('Hinzugefügt');
  }
}

function addFreelance() {
  const name = prompt('Name des Freelancers:');
  if (name && name.trim()) {
    state.team.freelance.push(name.trim());
    saveTeam();
    renderTeamPanel();
    showToast('Hinzugefügt');
  }
}

// ============ NOTIFICATIONS ============
async function toggleNotifications() {
  if (!('Notification' in window)) {
    showToast('Browser unterstützt keine Notifications');
    return;
  }
  if (state.notifEnabled) {
    state.notifEnabled = false;
    localStorage.setItem(NOTIF_KEY, '0');
    showToast('Notifications deaktiviert');
    renderTeamPanel();
    return;
  }
  if (Notification.permission === 'denied') {
    showToast('In Browser-Einstellungen erlauben');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    state.notifEnabled = true;
    localStorage.setItem(NOTIF_KEY, '1');
    try { new Notification('equipe Videoplaner', { body: 'Benachrichtigungen sind aktiv.', icon: 'icon-192.png' }); } catch(e) {}
    showToast('Notifications aktiviert');
  } else {
    showToast('Keine Berechtigung erteilt');
  }
  renderTeamPanel();
}

// ============ TOAST ============
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============ UTILS ============
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// ============ SAMPLE DATA LADEN ============
function loadHistoricalData() {
  if (Object.keys(state.entries).length > 0) {
    if (!confirm('Bestehende Daten werden überschrieben. Weitermachen?')) return;
  }
  if (typeof SAMPLE_DATA === 'undefined') {
    showToast('Sample-Daten nicht verfügbar');
    return;
  }
  state.entries = JSON.parse(JSON.stringify(SAMPLE_DATA));
  state.team = { ...DEFAULT_TEAM };
  saveEntries();
  saveTeam();
  state.selectedDate = new Date(2026, 4, 13);
  state.monthViewDate = new Date(2026, 4, 1);
  state.weekViewDate = new Date(2026, 4, 13);
  showToast(`${Object.keys(SAMPLE_DATA).length} Tage importiert`);
  switchView('day');
}

// ============ EXPORT / IMPORT ============
function exportData() {
  const data = {
    entries: state.entries,
    team: state.team,
    exported: new Date().toISOString(),
    version: 3
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equipe-videoplaner-${new Date().toISOString().substring(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Daten exportiert');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.entries) state.entries = data.entries;
      if (data.team) {
        state.team = { ...DEFAULT_TEAM, ...data.team };
        if (!state.team.ex) state.team.ex = [...DEFAULT_TEAM.ex];
      }
      saveEntries();
      saveTeam();
      showToast('Daten importiert');
      switchView('day');
    } catch(err) {
      showToast('Import fehlgeschlagen');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('WIRKLICH alle Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
  if (!confirm('Letzte Warnung: Alle Einträge gehen verloren.')) return;
  state.entries = {};
  saveEntries();
  showToast('Alle Daten gelöscht');
  switchView('day');
}

// ============ EVENTS ============
function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchView(btn.dataset.view);
  });

  document.getElementById('todayJump').onclick = () => {
    state.selectedDate = new Date();
    renderDay();
  };

  document.getElementById('prevMonth').onclick = () => {
    state.monthViewDate = new Date(state.monthViewDate.getFullYear(), state.monthViewDate.getMonth() - 1, 1);
    renderMonth();
  };
  document.getElementById('nextMonth').onclick = () => {
    state.monthViewDate = new Date(state.monthViewDate.getFullYear(), state.monthViewDate.getMonth() + 1, 1);
    renderMonth();
  };

  document.getElementById('prevWeek').onclick = () => {
    state.weekViewDate = addDays(getWeekStart(state.weekViewDate), -7);
    renderWeek();
  };
  document.getElementById('nextWeek').onclick = () => {
    state.weekViewDate = addDays(getWeekStart(state.weekViewDate), 7);
    renderWeek();
  };
  document.getElementById('weekToday').onclick = () => {
    state.weekViewDate = new Date();
    renderWeek();
  };

  document.getElementById('fabAdd').onclick = () => {
    const dayKey = fmtDateKey(state.selectedDate);
    const free = state.team.fix.find(s => !getEntry(dayKey, s)) || state.team.fix[0];
    openModal(state.selectedDate, free, 'fix');
  };

  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('btnCancel').onclick = closeModal;
  document.getElementById('btnSave').onclick = saveModal;
  document.getElementById('btnDelete').onclick = deleteModalEntry;
  document.getElementById('modalOverlay').onclick = (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  };

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.modalSelectedType = btn.dataset.type;
    };
  });

  document.querySelectorAll('#setupTabs .pill').forEach(p => {
    p.onclick = () => switchSetupTab(p.dataset.setup);
  });

  document.getElementById('enableNotif').onclick = toggleNotifications;
  document.getElementById('addFixBtn').onclick = addFix;
  document.getElementById('addFreelanceBtn').onclick = addFreelance;
  document.getElementById('exportBtn').onclick = exportData;
  document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  };
  document.getElementById('loadHistoryBtn').onclick = loadHistoricalData;
  document.getElementById('clearBtn').onclick = clearAllData;

  // Swipe für Tag-Navigation
  let touchStartX = 0, touchStartY = 0;
  const dayView = document.getElementById('view-day');
  dayView.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  dayView.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx > 0) state.selectedDate = addDays(state.selectedDate, -1);
      else state.selectedDate = addDays(state.selectedDate, 1);
      renderDay();
    }
  }, { passive: true });
}

// ============ INIT ============
function init() {
  loadState();

  if (Object.keys(state.entries).length === 0 && typeof SAMPLE_DATA !== 'undefined') {
    state.entries = JSON.parse(JSON.stringify(SAMPLE_DATA));
    state.team = { ...DEFAULT_TEAM };
    saveEntries();
    saveTeam();
  }

  state.selectedDate = new Date();
  state.monthViewDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
  state.weekViewDate = new Date();

  bindEvents();
  switchView('day');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
