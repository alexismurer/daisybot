// tests/agent/tools/generateImage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message } from 'discord.js';
import { generateAndSendImage } from '../../../src/agent/tools/generateImage';

const mockReply = vi.fn().mockResolvedValue(undefined);
const mockMessage = { reply: mockReply } as unknown as Message;

function makeFetch({ ok = true, contentType = 'image/png' } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    headers: { get: (_h: string) => contentType },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', makeFetch());
});

describe('generateAndSendImage', () => {
  it('sends image attachment on success', async () => {
    await generateAndSendImage('a cat', 1024, 1024, mockMessage);

    expect(mockReply).toHaveBeenCalledOnce();
    const [arg] = mockReply.mock.calls[0];
    expect(arg.files[0].attachment).toBeInstanceOf(Buffer);
    expect(arg.files[0].name).toBe('image.png');
    expect(arg.allowedMentions).toEqual({ repliedUser: false });
  });

  it('builds URL with model=flux, safe=false, nologo=true', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    await generateAndSendImage('a dog', 512, 512, mockMessage);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('model=flux');
    expect(url).toContain('safe=false');
    expect(url).toContain('nologo=true');
    expect(url).toContain('width=512');
    expect(url).toContain('height=512');
  });

  it('replies with error message when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await generateAndSendImage('a cat', 1024, 1024, mockMessage);

    expect(mockReply).toHaveBeenCalledOnce();
    const [arg] = mockReply.mock.calls[0];
    expect(typeof arg.content).toBe('string');
    expect(arg.content).toContain('Sorry');
  });

  it('replies with error message when response.ok is false', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: false }));

    await generateAndSendImage('a cat', 1024, 1024, mockMessage);

    expect(mockReply).toHaveBeenCalledOnce();
    const [arg] = mockReply.mock.calls[0];
    expect(arg.content).toContain('Sorry');
  });

  it('replies with error message when content-type is not image', async () => {
    vi.stubGlobal('fetch', makeFetch({ contentType: 'text/html' }));

    await generateAndSendImage('a cat', 1024, 1024, mockMessage);

    expect(mockReply).toHaveBeenCalledOnce();
    const [arg] = mockReply.mock.calls[0];
    expect(arg.content).toContain('Sorry');
  });

  it('truncates prompt to 500 chars in URL', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    await generateAndSendImage('a'.repeat(600), 1024, 1024, mockMessage);

    const [url] = fetchMock.mock.calls[0];
    const promptPart = url.split('/prompt/')[1].split('?')[0];
    expect(decodeURIComponent(promptPart).length).toBe(500);
  });
});
