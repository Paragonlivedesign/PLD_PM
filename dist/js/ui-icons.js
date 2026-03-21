/* ============================================
   Module: UI Icons (customizable / emoji-free option)
   Depends on: none (loaded early)
   ============================================
   Companies can disable emoji or supply custom icons via Settings > Appearance > UI Icons.
   All defaults use Unicode escapes so encoding stays reliable.
   ============================================ */

const UI_ICONS_DEFAULTS = {
  // Theme mode (Settings)
  themeDark: '\uD83C\uDF19',
  themeLight: '\u2600\uFE0F',
  themeMidnight: '\uD83C\uDF0C',
  themeCustom: '\uD83C\uDFA8',
  // Profile tabs
  profilePersonal: '\uD83D\uDC64',
  profileSecurity: '\uD83D\uDD12',
  profileNotifications: '\uD83D\uDD14',
  profileActivity: '\uD83D\uDCDB',
  // Activity log
  activityLoggedIn: '\uD83D\uDD11',
  activityUpdatedEvent: '\uD83D\uDCDD',
  activityAssignedCrew: '\uD83D\uDC64',
  activityGeneratedDoc: '\uD83D\uDCC4',
  activityApprovedTravel: '\u2708\uFE0F',
  activityResolvedConflict: '\u26A0\uFE0F',
  activityCreatedEvent: '\uD83C\uDFAA',
  activityUpdatedBudget: '\uD83D\uDCB0',
  activityBookedHotel: '\uD83C\uDFE8',
  activityUploadedDoc: '\uD83D\uDCC1',
  activityInvitedUser: '\u2709\uFE0F',
  activitySettledEvent: '\u2705',
  // Travel types
  travelFlight: '\u2708\uFE0F',
  travelHotel: '\uD83C\uDFE8',
  travelSelfDrive: '\uD83D\uDE97',
  travelLocation: '\uD83D\uDCCD',
  // Integrations
  integrationSlack: '\uD83D\uDCAC',
  integrationQuickBooks: '\uD83D\uDCCA',
  integrationOutlook: '\uD83D\uDCC6',
  integrationDropbox: '\uD83D\uDCE6',
  integrationApi: '\uD83D\uDD0C',
  integrationLink: '\uD83D\uDD17',
  integrationGoogleCal: '\uD83D\uDCC5',
  integrationGoogleDrive: '\uD83D\uDCC1',
  integrationWebhooks: '\uD83D\uDD17',
  integrationGoogleDriveAlt: '\uD83D\uDCC1',
  integrationSlackAlt: '\uD83D\uDCAC',
  integrationQuickBooksAlt: '\uD83D\uDCCA',
  integrationOutlookAlt: '\uD83D\uDCC6',
  integrationDropboxAlt: '\uD83D\uDCE6',
  integrationApiAlt: '\uD83D\uDD0C',
  // Document templates
  templateCrewPack: '\uD83D\uDC65',
  templateDaySheet: '\uD83D\uDCDB',
  templateTrucking: '\uD83D\uDE9A',
  templateRooming: '\uD83C\uDFE8',
  templateTravelSummary: '\u2708\uFE0F',
  templateSettlement: '\uD83D\uDCB0',
  // Modals / actions
  uploadBrowse: '\uD83D\uDCC1',
  uploadSuccess: '\u2705',
  docPreview: '\uD83D\uDCC4',
  modalRemove: '\u2716',
  docDownload: '\u2193',
  docEmail: '\u2709',
  // Events / list placeholders
  crewEmpty: '\u2014',
  truck: '\uD83D\uDE9A',
  arrowRight: '\u2192',
  arrowLeft: '\u2190',
  arrowUp: '\u2191',
  arrowDown: '\u2193',
  bullet: '\u00B7',
  emDash: '\u2014',
  // Density (Settings)
  densityCompact: '\u2584',
  densityComfortable: '\u2584\u2584',
  densitySpacious: '\u2584\u2584\u2584',
};

let _uiIconsOverrides = null;
let _useEmojiIcons = true;

function loadUIIconsPrefs() {
  try {
    const raw = localStorage.getItem('pm_ui_icons');
    _uiIconsOverrides = raw ? JSON.parse(raw) : {};
    _useEmojiIcons = localStorage.getItem('pm_ui_icons_emoji') !== 'false';
  } catch (e) {
    _uiIconsOverrides = {};
    _useEmojiIcons = true;
  }
}

function saveUIIconsPrefs() {
  try {
    localStorage.setItem('pm_ui_icons', JSON.stringify(_uiIconsOverrides || {}));
  } catch (e) {}
}

function setUseEmojiIcons(use) {
  _useEmojiIcons = !!use;
  try { localStorage.setItem('pm_ui_icons_emoji', use ? 'true' : 'false'); } catch (e) {}
}

function getUseEmojiIcons() {
  return _useEmojiIcons;
}

function setUIIcon(key, value) {
  if (!_uiIconsOverrides) loadUIIconsPrefs();
  if (value === '' || value == null) delete _uiIconsOverrides[key];
  else _uiIconsOverrides[key] = value;
  saveUIIconsPrefs();
}

/**
 * Get the icon for a given key. Returns custom override, or default if useEmojiIcons, else ''.
 * @param {string} key - e.g. 'themeDark', 'travelFlight', 'crewEmpty'
 * @returns {string}
 */
function uiIcon(key) {
  if (!_uiIconsOverrides) loadUIIconsPrefs();
  if (_uiIconsOverrides && _uiIconsOverrides[key] !== undefined) return _uiIconsOverrides[key];
  if (!_useEmojiIcons) return '';
  return UI_ICONS_DEFAULTS[key] != null ? UI_ICONS_DEFAULTS[key] : '';
}

// Initialize on load
loadUIIconsPrefs();
