import { readdir, rename, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const travelDir = path.join(projectRoot, 'images', 'travel');
const dataFile = path.join(projectRoot, 'js', 'data', 'travel-gallery-data.js');
const galleryJsonFile = path.join(travelDir, 'gallery.json');
const outputDir = path.join(projectRoot, 'script-output');
const manifestFile = path.join(outputDir, 'travel-gallery-manifest.json');
const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

function padIndex(index) {
  return String(index + 1).padStart(2, '0');
}

function normalizeExt(ext) {
  return ext.toLowerCase() === '.jpeg' ? '.jpg' : ext.toLowerCase();
}

function jsString(value) {
  return JSON.stringify(value);
}

const entries = await readdir(travelDir, { withFileTypes: true });
const images = entries
  .filter((entry) => entry.isFile() && imageExts.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort(collator.compare);

if (images.length === 0) {
  throw new Error(`No travel images found in ${travelDir}`);
}

const staged = [];
for (const [index, name] of images.entries()) {
  const ext = normalizeExt(path.extname(name));
  const tempName = `__travel_tmp_${padIndex(index)}_${Date.now()}${ext}`;
  await rename(path.join(travelDir, name), path.join(travelDir, tempName));
  staged.push({ from: name, tempName, to: `travel-${padIndex(index)}${ext}` });
}

for (const item of staged) {
  await rename(path.join(travelDir, item.tempName), path.join(travelDir, item.to));
}

const gallery = staged.map((item, index) => ({
  src: `images/travel/${item.to}`,
  alt: `旅行照片 ${padIndex(index)}`,
}));

const dataSource = [
  'window.TRAVEL_GALLERY = [',
  ...gallery.map((item) => `  { src: ${jsString(item.src)}, alt: ${jsString(item.alt)} },`),
  '];',
  '',
].join('\n');

await mkdir(path.dirname(dataFile), { recursive: true });
await writeFile(dataFile, dataSource, 'utf8');
await writeFile(galleryJsonFile, JSON.stringify(gallery, null, 2) + '\n', 'utf8');

await mkdir(outputDir, { recursive: true });
await writeFile(
  manifestFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      travelDir: path.relative(projectRoot, travelDir).replaceAll('\\', '/'),
      dataFile: path.relative(projectRoot, dataFile).replaceAll('\\', '/'),
      galleryJsonFile: path.relative(projectRoot, galleryJsonFile).replaceAll('\\', '/'),
      count: gallery.length,
      files: staged.map(({ from, to }, index) => ({
        index: index + 1,
        from,
        to,
        src: gallery[index].src,
      })),
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log(`Generated ${gallery.length} travel gallery entries.`);
