import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = 'apps/extension/dist';
const requiredFiles = [
  'manifest.json',
  'background.js',
  'contentScript.js',
  'options.html',
  'options.js',
  'popup.html',
  'popup.js',
  'assets/options.css',
  'assets/popup.css',
  'assets/settings.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'brand/og-image.svg',
  'brand/og-image.png',
];

for (const file of requiredFiles) {
  await assertReadable(join(distDir, file));
}

const manifest = JSON.parse(await readFile(join(distDir, 'manifest.json'), 'utf8'));
const backgroundSource = await readFile(join(distDir, 'background.js'), 'utf8');
const contentScriptSource = await readFile(join(distDir, 'contentScript.js'), 'utf8');
const optionsHtml = await readFile(join(distDir, 'options.html'), 'utf8');
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.service_worker, 'background.js');
assert.equal(manifest.action.default_popup, 'popup.html');
assert.equal(manifest.options_page, 'options.html');
assert.deepEqual(manifest.permissions, ['activeTab', 'contextMenus', 'scripting', 'storage']);
assert.deepEqual(manifest.host_permissions, ['https://api.openai.com/*']);
assert.match(backgroundSource, /web_search/);
assert.match(contentScriptSource, /skim-page-web-search/);
assert.match(contentScriptSource, /skim-page-switch/);
assert.match(contentScriptSource, /skim-page:cancel-summary/);
assert.match(optionsHtml, /web-search-enabled/);

for (const [size, path] of Object.entries(manifest.icons)) {
  const dimensions = await readPngDimensions(join(distDir, path));
  assert.equal(dimensions.width, Number(size));
  assert.equal(dimensions.height, Number(size));
}

console.log('Extension build smoke check passed.');

async function assertReadable(path) {
  const file = await readFile(path);
  assert.ok(file.byteLength > 0, `${path} should not be empty`);
}

async function readPngDimensions(path) {
  const file = await readFile(path);
  assert.equal(file.toString('ascii', 1, 4), 'PNG', `${path} must be a PNG`);

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}
