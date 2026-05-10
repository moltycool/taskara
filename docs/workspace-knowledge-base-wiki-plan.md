# Workspace Knowledge Base and Wiki Plan

## Goal

Add a first-class workspace knowledge base to Taskara: a place for durable team knowledge, project specs, decisions, SOPs, onboarding material, meeting outcomes, and task-adjacent documentation.

This should not become a detached Notion clone. The strongest product angle for Taskara is a wiki that lives beside execution: pages can reference tasks, projects, meetings, announcements, people, and files; tasks can link back to the page that explains the work.

## Industry Research

### Notion

Notion positions wikis around centralized, findable, maintainable knowledge. Its wiki pages include default views such as Home, All pages, and Pages I own. Notion also has verified pages, page owners, verification expiry, owner notifications, and a workspace-level verified-pages management view. Source: https://www.notion.com/en-gb/help/wikis-and-verified-pages

Takeaway for Taskara:

- Knowledge needs ownership, not just storage.
- A "verified" state is a powerful trust signal in search, mentions, and page lists.
- "Pages I own" is a practical maintenance queue.
- Verification expiry should generate inbox notifications.

### Linear

Linear does not try to be a full company wiki. It keeps project documents close to projects, resources, specs, PRDs, updates, issues, and project overviews. Documents share editing patterns with issues, support templates, subscriptions, inline comments, collaborative editing, version revert, references to issues/projects/documents, and direct links to headers. Source: https://linear.app/docs/project-documents and https://linear.app/docs/project-overview

Takeaway for Taskara:

- Start with docs that are tightly connected to projects and tasks.
- Reuse the existing issue/meeting rich editor instead of inventing a second writing surface.
- Mentions and references are core, not nice-to-have.
- Header deep links are important for long operational docs.

### ClickUp

ClickUp Docs are connected to work, support real-time collaboration, inline comments, resolved threads, comment-to-task conversion, version history, a Docs Hub with search/sort/filter, nested pages, rich media, permissions, templates, and AI answers across docs, comments, tasks, and wikis. Its Knowledge Management page highlights verified wikis, real-time editing, comments, advanced permissions, version histories, imports, and centralized Docs Hub discovery. Sources: https://clickup.com/features/docs and https://clickup.com/features/knowledge-management

Takeaway for Taskara:

- A wiki must be discoverable through one hub, not only through trees.
- Wiki comments should turn into tasks because Taskara is a task system.
- Version history and permissions are table stakes.
- AI answers are a later-stage feature, but only after source links and trust metadata exist.

### Confluence

Confluence emphasizes spaces, global and space permissions, templates, labels/categories, Livesearch, Content by Label, page hierarchies, watching pages/spaces, comments, and knowledge-base spaces organized by parent/child pages. Source: https://www.atlassian.com/software/confluence/resources/guides/best-practices/knowledge-base

Takeaway for Taskara:

- Use spaces as the organizing unit, then pages as the content unit.
- Labels and page trees should coexist.
- Watch/subscription behavior is expected.
- Templates reduce low-quality blank-page creation.

## Product Principles

1. Knowledge should live beside work.
   Pages should attach to projects, teams, meetings, and tasks. Project pages should appear in the project resources area, and task pages should be mentionable from task descriptions and comments.

2. Search beats folder memory.
   The hub, command menu, and global search must return pages by title, body text, owner, labels, scope, and verification state.

3. Trust must be visible.
   Every important page needs owner, last edited, verified state, and expiry status. Unowned or expired pages should be obvious.

4. Permissions should be simple first.
   Ship space-level permissions before page-level ACLs. Page-level ACLs add complexity to search, sync, sharing, comments, and inheritance.

5. Reuse Taskara infrastructure.
   Use Prisma, Fastify routes, workspace actor/RBAC helpers, existing CDN uploads, activity logs, notifications, sync events, and the existing Lexical editor.

## Recommended Scope

### MVP

- Workspace wiki hub.
- Spaces: workspace, team, and project spaces.
- Nested pages.
- Rich editor based on existing `DescriptionEditor`.
- Page owner.
- Page labels.
- Page verification with optional expiry.
- Page versions and revert.
- Page search.
- Page comments.
- Page subscriptions/watch.
- Project resources: show linked pages on project detail/overview.
- Task and page references: link pages from task descriptions/comments and link tasks from pages.

