/* ============================================
   Module: Theme Engine
   Depends on: state.js (none for theme itself)
   ============================================ */

/** Base palette when Theme Mode is Custom (editable in Settings → Appearance). */
const CUSTOM_PALETTE_DEFAULTS = {
  bgPrimary: '#0f1117',
  bgSecondary: '#161922',
  bgTertiary: '#1c2030',
  bgElevated: '#222639',
  textPrimary: '#e8eaf0',
  textSecondary: '#9ba1b4',
  textTertiary: '#6b7280',
};

/** Migrate old Solarized preset into Custom with equivalent colors. */
const SOLARIZED_TO_CUSTOM_PALETTE = {
  bgPrimary: '#002b36',
  bgSecondary: '#073642',
  bgTertiary: '#0a4050',
  bgElevated: '#0a4050',
  textPrimary: '#fdf6e3',
  textSecondary: '#93a1a1',
  textTertiary: '#657b83',
};

const THEME_DEFAULTS = {
  mode: 'dark',
  accent: '#3b82f6',
  radius: 0,
  fontSize: 14,
  density: 'comfortable',
  sidebarWidth: 260,
  fontFamily: 'Inter',
  customPalette: { ...CUSTOM_PALETTE_DEFAULTS },
};

const ACCENT_PRESETS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Lime', value: '#84cc16' },
];

const FONT_OPTIONS = ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'monospace'];

let themeSettings = { ...THEME_DEFAULTS, customPalette: { ...THEME_DEFAULTS.customPalette } };

function loadTheme() {
  try {
    const saved = localStorage.getItem('pm_theme');
    if (saved) {
      const p = JSON.parse(saved);
      themeSettings = {
        ...THEME_DEFAULTS,
        ...p,
        customPalette: { ...THEME_DEFAULTS.customPalette, ...(p.customPalette || {}) },
      };
      if (themeSettings.mode === 'solarized') {
        themeSettings.mode = 'custom';
        themeSettings.customPalette = {
          ...themeSettings.customPalette,
          ...SOLARIZED_TO_CUSTOM_PALETTE,
        };
        saveTheme();
      }
    }
  } catch (e) {}
  applyTheme();
}

function saveTheme() {
  try { localStorage.setItem('pm_theme', JSON.stringify(themeSettings)); } catch (e) {}
}

function setTheme(key, value) {
  if (key === 'customPalette' && value && typeof value === 'object' && !Array.isArray(value)) {
    themeSettings.customPalette = { ...themeSettings.customPalette, ...value };
  } else {
    themeSettings[key] = value;
  }
  saveTheme();
  applyTheme();
}

