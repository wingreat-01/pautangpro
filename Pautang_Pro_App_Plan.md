# Pautang Pro — App Sketch Plan
**A pautang/lending ledger app for informal lenders, built for Google Play Store distribution**

---

## 🔨 Build Status (updated as we go)

**Currently: Week 1–2 of the roadmap (Section 11) — MVP feature build is complete, and several Phase 2 + packaging-prep items are done ahead of schedule.**

| Plan section | Item | Status |
|---|---|---|
| §3 MVP | Borrower management (add/edit/search) | ✅ Built |
| §3 MVP | Loan entry (principal, interest type, term, due date) | ✅ Built |
| §3 MVP | Payment logging + auto balance update | ✅ Built |
| §3 MVP | Dashboard (total out, due today, overdue, needs-attention list) | ✅ Built |
| §3 MVP | Reminders (local push notification) | ✅ Built — Notification API on due/overdue, plus best-effort periodic background sync in the service worker so it can fire even if the app hasn't been opened recently |
| §3 MVP | PIN/lock security | ✅ Built — 4-digit PIN screen with change-PIN flow in Settings |
| §3 MVP | Offline-first (IndexedDB) | ✅ Built |
| §7 Flow | Reports screen (monthly collections, overdue, top borrowers) | ✅ Built — pulled in early from Week 3 |
| §6 Architecture | Local-only decision locked in | ✅ Decided |
| §4 Phase 2 | Voice logging | ✅ Built, and now more than the original plan — a full multi-turn guided voice assistant (not just a one-shot mic-to-prefill). Tap the mic and it asks step-by-step questions for **New Borrower** and **New Pautang** (borrower, principal, interest, term, notes), reads back a summary, and lets you say "edit" or "mali" to fix one field before saving. Recognizes both English and Tagalog trigger phrases (e.g. "new pautang," "hihiram," "manghihiram," "babale"), and listening now tolerates a natural pause (~5s) instead of cutting off mid-sentence |
| §4 Phase 2 | Export to PDF/Excel | ✅ Built — full ledger export (PDF + Excel) from Settings, plus a per-borrower **Statement PDF** from the borrower detail screen |
| §4 Phase 2 | Cloud sync / shared account (Firebase) | ✅ Built — email/password sign-in, Firestore mirror + last-write-wins sync across devices (single-account only, not multi-user staff logins yet) |
| §8 Play Store | App icons, manifest.json, service worker | ✅ Built — 192/512/maskable icons, install manifest, and offline-caching service worker are all in place; this is groundwork for TWA packaging below, not the packaging itself |
| §8 Play Store | PWA → TWA packaging (PWABuilder) | ⬜ Not started — install assets are ready, but the actual TWA wrap hasn't been done |
| §8 Play Store | Play Console setup, privacy policy, store listing | ⬜ Not started — manifest also references 3 store screenshots that don't exist yet |
| §12 Open decisions | Pricing model (one-time/freemium/subscription) | ⬜ Still open |
| §12 Open decisions | Solo vs multi-user in v1 | ⬜ Still open |
| §12 Open decisions | Export to PDF/Excel in MVP or Phase 2 | ✅ Resolved by building it — see above |

**MVP feature list (Section 3) is fully built, and most of Phase 2 (§4) is done too.** What's left before Play Store packaging (§8) is mostly non-code: pricing decision, multi-user decision, store screenshots, and the actual TWA wrap.

---


## 1. Concept & Value Proposition

**One-liner:** "Track every pautang, every payment, every borrower — in your pocket."

**Problem it solves:** Most small-scale lenders (sari-sari store owners, 5-6 lenders, cooperative officers, informal moneylenders) still track loans in a notebook (*libreta*) or scattered GCash/messenger threads. This causes:
- Forgotten due dates and missed collections
- Disputes over amounts owed ("hindi ko naman ganyan kalaki utang")
- No visibility into total exposure/receivables
- No easy way to compute interest, penalties, or partial payments

**Pautang Pro** turns this into a clean digital ledger: add a borrower, log a loan, record payments, see balances — all offline-capable, all on their phone.

---

## 2. Target Users

