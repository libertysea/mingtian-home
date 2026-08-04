import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mixNodeModules = process.env.MIX_NODE_MODULES || 'E:/project/mix/node_modules';
const { build } = require(`${mixNodeModules}/esbuild`);

await build({
  absWorkingDir: process.cwd(),
  entryPoints: ['src/music/standalone.tsx'],
  outfile: 'js/runtime/music-component.js',
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  target: ['chrome100', 'edge100', 'firefox100', 'safari15'],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  loader: {
    '.webp': 'dataurl'
  },
  nodePaths: [mixNodeModules],
  charset: 'utf8',
  logLevel: 'info'
});
