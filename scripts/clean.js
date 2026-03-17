/**
 * clean.js — Remove public output directory
 */
import { rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'public');

try {
  await rm(DIST, { recursive: true, force: true });
  console.log('[clean] public/ removed');
} catch {
  // Already clean
}