### Phase 2

- Inline anchored comments.
- Comment-to-task conversion.
- Header links.
- Templates.
- Import/export Markdown.
- Realtime page list updates via sync.
- Global command-menu integration.

### Phase 3

- Collaborative cursors and conflict-free editing.
- Page-level permissions.
- Public/shared links if needed.
- AI Q&A with source citations.
- Notion/Confluence importers.

## Data Model

Add these Prisma enums:

```prisma
enum KnowledgeSpaceType {
  WORKSPACE
  TEAM
  PROJECT
}

enum KnowledgePageStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum KnowledgePermissionRole {
  VIEWER
  COMMENTER
  EDITOR
  ADMIN
}

enum KnowledgeReferenceType {
  PAGE
  TASK
  PROJECT
  MEETING
  ANNOUNCEMENT
  EXTERNAL_URL
}
```

Add these models:

```prisma
model KnowledgeSpace {
  id          String             @id @default(uuid()) @db.Uuid
  workspaceId String            @db.Uuid
  type        KnowledgeSpaceType
  teamId      String?            @db.Uuid
  projectId   String?            @db.Uuid
  key         String
  name        String
  description String?
  icon        String?
  createdById String?            @db.Uuid
  updatedById String?            @db.Uuid
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  project   Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pages     KnowledgePage[]

  @@unique([workspaceId, key])
  @@unique([projectId])
  @@index([workspaceId, type])
  @@index([workspaceId, teamId])
}

model KnowledgePage {
  id                    String              @id @default(uuid()) @db.Uuid
  workspaceId           String              @db.Uuid
  spaceId               String              @db.Uuid
  parentId              String?             @db.Uuid
  slug                  String
  title                 String
  summary               String?
  icon                  String?
  content               Json
  contentText           String
  status                KnowledgePageStatus @default(DRAFT)
  ownerId               String?             @db.Uuid
  createdById           String?             @db.Uuid
  updatedById           String?             @db.Uuid
  verifiedById          String?             @db.Uuid
  verifiedAt            DateTime?
  verificationExpiresAt DateTime?
  archivedAt            DateTime?
  position              Int                 @default(0)
  version               Int                 @default(1)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  workspace Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  space     KnowledgeSpace  @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  parent    KnowledgePage?  @relation("KnowledgePageTree", fields: [parentId], references: [id], onDelete: SetNull)
  children  KnowledgePage[] @relation("KnowledgePageTree")
  owner     User?           @relation("KnowledgePageOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  versions  KnowledgePageVersion[]
  comments  KnowledgePageComment[]
  labels    KnowledgePageLabel[]
  references KnowledgePageReference[]
  subscriptions KnowledgePageSubscription[]
  attachments KnowledgePageAttachment[]

  @@unique([spaceId, parentId, slug])
  @@index([workspaceId, status, updatedAt])
  @@index([workspaceId, ownerId])
  @@index([workspaceId, verificationExpiresAt])
}

model KnowledgePageVersion {
  id          String   @id @default(uuid()) @db.Uuid
  pageId      String   @db.Uuid
  version     Int
  title       String
  content     Json
  contentText String
  authorId    String?  @db.Uuid
  reason      String?
  createdAt   DateTime @default(now())

  page   KnowledgePage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  author User?         @relation(fields: [authorId], references: [id], onDelete: SetNull)

  @@unique([pageId, version])
  @@index([pageId, createdAt])
}

model KnowledgePageComment {
  id           String   @id @default(uuid()) @db.Uuid
  workspaceId  String   @db.Uuid
  pageId       String   @db.Uuid
  authorId     String?  @db.Uuid
  body         String
  anchor       Json?
  resolvedAt   DateTime?
  resolvedById String?  @db.Uuid
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  page      KnowledgePage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  author    User?         @relation(fields: [authorId], references: [id], onDelete: SetNull)
  attachments KnowledgePageAttachment[]

  @@index([workspaceId, pageId, createdAt])
}

model KnowledgePageSubscription {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @db.Uuid
  pageId      String   @db.Uuid
  userId      String   @db.Uuid
  createdAt   DateTime @default(now())

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  page      KnowledgePage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([pageId, userId])
  @@index([workspaceId, userId, createdAt])
}

model KnowledgePageAttachment {
  id         String   @id @default(uuid()) @db.Uuid
  pageId     String   @db.Uuid
  commentId  String?  @db.Uuid
  name       String
  documentId String?
  object     String
  mimeType   String?
  sizeBytes  Int?
  createdAt  DateTime @default(now())

  page KnowledgePage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  comment KnowledgePageComment? @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@index([pageId, createdAt])
  @@index([commentId, createdAt])
  @@index([object])
}

model KnowledgeLabel {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @db.Uuid
  name        String
  color       String   @default("#64748b")
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  pages     KnowledgePageLabel[]

  @@unique([workspaceId, name])
}

model KnowledgePageLabel {
  pageId  String @db.Uuid
  labelId String @db.Uuid

  page  KnowledgePage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  label KnowledgeLabel @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([pageId, labelId])
}

model KnowledgePageReference {
  id          String                 @id @default(uuid()) @db.Uuid
  workspaceId String                @db.Uuid
  pageId      String                @db.Uuid
  type        KnowledgeReferenceType
  targetId    String?
  url         String?
  title       String?
  createdAt   DateTime              @default(now())

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  page      KnowledgePage @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([workspaceId, type, targetId])
  @@index([pageId])
}
```

