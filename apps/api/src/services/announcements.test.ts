import { describe, expect, test } from 'bun:test';
import { announcementPollVoteSchema, createAnnouncementSchema } from '@taskara/shared';
import type { RequestActor } from './actor';
import { canManageAnnouncement } from './announcements';

function actor(userId: string, role: RequestActor['role']): RequestActor {
  return {
    workspace: { id: 'workspace-1' },
    user: { id: userId },
    role
  } as RequestActor;
}

describe('announcement access', () => {
  test('allows admins and creators to manage announcements', () => {
    expect(canManageAnnouncement(actor('user-admin', 'ADMIN'), 'user-creator')).toBe(true);
    expect(canManageAnnouncement(actor('user-creator', 'MEMBER'), 'user-creator')).toBe(true);
  });

  test('rejects ordinary non-creators', () => {
    expect(canManageAnnouncement(actor('user-other', 'MEMBER'), 'user-creator')).toBe(false);
  });
});

describe('announcement poll validation', () => {
  test('accepts poll with unique options', () => {
    const parsed = createAnnouncementSchema.parse({
      title: 'Announcement with poll',
      recipientIds: [],
      publish: false,
      poll: {
        question: 'Pick a slot',
        options: ['9:00', '11:00'],
        allowMultiple: false
      }
    });
    expect(parsed.poll?.options).toEqual(['9:00', '11:00']);
  });

  test('rejects duplicate poll options', () => {
    expect(() => createAnnouncementSchema.parse({
      title: 'Bad poll',
      recipientIds: [],
      publish: false,
      poll: {
        question: 'Pick a slot',
        options: ['9:00', '9:00'],
        allowMultiple: false
      }
    })).toThrow();
  });

  test('rejects duplicate optionIds in vote payload', () => {
    expect(() => announcementPollVoteSchema.parse({
      optionIds: ['6761eec0-7729-4ce2-ab3a-8fd76f0887a5', '6761eec0-7729-4ce2-ab3a-8fd76f0887a5']
    })).toThrow();
  });
});
