import { afterEach, describe, expect, test } from 'bun:test';

process.env.API_HOST = '127.0.0.1';
process.env.API_PORT = '4000';
process.env.WEB_ORIGIN = 'http://localhost:3005';
process.env.TASKARA_CDN_APP = 'taskara-test';
process.env.TASKARA_CDN_UPLOAD_URL = 'https://cdn.example.test/upload';
process.env.TASKARA_CDN_MEDIA_BASE_URL = 'https://cdn.example.test/v1/media/';
process.env.MATTERMOST_SYNTHETIC_EMAIL_DOMAIN = 'mattermost.example.invalid';

const { buildMediaUrlFromBase, uploadMediaToCdn } = await import('./media');

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('media URL handling', () => {
  test('builds CDN URLs whether the base is the CDN root or media endpoint', () => {
    expect(buildMediaUrlFromBase('https://cdn.example.test', 'objects/file.png')).toBe(
      'https://cdn.example.test/v1/media/objects/file.png'
    );
    expect(buildMediaUrlFromBase('https://cdn.example.test/v1/media/', 'objects/file.png')).toBe(
      'https://cdn.example.test/v1/media/objects/file.png'
    );
    expect(buildMediaUrlFromBase('https://cdn.example.test/v1/media/', '/v1/media/objects/file.png')).toBe(
      'https://cdn.example.test/v1/media/objects/file.png'
    );
  });

  test('keeps absolute CDN objects unchanged', () => {
    expect(buildMediaUrlFromBase('https://cdn.example.test/v1/media/', 'https://assets.example.test/file.png')).toBe(
      'https://assets.example.test/file.png'
    );
  });

  test('uploads multipart media to the configured CDN endpoint', async () => {
    globalThis.fetch = (async (url, init) => {
      const form = init?.body;
      expect(url).toBe('https://cdn.example.test/upload');
      expect(init?.method).toBe('POST');
      expect(form).toBeInstanceOf(FormData);
      expect((form as FormData).get('app')).toBe('taskara-test');
      expect((form as FormData).get('name')).toBe('Public name');
      expect((form as FormData).get('file')).toBeInstanceOf(Blob);

      return new Response(JSON.stringify({ documentId: 'doc-1', object: 'objects/file.txt' }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const uploaded = await uploadMediaToCdn({
      bytes: new TextEncoder().encode('hello'),
      filename: 'file.txt',
      mimeType: 'text/plain',
      name: 'Public name'
    });

    expect(uploaded).toEqual({
      documentId: 'doc-1',
      object: 'objects/file.txt',
      url: 'https://cdn.example.test/v1/media/objects/file.txt',
      name: 'Public name',
      mimeType: 'text/plain',
      sizeBytes: 5
    });
  });
});
