/**
 * Seeds Firestore (emulator or real project).
 * Usage:
 *   Start emulators: npm run emulators
 *   In another terminal: npm run seed
 *
 * Uses FIRESTORE_EMULATOR_HOST when set; otherwise targets production (requires GOOGLE_APPLICATION_CREDENTIALS or gcloud).
 */
import admin from 'firebase-admin';
import {
  DEPARTMENTS,
  CLIENTS,
  VENUES,
  PERSONNEL,
  TRUCKS,
  TRUCK_ROUTES,
  EVENTS,
  TRAVEL_RECORDS,
  DOCUMENTS,
  EMAIL_TEMPLATES,
  RIDER_ITEMS,
  INVOICES,
  ACTIVITY_LOG,
} from './seed-collections.mjs';

const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-pld-pm';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn(
    '[seed] FIRESTORE_EMULATOR_HOST not set — writing to real project',
    projectId,
    '(set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 for local emulator)'
  );
} else {
  console.log('[seed] Using Firestore emulator:', process.env.FIRESTORE_EMULATOR_HOST);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

function dataWithoutId(row) {
  const { id: _id, ...rest } = row;
  return rest;
}

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.size) await batch.commit();
  console.log('[seed] cleared', name, snap.size);
}

async function setCollection(name, rows) {
  const batch = db.batch();
  for (const row of rows) {
    batch.set(db.collection(name).doc(row.id), dataWithoutId(row));
  }
  if (rows.length) await batch.commit();
  console.log('[seed] wrote', name, rows.length);
}

async function main() {
  const collections = [
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
  for (const c of collections) {
    await deleteCollection(c);
  }

  await setCollection('departments', DEPARTMENTS);
  await setCollection('clients', CLIENTS);
  await setCollection('venues', VENUES);
  await setCollection('personnel', PERSONNEL);
  await setCollection('trucks', TRUCKS);
  await setCollection('truckRoutes', TRUCK_ROUTES);
  await setCollection('events', EVENTS);
  await setCollection('travelRecords', TRAVEL_RECORDS);
  await setCollection('documents', DOCUMENTS);
  await setCollection('emailTemplates', EMAIL_TEMPLATES);
  await setCollection('riderItems', RIDER_ITEMS);
  await setCollection('invoices', INVOICES);

  const batch = db.batch();
  ACTIVITY_LOG.forEach((entry, i) => {
    batch.set(db.collection('activityLog').doc('al' + i), entry);
  });
  await batch.commit();
  console.log('[seed] wrote activityLog', ACTIVITY_LOG.length);
  console.log('[seed] done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
