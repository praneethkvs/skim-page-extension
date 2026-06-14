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
  let emittedText = '';

  async function processRawEvent(rawEvent: string): Promise<void> {
    const streamEvent = parseStreamEvent(rawEvent);

    if (!streamEvent) {
      return;
    }

    const errorMessage = getStreamErrorMessage(streamEvent);

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    const text = getStreamEventText(streamEvent);

    if (!text) {
      return;
    }

    const delta = getNewTextDelta(emittedText, text);

    if (!delta) {
      return;
    }

    emittedText += delta;
    await onDelta(delta);
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      await processRawEvent(event);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    await processRawEvent(buffer);
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

type OpenAiStreamEvent = {
  type: string;
  payload: Record<string, unknown>;
};

function parseStreamEvent(event: string): OpenAiStreamEvent | null {
  let eventType = '';
  const dataLines: string[] = [];

  for (const line of event.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  const data = dataLines.join('\n');

  if (!data || data === '[DONE]') {
    return null;
  }

  try {
    const payload = JSON.parse(data) as Record<string, unknown>;
    const payloadType = typeof payload.type === 'string' ? payload.type : '';
    const type = payloadType || eventType;

    return type ? { type, payload } : null;
  } catch {
    return null;
  }
}

function getStreamEventText({ type, payload }: OpenAiStreamEvent): string {
  if (type === 'response.output_text.delta' || type === 'response.refusal.delta') {
    return typeof payload.delta === 'string' ? payload.delta : '';
  }

  if (type === 'response.output_text.done') {
    return typeof payload.text === 'string' ? payload.text : '';
  }

  if (type === 'response.refusal.done') {
    return typeof payload.refusal === 'string' ? payload.refusal : '';
  }

  if (type === 'response.completed') {
    return getResponseOutputText(payload.response);
  }

  return '';
}

function getNewTextDelta(emittedText: string, text: string): string {
  if (!emittedText) {
    return text;
  }

  if (text.startsWith(emittedText)) {
    return text.slice(emittedText.length);
  }

  return '';
}

function getResponseOutputText(response: unknown): string {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if ('output_text' in response && typeof response.output_text === 'string') {
    return response.output_text;
  }

  if (!('output' in response) || !Array.isArray(response.output)) {
    return '';
  }

  return response.output
    .flatMap((item) => getOutputItemText(item))
    .join('');
}

function getOutputItemText(item: unknown): string[] {
  if (!item || typeof item !== 'object' || !('content' in item) || !Array.isArray(item.content)) {
    return [];
  }

  return item.content.flatMap((contentPart) => {
    if (!contentPart || typeof contentPart !== 'object') {
      return [];
    }

    if ('text' in contentPart && typeof contentPart.text === 'string') {
      return [contentPart.text];
    }

    if ('refusal' in contentPart && typeof contentPart.refusal === 'string') {
      return [contentPart.refusal];
    }

    return [];
  });
}

function getStreamErrorMessage({ type, payload }: OpenAiStreamEvent): string {
  if (type === 'error') {
    return getNestedErrorMessage(payload.error) || getStringField(payload, 'message') || 'OpenAI stream failed.';
  }

  if (type === 'response.failed') {
    return getNestedErrorMessage(payload.response) || 'OpenAI response failed.';
  }

  if (type === 'response.incomplete') {
    return getIncompleteMessage(payload.response);
  }

  return '';
}

function getNestedErrorMessage(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }

  if ('error' in value) {
    const nestedErrorMessage = getNestedErrorMessage(value.error);

    if (nestedErrorMessage) {
      return nestedErrorMessage;
    }
  }

  return getStringField(value, 'message') || getStringField(value, 'code');
}

function getIncompleteMessage(response: unknown): string {
  if (!response || typeof response !== 'object' || !('incomplete_details' in response)) {
    return 'OpenAI response ended before it finished.';
  }

  const details = response.incomplete_details;

  if (!details || typeof details !== 'object') {
    return 'OpenAI response ended before it finished.';
  }

  const reason = getStringField(details, 'reason');

  return reason ? `OpenAI response ended before it finished: ${reason}.` : 'OpenAI response ended before it finished.';
}

function getStringField(value: object, field: string): string {
  return field in value && typeof value[field as keyof typeof value] === 'string'
    ? value[field as keyof typeof value]
    : '';
}
