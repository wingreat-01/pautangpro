const CACHE_NAME = 'pautang-pro-v5'; // bumped to force update — cache-first fetch strategy below means the installed app keeps serving whatever was cached under the old name forever, otherwise
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './vendor/xlsx.full.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './vendor/firebase-app-compat.js',
  './vendor/firebase-auth-compat.js',
  './vendor/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});

/* =========================================================
   PERIODIC BACKGROUND SYNC — best effort only.
   Supported on some Chrome/Android installed-PWA setups; the
   OS/browser decides the actual interval, it is not guaranteed
   to fire on time or at all. This lets reminders check for due
   loans even if the app hasn't been opened in a while, on the
   devices where the browser allows it. Everywhere else, the
   in-app check on launch (see index.html) is what covers it.
   ========================================================= */

const DB_NAME = 'PautangProDB';
const DB_VERSION = 1;

function swOpenDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
function swGetAll(db, storeName){
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function swGet(db, storeName, key){
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function swPut(db, storeName, value){
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function swLoanTotal(loan){
  const p = Number(loan.principal) || 0;
  const rate = Number(loan.interestRate) || 0;
  if (loan.interestType === 'flat') return p + (p * rate / 100);
  if (loan.interestType === 'monthly') return p + (p * (rate / 100) * (Number(loan.termMonths) || 1));
  return p;
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'pautang-due-check') {
    event.waitUntil(runDueCheck());
  }
});

async function runDueCheck(){
  try{
    const db = await swOpenDB();
    const enabledRec = await swGet(db, 'settings', 'notificationsEnabled');
    if (!enabledRec || !enabledRec.value) return;

    const loans = await swGetAll(db, 'loans');
    const borrowers = await swGetAll(db, 'borrowers');
    const payments = await swGetAll(db, 'payments');
    const today = new Date().toISOString().slice(0,10);
    const notifiedRec = await swGet(db, 'settings', 'notifiedLoanKeys');
    const notified = new Set(notifiedRec ? notifiedRec.value : []);

    const due = [];
    for(const loan of loans){
      const total = swLoanTotal(loan);
      const paid = payments.filter(p=>p.loanId===loan.id).reduce((s,p)=>s+(Number(p.amount)||0),0);
      const balance = Math.max(0, total - paid);
      if(balance <= 0.004) continue;
      const isDueOrOverdue = (loan.dueDate === today) || (loan.dueDate && loan.dueDate < today);
      if(!isDueOrOverdue) continue;
      const key = loan.id + ':' + today;
      if(notified.has(key)) continue;
      const borrower = borrowers.find(b=>b.id===loan.borrowerId);
      due.push({ loan, borrower, balance, key, overdue: loan.dueDate < today });
    }
    if(due.length === 0) return;

    if(due.length === 1){
      const d = due[0];
      await self.registration.showNotification('Pautang Pro — ' + (d.overdue?'Overdue':'Due Today'), {
        body: `${d.borrower ? d.borrower.name : 'A borrower'} — balance due`,
        icon: 'icon-192.png',
        tag: d.key
      });
    } else {
      const overdueCount = due.filter(d=>d.overdue).length;
      await self.registration.showNotification('Pautang Pro — Collections Reminder', {
        body: `${due.length} loans need attention (${overdueCount} overdue). Open the app to review.`,
        icon: 'icon-192.png',
        tag: 'batch-' + today
      });
    }
    due.forEach(d => notified.add(d.key));
    const trimmed = new Set([...notified].filter(k => k.endsWith(today)));
    await swPut(db, 'settings', { key:'notifiedLoanKeys', value:[...trimmed] });
  }catch(err){
    // IndexedDB or notification access can fail in some background contexts — fail silently.
  }
}
