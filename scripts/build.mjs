/**
 * Build both halves of dsh-better-choice.
 *
 * The browser half is a CommonJS bundle wrapped in DSH's client module-loader
 * envelope: platform modules (react, primitives, slots, ...) are provided by
 * the host through the factory's `require`, everything else is bundled.
 */
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

const MODULE_TABLE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const banner = `window.__ModuleLoader__.load({
  id: "dsh-better-choice",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;`

const footer = `    return module.exports;
  }
});`

await mkdir('lib', { recursive: true })

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome120'],
  jsx: 'automatic',
  sourcemap: true,
  legalComments: 'none',
  external: MODULE_TABLE,
  banner: { js: banner },
  footer: { js: footer },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
})

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  sourcemap: true,
  logLevel: 'info',
})

console.log('built lib/client.js and lib/index.js')