| Persona | Description | Key Need |
|---|---|---|
| **Sari-sari store lender** | Extends "utang" to regular customers on top of store credit | Simple running balance per person |
| **5-6 lender** | Daily/weekly collection lender, interest-based | Due date tracking, collection lists, interest calc |
| **Informal salary loan lender** | Lends to co-workers/employees, payday deduction style | Payment schedules tied to payday |
| **Small lending office / cooperative staff** | Slightly more formal, multiple lenders under one entity | Multi-user access, reports for owner |

This mirrors the same customer base as your BIB Loans and warehouse/POS clients — Philippine SMB and informal-sector operators — but here you're selling **one packaged app** instead of building bespoke systems per client.

---

## 3. Core Feature Set (MVP)

1. **Borrower management**
   - Add/edit borrower (name, contact, photo optional, address)
   - Search/filter borrower list
2. **Loan (Pautang) entry**
   - Principal amount, date given, interest type (flat %, per month, none), due date/term
   - Auto-compute total payable
3. **Payment logging**
   - Partial or full payment entry, date, running balance auto-updates
   - Payment history per loan
4. **Ledger / Dashboard**
   - Total receivables (pera sa labas), overdue list, today's due collections
   - Per-borrower ledger view (loan history + payments, like a bank statement)
5. **Reminders**
   - Local push notification for due/overdue loans (no SMS cost — device-level notification)
6. **PIN/lock security**
   - App-level PIN lock (like your BIB Loans owner dashboard pattern) since this is sensitive financial data
7. **Offline-first**
   - Works with no internet; syncs when back online

## 4. Phase 2 Features (post-launch, possible premium tier)

- Multiple lenders/users under one account (staff logins)
- Export ledger to PDF/Excel (for records or disputes)
- SMS/GCash payment reminder templates (share to Messenger/SMS, not auto-send)
- Interest auto-computation presets (5-6 style, monthly %, add-on rate)
- Backup to Google Drive / cloud sync across devices
- Analytics: best-paying borrowers, default risk flags, monthly collection trends
- Multi-currency (for OFW-run lending) — low priority

---

## 5. Data Model

Even before deciding the backend, the entities are the same shape as your other loan systems:

```
BORROWERS
 - borrower_id, name, contact, address, photo_url, date_added, status

LOANS
 - loan_id, borrower_id, principal, interest_type, interest_rate,
   date_given, due_date, term, status (active/paid/overdue), notes

PAYMENTS
 - payment_id, loan_id, amount, date_paid, method (cash/gcash/maya), notes

USERS (if multi-user)
 - user_id, name, pin_hash, role (owner/staff), account_id

ACCOUNTS (multi-tenant boundary — see Section 6)
 - account_id, owner_name, subscription_status, device/install_id
```

This is structurally identical to your BIB Loans / roll inventory ledger pattern (parent record → child transactions → running balance) — just renamed for lending.

---

## 6. ⚠️ The Key Architecture Decision: GAS+Sheets vs. a Real Multi-Tenant Backend

Your existing stack (single-file HTML PWA + Google Apps Script + Google Sheets) works great for **bespoke client work** — one client, one Sheet, one GAS deployment, you control both ends.

**For a Play Store app sold to many strangers, this breaks down** in a few ways worth deciding on *now*:

