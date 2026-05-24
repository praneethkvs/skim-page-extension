import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const settingsSource = await readFile('apps/extension/src/settings.ts', 'utf8');

assert.match(settingsSource, /const OPENAI_API_KEY = 'skimPageOpenAiApiKey'/);
assert.match(settingsSource, /chrome\.storage\.local\.get/);
assert.match(settingsSource, /chrome\.storage\.local\.set/);
assert.doesNotMatch(settingsSource, /chrome\.storage\.sync\.set\(\{ \[OPENAI_API_KEY\]/);
assert.doesNotMatch(settingsSource, /chrome\.storage\.sync\.get\(\{ \[OPENAI_API_KEY\]/);

console.log('Extension storage tests passed.');