When implementing the migration, also add the required back-relations to existing models:

- `Workspace`: `knowledgeSpaces`, `knowledgePages`, `knowledgeLabels`, `knowledgeComments`, `knowledgeSubscriptions`, `knowledgeReferences`
- `Team`: `knowledgeSpaces`
- `Project`: `knowledgeSpaces`
- `User`: owned/created/updated/verified pages, page versions, comments, subscriptions

PostgreSQL full-text search should be added in a SQL migration, because Prisma does not model generated `tsvector` columns cleanly enough for this use case:

```sql
ALTER TABLE "KnowledgePage"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("summary", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("contentText", '')), 'C')
  ) STORED;

CREATE INDEX "KnowledgePage_searchVector_idx"
  ON "KnowledgePage"
  USING GIN ("searchVector");
```

Use `simple` initially because Taskara has Persian UI/text and English identifiers. Persian stemming can be explored later with a dedicated search service or trigram ranking.

## API Plan

Create `apps/api/src/services/knowledge.ts` and `apps/api/src/routes/knowledge.ts`.

Routes:

- `GET /knowledge/spaces`
- `POST /knowledge/spaces`
- `GET /knowledge/spaces/:spaceKey`
- `PATCH /knowledge/spaces/:spaceKey`
- `GET /knowledge/pages?spaceId=&parentId=&q=&ownerId=&label=&verified=&status=`
- `POST /knowledge/pages`
- `GET /knowledge/pages/:idOrSlug`
- `PATCH /knowledge/pages/:id`
- `DELETE /knowledge/pages/:id`
- `POST /knowledge/pages/:id/verify`
- `DELETE /knowledge/pages/:id/verify`
- `GET /knowledge/pages/:id/versions`
- `POST /knowledge/pages/:id/versions/:version/revert`
- `GET /knowledge/pages/:id/comments`
- `POST /knowledge/pages/:id/comments`
- `PATCH /knowledge/pages/:id/comments/:commentId`
- `POST /knowledge/pages/:id/attachments`
- `POST /knowledge/pages/:id/subscribe`
- `DELETE /knowledge/pages/:id/subscribe`
- `GET /knowledge/search?q=...`
- `GET /knowledge/references?targetType=TASK&targetId=...`

Validation belongs in `packages/shared/src/index.ts`:

- `createKnowledgeSpaceSchema`
- `updateKnowledgeSpaceSchema`
- `createKnowledgePageSchema`
- `updateKnowledgePageSchema`
- `knowledgePageListQuerySchema`
- `knowledgeSearchQuerySchema`
- `verifyKnowledgePageSchema`
- `createKnowledgeCommentSchema`

Service rules:

- On create: set creator as owner and subscriber.
- On update: require base `version`; reject stale edits with `409`.
- On update: increment page `version`, write `KnowledgePageVersion`, extract `contentText`, extract references from Lexical JSON.
- On verify: require owner/editor/admin, set `verifiedById`, `verifiedAt`, optional expiry.
- On expiry: scheduled job creates notification for page owner.
- On archive: soft-delete with `status=ARCHIVED` and `archivedAt`.

