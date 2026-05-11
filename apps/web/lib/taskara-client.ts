import type { TaskaraAttachment, TaskaraKnowledgeAttachment } from './taskara-types';
import { clearAuthSession, getAuthToken } from '@/store/auth-store';

export interface UploadedMediaObject {
   documentId?: string;
   object: string;
   url: string;
   name: string;
   mimeType?: string;
   sizeBytes: number;
}

export class TaskaraClientError extends Error {
   constructor(
      message: string,
      public readonly status?: number
   ) {
      super(message);
      this.name = 'TaskaraClientError';
   }
}

export function taskaraApiBaseUrl(): string {
   return requiredClientEnv(['TASKARA_API_URL', 'VITE_TASKARA_API_URL']).replace(/\/$/, '');
}

export function taskaraRequestHeaders(init: RequestInit = {}): Headers {
   const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
   const publicRouteRoots = new Set(['login', 'signup', 'onboarding', 'accept-invite']);
   const workspaceSlug =
      typeof window !== 'undefined' && pathParts[0] && !publicRouteRoots.has(pathParts[0])
         ? pathParts[0]
         : undefined;

   const headers = new Headers(init.headers);
   const token = getAuthToken();
   if (token) headers.set('authorization', `Bearer ${token}`);
   if (workspaceSlug) headers.set('x-workspace-slug', workspaceSlug);
   if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
   }

   return headers;
}

export async function taskaraRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
   const apiBaseUrl = taskaraApiBaseUrl();
   const headers = taskaraRequestHeaders(init);

   const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
   });

   if (response.status === 204) return undefined as T;

   const text = await response.text();
   const isJson = isJsonResponse(response);
   const data = text && isJson ? parseJsonResponse(text, response, `${apiBaseUrl}${path}`) : undefined;

   if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/auth/')) {
         clearAuthSession();
      }
      throw new TaskaraClientError(
         errorMessageFromResponse(data) ||
            (!isJson && text ? unexpectedApiResponseMessage(response, apiBaseUrl) : response.statusText),
         response.status
      );
   }

   if (text && !isJson) {
      throw new TaskaraClientError(unexpectedApiResponseMessage(response, apiBaseUrl), response.status);
   }

   return data as T;
}

function isJsonResponse(response: Response): boolean {
   const contentType = response.headers.get('content-type')?.toLowerCase() || '';
   return contentType.includes('application/json') || contentType.includes('+json');
}

function parseJsonResponse(text: string, response: Response, url: string): unknown {
   try {
      return JSON.parse(text);
   } catch {
      throw new TaskaraClientError(`Taskara API returned invalid JSON from ${url}.`, response.status);
   }
}

function errorMessageFromResponse(data: unknown): string | undefined {
   if (typeof data !== 'object' || data === null || !('message' in data)) return undefined;
   const message = data.message;
   return typeof message === 'string' && message.trim() ? message : undefined;
}

function unexpectedApiResponseMessage(response: Response, apiBaseUrl: string): string {
   const contentType = response.headers.get('content-type') || 'unknown content type';
   return `Expected JSON from Taskara API, but received ${contentType}. Check VITE_TASKARA_API_URL; it should point to the API server (${apiBaseUrl}), not the web server.`;
}

function requiredClientEnv(names: string[]): string {
   const value = clientEnvValue(names);
   if (value) return value;
   throw new Error(`${names[0]} is required`);
}

function clientEnvValue(names: string[]): string | undefined {
   const config = typeof window === 'undefined' ? undefined : window.__TASKARA_CONFIG__;
   for (const name of names) {
      const runtimeValue = config?.[name as keyof typeof config];
      if (typeof runtimeValue === 'string' && runtimeValue.trim()) return runtimeValue.trim();

      const buildValue = (import.meta.env as Record<string, unknown>)[name];
      if (typeof buildValue === 'string' && buildValue.trim()) return buildValue.trim();
   }

   return undefined;
}

