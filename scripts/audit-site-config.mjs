import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const configFile = path.join(projectRoot, 'site.config.yaml');
const outputFile = path.join(projectRoot, 'script-output', 'site-config-coverage.json');

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && line[i - 1] !== '\\') {
      quote = quote === ch ? null : quote || ch;
      continue;
    }
    if (ch === '#' && !quote) return line.slice(0, i);
  }
  return line;
}

function countIndent(line) {
  return line.match(/^ */)?.[0].length || 0;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const body = value.slice(1, -1);
    return value.startsWith('"') ? JSON.parse(value) : body.replaceAll("''", "'");
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function hasNested(lines, startIndex, indent) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = stripComment(lines[i]).trimEnd();
    if (!line.trim()) continue;
    return countIndent(line) > indent;
  }
  return false;
}

function nextContainer(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const next = stripComment(lines[i]).trimEnd();
    if (!next.trim()) continue;
    return next.trim().startsWith('- ') ? [] : {};
  }
  return {};
}

function parseYaml(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = stripComment(lines[i]).trimEnd();
    if (!raw.trim()) continue;

    const indent = countIndent(raw);
    const content = raw.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();

    const parent = stack[stack.length - 1].value;

    if (content.startsWith('- ')) {
      if (!Array.isArray(parent)) throw new Error('YAML list item has no array parent at line ' + (i + 1));

      const itemText = content.slice(2).trim();
      if (!itemText) {
        const item = {};
        parent.push(item);
        stack.push({ indent, value: item });
        continue;
      }

      const pair = itemText.match(/^([^:]+):(?:\s+(.*)|\s*)$/);
      if (pair) {
        const item = {};
        const key = pair[1].trim();
        const rest = (pair[2] || '').trim();
        item[key] = rest ? parseScalar(rest) : {};
        parent.push(item);
        stack.push({ indent, value: item });
        if (!rest) stack.push({ indent: indent + 2, value: item[key] });
      } else {
        parent.push(parseScalar(itemText));
      }
      continue;
    }

    const match = content.match(/^([^:]+):(.*)$/);
    if (!match) throw new Error('Unsupported YAML line ' + (i + 1) + ': ' + content);

    const key = match[1].trim();
    const rest = match[2].trim();
    if (rest) {
      parent[key] = parseScalar(rest);
      continue;
    }

    const container = hasNested(lines, i + 1, indent) ? nextContainer(lines, i + 1) : {};
    if (Array.isArray(parent)) parent.push(container);
    else parent[key] = container;
    stack.push({ indent, value: container });
  }

  return root;
}

function collectLeafPaths(value, prefix = '', paths = new Set()) {
  if (Array.isArray(value)) {
    if (value.length === 0) paths.add(prefix + '[*]');
    for (const item of value) collectLeafPaths(item, prefix + '[*]', paths);
    return paths;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectLeafPaths(child, prefix ? prefix + '.' + key : key, paths);
    }
    return paths;
  }

  paths.add(prefix);
  return paths;
}