## Permissions

Start with space-level access:

- Workspace space: workspace members can view; members can edit; guests can view/comment; owners/admins can manage.
- Team space: team members can view/edit; guests can view/comment if they are team members; owners/admins can manage.
- Project space: same access as the project/team. If project has no team, workspace members can view/edit.

Add helper functions:

- `listAccessibleKnowledgeSpaceIds(actor)`
- `assertActorCanViewKnowledgeSpace(actor, spaceId)`
- `assertActorCanEditKnowledgeSpace(actor, spaceId)`
- `assertActorCanManageKnowledgeSpace(actor, spaceId)`
- `assertActorCanViewKnowledgePage(actor, pageId)`
- `assertActorCanEditKnowledgePage(actor, pageId)`

Important implementation note: current team/project access helpers are membership-driven. For wiki work, decide explicitly whether `OWNER` and `ADMIN` can access all team spaces. Product expectation says yes; implement that once and reuse it.

## Editor Plan

Extract the existing `DescriptionEditor` into a reusable editor:

- `RichTextEditor`
- `TaskDescriptionEditor`
- `KnowledgePageEditor`

Reuse current Lexical support:

- headings
- lists
- checklist
- quote
- bold/italic/strike/code
- mentions
- images/uploads
- slash commands

Add wiki-specific editor capabilities:

- page mentions
- task/project/meeting mentions
- link node toolbar
- heading IDs for deep links
- code block node
- table node later
- paste Markdown import

Persist Lexical JSON as `KnowledgePage.content` and extracted plaintext as `contentText`.

## UI Plan

Routes:

- `/:orgId/wiki`
- `/:orgId/wiki/:spaceKey`
- `/:orgId/wiki/:spaceKey/:pageSlug`
- `/:orgId/team/:teamId/wiki`
- `/:orgId/team/:teamId/projects/:projectId/wiki` or project resource panel entry

Navigation:

- Add primary sidebar item `Wiki`.
- Add team-level child item `Wiki` under each team.
- Add project resources section showing linked pages and "New doc".
- Add command-menu search results for pages.

Hub layout:

- top search
- verified pages
- recently updated
- pages I own
- expired verification
- workspace spaces
- team spaces
- project spaces

Space/page layout:

- right-side app shell remains consistent with Taskara.
- tree navigation on the side.
- center editor/reader.
- metadata strip: owner, verified state, last edited, labels.
- action menu: verify, move, duplicate, archive, version history, copy link.

## Notifications

Add notification types:

- `knowledge_page_mentioned`
- `knowledge_page_commented`
- `knowledge_page_updated`
- `knowledge_page_verification_expired`
- `knowledge_page_owner_assigned`

Notification recipients:

- direct mentions
- page subscribers
- page owner for verification expiry
- comment/reply participants

Avoid notifying the actor about their own action, matching current task notification behavior.

## Sync and Realtime

MVP can load pages through normal API requests. Still append `SyncEvent` for page create/update/archive/comment so existing live refresh infrastructure can react.

Phase 2 should extend `/sync/bootstrap`, `/sync/pull`, and `/sync/stream` to include:

- visible spaces
- visible page summaries
- page upsert/delete events scoped by permissions

For actual collaborative text editing, do not fake it with last-write-wins. Use current version checks first; later add a Yjs provider for Lexical when collaborative editing is a real requirement.

## Search

Implement in this order:

1. Database full-text search over title, summary, contentText.
2. Filter by permission before returning results.
3. Rank verified pages and title matches higher.
4. Show owner, space, last edited, and verification badge in results.
5. Add global command-menu integration.
6. Later: semantic embeddings and AI Q&A with citations.

Search result ranking:

- exact title match
- verified and non-expired
- title prefix
- label match
- content rank
- recently updated

## Taskara-Specific Integrations

### Tasks

- Page mentions in task descriptions/comments.
- Related docs panel on issue page.
- Create task from page comment.
- Create task from selected page text.
- Reference task keys in page content.

### Projects

- Each project can have a default project space.
- Project overview should show project docs under Resources.
- New project template can optionally create starter docs: PRD, decisions, meeting notes, runbook.

### Meetings

