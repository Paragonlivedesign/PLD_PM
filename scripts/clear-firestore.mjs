/**
 * Deletes all app documents from Firestore (emulator or real project).
 * Usage (emulator):
 *   npm run emulators   # terminal 1
 *   npm run clear:firestore
 *
 * Uses FIRESTORE_EMULATOR_HOST when set; otherwise targets production (requires credentials).
 */
import admin from 'firebase-admin';

const COLLECTIONS = [
  'departments',
  'clients',
  'venues',
  'personnel',
  'trucks',
  'truckRoutes',
  'events',
  'travelRecords',
  'documents',
  'emailTemplates',
  'riderItems',
  'invoices',
  'activityLog',
];

const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-pld-pm';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn(
    '[clear] FIRESTORE_EMULATOR_HOST not set — deleting from real project',
    projectId,
    '(set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 for local emulator)'
  );
} else {
  console.log('[clear] Using Firestore emulator:', process.env.FIRESTORE_EMULATOR_HOST);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

/** Firestore batch max operations */
const BATCH = 450;

async function deleteCollection(name) {
  let total = 0;
  for (;;) {
    const snap = await db.collection(name).limit(BATCH).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  if (total) console.log('[clear] cleared', name, total);
}

async function main() {
  for (const c of COLLECTIONS) {
    await deleteCollection(c);
  }
  console.log('[clear] done (empty collections).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
