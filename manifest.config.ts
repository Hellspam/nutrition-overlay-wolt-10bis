import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Nutrition Overlay (Wolt & 10bis)',
  version: '0.1.0',
  description: 'Estimated calories + macros on Wolt and 10bis menu items.',
  permissions: ['storage'],
  host_permissions: [
    'https://*.10bis.co.il/*',
    'https://*.wolt.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['https://*.10bis.co.il/*', 'https://*.wolt.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
})