- Convert meeting description/minutes into wiki page.
- Link meeting pages back to meeting records.
- Pull action items from page selection into tasks.

### Announcements

- Publish wiki page summary as announcement.
- Link announcements to canonical policy/process pages.

### Agents

- Add MCP/Taskara plugin read tools later:
  - search wiki
  - fetch page
  - create page
  - update page
  - comment on page

## Implementation Phases

### Phase 1: Foundation

- Add Prisma models/enums and SQL search migration.
- Generate Prisma client.
- Add shared Zod schemas/types.
- Add `knowledge.ts` service with permissions, serialization, content text extraction, reference extraction, version creation.
- Register `/knowledge` routes.
- Add API tests for CRUD, permissions, search, versioning, verification.

Exit criteria:

- A workspace member can create, edit, archive, search, verify, and revert a page through API.
- A non-member cannot access a team/project wiki.
- Search never leaks inaccessible pages.

### Phase 2: Basic Web Product

- Extract reusable rich editor.
- Add `TaskaraKnowledgeSpace`, `TaskaraKnowledgePage`, `TaskaraKnowledgeComment` client types.
- Add `KnowledgeHubView`, `KnowledgeSpaceView`, `KnowledgePageView`.
- Add sidebar Wiki item and team Wiki item.
- Add page tree and page editor.
- Add labels, owner, verification controls.
- Add version history modal.

Exit criteria:

- A user can manage a usable workspace wiki in the browser.
- Verified pages are visibly distinct.
- Version revert works.
- Persian UI copy is consistent with existing `fa-copy.ts`.

### Phase 3: Work Graph

- Add `KnowledgePageReference` extraction from editor JSON.
- Add task/project/meeting/page mentions.
- Add related docs panel on issue page.
- Add project resources docs section.
- Add comment-to-task conversion.
- Add page subscriptions and notifications.

Exit criteria:

- Project docs are visible from project context.
- Tasks and docs cross-link reliably.
- Mentions notify the right users.

### Phase 4: Discovery and Maintenance

- Add global command menu search.
- Add hub filters: owner, label, space, verified, expired, recently updated.
- Add "Pages I own".
- Add verification expiry reminder job.
- Add templates.
- Add Markdown import/export.

Exit criteria:

- Users can find pages without knowing their space.
- Owners have a clear maintenance queue.
- New docs start from useful structure.

### Phase 5: Collaboration and AI

- Add anchored inline comments.
- Add realtime page-summary sync.
- Add collaborative editing with Lexical + Yjs if needed.
- Add AI answers from pages/tasks/comments with source links.
- Add Notion/Confluence/Markdown importers.

Exit criteria:

- Multiple users can safely work around the same docs.
- AI answers are backed by linked source pages.

## Testing Plan

API tests:

- space CRUD
- page CRUD
- page tree movement
- slug uniqueness under same parent
- permission boundaries
- search permission filtering
- version creation and revert
- verification and expiry
- comments and subscriptions
- reference extraction
- activity logs and sync events

Web tests:

- hub renders empty and populated states
- create page flow
- edit/autosave or explicit save flow
- page tree navigation
- search results
- verification badge/control
- version revert modal
- project resource docs
- related docs on issue page

Regression checks:

- existing task sync still works.
- existing uploads still work.
- existing issue editor behavior stays intact after editor extraction.

## Technical Risks

1. Rich editor scope creep.
   Keep MVP to existing Lexical capabilities. Add tables and advanced embeds later.

2. Realtime editing complexity.
   Use optimistic locking first. Add collaborative editing only when real usage demands it.

3. Permission leaks through search.
   Treat search as permission-sensitive from day one; never query globally then filter casually in the UI.

4. Version storage growth.
   Store versions on material saves and reverts, not every keystroke. Add retention later if needed.

5. Wiki becoming disconnected from work.
   Prioritize project resources, task references, and comment-to-task before advanced document features.

## Recommended First Pull Request

Build the backend foundation first:

- Prisma schema and migration.
- Shared schemas and types.
- `knowledge.ts` service.
- `/knowledge` routes.
- Search SQL migration.
- Tests for CRUD, permissions, search, verification, and versions.

Do not start with AI, realtime collaborative cursors, public sharing, or page-level ACLs. Those depend on the core model being correct.
