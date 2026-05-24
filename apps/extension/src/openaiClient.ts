type StreamResponseOptions = {
  apiKey: string;
  input: string;
  model: string;
  onDelta: (delta: string) => void | Promise<void>;
  signal?: AbortSignal;
  webSearchEnabled?: boolean;
};

type TestKeyOptions = {
  apiKey: string;
  model: string;
};

export async function testOpenAiKey({ apiKey, model }: TestKeyOptions): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      input: 'Reply with the word ok.',
      max_output_tokens: 16,
      model,
    }),
  });

  if (!response.ok) {
    throw new Error(await readOpenAiError(response));
  }
}

export async function streamOpenAiResponse({
  apiKey,
  input,
  model,
  onDelta,
  signal,
  webSearchEnabled = false,
}: StreamResponseOptions): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildStreamRequestBody({ input, model, webSearchEnabled })),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(await readOpenAiError(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const delta = parseStreamDelta(event);

      if (delta) {
        await onDelta(delta);
      }
    }
  }
}

function buildStreamRequestBody({
  input,
  model,
  webSearchEnabled,
}: Pick<StreamResponseOptions, 'input' | 'model'> & { webSearchEnabled: boolean }): Record<string, unknown> {
  return {
    input,
    model,
    stream: true,
    ...(webSearchEnabled ? { tools: [{ type: 'web_search' }] } : {}),
  };
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function readOpenAiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };

    return body.error?.message ?? `OpenAI request failed with ${response.status}.`;
  } catch {
    return `OpenAI request failed with ${response.status}.`;
  }
}

function parseStreamDelta(event: string): string {
  const dataLines = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());

  for (const dataLine of dataLines) {
    if (!dataLine || dataLine === '[DONE]') {
      continue;
    }

    try {
      const payload = JSON.parse(dataLine) as { type?: string; delta?: string };

      if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
        return payload.delta;
      }
    } catch {
      continue;
    }
  }

  return '';
}
