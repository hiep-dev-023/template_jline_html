/**
 * build.js — Main build system for template_jline_html
 *
 * Features:
 *   - EJS + front-matter + layout → HTML
 *   - SCSS → CSS (with dependency graph, incremental compile)
 *   - JS copy (incremental)
 *   - Vendor copy (incremental)
 *   - Images: svg/gif/ico/webp copy, jpg/png → webp conversion
 *   - Videos: copy mp4/webm/ogg
 *   - Stale file removal
 *   - BrowserSync dev server (--watch mode)
 *   - Cross-platform paths (posix-normalized)
 */

import { resolve, dirname, basename, extname, relative, join, posix } from 'path';
import { fileURLToPath } from 'url';
import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  readdirSync, statSync, unlinkSync, rmSync,
} from 'fs';
import { readFile, writeFile, mkdir, cp, rm, stat } from 'fs/promises';
import ejs from 'ejs';
import matter from 'gray-matter';
import { compileString } from 'sass-embedded';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import sortMediaQueries from 'postcss-sort-media-queries';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src');
const DIST = resolve(ROOT, 'public');
const LAYOUTS_DIR = resolve(SRC, 'layouts');
const SCSS_DIR = resolve(SRC, 'assets', 'scss');
const JS_DIR = resolve(SRC, 'assets', 'js');
const IMAGES_DIR = resolve(SRC, 'assets', 'images');
const VIDEOS_DIR = resolve(SRC, 'assets', 'videos');
const VENDOR_DIR = resolve(SRC, 'assets', 'vendor');

const isWatch = process.argv.includes('--watch');


// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
/** Normalize path to use posix separators */
const norm = (p) => p.replace(/\\/g, '/');

/** Ensure directory exists */
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** Check if a file is newer than another */
function isNewer(src, dest) {
  try {
    const srcStat = statSync(src);
    const destStat = statSync(dest);
    return srcStat.mtimeMs > destStat.mtimeMs;
  } catch {
    return true; // dest doesn't exist
  }
}

/** Walk a directory recursively, returning file paths */
function walkSync(dir, filter) {
  const results = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkSync(fullPath, filter));
    } else if (!filter || filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Remove stale files in dest that don't have a corresponding source */
function removeStaleFiles(srcDir, destDir, opts = {}) {
  if (!existsSync(destDir)) return;
  const { transformExt } = opts;

  const srcFiles = new Set();
  for (const f of walkSync(srcDir)) {
    const rel = norm(relative(srcDir, f));
    srcFiles.add(rel);
    // Also add without extension for webp matching
    if (transformExt) {
      const ext = extname(rel);
      if (transformExt.from.includes(ext)) {
        srcFiles.add(rel.replace(ext, transformExt.to));
      }
    }
  }

  for (const f of walkSync(destDir)) {
    const rel = norm(relative(destDir, f));
    if (!srcFiles.has(rel)) {
      try {
        unlinkSync(f);
        console.log(`[clean] removed stale: ${rel}`);
      } catch { /* ignore */ }
    }
  }

  // Remove empty directories
  removeEmptyDirs(destDir);
}

/** Recursively remove empty directories */
function removeEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      removeEmptyDirs(join(dir, entry.name));
    }
  }
  // Re-check after cleaning subdirectories
  if (readdirSync(dir).length === 0 && dir !== DIST) {
    try {
      rmSync(dir, { force: true });
    } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────
// 1. EJS Templates
// ─────────────────────────────────────────────
function buildEjs(changedFile) {
  const ejsFiles = walkSync(SRC, (f) => {
    const ext = extname(f);
    const name = basename(f);
    const relPath = norm(relative(SRC, f));
    return ext === '.ejs' && !name.startsWith('_') && !relPath.startsWith('layouts/');
  });

  // If a specific file changed and it's not a partial/layout, only rebuild that file
  if (changedFile) {
    const changedNorm = norm(changedFile);
    const changedBase = basename(changedFile);
    const isPartialOrLayout = changedBase.startsWith('_') || changedNorm.includes('/layouts/');

    if (!isPartialOrLayout) {
      // Only rebuild the changed file
      renderEjsFile(changedFile);
      return;
    }
    // If partial/layout changed, rebuild all
  }

  for (const file of ejsFiles) {
    renderEjsFile(file);
  }
}

function renderEjsFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const { data: frontData, content } = matter(raw);

    // Calculate assetsDir (relative path to root)
    const relPath = norm(relative(SRC, filePath));
    const depth = relPath.split('/').length - 1;
    let assetsDir = './';
    for (let i = 0; i < depth; i++) {
      assetsDir += '../';
    }

    // Read layout
    const layoutName = frontData.layout || '_default';
    const layoutPath = resolve(LAYOUTS_DIR, `${layoutName}.ejs`);
    const layoutContent = readFileSync(layoutPath, 'utf8');

    // Render the page content first (inner EJS)
    const pageHtml = ejs.render(content, {
      file: { data: frontData, path: filePath },
      assetsDir,
      layoutsDir: LAYOUTS_DIR,
    }, {
      filename: filePath,
    });

    // Render the layout with the page content inserted
    const fullHtml = ejs.render(layoutContent, {
      file: { data: frontData, path: filePath },
      contents: pageHtml,
      assetsDir,
      layoutsDir: LAYOUTS_DIR,
    }, {
      filename: layoutPath,
    });

    // Write output
    const outPath = resolve(DIST, relPath.replace(/\.ejs$/, '.html'));
    ensureDir(dirname(outPath));
    writeFileSync(outPath, fullHtml, 'utf8');
    console.log(`[ejs] ${relPath} → ${norm(relative(DIST, outPath))}`);
  } catch (err) {
    console.error(`[ejs] Error processing ${filePath}:`, err.message);
  }
}