| Approach | How it'd work | Pros | Cons |
|---|---|---|---|
| **A. Local-only (no backend)** | All data stored on-device (IndexedDB/localStorage), no server at all | Simplest, no GAS quota issues, no per-user setup, works offline by default, zero backend cost | No cross-device sync, no cloud backup unless you add one, data lost if phone lost/app uninstalled unless exported |
| **B. Each buyer connects their own Google Sheet** | App ships with "connect your Google account," creates a Sheet + Apps Script under *their* account (like a template they deploy) | Keeps your familiar stack, buyer owns their data, no server cost to you | Painful onboarding (non-technical lenders won't want to deploy Apps Script), fragile, hard to support at scale |
| **C. Centralized backend you host** (Firebase/Supabase + real DB) | One backend serves all customers, each has an account/login | Proper multi-tenant SaaS, easy onboarding, real subscriptions, cloud sync, scalable | New tech stack to learn, ongoing hosting cost, you now maintain a live service |

**Recommendation for a Play Store commercial app:** Start with **A (local-only)** for MVP — it matches how a notebook/ledger app is expected to behave, needs zero backend, and gets you to market fastest. Add **cloud backup/sync as a paid upgrade** later using either Firebase (cheap, scales, has a free tier) or Google Drive API (each user's own Drive — no server cost for you, similar spirit to your GAS pattern but user-owned).

Option B (your current pattern) is realistically too fragile for consumers you don't personally onboard — that pattern works because *you* are the one deploying it for each client.

---

## 7. Screen/Flow Sketch

```
[Splash/Onboarding]
   → Set up PIN → Set lender profile name
        ↓
[Dashboard]
   - Total Out (₱), Due Today, Overdue count
   - Quick actions: + New Borrower, + New Loan, + Log Payment
        ↓
[Borrower List] → [Borrower Ledger View]
   (search/filter)     - loan history, payment history, balance, "Add Payment" button
        ↓
[New Loan Form]
   - select/add borrower, amount, interest, term, due date
        ↓
[Reports]
   - overdue list, monthly collections, top borrowers
        ↓
[Settings]
   - PIN change, backup/export, theme, about/support
```

---

## 8. From PWA to Play Store

Since your BIB Loans research already covered this ground:

1. Build as a single-file HTML/JS PWA (your standard pattern) — but backend-light per Section 6.
2. Wrap using **PWABuilder** or **Bubblewrap** → generates a **TWA (Trusted Web Activity)** Android package.
3. Google Play Console setup: developer account (one-time $25 fee), app listing, screenshots, privacy policy (required — especially since this app stores personal financial data).
4. **Google Play Billing** integration if you want in-app purchases (e.g., unlock cloud sync, remove borrower limit) — this needs to go through Play Billing API, not a direct payment link, per Play Store policy.
5. Data safety form in Play Console — you'll need to disclose what data is collected (financial data, contact info) even if it's stored only on-device.

---

## 9. Monetization Options

| Model | Description |
|---|---|
| **Freemium** | Free up to N borrowers/loans, pay to unlock unlimited + cloud backup |
| **One-time purchase** | Simple ₱199–₱499 one-time unlock, appeals to lenders who dislike subscriptions |
| **Subscription** | ₱49–₱99/month for cloud sync + multi-device + reports — better recurring revenue but harder sell to this audience |

Given the target user (informal lenders, price-sensitive, subscription-averse), **one-time purchase or freemium with a paid backup tier** will likely convert better than subscription-only.

---

## 10. Compliance Notes (Philippines-specific)

- **Data Privacy Act (RA 10173):** You're storing borrowers' personal and financial data — need a clear privacy policy, and ideally data stays on-device or encrypted in transit if synced.
- This app is a **ledger/tracking tool**, not a lending platform — important to keep positioning clear (you're not facilitating loans, matching lenders/borrowers, or processing payments) to avoid falling under lending company / financing company regulatory scope (BSP/SEC lending rules apply to entities that *originate* loans, not personal record-keeping apps).
- Play Store review may flag any app that resembles a "loan app" — keep messaging as "personal ledger/tracker," similar to expense trackers, not a lending marketplace.

---

## 11. Suggested Build Roadmap

1. **Week 1–2:** Local-only MVP — borrower CRUD, loan entry, payment entry, dashboard, PIN lock (reuse patterns from BIB Loans PWA)
2. **Week 3:** Reports screen, offline storage polish (IndexedDB instead of localStorage for larger data)
3. **Week 4:** PWA → TWA packaging, Play Console setup, privacy policy, store listing assets
4. **Week 5:** Internal testing track → closed testing with a few real lender friends/contacts
5. **Week 6+:** Public launch, gather feedback, then build Phase 2 (cloud sync, multi-user) as paid upgrade

---

## 12. Open Decisions Before You Start Building

- [x] **Local-only vs. cloud-backed from day one?** → **Local-only for v1.** All data in IndexedDB on-device, no backend, no per-user Apps Script deployment. Cloud sync/backup is a Phase 2 paid upgrade (likely via Firebase or Google Drive API, decided later).
- [ ] One-time purchase vs. freemium vs. subscription?
- [ ] Solo lender only, or multi-user/staff accounts in scope for v1?
- [x] **Export-to-PDF/Excel in MVP or Phase 2?** → Built already (full ledger export + per-borrower statement PDF), ahead of the original Phase 2 timing.