export async function uploadTaskAttachment(task: string, file: File, name = file.name): Promise<TaskaraAttachment> {
   const media = await uploadMedia(file, name);
   return taskaraRequest<TaskaraAttachment>(`/tasks/${encodeURIComponent(task)}/attachments`, {
      method: 'POST',
      body: attachmentRegistrationBody(media),
   });
}

export async function uploadTaskCommentAttachment(
   task: string,
   commentId: string,
   file: File,
   name = file.name
): Promise<TaskaraAttachment> {
   const media = await uploadMedia(file, name);
   return taskaraRequest<TaskaraAttachment>(
      `/tasks/${encodeURIComponent(task)}/comments/${encodeURIComponent(commentId)}/attachments`,
      {
         method: 'POST',
         body: attachmentRegistrationBody(media),
      }
   );
}

export async function uploadMedia(file: File, name = file.name): Promise<UploadedMediaObject> {
   const form = new FormData();
   form.set('name', name);
   form.set('app', clientEnvValue(['TASKARA_CDN_APP', 'VITE_TASKARA_CDN_APP']) || 'taskara');
   form.set('file', file, file.name);

   const response = await fetch(requiredClientEnv(['TASKARA_CDN_UPLOAD_URL', 'VITE_TASKARA_CDN_UPLOAD_URL']), {
      method: 'POST',
      body: form,
   });

   const text = await response.text();
   const data = text ? parseOptionalJson(text) : undefined;

   if (!response.ok) {
      throw new TaskaraClientError(
         errorMessageFromResponse(data) || `CDN upload failed with ${response.status} ${response.statusText}`,
         response.status
      );
   }

   return normalizeCdnUploadResponse(data, file, name);
}

export async function uploadKnowledgePageAttachment(
   pageId: string,
   file: File,
   name = file.name
): Promise<TaskaraKnowledgeAttachment> {
   const media = await uploadMedia(file, name);
   return taskaraRequest<TaskaraKnowledgeAttachment>(`/knowledge/pages/${encodeURIComponent(pageId)}/attachments`, {
      method: 'POST',
      body: attachmentRegistrationBody(media),
   });
}

function attachmentRegistrationBody(media: UploadedMediaObject): string {
   return JSON.stringify({
      documentId: media.documentId,
      object: media.object,
      url: media.url,
      name: media.name,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
   });
}

function normalizeCdnUploadResponse(data: unknown, file: File, name: string): UploadedMediaObject {
   if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TaskaraClientError('CDN upload response was invalid.');
   }

   const record = data as Record<string, unknown>;
   const documentId = stringValue(record.documentId) || stringValue(record.id);
   const responseObject = stringValue(record.object);
   const responseUrl = stringValue(record.url);
   const object = responseObject || documentId || responseUrl;
   if (!object) throw new TaskaraClientError('CDN upload response did not include a document id or object.');

   const url = responseUrl || buildClientMediaUrl(object);
   return {
      documentId,
      object,
      url,
      name: name.trim() || file.name,
      mimeType: file.type || stringValue(record.mimeType),
      sizeBytes: file.size,
   };
}

function buildClientMediaUrl(object: string): string {
   if (/^https?:\/\//i.test(object)) return object;

   const mediaBaseUrl = requiredClientEnv(['TASKARA_CDN_MEDIA_BASE_URL', 'VITE_TASKARA_CDN_MEDIA_BASE_URL']);
   const normalizedBaseUrl = mediaBaseUrl.replace(/\/+$/, '').replace(/\/v1\/media$/i, '');
   const normalizedObject = object.replace(/^\/+/, '');
   if (normalizedObject.startsWith('v1/media/')) return `${normalizedBaseUrl}/${normalizedObject}`;
   return `${normalizedBaseUrl}/v1/media/${normalizedObject}`;
}

function parseOptionalJson(text: string): unknown {
   try {
      return JSON.parse(text);
   } catch {
      return undefined;
   }
}

function stringValue(value: unknown): string | undefined {
   return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
