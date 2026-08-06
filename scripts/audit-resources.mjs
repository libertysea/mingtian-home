import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputFile = path.join(projectRoot, 'script-output', 'resource-reference-audit.json');

const assetRoots = ['images', 'videos', 'music', 'models', 'fonts', 'vendor'];
const sourceRoots = ['index.html', 'site.config.yaml', 'robots.txt', 'sitemap.xml', 'css', 'js', 'music'];
const assetExts = new Set([
  '.apng', '.avif', '.gif', '.ico', '.jpg', '.jpeg', '.json', '.mp3', '.mp4', '.ogg',
  '.png', '.svg', '.ttf', '.wav', '.webm', '.webp', '.woff', '.woff2', '.glb', '.gltf',
  '.js',
]);
const sourceExts = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml', '.yaml', '.yml']);
const ignoredSourceDirs = new Set(['.git', 'node_modules']);
const retainedUnreferencedAssets = new Map([
  ['images/about/lanyard.png', 'about badge/lanyard related asset retained for badge effects'],
  ['models/about-card.glb', 'about badge 3D model retained for badge effects'],
  ['vendor/liquid1.min.js', 'book/page-flip related vendor asset retained for daily book effects'],
]);

function slash(value) {
  return value.replaceAll('\\', '/');
}

function isExternal(value) {
  return /^(?:https?:|data:|blob:|mailto:|tel:|#)/i.test(value);
}

function isAssetLike(value) {
  const clean = value.split(/[?#]/)[0];
  const ext = path.extname(clean).toLowerCase();
  return assetExts.has(ext) && assetRoots.some((root) => clean.startsWith(root + '/') || clean.startsWith('../' + root + '/'));
}

function normalizeReference(raw, fromFile) {
  if (!raw || isExternal(raw)) return null;
  let value = raw.trim().replace(/\\/g, '/').split(/[?#]/)[0];
  if (!value || value.startsWith('#') || value.startsWith('/')) return null;
  if (!isAssetLike(value)) return null;

  let absolute;
  if (assetRoots.some((root) => value === root || value.startsWith(root + '/'))) {
    absolute = path.join(projectRoot, value);
  } else {
    absolute = path.resolve(path.dirname(fromFile), value);
  }

  const relative = slash(path.relative(projectRoot, absolute));
  if (relative.startsWith('..')) return null;
  return relative;
}

async function listFiles(targets) {
  const files = [];

  async function walk(filePath) {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      if (ignoredSourceDirs.has(path.basename(filePath))) return;
      for (const entry of await readdir(filePath)) await walk(path.join(filePath, entry));
      return;
    }
    files.push(filePath);
  }

  for (const target of targets) {
    const filePath = path.join(projectRoot, target);
    try {
      await walk(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return files;
}

function collectReferences(text, filePath) {
  const refs = new Set();
  const patterns = [
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    /(?:src|href|poster)=["']([^"']+)["']/g,
    /["']((?:\.\.\/)*(?:images|videos|music|models|fonts|vendor)\/[^"'\s)]+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[2] || match[1];
      const normalized = normalizeReference(value, filePath);
      if (normalized) refs.add(normalized);
    }
  }

  return refs;
}

const sourceFiles = (await listFiles(sourceRoots))
  .filter((file) => sourceExts.has(path.extname(file).toLowerCase()))
  .filter((file) => !slash(path.relative(projectRoot, file)).startsWith('js/runtime/'));

const assetFiles = (await listFiles(assetRoots))
  .filter((file) => assetExts.has(path.extname(file).toLowerCase()))
  .map((file) => slash(path.relative(projectRoot, file)))
  .sort();

const referencedBy = new Map();
for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  const source = slash(path.relative(projectRoot, file));
  for (const reference of collectReferences(text, file)) {
    if (!referencedBy.has(reference)) referencedBy.set(reference, []);
    referencedBy.get(reference).push(source);
  }
}

const assetSet = new Set(assetFiles);
const referencedAssets = [...referencedBy.keys()].sort();
const missing = referencedAssets
  .filter((reference) => !assetSet.has(reference))
  .map((reference) => ({ path: reference, referencedBy: referencedBy.get(reference) }));
const retainedUnreferenced = assetFiles
  .filter((asset) => !referencedBy.has(asset) && retainedUnreferencedAssets.has(asset))
  .map((asset) => ({ path: asset, reason: retainedUnreferencedAssets.get(asset) }));
const unreferenced = assetFiles
  .filter((asset) => !referencedBy.has(asset))
  .filter((asset) => !retainedUnreferencedAssets.has(asset))
  .map((asset) => ({ path: asset }));

const report = {
  generatedAt: new Date().toISOString(),
  scannedSourceCount: sourceFiles.length,
  scannedAssetCount: assetFiles.length,
  referencedAssetCount: referencedAssets.length,
  missingCount: missing.length,
  missing,
  unreferencedCount: unreferenced.length,
  unreferenced,
  retainedUnreferencedCount: retainedUnreferenced.length,
  retainedUnreferenced,
  scannedSourceFiles: sourceFiles.map((file) => slash(path.relative(projectRoot, file))).sort(),
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('Scanned source files: ' + report.scannedSourceCount);
console.log('Scanned assets: ' + report.scannedAssetCount);
console.log('Referenced assets: ' + report.referencedAssetCount);
console.log('Missing references: ' + report.missingCount);
console.log('Unreferenced assets: ' + report.unreferencedCount);
console.log('Retained unreferenced assets: ' + report.retainedUnreferencedCount);
if (missing.length) {
  console.log('Missing resources:');
  for (const item of missing) console.log('- ' + item.path + ' <- ' + item.referencedBy.join(', '));
  process.exitCode = 1;
}