function resetTheme() {
  themeSettings = { ...THEME_DEFAULTS, customPalette: { ...THEME_DEFAULTS.customPalette } };
  saveTheme();
  applyTheme();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function adjustColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = v => Math.max(0, Math.min(255, v));
  const rr = clamp(r + amount).toString(16).padStart(2, '0');
  const gg = clamp(g + amount).toString(16).padStart(2, '0');
  const bb = clamp(b + amount).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

function applyTheme() {
  const root = document.documentElement;
  const s = themeSettings;
  const { r, g, b } = hexToRgb(s.accent);

  // Mode
  if (s.mode === 'dark') {
    root.style.setProperty('--bg-primary', '#0f1117');
    root.style.setProperty('--bg-secondary', '#161922');
    root.style.setProperty('--bg-tertiary', '#1c2030');
    root.style.setProperty('--bg-elevated', '#222639');
    root.style.setProperty('--bg-hover', '#262b3f');
    root.style.setProperty('--bg-active', '#2d3352');
    root.style.setProperty('--border-subtle', 'rgba(255,255,255,0.06)');
    root.style.setProperty('--border-default', 'rgba(255,255,255,0.1)');
    root.style.setProperty('--border-strong', 'rgba(255,255,255,0.15)');
    root.style.setProperty('--text-primary', '#e8eaf0');
    root.style.setProperty('--text-secondary', '#9ba1b4');
    root.style.setProperty('--text-tertiary', '#6b7280');
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.3)');
    root.style.setProperty('--shadow-md', '0 4px 12px rgba(0,0,0,0.4)');
    root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0,0,0,0.5)');
  } else if (s.mode === 'light') {
    root.style.setProperty('--bg-primary', '#f5f5f7');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--bg-tertiary', '#f0f0f2');
    root.style.setProperty('--bg-elevated', '#ffffff');
    root.style.setProperty('--bg-hover', '#e8e8ec');
    root.style.setProperty('--bg-active', '#dddde3');
    root.style.setProperty('--border-subtle', 'rgba(0,0,0,0.06)');
    root.style.setProperty('--border-default', 'rgba(0,0,0,0.12)');
    root.style.setProperty('--border-strong', 'rgba(0,0,0,0.18)');
    root.style.setProperty('--text-primary', '#1a1a2e');
    root.style.setProperty('--text-secondary', '#555566');
    root.style.setProperty('--text-tertiary', '#888899');
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.08)');
    root.style.setProperty('--shadow-md', '0 4px 12px rgba(0,0,0,0.1)');
    root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0,0,0,0.15)');
  } else if (s.mode === 'midnight') {
    root.style.setProperty('--bg-primary', '#020617');
    root.style.setProperty('--bg-secondary', '#0f172a');
    root.style.setProperty('--bg-tertiary', '#1e293b');
    root.style.setProperty('--bg-elevated', '#1e293b');
    root.style.setProperty('--bg-hover', '#334155');
    root.style.setProperty('--bg-active', '#475569');
    root.style.setProperty('--border-subtle', 'rgba(255,255,255,0.04)');
    root.style.setProperty('--border-default', 'rgba(255,255,255,0.08)');
    root.style.setProperty('--border-strong', 'rgba(255,255,255,0.12)');
    root.style.setProperty('--text-primary', '#f1f5f9');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--text-tertiary', '#64748b');
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.5)');
    root.style.setProperty('--shadow-md', '0 4px 12px rgba(0,0,0,0.6)');
    root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0,0,0,0.7)');
  } else if (s.mode === 'custom') {
    const p = { ...CUSTOM_PALETTE_DEFAULTS, ...(s.customPalette || {}) };
    root.style.setProperty('--bg-primary', p.bgPrimary);
    root.style.setProperty('--bg-secondary', p.bgSecondary);
    root.style.setProperty('--bg-tertiary', p.bgTertiary);
    root.style.setProperty('--bg-elevated', p.bgElevated);
    root.style.setProperty('--bg-hover', adjustColor(p.bgTertiary, 18));
    root.style.setProperty('--bg-active', adjustColor(p.bgTertiary, 36));
    const { r: br, g: bg, b: bb } = hexToRgb(p.bgPrimary);
    const lum = br * 0.299 + bg * 0.587 + bb * 0.114;
    const bmix = lum < 140 ? '255,255,255' : '0,0,0';
    root.style.setProperty('--border-subtle', `rgba(${bmix},0.06)`);
    root.style.setProperty('--border-default', `rgba(${bmix},0.1)`);
    root.style.setProperty('--border-strong', `rgba(${bmix},0.15)`);
    root.style.setProperty('--text-primary', p.textPrimary);
    root.style.setProperty('--text-secondary', p.textSecondary);
    root.style.setProperty('--text-tertiary', p.textTertiary);
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0,0,0,0.3)');
    root.style.setProperty('--shadow-md', '0 4px 12px rgba(0,0,0,0.4)');
    root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0,0,0,0.5)');
  }

  // Accent color
  root.style.setProperty('--accent-blue', s.accent);
  root.style.setProperty('--accent-blue-hover', adjustColor(s.accent, -25));
  root.style.setProperty('--accent-blue-muted', `rgba(${r},${g},${b},0.15)`);
  root.style.setProperty('--shadow-glow-blue', `0 0 20px rgba(${r},${g},${b},0.3)`);

  // Border radius
  root.style.setProperty('--radius-sm', s.radius + 'px');
  root.style.setProperty('--radius-md', Math.round(s.radius * 1.33) + 'px');
  root.style.setProperty('--radius-lg', s.radius * 2 + 'px');
  root.style.setProperty('--radius-xl', Math.round(s.radius * 2.67) + 'px');

  // Font size
  root.style.fontSize = s.fontSize + 'px';

  // Font family
  root.style.setProperty('font-family', `'${s.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`);
  document.body.style.fontFamily = `'${s.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

  // Sidebar width
  root.style.setProperty('--sidebar-width', s.sidebarWidth + 'px');

  // Density
  const densityScale = { compact: 0.75, comfortable: 1, spacious: 1.3 };
  root.style.setProperty('--density', densityScale[s.density] || 1);

  // Also update department colors if they were edited
  DEPARTMENTS.forEach(d => {
    // departments use their own color property, no CSS var needed
  });
}
