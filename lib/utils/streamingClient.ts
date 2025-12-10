/**
 * Frontend Streaming Client
 * Consumes Server-Sent Events from streaming APIs
 */

import logger from './logger';

export interface StreamOptions {
  method?: string;
  headers?: HeadersInit;
  body?: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: { text?: string; error?: string }) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

/**
 * Consume a Server-Sent Events stream
 * Handles chunked responses and parses SSE format
 */
export async function consumeStream(
  url: string,
  options: StreamOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { onChunk, onComplete, onError } = callbacks;
  
  let fullText = '';
  let aborted = false;

  try {
    const response = await fetch(url, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (!aborted) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);

          // Check for completion signal
          if (data === '[DONE]') {
            onComplete(fullText);
            return;
          }

          // Parse JSON data
          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              onError(new Error(parsed.error));
              return;
            }

            if (parsed.text) {
              fullText += parsed.text;
              onChunk({ text: parsed.text });
            }
          } catch (parseError) {
            logger.warn('[Streaming Client] Failed to parse chunk:', data);
          }
        }
      }
    }

    // Stream ended without [DONE] signal
    onComplete(fullText);
  } catch (error) {
    logger.error('[Streaming Client] Stream error:', error);
    onError(error instanceof Error ? error : new Error('Stream failed'));
  }
}

/**
 * Parse action blocks from AI response
 * Looks for ```action blocks in markdown
 */
export function parseActionBlocks(text: string): Array<{ type: string; data: Record<string, unknown> }> {
  const actions: Array<{ type: string; data: Record<string, unknown> }> = [];
  
  // Match ```action blocks
  const actionRegex = /```action\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);
      
      if (parsed.type && parsed.data) {
        actions.push(parsed);
      }
    } catch (error) {
      logger.warn('[Streaming Client] Failed to parse action block:', match[1]);
    }
  }

  return actions;
}
