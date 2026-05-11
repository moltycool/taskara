import { describe, expect, test } from 'bun:test';
import { HttpError, errorMessage, statusCodeFromError } from './http';

describe('http error helpers', () => {
  test('preserves explicit application status codes', () => {
    expect(statusCodeFromError(new HttpError(503, 'Upload backend is unavailable'))).toBe(503);
  });

  test('preserves Fastify and multipart status codes', () => {
    expect(statusCodeFromError(Object.assign(new Error('request file too large'), { statusCode: 413 }))).toBe(413);
    expect(statusCodeFromError(Object.assign(new Error('the request is not multipart'), { status: 406 }))).toBe(406);
  });

  test('uses a stable fallback message for non-error throws', () => {
    expect(errorMessage('boom')).toBe('Internal server error');
    expect(statusCodeFromError('boom')).toBe(500);
  });
});
