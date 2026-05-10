-- CreateEnum
CREATE TYPE "KnowledgeSpaceType" AS ENUM ('WORKSPACE', 'TEAM', 'PROJECT');

-- CreateEnum
CREATE TYPE "KnowledgePageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeReferenceType" AS ENUM ('PAGE', 'TASK', 'PROJECT', 'MEETING', 'ANNOUNCEMENT', 'EXTERNAL_URL');

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "knowledgePageId" UUID;

-- CreateTable
CREATE TABLE "KnowledgeSpace" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "type" "KnowledgeSpaceType" NOT NULL,
    "teamId" UUID,
    "projectId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePage" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "spaceId" UUID NOT NULL,
    "parentId" UUID,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "icon" TEXT,
    "content" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "status" "KnowledgePageStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" UUID,
    "createdById" UUID,
    "updatedById" UUID,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "verificationExpiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePageVersion" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "authorId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgePageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePageComment" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "anchor" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePageComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePageSubscription" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgePageSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePageAttachment" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "commentId" UUID,
    "name" TEXT NOT NULL,
    "documentId" TEXT,
    "object" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgePageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeLabel" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePageLabel" (
    "pageId" UUID NOT NULL,
    "labelId" UUID NOT NULL,

    CONSTRAINT "KnowledgePageLabel_pkey" PRIMARY KEY ("pageId","labelId")
);

-- CreateTable
CREATE TABLE "KnowledgePageReference" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "type" "KnowledgeReferenceType" NOT NULL,
    "targetId" TEXT,
    "url" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgePageReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSpace_workspaceId_key_key" ON "KnowledgeSpace"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSpace_projectId_key" ON "KnowledgeSpace"("projectId");

-- CreateIndex
CREATE INDEX "KnowledgeSpace_workspaceId_type_idx" ON "KnowledgeSpace"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "KnowledgeSpace_workspaceId_teamId_idx" ON "KnowledgeSpace"("workspaceId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePage_spaceId_path_key" ON "KnowledgePage"("spaceId", "path");

-- CreateIndex
CREATE INDEX "KnowledgePage_workspaceId_status_updatedAt_idx" ON "KnowledgePage"("workspaceId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgePage_workspaceId_ownerId_idx" ON "KnowledgePage"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX "KnowledgePage_workspaceId_verificationExpiresAt_idx" ON "KnowledgePage"("workspaceId", "verificationExpiresAt");

-- CreateIndex
CREATE INDEX "KnowledgePage_spaceId_parentId_position_idx" ON "KnowledgePage"("spaceId", "parentId", "position");

-- CreateIndex
CREATE INDEX "KnowledgePage_search_vector_idx" ON "KnowledgePage" USING GIN (
  (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("summary", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("contentText", '')), 'C')
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePageVersion_pageId_version_key" ON "KnowledgePageVersion"("pageId", "version");

-- CreateIndex
CREATE INDEX "KnowledgePageVersion_pageId_createdAt_idx" ON "KnowledgePageVersion"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgePageComment_workspaceId_pageId_createdAt_idx" ON "KnowledgePageComment"("workspaceId", "pageId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgePageComment_authorId_createdAt_idx" ON "KnowledgePageComment"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePageSubscription_pageId_userId_key" ON "KnowledgePageSubscription"("pageId", "userId");

-- CreateIndex
CREATE INDEX "KnowledgePageSubscription_workspaceId_userId_createdAt_idx" ON "KnowledgePageSubscription"("workspaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgePageAttachment_pageId_createdAt_idx" ON "KnowledgePageAttachment"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgePageAttachment_commentId_createdAt_idx" ON "KnowledgePageAttachment"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgePageAttachment_object_idx" ON "KnowledgePageAttachment"("object");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeLabel_workspaceId_name_key" ON "KnowledgeLabel"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "KnowledgePageReference_workspaceId_type_targetId_idx" ON "KnowledgePageReference"("workspaceId", "type", "targetId");

-- CreateIndex
CREATE INDEX "KnowledgePageReference_pageId_idx" ON "KnowledgePageReference"("pageId");

-- CreateIndex
CREATE INDEX "Notification_knowledgePageId_idx" ON "Notification"("knowledgePageId");

-- AddForeignKey
ALTER TABLE "KnowledgeSpace" ADD CONSTRAINT "KnowledgeSpace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSpace" ADD CONSTRAINT "KnowledgeSpace_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSpace" ADD CONSTRAINT "KnowledgeSpace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSpace" ADD CONSTRAINT "KnowledgeSpace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSpace" ADD CONSTRAINT "KnowledgeSpace_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "KnowledgeSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePage" ADD CONSTRAINT "KnowledgePage_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageVersion" ADD CONSTRAINT "KnowledgePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "KnowledgePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageVersion" ADD CONSTRAINT "KnowledgePageVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageComment" ADD CONSTRAINT "KnowledgePageComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageComment" ADD CONSTRAINT "KnowledgePageComment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "KnowledgePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageComment" ADD CONSTRAINT "KnowledgePageComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageComment" ADD CONSTRAINT "KnowledgePageComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageSubscription" ADD CONSTRAINT "KnowledgePageSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageSubscription" ADD CONSTRAINT "KnowledgePageSubscription_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "KnowledgePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageSubscription" ADD CONSTRAINT "KnowledgePageSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageAttachment" ADD CONSTRAINT "KnowledgePageAttachment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "KnowledgePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageAttachment" ADD CONSTRAINT "KnowledgePageAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "KnowledgePageComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeLabel" ADD CONSTRAINT "KnowledgeLabel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageLabel" ADD CONSTRAINT "KnowledgePageLabel_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "KnowledgePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageLabel" ADD CONSTRAINT "KnowledgePageLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "KnowledgeLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageReference" ADD CONSTRAINT "KnowledgePageReference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePageReference" ADD CONSTRAINT "KnowledgePageReference_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "KnowledgePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_knowledgePageId_fkey" FOREIGN KEY ("knowledgePageId") REFERENCES "KnowledgePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