const coveredPaths = new Map([
  ['config.version', 'manifest metadata'],
  ['config.project', 'manifest metadata'],
  ['config.language', 'generated JS sets document language'],

  ['site.name', 'generated SEO metadata and structured data fallback'],
  ['site.title', 'generated document title fallback'],
  ['site.description', 'generated SEO metadata fallback'],
  ['site.author', 'generated author metadata'],
  ['site.url', 'generated canonical, robots, sitemap, absolute URLs'],
  ['site.favicon', 'generated favicon link'],

  ['seo.title', 'generated document, Open Graph, and Twitter titles'],
  ['seo.description', 'generated description, Open Graph, and Twitter descriptions'],
  ['seo.keywords[*]', 'generated keywords metadata'],
  ['seo.ogImage', 'generated Open Graph and Twitter image metadata'],
  ['seo.ogImageAlt', 'generated Open Graph and Twitter image alt metadata'],
  ['seo.structuredData.type', 'generated JSON-LD type'],
  ['seo.structuredData.name', 'generated JSON-LD name'],
  ['seo.structuredData.url', 'generated JSON-LD URL'],
  ['seo.structuredData.image', 'generated JSON-LD image'],
  ['seo.structuredData.description', 'generated JSON-LD description'],
  ['seo.structuredData.sameAs[*]', 'generated JSON-LD sameAs links'],
  ['seo.robots.allowIndexing', 'generated robots.txt policy'],
  ['seo.robots.sitemap', 'generated robots.txt sitemap line'],
  ['seo.robots.rules[*].userAgent', 'generated robots.txt user-agent rules'],
  ['seo.robots.rules[*].allow[*]', 'generated robots.txt allow rules'],
  ['seo.robots.rules[*].disallow[*]', 'generated robots.txt disallow rules'],
  ['seo.robots.aiCrawlers.disallow[*]', 'generated robots.txt AI crawler blocks'],
  ['seo.robots.notice.text', 'generated robots.txt notice'],
  ['seo.sitemap.enabled', 'controls sitemap.xml generation'],
  ['seo.sitemap.output', 'controls sitemap.xml output file'],
  ['seo.sitemap.urls[*].loc', 'generated sitemap URL loc'],
  ['seo.sitemap.urls[*].changefreq', 'generated sitemap URL changefreq'],
  ['seo.sitemap.urls[*].priority', 'generated sitemap URL priority'],

  ['navigation.brand.image', 'runtime navigation brand image'],
  ['navigation.brand.target', 'runtime navigation brand target'],
  ['navigation.brand.label', 'runtime navigation brand label'],
  ['navigation.items[*].label', 'runtime navigation link label'],
  ['navigation.items[*].target', 'runtime navigation link target'],

  ['hero.kicker', 'runtime hero kicker'],
  ['hero.title', 'runtime hero title'],
  ['hero.subtitle', 'runtime hero subtitle'],
  ['hero.background.video', 'runtime hero video source'],
  ['hero.background.crop.position', 'runtime hero object-position'],
  ['hero.background.crop.scale', 'runtime hero video scale variable'],

  ['about.copy.kicker', 'about card runtime copy'],
  ['about.copy.title', 'about card runtime copy'],
  ['about.copy.roles[*]', 'about card runtime copy'],
  ['about.copy.tags[*]', 'about card runtime copy'],
  ['about.copy.note', 'about card runtime copy'],
  ['about.copy.flipHint', 'about card flip hint'],
  ['about.badge.front', 'runtime about badge front image'],
  ['about.badge.back', 'runtime about badge back image'],

  ['interests.scene.background', 'runtime interests scene background'],
  ['interests.scene.title.en', 'runtime interests title'],
  ['interests.scene.title.cn', 'runtime interests title and aria label'],
  ['interests.music.entryTooltip', 'runtime interests music tooltip'],
  ['interests.music.vinyl', 'runtime interests vinyl image'],
  ['interests.music.tonearm', 'runtime interests tonearm image'],
  ['interests.music.character', 'runtime interests music character image'],
  ['interests.tv.frame', 'runtime interests TV frame'],
  ['interests.tv.slides[*].title', 'runtime interests TV slide metadata'],
  ['interests.tv.slides[*].image', 'runtime interests TV slide image'],
  ['interests.games.character', 'runtime interests game character image'],
  ['interests.games.items[*].title', 'runtime interests game item title'],
  ['interests.games.items[*].image', 'runtime interests game item image'],

  ['blog.kicker', 'runtime blog kicker'],
  ['blog.title', 'runtime blog title'],
  ['blog.lede', 'runtime blog lede'],
  ['blog.previewImage', 'runtime blog preview image'],
  ['blog.link.label', 'runtime blog link label'],
  ['blog.link.url', 'runtime blog link target'],

  ['travel.hero.titleLines[*]', 'runtime travel title lines'],
  ['travel.hero.subtitle[*]', 'runtime travel subtitle lines'],
  ['travel.hero.button', 'runtime travel button label'],
  ['travel.hero.video', 'runtime travel video source'],
  ['travel.gallery.title', 'runtime travel gallery title'],
  ['travel.gallery.folder', 'generator scans travel gallery folder'],

  ['portfolio.kicker', 'runtime portfolio kicker'],
  ['portfolio.title', 'runtime portfolio title'],
  ['portfolio.lede', 'runtime portfolio lede'],
  ['portfolio.photographerImage', 'runtime portfolio photographer image'],
  ['portfolio.projects[*].name', 'portfolio gallery runtime project name'],
  ['portfolio.projects[*].intro', 'portfolio gallery runtime project intro'],
  ['portfolio.projects[*].image', 'portfolio gallery runtime project image'],
  ['portfolio.projects[*].href', 'portfolio gallery runtime project link'],

  ['daily.book.binder', 'runtime daily binder image'],
  ['daily.book.arrow', 'runtime daily arrow image'],
  ['daily.campus.date', 'runtime daily campus copy'],
  ['daily.campus.title', 'runtime daily campus copy'],
  ['daily.campus.tags', 'runtime daily campus copy'],
  ['daily.campus.note', 'runtime daily campus copy'],
  ['daily.campus.background.left', 'runtime daily campus left background'],
  ['daily.campus.background.right', 'runtime daily campus right background'],
  ['daily.campus.images.seal', 'runtime daily campus image'],
  ['daily.campus.images.card', 'runtime daily campus image'],
  ['daily.campus.images.coder', 'runtime daily campus image'],
  ['daily.campus.images.sticker', 'runtime daily campus image'],
  ['daily.vibeCoding.caption', 'runtime daily vibe coding caption'],
  ['daily.vibeCoding.background.left', 'runtime daily vibe coding left background'],
  ['daily.vibeCoding.background.right', 'runtime daily vibe coding right background'],
  ['daily.vibeCoding.images.quotaComic', 'runtime daily vibe coding image'],
  ['daily.vibeCoding.images.dreamCloud', 'runtime daily vibe coding image'],
  ['daily.vibeCoding.images.gif', 'runtime daily vibe coding image'],
  ['daily.stock.title', 'runtime daily stock copy'],
  ['daily.stock.subtitle', 'runtime daily stock copy'],
  ['daily.stock.difficulty', 'runtime daily stock copy'],
  ['daily.stock.apologyTitle', 'runtime daily stock copy'],
  ['daily.stock.apologyLines[*]', 'runtime daily stock apology lines'],
  ['daily.stock.background.left', 'runtime daily stock left background'],
  ['daily.stock.background.right', 'runtime daily stock right background'],
  ['daily.stock.images.learn', 'runtime daily stock image'],
  ['daily.stock.images.question', 'runtime daily stock image'],
  ['daily.stock.images.capitalTrap', 'runtime daily stock image'],
  ['daily.stock.images.deliveryRider', 'runtime daily stock image'],
  ['daily.log.terminalUser', 'runtime daily log copy'],
  ['daily.log.kicker', 'runtime daily log copy'],
  ['daily.log.title', 'runtime daily log copy'],
  ['daily.log.dateTape', 'runtime daily log copy'],
  ['daily.log.note', 'runtime daily log copy'],
  ['daily.log.images.filmStrip', 'runtime daily log image'],
  ['daily.log.images.study', 'runtime daily log image'],
  ['daily.log.images.walkCard', 'runtime daily log image'],
  ['daily.log.images.archCard', 'runtime daily log image'],
  ['daily.log.images.filmCard', 'runtime daily log image'],

  ['continuation.title', 'runtime continuation title'],
  ['continuation.subtitle', 'runtime continuation subtitle'],
  ['continuation.quote', 'runtime continuation quote'],
  ['footer.record.text', 'runtime footer record text'],
  ['footer.record.url', 'runtime footer record link'],
  ['footer.copyright', 'runtime footer copyright'],

  ['music.player.autoplay', 'home music autoplay policy'],
  ['music.player.featuredTrack', 'generated and runtime featured track'],
  ['music.meting.api.primary', 'generated music meting primary API'],
  ['music.meting.api.fallback[*]', 'generated music meting fallback APIs'],
  ['music.sources.local.enabled', 'generated music local source toggle'],
  ['music.sources.local.tracks[*].id', 'generated local music track id'],
  ['music.sources.local.tracks[*].title', 'generated local music track title'],
  ['music.sources.local.tracks[*].artist', 'generated local music track artist'],
  ['music.sources.local.tracks[*].cover', 'generated local music track cover'],
  ['music.sources.local.tracks[*].audio', 'generated local music track audio'],
  ['music.sources.local.tracks[*].lyrics.type', 'generated local music lyrics source'],
  ['music.sources.local.tracks[*].lyrics.server', 'generated local music lyrics server'],
  ['music.sources.local.tracks[*].lyrics.id', 'generated local music lyrics id'],
  ['music.sources.network.enabled', 'generated music network source toggle'],
  ['music.sources.network.default', 'generated music default network source'],
  ['music.sources.network.playlists[*].id', 'generated network playlist id'],
  ['music.sources.network.playlists[*].type', 'generated network playlist type'],
  ['music.sources.network.playlists[*].source', 'generated network playlist source'],
  ['music.sources.network.playlists[*].enabled', 'generated network playlist toggle'],
  ['music.sources.network.playlists[*].server', 'generated network playlist meting server'],
]);

const config = parseYaml(await readFile(configFile, 'utf8'));
const paths = [...collectLeafPaths(config)].sort();
const covered = [];
const uncovered = [];

for (const configPath of paths) {
  const reason = coveredPaths.get(configPath);
  if (reason) covered.push({ path: configPath, reason });
  else uncovered.push({ path: configPath, reason: 'No coverage rule found for this YAML field.' });
}

const report = {
  generatedAt: new Date().toISOString(),
  configFile: path.relative(projectRoot, configFile).replaceAll('\\', '/'),
  totalLeafPaths: paths.length,
  coveredCount: covered.length,
  uncoveredCount: uncovered.length,
  uncovered,
  covered,
};

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('Audited ' + paths.length + ' config leaf paths.');
console.log('Covered: ' + covered.length);
console.log('Uncovered: ' + uncovered.length);
if (uncovered.length) {
  console.log('Uncovered paths:');
  for (const item of uncovered) console.log('- ' + item.path);
  process.exitCode = 1;
}
