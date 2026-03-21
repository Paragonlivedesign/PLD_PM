/* ============================================
   Firebase bootstrap: Auth + Firestore + Storage
   Loads collections into global arrays defined in data.js
   ============================================ */

(function (global) {
  function useEmulators() {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  }

  async function loadCollection(db, name, targetArray) {
    const snap = await db.collection(name).get();
    targetArray.length = 0;
    snap.forEach(function (doc) {
      targetArray.push(Object.assign({ id: doc.id }, doc.data()));
    });
  }

  const PLD_PM_DATA = {
    ready: false,
    error: null,

    async init() {
      PLD_PM_DATA.error = null;

      if (typeof global.pldTryBootstrapFromSql === 'function') {
        try {
          const sqlOk = await global.pldTryBootstrapFromSql();
          if (sqlOk) {
            PLD_PM_DATA.ready = true;
            global.dispatchEvent(new CustomEvent('pld-data-ready'));
            global.dispatchEvent(new CustomEvent('pld-rest-events-synced'));
            return;
          }
        } catch (e) {
          console.warn('pldTryBootstrapFromSql', e);
        }
      }

      if (!global.PLD_FIREBASE_CONFIG || !global.PLD_FIREBASE_CONFIG.projectId) {
        throw new Error('Missing PLD_FIREBASE_CONFIG');
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(global.PLD_FIREBASE_CONFIG);
      }

      if (useEmulators()) {
        firebase.auth().useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
        firebase.firestore().useEmulator('127.0.0.1', 8080);
        firebase.storage().useEmulator('127.0.0.1', 9199);
      }

      await firebase.auth().signInAnonymously();

      const db = firebase.firestore();

      await loadCollection(db, 'departments', DEPARTMENTS);
      await loadCollection(db, 'clients', CLIENTS);
      await loadCollection(db, 'venues', VENUES);
      await loadCollection(db, 'personnel', PERSONNEL);
      await loadCollection(db, 'trucks', TRUCKS);
      await loadCollection(db, 'truckRoutes', TRUCK_ROUTES);
      await loadCollection(db, 'events', EVENTS);
      await loadCollection(db, 'travelRecords', TRAVEL_RECORDS);
      await loadCollection(db, 'documents', DOCUMENTS);
      await loadCollection(db, 'emailTemplates', EMAIL_TEMPLATES);
      await loadCollection(db, 'riderItems', RIDER_ITEMS);
      await loadCollection(db, 'invoices', INVOICES);

      const actSnap = await db.collection('activityLog').get();
      ACTIVITY_LOG.length = 0;
      actSnap.forEach(function (doc) {
        ACTIVITY_LOG.push(doc.data());
      });

      PLD_PM_DATA.ready = true;
      global.dispatchEvent(new CustomEvent('pld-data-ready'));

      if (typeof global.pldTrySyncEventsStackFromRest === 'function') {
        try {
          const used = await global.pldTrySyncEventsStackFromRest();
          if (used) {
            global.dispatchEvent(new CustomEvent('pld-rest-events-synced'));
          }
        } catch (e) {
          console.warn('pldTrySyncEventsStackFromRest', e);
        }
      }
    },

    async refresh() {
      await PLD_PM_DATA.init();
    },
  };

  global.PLD_PM_DATA = PLD_PM_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