// ─────────────────────────────────────────────
// 2. SCSS → CSS
// ─────────────────────────────────────────────
const postcssPlugins = isWatch
  ? [autoprefixer({ cascade: false })]
  : [sortMediaQueries({ sort: 'mobile-first' }), autoprefixer({ cascade: false }), cssnano()];

async function buildScss(changedFile) {
  // Find all SCSS entry files (non-partial)
  let entryFiles;

  if (changedFile) {
    const changedAbs = resolve(changedFile);
    const changedBase = basename(changedFile);

    if (changedBase.startsWith('_')) {
      // Partial changed — find which entries depend on it
      entryFiles = findDependentEntries(changedAbs);
    } else {
      entryFiles = [changedAbs];
    }
  } else {
    entryFiles = walkSync(SCSS_DIR, (f) =>
      extname(f) === '.scss' && !basename(f).startsWith('_')
    );
  }

  for (const entry of entryFiles) {
    await compileScssFile(entry);
  }
}

async function compileScssFile(filePath) {
  try {
    const source = readFileSync(filePath, 'utf8');
    if (!source.trim() || /^{\\rtf/i.test(source)) return;

    const result = compileString(source, {
      url: new URL(`file:///${norm(filePath)}`),
      loadPaths: [SCSS_DIR],
      style: 'expanded',
      sourceMap: true,
    });

    // PostCSS processing
    const processed = await postcss(postcssPlugins).process(result.css, {
      from: filePath,
      map: { inline: false },
    });

    const rel = relative(SCSS_DIR, filePath);
    const cssPath = resolve(DIST, 'assets', 'css', rel.replace(/\.scss$/, '.css'));
    const mapPath = cssPath + '.map';
    ensureDir(dirname(cssPath));

    writeFileSync(cssPath, processed.css, 'utf8');
    if (processed.map) {
      writeFileSync(mapPath, processed.map.toString(), 'utf8');
    }
    console.log(`[scss] ${norm(rel)} → ${basename(cssPath)}`);
  } catch (err) {
    console.error(`[scss] Error compiling ${filePath}:`, err.message);
  }
}

/** Find SCSS entry files that depend on a given partial */
function findDependentEntries(changedPartial) {
  const allFiles = walkSync(SCSS_DIR, (f) => extname(f) === '.scss');
  const importRegex = /@(use|import|forward)\s+['"]([^'"]+)['"]/g;

  function resolveImport(importPath, fromDir) {
    const clean = importPath.replace(/\.(scss|sass)$/, '');
    const base = resolve(fromDir, clean);
    const candidates = [];

    for (const ext of ['.scss', '.sass']) {
      candidates.push(base + ext);
      candidates.push(join(dirname(base), '_' + basename(base) + ext));
    }
    candidates.push(join(base, '_index.scss'));
    candidates.push(join(base, 'index.scss'));

    for (const c of candidates) {
      if (existsSync(c)) return resolve(c);
    }
    return null;
  }

  function parseImports(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const imports = [];
      let match;
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(content)) !== null) {
        const imp = match[2];
        if (/^(sass:|http:|https:|url\()/i.test(imp)) continue;
        imports.push(imp);
      }
      return imports
        .map((p) => resolveImport(p, dirname(filePath)))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  const memo = new Map();
  function dependsOn(file, target) {
    const key = `${file}|${target}`;
    if (memo.has(key)) return memo.get(key);
    memo.set(key, false); // prevent circular
    const imports = parseImports(file);
    if (imports.some((imp) => resolve(imp) === resolve(target))) {
      memo.set(key, true);
      return true;
    }
    for (const imp of imports) {
      if (dependsOn(imp, target)) {
        memo.set(key, true);
        return true;
      }
    }
    return false;
  }

  const entries = [];
  for (const file of allFiles) {
    if (!basename(file).startsWith('_')) {
      if (resolve(file) === resolve(changedPartial) || dependsOn(file, changedPartial)) {
        entries.push(file);
      }
    }
  }
  memo.clear();
  return entries;
}

// ─────────────────────────────────────────────
// 3. JS Copy
// ─────────────────────────────────────────────
function buildJs(changedFile) {
  const destDir = resolve(DIST, 'assets', 'js');

  if (changedFile) {
    const rel = relative(JS_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    const src = readFileSync(changedFile);
    writeFileSync(dest, src);
    console.log(`[js] ${norm(rel)}`);
    return;
  }

  const files = walkSync(JS_DIR, (f) => extname(f) === '.js');
  for (const file of files) {
    const rel = relative(JS_DIR, file);
    const dest = resolve(destDir, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[js] ${norm(rel)}`);
    }
  }
  removeStaleFiles(JS_DIR, destDir);
}

// ─────────────────────────────────────────────
// 4. Vendor Copy
// ─────────────────────────────────────────────
function buildVendor(changedFile) {
  const destDir = resolve(DIST, 'assets', 'vendor');
  const vendorExts = ['.php', '.png', '.jpg', '.scss', '.css', '.js', '.svg', '.woff', '.woff2', '.ttf', '.eot'];

  if (changedFile) {
    const rel = relative(VENDOR_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, readFileSync(changedFile));
    console.log(`[vendor] ${norm(rel)}`);
    return;
  }

  const files = walkSync(VENDOR_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return vendorExts.includes(ext);
  });

  for (const file of files) {
    const rel = relative(VENDOR_DIR, file);
    const dest = resolve(destDir, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[vendor] ${norm(rel)}`);
    }
  }
  removeStaleFiles(VENDOR_DIR, destDir);
}

// ─────────────────────────────────────────────
// 5. Images (copy + WebP conversion)
// ─────────────────────────────────────────────
async function buildImages(changedFile) {
  const destDir = resolve(DIST, 'assets', 'images');
  ensureDir(destDir);

  const copyExts = ['.gif', '.svg', '.ico', '.webp'];
  const convertExts = ['.jpg', '.jpeg', '.png'];

  if (changedFile) {
    const ext = extname(changedFile).toLowerCase();
    const rel = relative(IMAGES_DIR, changedFile);

    if (copyExts.includes(ext)) {
      const dest = resolve(destDir, rel);
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(changedFile));
      console.log(`[images] copy: ${norm(rel)}`);
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const dest = resolve(destDir, webpRel);
      ensureDir(dirname(dest));
      await sharp(changedFile).webp({ quality: 90 }).toFile(dest);
      console.log(`[images] webp: ${norm(rel)} → ${norm(webpRel)}`);
    }
    return;
  }

  // Full build
  const allFiles = walkSync(IMAGES_DIR);

  for (const file of allFiles) {
    const ext = extname(file).toLowerCase();
    const rel = relative(IMAGES_DIR, file);

    if (copyExts.includes(ext)) {
      const dest = resolve(destDir, rel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        writeFileSync(dest, readFileSync(file));
        console.log(`[images] copy: ${norm(rel)}`);
      }
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const dest = resolve(destDir, webpRel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        await sharp(file).webp({ quality: 90 }).toFile(dest);
        console.log(`[images] webp: ${norm(rel)} → ${norm(webpRel)}`);
      }
    }
  }

  removeStaleFiles(IMAGES_DIR, destDir, {
    transformExt: { from: ['.jpg', '.jpeg', '.png'], to: '.webp' },
  });
}

