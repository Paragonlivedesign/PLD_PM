/**
 * After `vite build`, copy classic script bundles into dist/ (non-module JS is not rolled up).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

if (!fs.existsSync(dist)) {
  console.error('[copy-static-to-dist] dist/ missing — run vite build first');
  process.exit(1);
}

fs.cpSync(path.join(root, 'js'), path.join(dist, 'js'), { recursive: true });
fs.copyFileSync(path.join(root, 'data.js'), path.join(dist, 'data.js'));
const cssSrc = path.join(root, 'css');
const cssDst = path.join(dist, 'css');
if (fs.existsSync(cssSrc)) {
  fs.mkdirSync(cssDst, { recursive: true });
  fs.cpSync(cssSrc, cssDst, { recursive: true });
}
console.log('[copy-static-to-dist] copied js/, data.js, css/ → dist/');
