/* ============================================
   Firestore writes for events (compat SDK on window.firebase)
   ============================================ */

/** @returns {Promise<void>} */
async function persistEventFields(eventId, patch) {
  if (
    typeof window !== 'undefined' &&
    window.PLD_EVENTS_FROM_REST &&
    typeof window.pldPersistEventPatchViaApi === 'function'
  ) {
    if (Object.prototype.hasOwnProperty.call(patch, 'phase')) {
      return;
    }
    await window.pldPersistEventPatchViaApi(eventId, patch);
    return;
  }
  /** PostgreSQL catalog bootstrap — never write events to Firestore. */
  if (typeof window !== 'undefined' && window.PLD_DATA_FROM_REST) return;
  /** When API is canonical, do not mirror event fields to Firestore (avoids split-brain). */
  if (typeof window !== 'undefined' && window.PLD_API_BASE) return;
  if (!window.firebase || !firebase.apps.length) return;
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v;
  }
  if (!Object.keys(clean).length) return;
  try {
    await firebase.firestore().collection('events').doc(eventId).update(clean);
  } catch (e) {
    console.error('persistEventFields', eventId, e);
    if (typeof showToast === 'function') showToast('Could not save to cloud', 'error');
  }
}