// ─────────────────────────────────────────────
// 6. Videos Copy
// ─────────────────────────────────────────────
function buildVideos(changedFile) {
  const destDir = resolve(DIST, 'assets', 'videos');
  const videoExts = ['.mp4', '.webm', '.ogg'];

  if (!existsSync(VIDEOS_DIR)) return;

  if (changedFile) {
    const rel = relative(VIDEOS_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, readFileSync(changedFile));
    console.log(`[videos] ${norm(rel)}`);
    return;
  }

  const files = walkSync(VIDEOS_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return videoExts.includes(ext);
  });

  for (const file of files) {
    const rel = relative(VIDEOS_DIR, file);
    const dest = resolve(destDir, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[videos] ${norm(rel)}`);
    }
  }
  removeStaleFiles(VIDEOS_DIR, destDir);
}


// ─────────────────────────────────────────────
// Full Build
// ─────────────────────────────────────────────
async function fullBuild() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       Building template_jline_html   ║');
  console.log('╚══════════════════════════════════════╝\n');

  const start = Date.now();

  // Clean output
  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true, force: true });
  }
  ensureDir(DIST);

  // Run tasks
  buildEjs();
  await buildScss();
  buildJs();
  buildVendor();
  await buildImages();
  buildVideos();


  const elapsed = Date.now() - start;
  console.log(`\n✓ Build complete in ${elapsed}ms\n`);
}

// ─────────────────────────────────────────────
// Watch Mode
// ─────────────────────────────────────────────
async function startWatch() {
  // Full build first
  await fullBuild();

  // Dynamic import chokidar and browser-sync
  const { watch: chokidarWatch } = await import('chokidar');
  const browserSync = (await import('browser-sync')).default.create();

  browserSync.init({
    server: { baseDir: DIST },
    port: 8080,
    open: true,
    notify: false,
    ui: false,
  });

  // Debounce helper
  function debounce(fn, wait = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  const watchOpts = {
    cwd: ROOT,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  };

  function getAbs(filepath) {
    return resolve(ROOT, filepath);
  }

  // EJS watcher
  const ejsWatcher = chokidarWatch(SRC, watchOpts);

  ejsWatcher.on('change', debounce((filepath) => {
    if (!filepath.endsWith('.ejs')) return;
    console.log(`[watch:ejs] changed: ${norm(filepath)}`);
    buildEjs(getAbs(filepath));
    browserSync.reload();
  }));
  ejsWatcher.on('add', debounce((filepath) => {
    if (!filepath.endsWith('.ejs')) return;
    console.log(`[watch:ejs] added: ${norm(filepath)}`);
    buildEjs(getAbs(filepath));
    browserSync.reload();
  }));
  ejsWatcher.on('unlink', debounce((filepath) => {
    if (!filepath.endsWith('.ejs')) return;
    const rel = relative(SRC, getAbs(filepath));
    const htmlPath = resolve(DIST, rel.replace(/\.ejs$/, '.html'));
    try {
      unlinkSync(htmlPath);
      console.log(`[watch:ejs] removed: ${norm(rel)}`);
    } catch { /* ignore */ }
    removeEmptyDirs(DIST);
  }));

  // SCSS watcher
  const scssWatcher = chokidarWatch(SCSS_DIR, watchOpts);

  scssWatcher.on('change', debounce(async (filepath) => {
    if (!filepath.endsWith('.scss')) return;
    console.log(`[watch:scss] changed: ${norm(filepath)}`);
    await buildScss(getAbs(filepath));
    browserSync.reload('*.css');
  }));
  scssWatcher.on('add', debounce(async (filepath) => {
    if (!filepath.endsWith('.scss')) return;
    console.log(`[watch:scss] added: ${norm(filepath)}`);
    await buildScss(getAbs(filepath));
    browserSync.reload('*.css');
  }));
  scssWatcher.on('unlink', debounce((filepath) => {
    if (!filepath.endsWith('.scss')) return;
    const rel = relative(SCSS_DIR, getAbs(filepath));
    const name = basename(filepath);
    if (!name.startsWith('_')) {
      const cssFile = resolve(DIST, 'assets', 'css', rel.replace(/\.scss$/, '.css'));
      const mapFile = cssFile + '.map';
      try { unlinkSync(cssFile); } catch { /* ignore */ }
      try { unlinkSync(mapFile); } catch { /* ignore */ }
      console.log(`[watch:scss] removed CSS: ${basename(cssFile)}`);
    }
    removeEmptyDirs(resolve(DIST, 'assets', 'css'));
  }));

  // JS watcher
  const jsWatcher = chokidarWatch(JS_DIR, watchOpts);

  jsWatcher.on('change', debounce((filepath) => {
    if (!filepath.endsWith('.js')) return;
    console.log(`[watch:js] changed: ${norm(filepath)}`);
    buildJs(getAbs(filepath));
    browserSync.reload();
  }));
  jsWatcher.on('add', debounce((filepath) => {
    if (!filepath.endsWith('.js')) return;
    console.log(`[watch:js] added: ${norm(filepath)}`);
    buildJs(getAbs(filepath));
    browserSync.reload();
  }));
  jsWatcher.on('unlink', debounce((filepath) => {
    if (!filepath.endsWith('.js')) return;
    const rel = relative(JS_DIR, getAbs(filepath));
    const dest = resolve(DIST, 'assets', 'js', rel);
    try { unlinkSync(dest); } catch { /* ignore */ }
    console.log(`[watch:js] removed: ${norm(rel)}`);
    removeEmptyDirs(resolve(DIST, 'assets', 'js'));
  }));

  // Vendor watcher
  const vendorWatcher = chokidarWatch(VENDOR_DIR, watchOpts);

  const vendorExts = ['.php', '.png', '.jpg', '.scss', '.css', '.js', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  function isVendor(f) { return vendorExts.includes(extname(f).toLowerCase()); }

  vendorWatcher.on('change', debounce((filepath) => {
    if (!isVendor(filepath)) return;
    console.log(`[watch:vendor] changed: ${norm(filepath)}`);
    buildVendor(getAbs(filepath));
    browserSync.reload();
  }));
  vendorWatcher.on('add', debounce((filepath) => {
    if (!isVendor(filepath)) return;
    console.log(`[watch:vendor] added: ${norm(filepath)}`);
    buildVendor(getAbs(filepath));
    browserSync.reload();
  }));
  vendorWatcher.on('unlink', debounce((filepath) => {
    if (!isVendor(filepath)) return;
    const rel = relative(VENDOR_DIR, getAbs(filepath));
    const dest = resolve(DIST, 'assets', 'vendor', rel);
    try { unlinkSync(dest); } catch { /* ignore */ }
    console.log(`[watch:vendor] removed: ${norm(rel)}`);
    removeEmptyDirs(resolve(DIST, 'assets', 'vendor'));
  }));

  // Images watcher
  const imgWatcher = chokidarWatch(IMAGES_DIR, {
    cwd: ROOT,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const copyExts = ['.gif', '.svg', '.ico', '.webp'];
  const convertExts = ['.jpg', '.jpeg', '.png'];
  function isImage(f) { const e = extname(f).toLowerCase(); return copyExts.includes(e) || convertExts.includes(e); }

  imgWatcher.on('change', debounce(async (filepath) => {
    if (!isImage(filepath)) return;
    console.log(`[watch:images] changed: ${norm(filepath)}`);
    await buildImages(getAbs(filepath));
    browserSync.reload();
  }));
  imgWatcher.on('add', debounce(async (filepath) => {
    if (!isImage(filepath)) return;
    console.log(`[watch:images] added: ${norm(filepath)}`);
    await buildImages(getAbs(filepath));
    browserSync.reload();
  }));
  imgWatcher.on('unlink', debounce((filepath) => {
    if (!isImage(filepath)) return;
    const rel = relative(IMAGES_DIR, getAbs(filepath));
    const destDir = resolve(DIST, 'assets', 'images');
    // Try removing both original and webp versions
    const dest = resolve(destDir, rel);
    const webpDest = resolve(destDir, rel.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    try { unlinkSync(dest); } catch { /* ignore */ }
    try { unlinkSync(webpDest); } catch { /* ignore */ }
    console.log(`[watch:images] removed: ${norm(rel)}`);
    removeEmptyDirs(destDir);
  }));

  // Videos watcher (only if directory exists)
  if (existsSync(VIDEOS_DIR)) {
    const videoWatcher = chokidarWatch(VIDEOS_DIR, {
      cwd: ROOT,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    const videoExts = ['.mp4', '.webm', '.ogg'];
    function isVideo(f) { return videoExts.includes(extname(f).toLowerCase()); }

    videoWatcher.on('change', debounce((filepath) => {
      if (!isVideo(filepath)) return;
      console.log(`[watch:videos] changed: ${norm(filepath)}`);
      buildVideos(getAbs(filepath));
      browserSync.reload();
    }));
    videoWatcher.on('add', debounce((filepath) => {
      if (!isVideo(filepath)) return;
      console.log(`[watch:videos] added: ${norm(filepath)}`);
      buildVideos(getAbs(filepath));
      browserSync.reload();
    }));
    videoWatcher.on('unlink', debounce((filepath) => {
      if (!isVideo(filepath)) return;
      const rel = relative(VIDEOS_DIR, getAbs(filepath));
      const dest = resolve(DIST, 'assets', 'videos', rel);
      try { unlinkSync(dest); } catch { /* ignore */ }
      console.log(`[watch:videos] removed: ${norm(rel)}`);
      removeEmptyDirs(resolve(DIST, 'assets', 'videos'));
    }));
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║   Watching for changes on :8080...   ║');
  console.log('╚══════════════════════════════════════╝\n');
}

// ─────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────
if (isWatch) {
  startWatch();
} else {
  fullBuild();
}
