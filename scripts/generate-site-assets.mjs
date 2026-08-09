import { readdir, rename, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const configFile = path.join(projectRoot, 'site.config.yaml');
const siteConfigFile = path.join(projectRoot, 'js', 'data', 'site-config.generated.js');
const musicTracksFile = path.join(projectRoot, 'js', 'data', 'music-tracks.generated.js');
const robotsFile = path.join(projectRoot, 'robots.txt');
const defaultSitemapFile = path.join(projectRoot, 'sitemap.xml');
const travelDataFile = path.join(projectRoot, 'js', 'data', 'travel-gallery-data.js');
const siteFontsFile = path.join(projectRoot, 'css', 'site-fonts.css');
const outputDir = path.join(projectRoot, 'script-output');
const manifestFile = path.join(outputDir, 'site-assets-manifest.json');

const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

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
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
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

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;

    if (content.startsWith('- ')) {
      if (!Array.isArray(parent)) {
        throw new Error('YAML list item has no array parent at line ' + (i + 1));
      }

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

function slash(value) {
  return value.replaceAll('\\', '/');
}

function trimSlash(value) {
  return value.replace(/\/+$/, '');
}

function absoluteUrl(siteUrl, assetPath) {
  if (!assetPath) return '';
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return trimSlash(siteUrl) + '/' + assetPath.replace(/^\/+/, '');
}

function padIndex(index) {
  return String(index + 1).padStart(2, '0');
}

function normalizeExt(ext) {
  return ext.toLowerCase() === '.jpeg' ? '.jpg' : ext.toLowerCase();
}

function fontFace(family, file, options = {}) {
  const format = options.format || (file.endsWith('.woff2') ? 'woff2' : 'truetype');
  const weight = options.weight || '400';
  const display = options.display || 'swap';
  return [
    '@font-face {',
    '  font-family: ' + JSON.stringify(family) + ';',
    '  src: url("../' + slash(file) + '") format("' + format + '");',
    '  font-weight: ' + weight + ';',
    '  font-style: normal;',
    '  font-display: ' + display + ';',
    '}',
    '',
  ].join('\n');
}

async function buildSiteFonts() {
  const fonts = [
    {
      family: 'Mingtian Hand Latin',
      file: 'fonts/segoe-script.ttf',
      weight: '400 700',
      aliases: ['Segoe Script'],
    },
    {
      family: 'Mingtian Brush SC',
      file: 'fonts/ma-shan-zheng-regular.ttf',
      weight: '400',
      aliases: ['STXingkai', 'KaiTi', 'Kaiti SC', 'STKaiti', 'FZShuTi', 'LiSu', 'STXinwei', 'YouYuan', '华文新魏', '方正舒体'],
    },
    {
      family: 'Mingtian Ending Serif',
      file: 'fonts/stzhongsong-bold.ttf',
      weight: '700 900',
      aliases: ['STZhongsong'],
    },
    {
      family: 'Mingtian Continuation Heavy',
      file: 'fonts/source-han-serif-sc-heavy.ttf',
      weight: '800 900',
      aliases: [],
    },
    {
      family: 'Georgia',
      file: 'fonts/georgia.ttf',
      weight: '400',
      aliases: [],
    },
    {
      family: 'Georgia',
      file: 'fonts/georgia-bold.ttf',
      weight: '700 800',
      aliases: [],
    },
    {
      family: 'Mingtian Ending Condensed',
      file: 'fonts/arial-narrow-regular.ttf',
      weight: '400',
      aliases: [],
    },
    {
      family: 'Mingtian Ending Condensed',
      file: 'fonts/arial-narrow-bold.ttf',
      weight: '700 800',
      aliases: [],
    },
  ];

  const faces = [
    '/*',
    '  Generated by scripts/generate-site-assets.mjs. Do not edit by hand.',
    '  The /fonts folder keeps the full local font inventory; this runtime CSS',
    '  only enables fonts currently needed by the page.',
    '*/',
    '',
  ];

  for (const item of fonts) {
    faces.push(fontFace(item.family, item.file, {
      weight: item.weight,
      format: item.file.endsWith('.woff2') ? 'woff2' : 'truetype',
    }));
    for (const alias of item.aliases || []) {
      faces.push(fontFace(alias, item.file, {
        weight: item.weight,
        format: item.file.endsWith('.woff2') ? 'woff2' : 'truetype',
      }));
    }
  }

  await mkdir(path.dirname(siteFontsFile), { recursive: true });
  await writeFile(siteFontsFile, faces.join('\n'), 'utf8');

  return {
    file: slash(path.relative(projectRoot, siteFontsFile)),
    enabledFamilies: fonts.map((item) => item.family),
    sourceFiles: fonts.map((item) => item.file),
    aliasCount: fonts.reduce((sum, item) => sum + (item.aliases || []).length, 0),
  };
}

async function buildTravelGallery(config) {
  const folder = (config.travel && config.travel.gallery && config.travel.gallery.folder) || 'images/travel';
  const travelDir = path.join(projectRoot, folder);
  const entries = await readdir(travelDir, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile() && imageExts.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort(collator.compare);

  if (images.length === 0) throw new Error('No travel images found in ' + travelDir);

  const timestamp = Date.now();
  const staged = [];
  for (const [index, name] of images.entries()) {
    const ext = normalizeExt(path.extname(name));
    const target = 'travel-' + padIndex(index) + ext;
    if (name === target) {
      staged.push({ from: name, tempName: name, to: target, unchanged: true });
      continue;
    }

    const tempName = '__travel_tmp_' + padIndex(index) + '_' + timestamp + ext;
    await rename(path.join(travelDir, name), path.join(travelDir, tempName));
    staged.push({ from: name, tempName, to: target, unchanged: false });
  }

  for (const item of staged) {
    if (!item.unchanged) await rename(path.join(travelDir, item.tempName), path.join(travelDir, item.to));
  }

  const gallery = staged.map((item, index) => ({
    src: slash(folder) + '/' + item.to,
    alt: '旅行照片 ' + padIndex(index),
  }));

  const dataSource = [
    'window.TRAVEL_GALLERY = [',
    ...gallery.map((item) => '  { src: ' + JSON.stringify(item.src) + ', alt: ' + JSON.stringify(item.alt) + ' },'),
    '];',
    '',
  ].join('\n');

  await mkdir(path.dirname(travelDataFile), { recursive: true });
  await writeFile(travelDataFile, dataSource, 'utf8');
  await writeFile(path.join(travelDir, 'gallery.json'), JSON.stringify(gallery, null, 2) + '\n', 'utf8');

  return {
    folder: slash(folder),
    count: gallery.length,
    files: staged.map(({ from, to }, index) => ({
      index: index + 1,
      from,
      to,
      src: gallery[index].src,
    })),
  };
}

async function buildSiteConfig(config) {
  const site = config.site || {};
  const seo = config.seo || {};
  const siteUrl = trimSlash(site.url || '');
  const title = seo.title || site.title || site.name || '';
  const description = seo.description || site.description || '';
  const keywords = Array.isArray(seo.keywords) ? seo.keywords.join(',') : '';
  const ogImage = absoluteUrl(siteUrl, seo.ogImage || '');
  const ogImageAlt = seo.ogImageAlt || '';
  const favicon = site.favicon || '';
  const language = config.config?.language || 'zh-CN';
  const structuredDataConfig = seo.structuredData && typeof seo.structuredData === 'object'
    ? seo.structuredData
    : null;
  const structuredData = structuredDataConfig ? {
    '@context': 'https://schema.org',
    '@type': structuredDataConfig.type || 'Person',
    name: structuredDataConfig.name || site.name || title,
    url: structuredDataConfig.url || siteUrl || undefined,
    image: structuredDataConfig.image ? absoluteUrl(siteUrl, structuredDataConfig.image) : undefined,
    description: structuredDataConfig.description || description || undefined,
    sameAs: Array.isArray(structuredDataConfig.sameAs) ? structuredDataConfig.sameAs : undefined,
  } : null;

  const runtimeConfig = { ...config, generatedAt: new Date().toISOString() };
  const source = [
    '// Generated by scripts/generate-site-assets.mjs. Do not edit by hand.',
    '(() => {',
    '  const config = ' + JSON.stringify(runtimeConfig, null, 2) + ';',
    '',
    '  window.SITE_CONFIG = config;',
    '  document.documentElement.lang = ' + JSON.stringify(language) + ';',
    '',
    '  const setAttr = (selector, attr, value) => {',
    '    if (!value) return;',
    '    const node = document.querySelector(selector);',
    '    if (node) node.setAttribute(attr, value);',
    '  };',
    '',
    "  const setContent = (selector, value) => setAttr(selector, 'content', value);",
    '  const siteUrl = ' + JSON.stringify(siteUrl) + ';',
    "  const pageUrl = siteUrl ? siteUrl + '/' : '';",
    '  const title = ' + JSON.stringify(title) + ';',
    '  const description = ' + JSON.stringify(description) + ';',
    '  const keywords = ' + JSON.stringify(keywords) + ';',
    '  const ogImage = ' + JSON.stringify(ogImage) + ';',
    '  const ogImageAlt = ' + JSON.stringify(ogImageAlt) + ';',
    '  const favicon = ' + JSON.stringify(favicon) + ';',
    '  const structuredData = ' + JSON.stringify(structuredData) + ';',
    '',
    '  if (title) document.title = title;',
    "  setContent('meta[name=\"description\"]', description);",
    "  setContent('meta[name=\"author\"]', config.site?.author);",
    "  setContent('meta[name=\"keywords\"]', keywords);",
    "  setAttr('link[rel=\"canonical\"]', 'href', pageUrl);",
    "  setAttr('link[rel=\"icon\"]', 'href', favicon);",
    "  setContent('meta[property=\"og:site_name\"]', config.site?.name);",
    "  setContent('meta[property=\"og:title\"]', title);",
    "  setContent('meta[property=\"og:description\"]', description);",
    "  setContent('meta[property=\"og:url\"]', pageUrl);",
    "  setContent('meta[property=\"og:image\"]', ogImage);",
    "  setContent('meta[property=\"og:image:alt\"]', ogImageAlt);",
    "  setContent('meta[name=\"twitter:title\"]', title);",
    "  setContent('meta[name=\"twitter:description\"]', description);",
    "  setContent('meta[name=\"twitter:image\"]', ogImage);",
    "  setContent('meta[name=\"twitter:image:alt\"]', ogImageAlt);",
    "  if (structuredData) {",
    "    const node = document.getElementById('site-structured-data');",
    "    if (node) node.textContent = JSON.stringify(structuredData);",
    "  }",
    '})();',
    '',
  ].join('\n');

  await mkdir(path.dirname(siteConfigFile), { recursive: true });
  await writeFile(siteConfigFile, source, 'utf8');

  return {
    file: slash(path.relative(projectRoot, siteConfigFile)),
    title,
    description,
    ogImage,
    ogImageAlt,
  };
}

function buildMetingUrl(baseUrl, meting) {
  if (!baseUrl || !meting) return '';
  const url = new URL(baseUrl);
  url.searchParams.set('server', meting.server || 'netease');
  url.searchParams.set('type', meting.type || 'url');
  url.searchParams.set('id', meting.id || meting.songId || '');
  return url.href;
}

function getMetingId(source) {
  const value = String(source || '');
  const match = value.match(/[?&]id=([^&#]+)/) || value.match(/(?:song|playlist)\D+(\d+)/);
  return match ? match[1] : value;
}

function normalizeTrack(track, options = {}) {
  const metingBase = options.metingBase || '';
  const featuredTrack = options.featuredTrack || '';
  const next = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    cover: track.cover,
    audio: track.audio || buildMetingUrl(metingBase, track.meting),
    hue: track.hue ?? 204,
    ratio: track.ratio ?? 1,
    span: track.span ?? 2,
    local: Boolean(options.local || track.local),
    featured: track.id === featuredTrack,
  };

  if (track.lyricSource) {
    next.lyricSource = track.lyricSource;
  } else if (track.lyrics?.type === 'meting' || track.lyrics?.source === 'meting') {
    next.lyricSource = {
      server: track.lyrics.server || track.lyrics.provider || 'netease',
      id: String(track.lyrics.id || track.lyrics.songId || ''),
    };
  }

  return next;
}

async function readMusicJson(source, metingBase, featuredTrack) {
  const sourceFile = path.join(projectRoot, source);
  const data = JSON.parse(await readFile(sourceFile, 'utf8'));
  const rawTracks = Array.isArray(data) ? data : data.tracks || [];
  return rawTracks.map((track) => normalizeTrack(track, { metingBase, featuredTrack }));
}

async function readMetingPlaylist(playlist, metingBase, featuredTrack) {
  if (!metingBase || !playlist.source) return [];
  const url = new URL(metingBase);
  url.searchParams.set('server', playlist.server || 'netease');
  url.searchParams.set('type', playlist.metingType || 'playlist');
  url.searchParams.set('id', getMetingId(playlist.source));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch meting playlist: ' + response.status + ' ' + url.href);
  }

  const data = await response.json();
  const rawTracks = Array.isArray(data) ? data : data.tracks || [];
  return rawTracks.map((track, index) => normalizeTrack({
    id: track.id ? String(track.id) : playlist.id + '-' + index,
    title: track.name || track.title,
    artist: Array.isArray(track.artist) ? track.artist.join(' / ') : track.artist || track.author,
    cover: track.pic || track.cover,
    audio: track.url || buildMetingUrl(metingBase, {
      server: playlist.server || 'netease',
      type: 'url',
      id: track.id,
    }),
  }, { metingBase, featuredTrack }));
}

async function buildMusicTracks(config) {
  const music = config.music || {};
  const featuredTrack = music.player?.featuredTrack || '';
  const metingBase = music.meting?.api?.primary || '';
  const localSource = music.sources?.local || {};
  const networkSource = music.sources?.network || {};
  const localTracks = localSource.enabled === false
    ? []
    : (localSource.tracks || []).map((track) => normalizeTrack(track, {
      local: true,
      metingBase,
      featuredTrack,
    }));

  let networkTracks = [];

  if (networkSource.enabled !== false) {
    const playlists = (networkSource.playlists || []).filter((playlist) => playlist.enabled !== false);
    const selected = playlists.find((playlist) => playlist.id === networkSource.default) || playlists[0];

    if (selected?.type === 'json') {
      networkTracks = await readMusicJson(selected.source, metingBase, featuredTrack);
    } else if (selected?.type === 'meting-playlist') {
      networkTracks = await readMetingPlaylist(selected, metingBase, featuredTrack);
    }
  }

  const tracks = [...localTracks, ...networkTracks].filter((track) => (
    track.id && track.title && track.artist && track.cover && track.audio
  ));

  tracks.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  const sourceCode = 'window.MUSIC_TRACKS = ' + JSON.stringify(tracks) + ';\n';
  await mkdir(path.dirname(musicTracksFile), { recursive: true });
  await writeFile(musicTracksFile, sourceCode, 'utf8');

  return {
    file: slash(path.relative(projectRoot, musicTracksFile)),
    count: tracks.length,
    localCount: localTracks.length,
    networkCount: networkTracks.length,
    metingServer: metingBase,
    featuredTrack,
  };
}

async function buildRobots(config) {
  const robots = (config.seo && config.seo.robots) || {};
  const lines = [];

  if (robots.allowIndexing === false) {
    lines.push('User-agent: *');
    lines.push('Disallow: /');
    lines.push('');
  } else {
    for (const rule of robots.rules || []) {
      lines.push('User-agent: ' + (rule.userAgent || '*'));
      for (const item of rule.allow || []) lines.push('Allow: ' + item);
      for (const item of rule.disallow || []) lines.push('Disallow: ' + item);
      lines.push('');
    }
  }

  for (const agent of (robots.aiCrawlers && robots.aiCrawlers.disallow) || []) {
    lines.push('User-agent: ' + agent);
    lines.push('Disallow: /');
    lines.push('');
  }

  if (robots.sitemap && config.seo?.sitemap?.enabled !== false) lines.push('Sitemap: ' + robots.sitemap);
  if (robots.notice && robots.notice.text) {
    lines.push('');
    lines.push('# ' + robots.notice.text);
  }

  await writeFile(robotsFile, lines.join('\n').trim() + '\n', 'utf8');
  return { file: slash(path.relative(projectRoot, robotsFile)), allowIndexing: robots.allowIndexing !== false };
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function buildSitemap(config) {
  const sitemap = (config.seo && config.seo.sitemap) || {};
  const sitemapFile = path.join(projectRoot, sitemap.output || 'sitemap.xml');
  const urls = sitemap.enabled === false ? [] : sitemap.urls || [];
  const body = urls.map((item) => {
    const lines = ['  <url>', '    <loc>' + xmlEscape(item.loc) + '</loc>'];
    if (item.lastmod) lines.push('    <lastmod>' + xmlEscape(item.lastmod) + '</lastmod>');
    if (item.changefreq) lines.push('    <changefreq>' + xmlEscape(item.changefreq) + '</changefreq>');
    if (item.priority !== undefined) lines.push('    <priority>' + xmlEscape(item.priority) + '</priority>');
    lines.push('  </url>');
    return lines.join('\n');
  }).join('\n');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + body
    + '\n</urlset>\n';

  await mkdir(path.dirname(sitemapFile), { recursive: true });
  await writeFile(sitemapFile, xml, 'utf8');
  return { file: slash(path.relative(projectRoot, sitemapFile)), count: urls.length };
}

const config = parseYaml(await readFile(configFile, 'utf8'));

const travel = await buildTravelGallery(config);
const siteFonts = await buildSiteFonts();
const siteConfig = await buildSiteConfig(config);
const musicTracks = await buildMusicTracks(config);
const robots = await buildRobots(config);
const sitemap = await buildSitemap(config);

await mkdir(outputDir, { recursive: true });
await writeFile(manifestFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  configFile: slash(path.relative(projectRoot, configFile)),
  siteFonts,
  siteConfig,
  musicTracks,
  robots,
  sitemap,
  travel,
}, null, 2) + '\n', 'utf8');

console.log('Generated ' + siteFonts.file);
console.log('Generated ' + siteConfig.file);
console.log('Generated ' + musicTracks.file);
console.log('Generated ' + robots.file);
console.log('Generated ' + sitemap.file);
console.log('Generated ' + travel.count + ' travel gallery entries.');
