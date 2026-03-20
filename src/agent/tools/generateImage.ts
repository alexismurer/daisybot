// src/agent/tools/generateImage.ts
import { config } from '../../config';

export async function fetchImageBuffer(
  prompt: string,
  width: number,
  height: number,
  nsfw: boolean = false
): Promise<Buffer | 'rate_limited' | null> {
  try {
    const truncated = prompt.slice(0, 500);
    const encoded = encodeURIComponent(truncated);
    const safeParam = nsfw ? '&safe=false' : '';
    const url =
      `https://gen.pollinations.ai/image/${encoded}` +
      `?model=flux&width=${width}&height=${height}&nologo=true${safeParam}`;

    const headers: Record<string, string> = {};
    if (config.POLLINATIONS_API_KEY) {
      headers['Authorization'] = `Bearer ${config.POLLINATIONS_API_KEY}`;
    }

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    if (response.status === 402) return 'rate_limited';
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error('Non-image response');
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error('[fetchImageBuffer] image fetch error:', err);
    return null;
  }
}
