import { describe, expect, test } from 'bun:test';
import {
  buildKnowledgePagePath,
  extractKnowledgeContentText,
  extractKnowledgeReferences,
  slugifyKnowledgeTitle
} from './knowledge';

describe('knowledge helpers', () => {
  test('builds stable slugs from latin titles and falls back for non-latin titles', () => {
    expect(slugifyKnowledgeTitle('Incident Response Runbook')).toBe('incident-response-runbook');
    expect(slugifyKnowledgeTitle('  Release: v2.1 / QA  ')).toBe('release-v2-1-qa');
    expect(slugifyKnowledgeTitle('راهنمای انتشار')).toBe('page');
  });

  test('builds nested page paths', () => {
    expect(buildKnowledgePagePath(null, 'overview')).toBe('overview');
    expect(buildKnowledgePagePath('engineering/runbooks', 'deploy')).toBe('engineering/runbooks/deploy');
  });

  test('extracts searchable text from lexical-like content', () => {
    const content = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Deploy checklist' },
              { type: 'mention', mentionName: 'Sara' }
            ]
          },
          {
            type: 'link',
            url: 'https://example.com/status',
            children: [{ type: 'text', text: 'status page' }]
          }
        ]
      }
    };

    expect(extractKnowledgeContentText(content)).toBe('Deploy checklist Sara https://example.com/status status page');
  });

  test('extracts and deduplicates work graph references', () => {
    const references = extractKnowledgeReferences({
      root: {
        children: [
          { type: 'taskMention', taskId: 'task-1', title: 'Fix sync' },
          { type: 'taskMention', taskId: 'task-1', title: 'Fix sync duplicate' },
          { type: 'pageMention', pageId: 'page-1', title: 'Release plan' },
          { type: 'link', url: 'https://linear.app/docs/project-documents', title: 'Linear docs' }
        ]
      }
    });

    expect(references).toEqual([
      { type: 'TASK', targetId: 'task-1', title: 'Fix sync duplicate' },
      { type: 'PAGE', targetId: 'page-1', title: 'Release plan' },
      { type: 'EXTERNAL_URL', url: 'https://linear.app/docs/project-documents', title: 'Linear docs' }
    ]);
  });
});
