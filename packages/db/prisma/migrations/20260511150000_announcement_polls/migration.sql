-- CreateTable
CREATE TABLE "AnnouncementPoll" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPollOption" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPollVote" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPoll_announcementId_key" ON "AnnouncementPoll"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementPoll_workspaceId_createdAt_idx" ON "AnnouncementPoll"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPollOption_pollId_position_key" ON "AnnouncementPollOption"("pollId", "position");

-- CreateIndex
CREATE INDEX "AnnouncementPollOption_workspaceId_pollId_idx" ON "AnnouncementPollOption"("workspaceId", "pollId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPollVote_pollId_userId_optionId_key" ON "AnnouncementPollVote"("pollId", "userId", "optionId");

-- CreateIndex
CREATE INDEX "AnnouncementPollVote_workspaceId_userId_createdAt_idx" ON "AnnouncementPollVote"("workspaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnnouncementPollVote_pollId_userId_idx" ON "AnnouncementPollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "AnnouncementPollVote_optionId_idx" ON "AnnouncementPollVote"("optionId");

-- AddForeignKey
ALTER TABLE "AnnouncementPoll" ADD CONSTRAINT "AnnouncementPoll_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPoll" ADD CONSTRAINT "AnnouncementPoll_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPollOption" ADD CONSTRAINT "AnnouncementPollOption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPollOption" ADD CONSTRAINT "AnnouncementPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "AnnouncementPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPollVote" ADD CONSTRAINT "AnnouncementPollVote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPollVote" ADD CONSTRAINT "AnnouncementPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "AnnouncementPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPollVote" ADD CONSTRAINT "AnnouncementPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AnnouncementPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPollVote" ADD CONSTRAINT "AnnouncementPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
