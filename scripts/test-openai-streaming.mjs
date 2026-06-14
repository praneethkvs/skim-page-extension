import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const tempDir = await mkdtemp(join(tmpdir(), 'skim-openai-stream-test-'));
const outfile = join(tempDir, 'openaiClient.mjs');

try {
  await esbuild.build({
    bundle: true,
    entryPoints: ['apps/extension/src/openaiClient.ts'],
    format: 'esm',
    outfile,
    platform: 'browser',
    sourcemap: false,
  });

  const { streamOpenAiResponse } = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);

  await assertStreamText(
    streamOpenAiResponse,
    [
      'event: response.output_text.delta\n',
      'data: {"delta":"Hello"}\n\n',
      'event: response.completed\n',
      'data: {"response":{"output":[{"content":[{"type":"output_text","text":"Hello world"}]}]}}\n\n',
    ],
    'Hello world',
  );

  await assertStreamText(
    streamOpenAiResponse,
    ['data: {"type":"response.output_text.done","text":"Final text"}\n\n'],
    'Final text',
  );

  await assertStreamText(
    streamOpenAiResponse,
    ['data: {"type":"response.refusal.delta","delta":"I can not help with that."}\n\n'],
    'I can not help with that.',
  );

  await assert.rejects(
    () =>
      assertStreamText(
        streamOpenAiResponse,
        ['event: error\ndata: {"error":{"message":"Bad stream"}}\n\n'],
        '',
      ),
    /Bad stream/,
  );

  console.log('OpenAI streaming parser tests passed.');
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

async function assertStreamText(streamOpenAiResponse, chunks, expectedText) {
  const originalFetch = globalThis.fetch;
  const deltas = [];

  globalThis.fetch = async () =>
    new Response(createStream(chunks), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

  try {
    await streamOpenAiResponse({
      apiKey: 'test-key',
      input: 'test input',
      model: 'test-model',
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(deltas.join(''), expectedText);
}

function createStream(chunks) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}
