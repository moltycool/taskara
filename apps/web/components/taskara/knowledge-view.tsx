'use client';

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
   Archive,
   BadgeCheck,
   BookOpen,
   CalendarDays,
   ChevronDown,
   ChevronLeft,
   Clock3,
   FileText,
   History,
   Loader2,
   MessageSquare,
   Plus,
   Send,
   ShieldCheck,
   Tags,
   UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DescriptionEditor } from '@/components/taskara/description-editor';
import { LinearAvatar } from '@/components/taskara/linear-ui';
import { fa } from '@/lib/fa-copy';
import { formatJalaliDateTime } from '@/lib/jalali';
import { dispatchWorkspaceRefresh, useLiveRefresh } from '@/lib/live-refresh';
import { taskaraRequest, uploadKnowledgePageAttachment } from '@/lib/taskara-client';
import type {
   PaginatedResponse,
   TaskaraKnowledgeComment,
   TaskaraKnowledgePage,
   TaskaraKnowledgePageVersion,
   TaskaraKnowledgeSpace,
   TaskaraProject,
   TaskaraTeam,
   TaskaraUser,
} from '@/lib/taskara-types';
import { cn } from '@/lib/utils';
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue } from '@/lib/select-utils';

type SpaceForm = {
   name: string;
   key: string;
   type: TaskaraKnowledgeSpace['type'];
   teamId: string;
   projectId: string;
};

type PageForm = {
   title: string;
   parentId: string;
};

type PageTreeNode = TaskaraKnowledgePage & {
   children: PageTreeNode[];
};

const emptySpaceForm: SpaceForm = {
   name: '',
   key: '',
   type: 'WORKSPACE',
   teamId: '',
   projectId: '',
};

const emptyPageForm: PageForm = {
   title: '',
   parentId: '',
};

const createSpaceSelectValue = '__create_space__';

export function KnowledgeView() {
   const navigate = useNavigate();
   const { orgId, spaceKey, pageId } = useParams();
   const workspaceSlug = orgId || 'taskara';
   const [spaces, setSpaces] = useState<TaskaraKnowledgeSpace[]>([]);
   const [pages, setPages] = useState<TaskaraKnowledgePage[]>([]);
   const [teams, setTeams] = useState<TaskaraTeam[]>([]);
   const [projects, setProjects] = useState<TaskaraProject[]>([]);
   const [users, setUsers] = useState<TaskaraUser[]>([]);
   const [selectedPage, setSelectedPage] = useState<TaskaraKnowledgePage | null>(null);
   const [comments, setComments] = useState<TaskaraKnowledgeComment[]>([]);
   const [versions, setVersions] = useState<TaskaraKnowledgePageVersion[]>([]);
   const [expandedPageIds, setExpandedPageIds] = useState<string[]>([]);
   const [loading, setLoading] = useState(true);
   const [pagesLoading, setPagesLoading] = useState(false);
   const [detailsLoading, setDetailsLoading] = useState(false);
   const [error, setError] = useState('');
   const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
   const [pageDialogOpen, setPageDialogOpen] = useState(false);
   const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
   const [spaceForm, setSpaceForm] = useState(emptySpaceForm);
   const [pageForm, setPageForm] = useState(emptyPageForm);
   const [titleDraft, setTitleDraft] = useState('');
   const [contentDraft, setContentDraft] = useState('');
   const [labelsDraft, setLabelsDraft] = useState('');
   const [commentBody, setCommentBody] = useState('');
   const [submittingSpace, setSubmittingSpace] = useState(false);
   const [submittingPage, setSubmittingPage] = useState(false);
   const [savingPage, setSavingPage] = useState(false);
   const [commentSubmitting, setCommentSubmitting] = useState(false);
   const [verifying, setVerifying] = useState(false);
   const [historyLoading, setHistoryLoading] = useState(false);
   const [uploadingImages, setUploadingImages] = useState(false);

   const selectedSpace = useMemo(() => {
      if (!spaces.length) return null;
      if (spaceKey) return spaces.find((space) => space.key === spaceKey || space.id === spaceKey) || null;
      return spaces[0] || null;
   }, [spaceKey, spaces]);

   const sortedPages = useMemo(
      () => [...pages].sort((a, b) => a.path.localeCompare(b.path, 'fa')),
      [pages]
   );
   const pageTree = useMemo(() => buildPageTree(pages), [pages]);
   const hasUnsavedPageChanges = useMemo(() => {
      if (!selectedPage) return false;
      const savedLabels = (selectedPage.labels || []).map((item) => item.label.name).join(', ');
      return (
         titleDraft !== selectedPage.title ||
         contentDirtyValue(contentDraft) !== contentDirtyValue(selectedPage.content) ||
         labelsDraft !== savedLabels
      );
   }, [contentDraft, labelsDraft, selectedPage, titleDraft]);

   const loadSpaces = useCallback(async () => {
      setError('');
      try {
         const [spaceResult, userResult, teamResult, projectResult] = await Promise.all([
            taskaraRequest<TaskaraKnowledgeSpace[]>('/knowledge/spaces'),
            taskaraRequest<PaginatedResponse<TaskaraUser>>('/users?limit=200').catch(() => ({
               items: [],
               total: 0,
               limit: 0,
               offset: 0,
            })),
            taskaraRequest<TaskaraTeam[]>('/teams').catch(() => []),
            taskaraRequest<TaskaraProject[]>('/projects').catch(() => []),
         ]);
         setSpaces(spaceResult);
         setUsers(userResult.items);
         setTeams(teamResult);
         setProjects(projectResult);
         if (!spaceKey && spaceResult[0]) {
            navigate(`/${workspaceSlug}/wiki/${spaceResult[0].key}`, { replace: true });
         }
      } catch (err) {
         setError(err instanceof Error ? err.message : fa.knowledge.loadFailed);
      } finally {
         setLoading(false);
      }
   }, [navigate, spaceKey, workspaceSlug]);

   const loadPages = useCallback(async (space: TaskaraKnowledgeSpace) => {
      setPagesLoading(true);
      try {
         const params = new URLSearchParams({ spaceId: space.id, limit: '200' });
         const result = await taskaraRequest<PaginatedResponse<TaskaraKnowledgePage>>(
            `/knowledge/pages?${params.toString()}`
         );
         setPages(result.items);
         return result.items;
      } catch (err) {
         setError(err instanceof Error ? err.message : fa.knowledge.loadFailed);
         return [];
      } finally {
         setPagesLoading(false);
      }
   }, []);

   const loadSelectedPage = useCallback(async (id: string) => {
      setDetailsLoading(true);
      try {
         const [pageResult, commentsResult] = await Promise.all([
            taskaraRequest<TaskaraKnowledgePage>(`/knowledge/pages/${encodeURIComponent(id)}`),
            taskaraRequest<TaskaraKnowledgeComment[]>(`/knowledge/pages/${encodeURIComponent(id)}/comments`).catch(() => []),
         ]);
         setSelectedPage(pageResult);
         setComments(commentsResult);
         setTitleDraft(pageResult.title);
         setContentDraft(editorValueFromContent(pageResult.content));
         setLabelsDraft((pageResult.labels || []).map((item) => item.label.name).join(', '));
      } catch (err) {
         setError(err instanceof Error ? err.message : fa.knowledge.loadFailed);
      } finally {
         setDetailsLoading(false);
      }
   }, []);

   useEffect(() => {
      void loadSpaces();
   }, [loadSpaces]);

   useLiveRefresh(() => {
      void loadSpaces();
      if (selectedSpace) void loadPages(selectedSpace);
      if (pageId && !hasUnsavedPageChanges) void loadSelectedPage(pageId);
   }, {
      fireOnMount: false,
      refreshOnFocus: false,
      refreshOnInterval: false,
      refreshOnPageShow: false,
      refreshOnVisibility: false,
   });

   useEffect(() => {
      if (!selectedSpace) return;
      void loadPages(selectedSpace).then((items) => {
         if (!pageId && items[0]) {
            navigate(`/${workspaceSlug}/wiki/${selectedSpace.key}/${items[0].id}`, { replace: true });
         }
      });
   }, [loadPages, navigate, pageId, selectedSpace, workspaceSlug]);

   useEffect(() => {
      setExpandedPageIds((current) => {
         const expandableIds = collectExpandablePageIds(pageTree);
         const expandableIdSet = new Set(expandableIds);
         const retained = current.filter((id) => expandableIdSet.has(id));
         const next = new Set(retained);
         const selectedPathIds = selectedPage ? findPageAncestorIds(pageTree, selectedPage.id) : [];

         if (retained.length === 0) {
            expandableIds.forEach((id) => next.add(id));
         }
         selectedPathIds.forEach((id) => next.add(id));

         return Array.from(next).filter((id) => expandableIdSet.has(id));
      });
   }, [pageTree, selectedPage]);

   useEffect(() => {
      if (!pageId) {
         setSelectedPage(null);
         setComments([]);
         return;
      }
      void loadSelectedPage(pageId);
   }, [loadSelectedPage, pageId]);

   function selectSpace(value: string) {
      if (value === createSpaceSelectValue) {
         openSpaceDialog();
         return;
      }

      const nextSpace = spaces.find((space) => space.id === value);
      if (nextSpace) navigate(`/${workspaceSlug}/wiki/${nextSpace.key}`);
   }

   function togglePageExpanded(pageIdToToggle: string) {
      setExpandedPageIds((items) => (
         items.includes(pageIdToToggle)
            ? items.filter((id) => id !== pageIdToToggle)
            : [...items, pageIdToToggle]
      ));
   }

   async function createSpace(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!spaceForm.name.trim()) return;
      if (spaceForm.type === 'TEAM' && !spaceForm.teamId) {
         toast.error(fa.knowledge.selectTeam);
         return;
      }
      if (spaceForm.type === 'PROJECT' && !spaceForm.projectId) {
         toast.error(fa.knowledge.selectProject);
         return;
      }
      setSubmittingSpace(true);
      try {
         const created = await taskaraRequest<TaskaraKnowledgeSpace>('/knowledge/spaces', {
            method: 'POST',
            body: JSON.stringify({
               type: spaceForm.type,
               name: spaceForm.name.trim(),
               key: spaceForm.key.trim() || undefined,
               teamId: spaceForm.type === 'TEAM' ? spaceForm.teamId : undefined,
               projectId: spaceForm.type === 'PROJECT' ? spaceForm.projectId : undefined,
            }),
         });
         setSpaceDialogOpen(false);
         setSpaceForm(emptySpaceForm);
         await loadSpaces();
         navigate(`/${workspaceSlug}/wiki/${created.key}`);
         dispatchWorkspaceRefresh({ source: 'knowledge:space:create' });
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.createSpaceFailed);
      } finally {
         setSubmittingSpace(false);
      }
   }

   function openSpaceDialog(seedFromRoute = false) {
      if (!seedFromRoute || !spaceKey) {
         setSpaceDialogOpen(true);
         return;
      }

      const routeTeam = teams.find((team) => `team-${team.slug}` === spaceKey);
      if (routeTeam) {
         setSpaceForm({
            type: 'TEAM',
            teamId: routeTeam.id,
            projectId: '',
            key: `team-${routeTeam.slug}`,
            name: `${routeTeam.name} ${fa.knowledge.teamSpace}`,
         });
         setSpaceDialogOpen(true);
         return;
      }

      const routeProject = projects.find((project) => `project-${project.keyPrefix.toLowerCase()}` === spaceKey);
      if (routeProject) {
         setSpaceForm({
            type: 'PROJECT',
            teamId: '',
            projectId: routeProject.id,
            key: `project-${routeProject.keyPrefix.toLowerCase()}`,
            name: `${routeProject.name} ${fa.knowledge.projectSpace}`,
         });
      }
      setSpaceDialogOpen(true);
   }

   async function createPage(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!selectedSpace || !pageForm.title.trim()) return;
      setSubmittingPage(true);
      try {
         const created = await taskaraRequest<TaskaraKnowledgePage>('/knowledge/pages', {
            method: 'POST',
            body: JSON.stringify({
               spaceId: selectedSpace.id,
               parentId: pageForm.parentId || undefined,
               title: pageForm.title.trim(),
               status: 'PUBLISHED',
            }),
         });
         setPageDialogOpen(false);
         setPageForm(emptyPageForm);
         await loadPages(selectedSpace);
         navigate(`/${workspaceSlug}/wiki/${selectedSpace.key}/${created.id}`);
         dispatchWorkspaceRefresh({ source: 'knowledge:page:create' });
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.createFailed);
      } finally {
         setSubmittingPage(false);
      }
   }

   function openPageDialog(parentId = '') {
      setPageForm({
         ...emptyPageForm,
         parentId,
      });
      setPageDialogOpen(true);
   }

   async function savePage() {
      if (!selectedPage || !titleDraft.trim()) return;
      setSavingPage(true);
      try {
         const updated = await taskaraRequest<TaskaraKnowledgePage>(
            `/knowledge/pages/${encodeURIComponent(selectedPage.id)}`,
            {
               method: 'PATCH',
               body: JSON.stringify({
                  title: titleDraft.trim(),
                  content: contentFromEditorValue(contentDraft),
                  labels: parseLabels(labelsDraft),
                  baseVersion: selectedPage.version,
               }),
            }
         );
         setSelectedPage(updated);
         setPages((items) => items.map((item) => (item.id === updated.id ? updated : item)));
         setLabelsDraft((updated.labels || []).map((item) => item.label.name).join(', '));
         toast.success(fa.knowledge.saved);
         dispatchWorkspaceRefresh({ source: 'knowledge:page:update' });
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.updateFailed);
      } finally {
         setSavingPage(false);
      }
   }

   async function archivePage() {
      if (!selectedPage || !selectedSpace || !window.confirm(fa.knowledge.archiveConfirm)) return;
      try {
         await taskaraRequest(`/knowledge/pages/${encodeURIComponent(selectedPage.id)}`, { method: 'DELETE' });
         toast.success(fa.knowledge.archived);
         const remaining = await loadPages(selectedSpace);
         const nextPage = remaining.find((page) => page.id !== selectedPage.id);
         navigate(nextPage ? `/${workspaceSlug}/wiki/${selectedSpace.key}/${nextPage.id}` : `/${workspaceSlug}/wiki/${selectedSpace.key}`);
         dispatchWorkspaceRefresh({ source: 'knowledge:page:archive' });
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.updateFailed);
      }
   }

   async function toggleVerification() {
      if (!selectedPage) return;
      setVerifying(true);
      try {
         const updated = await taskaraRequest<TaskaraKnowledgePage>(
            `/knowledge/pages/${encodeURIComponent(selectedPage.id)}/verify`,
            {
               method: selectedPage.verified ? 'DELETE' : 'POST',
               body: selectedPage.verified ? undefined : JSON.stringify({}),
            }
         );
         setSelectedPage(updated);
         setPages((items) => items.map((item) => (item.id === updated.id ? updated : item)));
         toast.success(fa.knowledge.verificationUpdated);
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.updateFailed);
      } finally {
         setVerifying(false);
      }
   }

   async function submitComment(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!selectedPage || !commentBody.trim()) return;
      setCommentSubmitting(true);
      try {
         const comment = await taskaraRequest<TaskaraKnowledgeComment>(
            `/knowledge/pages/${encodeURIComponent(selectedPage.id)}/comments`,
            {
               method: 'POST',
               body: JSON.stringify({ body: commentBody.trim() }),
            }
         );
         setComments((items) => [...items, comment]);
         setCommentBody('');
         toast.success(fa.knowledge.commentCreated);
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.commentFailed);
      } finally {
         setCommentSubmitting(false);
      }
   }

   async function openHistory() {
      if (!selectedPage) return;
      setHistoryDialogOpen(true);
      setHistoryLoading(true);
      try {
         const result = await taskaraRequest<TaskaraKnowledgePageVersion[]>(
            `/knowledge/pages/${encodeURIComponent(selectedPage.id)}/versions`
         );
         setVersions(result);
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.loadFailed);
      } finally {
         setHistoryLoading(false);
      }
   }

   async function revertVersion(version: number) {
      if (!selectedPage) return;
      try {
         const updated = await taskaraRequest<TaskaraKnowledgePage>(
            `/knowledge/pages/${encodeURIComponent(selectedPage.id)}/versions/${version}/revert`,
            { method: 'POST' }
         );
         setSelectedPage(updated);
         setTitleDraft(updated.title);
         setContentDraft(editorValueFromContent(updated.content));
         toast.success(fa.knowledge.reverted);
         setHistoryDialogOpen(false);
      } catch (err) {
         toast.error(err instanceof Error ? err.message : fa.knowledge.updateFailed);
      }
   }

   const uploadInlineImages = useCallback(
      async (files: File[]) => {
         if (!selectedPage || files.length === 0) return [];
         setUploadingImages(true);
         try {
            const uploaded = await Promise.all(files.map((file) => uploadKnowledgePageAttachment(selectedPage.id, file)));
            return uploaded.map((attachment) => ({
               altText: attachment.name,
               src: attachment.url,
            }));
         } finally {
            setUploadingImages(false);
         }
      },
      [selectedPage]
   );

   return (
      <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden bg-container text-foreground lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
         <aside className="flex min-h-0 flex-col border-b border-border bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-e">
            <div className="shrink-0 border-b border-border p-3">
               {!loading && spaces.length > 0 ? (
                  <Select dir="rtl" value={selectedSpace?.id || ''} onValueChange={selectSpace}>
                     <SelectTrigger className="h-10 w-full rounded-lg border-sidebar-border bg-sidebar-accent/70 px-3 text-sm font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent">
                        <span className="flex min-w-0 items-center gap-2">
                           <BookOpen className="size-4 shrink-0 text-sidebar-foreground/70" />
                           <SelectValue placeholder={fa.knowledge.title} />
                        </span>
                     </SelectTrigger>
                     <SelectContent className="border-border bg-popover text-popover-foreground">
                        {spaces.map((space) => (
                           <SelectItem key={space.id} value={space.id}>
                              {space.name}
                           </SelectItem>
                        ))}
                        <SelectItem value={createSpaceSelectValue}>{fa.knowledge.createSpace}</SelectItem>
                     </SelectContent>
                  </Select>
               ) : (
                  <div className="flex h-10 min-w-0 items-center gap-2 px-1">
                     <BookOpen className="size-4 shrink-0 text-sidebar-foreground/70" />
                     <h1 className="truncate text-sm font-semibold text-sidebar-accent-foreground">{fa.knowledge.title}</h1>
                  </div>
               )}
            </div>

            {error ? <div className="m-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs leading-5 text-red-200">{error}</div> : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
               {loading ? (
                  <KnowledgeEmptyState>{fa.app.loading}</KnowledgeEmptyState>
               ) : spaces.length === 0 ? (
                  <KnowledgeEmptyState>
                     <span>{fa.knowledge.noSpaces}</span>
                     <Button className="mt-3 h-8 rounded-full bg-indigo-500 px-4 text-xs text-white hover:bg-indigo-400" onClick={() => openSpaceDialog(true)}>
                        {fa.knowledge.createSpace}
                     </Button>
                  </KnowledgeEmptyState>
               ) : (
                  <section className="space-y-1">
                     <div className="mb-1 flex items-center justify-between px-2 text-[11px] text-sidebar-foreground/70">
                        <span>{fa.knowledge.pages}</span>
                        {pagesLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                     </div>
                     {pagesLoading && pageTree.length === 0 ? (
                        <div className="flex h-8 items-center gap-2 rounded-md px-3 text-xs text-muted-foreground">
                           <Loader2 className="size-3 animate-spin" />
                           {fa.app.loading}
                        </div>
                     ) : pageTree.length === 0 ? (
                        <div className="rounded-md px-3 py-2 text-xs leading-5 text-muted-foreground">{fa.knowledge.noPages}</div>
                     ) : selectedSpace ? (
                        <PageTreeRows
                           expandedPageIds={expandedPageIds}
                           nodes={pageTree}
                           selectedPageId={selectedPage?.id}
                           spaceKey={selectedSpace.key}
                           workspaceSlug={workspaceSlug}
                           onCreateChild={openPageDialog}
                           onTogglePage={togglePageExpanded}
                        />
                     ) : null}
                  </section>
               )}
            </div>

            <div className="border-t border-border p-3">
               <Button
                  className="h-9 w-full gap-2 rounded-full bg-sidebar-accent text-sm font-normal text-sidebar-accent-foreground hover:bg-sidebar-accent/80 disabled:text-muted-foreground"
                  disabled={!selectedSpace}
                  onClick={() => openPageDialog()}
               >
                  <Plus className="size-4" />
                  {fa.knowledge.newPage}
               </Button>
            </div>
         </aside>

         <main className="min-h-0 overflow-y-auto">
            {selectedPage ? (
               <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col px-5 py-5 lg:px-8">
                  <div className="space-y-4">
                     <Input
                        className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold leading-tight text-foreground shadow-none outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        placeholder={fa.knowledge.pageTitle}
                     />
                     <DescriptionEditor
                        value={contentDraft}
                        onChange={setContentDraft}
                        placeholder={fa.knowledge.contentPlaceholder}
                        users={users}
                        variant="plain"
                        showToolbar={false}
                        contentClassName="min-h-[420px] pr-0 text-[15px] leading-7 text-foreground"
                        placeholderClassName="pr-0 text-[15px]"
                        uploadInlineImages={uploadInlineImages}
                        onInlineImageUploadError={(err) => toast.error(err instanceof Error ? err.message : fa.knowledge.attachmentUploadFailed)}
                     />
                  </div>
               </div>
            ) : (
               <div className="flex h-full min-h-[420px] items-center justify-center p-6">
                  <KnowledgeEmptyState>
                     <span>{fa.knowledge.noPageSelected}</span>
                     {selectedSpace ? (
                        <Button className="mt-3 h-8 rounded-full bg-indigo-500 px-4 text-xs text-white hover:bg-indigo-400" onClick={() => openPageDialog()}>
                           {fa.knowledge.createPage}
                        </Button>
                     ) : spaceKey ? (
                        <Button className="mt-3 h-8 rounded-full bg-indigo-500 px-4 text-xs text-white hover:bg-indigo-400" onClick={() => openSpaceDialog(true)}>
                           {fa.knowledge.createSpace}
                        </Button>
                     ) : null}
                  </KnowledgeEmptyState>
               </div>
            )}
         </main>

         <aside className="hidden min-h-0 flex-col border-s border-border bg-card xl:flex">
            {selectedPage ? (
               <>
                  <section className="border-b border-border px-3 py-3">
                     <div className="mb-3 flex items-center justify-between gap-2 px-2">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                           <BookOpen className="size-3.5 shrink-0" />
                           <span className="truncate">{selectedSpace?.name}</span>
                           {detailsLoading || uploadingImages ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        </div>
                        <Button
                           size="sm"
                           className="h-7 rounded-md bg-indigo-500 px-3 text-xs font-normal text-white hover:bg-indigo-400 disabled:bg-white/[0.055] disabled:text-zinc-500"
                           disabled={savingPage || !titleDraft.trim() || !hasUnsavedPageChanges}
                           onClick={() => void savePage()}
                        >
                           {savingPage ? <Loader2 className="size-3.5 animate-spin" /> : null}
                           {savingPage ? fa.knowledge.saving : fa.app.save}
                        </Button>
                     </div>

                     <dl className="space-y-0.5 text-xs">
                        <MetadataRow icon={<BadgeCheck className="size-4" />} label={fa.issue.status}>
                           <span
                              className={cn(
                                 'inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                                 selectedPage.verified
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'
                                    : 'bg-muted text-muted-foreground'
                              )}
                           >
                              <span
                                 className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    selectedPage.verified ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-muted-foreground/50'
                                 )}
                              />
                              {selectedPage.verified ? fa.knowledge.verified : fa.knowledge.unverified}
                           </span>
                        </MetadataRow>
                        <MetadataRow icon={<UserRound className="size-4" />} label={fa.knowledge.owner}>
                           {selectedPage.owner ? (
                              <span className="inline-flex min-w-0 items-center gap-2">
                                 <LinearAvatar name={selectedPage.owner.name} src={selectedPage.owner.avatarUrl} className="size-5" />
                                 <span className="truncate">{selectedPage.owner.name}</span>
                              </span>
                           ) : (
                              fa.app.unset
                           )}
                        </MetadataRow>
                        <MetadataRow icon={<CalendarDays className="size-4" />} label={fa.knowledge.createdAt}>
                           {formatJalaliDateTime(selectedPage.createdAt)}
                        </MetadataRow>
                        <MetadataRow icon={<Clock3 className="size-4" />} label={fa.knowledge.updatedAt}>
                           {formatJalaliDateTime(selectedPage.updatedAt)}
                        </MetadataRow>
                        <MetadataRow icon={<Tags className="size-4" />} label={fa.knowledge.labels}>
                           <div className="min-w-0 space-y-2">
                              <Input
                                 className="h-8 rounded-md border-border bg-muted/60 px-2 text-xs text-foreground shadow-none placeholder:text-muted-foreground/70 hover:bg-muted focus-visible:border-ring focus-visible:ring-0"
                                 value={labelsDraft}
                                 onChange={(event) => setLabelsDraft(event.target.value)}
                                 placeholder={fa.knowledge.labelsPlaceholder}
                              />
                              {selectedPage.labels?.length ? (
                                 <span className="flex flex-wrap gap-1">
                                    {selectedPage.labels.map((item) => (
                                       <span key={item.label.id} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-foreground">
                                          {item.label.name}
                                       </span>
                                    ))}
                                 </span>
                              ) : null}
                           </div>
                        </MetadataRow>
                     </dl>

                     <div className="mt-3 border-t border-border pt-2">
                        <SidebarAction
                           icon={verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                           disabled={verifying}
                           onClick={() => void toggleVerification()}
                        >
                           {selectedPage.verified ? fa.knowledge.removeVerification : fa.knowledge.verify}
                        </SidebarAction>
                        <SidebarAction icon={<Plus className="size-4" />} onClick={() => openPageDialog(selectedPage.id)}>
                           {fa.knowledge.newChildPage}
                        </SidebarAction>
                        <SidebarAction icon={<History className="size-4" />} onClick={() => void openHistory()}>
                           {fa.knowledge.versions}
                        </SidebarAction>
                        <SidebarAction
                           destructive
                           icon={<Archive className="size-4" />}
                           onClick={() => void archivePage()}
                        >
                           {fa.knowledge.archive}
                        </SidebarAction>
                     </div>
                  </section>

                  <section className="flex min-h-0 flex-1 flex-col">
                     <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium text-foreground">
                        <MessageSquare className="size-4 text-muted-foreground" />
                        {fa.knowledge.comments}
                     </div>
                     <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        {comments.length === 0 ? (
                           <KnowledgeEmptyState>{fa.issue.noActivity}</KnowledgeEmptyState>
                        ) : (
                           <div className="space-y-3">
                              {comments.map((comment) => (
                                 <div key={comment.id} className="rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                       <span className="flex min-w-0 items-center gap-2">
                                          <LinearAvatar name={comment.author?.name} src={comment.author?.avatarUrl} className="size-6" />
                                          <span className="truncate text-sm text-foreground">{comment.author?.name || fa.app.unknown}</span>
                                       </span>
                                       <span className="shrink-0 text-[11px] text-muted-foreground">{formatJalaliDateTime(comment.createdAt)}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">{comment.body}</p>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                     <form className="border-t border-border p-3" onSubmit={(event) => void submitComment(event)}>
                        <Textarea
                           className="min-h-20 resize-none rounded-lg border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground/70"
                           value={commentBody}
                           onChange={(event) => setCommentBody(event.target.value)}
                           placeholder={fa.knowledge.leaveComment}
                        />
                        <div className="mt-2 flex justify-end">
                           <Button
                              className="h-8 gap-2 rounded-full bg-indigo-500 px-4 text-sm font-normal text-white hover:bg-indigo-400 disabled:bg-indigo-500/40"
                              disabled={!commentBody.trim() || commentSubmitting}
                              type="submit"
                           >
                              {commentSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                              {fa.app.save}
                           </Button>
                        </div>
                     </form>
                  </section>
               </>
            ) : null}
         </aside>

         <Dialog open={spaceDialogOpen} onOpenChange={setSpaceDialogOpen}>
            <DialogContent className="border-border bg-popover text-popover-foreground">
               <DialogHeader>
                  <DialogTitle>{fa.knowledge.createSpace}</DialogTitle>
                  <DialogDescription className="text-muted-foreground">{fa.knowledge.spaceScopeDescription}</DialogDescription>
               </DialogHeader>
               <form className="space-y-4" onSubmit={(event) => void createSpace(event)}>
                  <Field label={fa.knowledge.spaceType}>
                     <Select
                        value={spaceForm.type}
                        onValueChange={(type) =>
                           setSpaceForm((current) => ({
                              ...current,
                              type: type as TaskaraKnowledgeSpace['type'],
                              teamId: '',
                              projectId: '',
                           }))
                        }
                     >
                        <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-sm text-foreground">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-popover text-popover-foreground">
                           <SelectItem value="WORKSPACE">{fa.knowledge.workspaceSpace}</SelectItem>
                           <SelectItem value="TEAM">{fa.knowledge.teamSpace}</SelectItem>
                           <SelectItem value="PROJECT">{fa.knowledge.projectSpace}</SelectItem>
                        </SelectContent>
                     </Select>
                  </Field>
                  {spaceForm.type === 'TEAM' ? (
                     <Field label={fa.knowledge.teamSpace}>
                        <Select
                           value={toSelectValue(spaceForm.teamId)}
                           onValueChange={(value) => {
                              const teamId = fromSelectValue(value);
                              const team = teams.find((item) => item.id === teamId);
                              setSpaceForm((current) => ({
                                 ...current,
                                 teamId,
                                 key: team ? `team-${team.slug}` : current.key,
                                 name: current.name || (team ? `${team.name} ${fa.knowledge.teamSpace}` : current.name),
                              }));
                           }}
                        >
                           <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-sm text-foreground">
                              <SelectValue placeholder={fa.knowledge.selectTeam} />
                           </SelectTrigger>
                           <SelectContent className="border-border bg-popover text-popover-foreground">
                              <SelectItem value={EMPTY_SELECT_VALUE}>{fa.knowledge.selectTeam}</SelectItem>
                              {teams.map((team) => (
                                 <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  ) : null}
                  {spaceForm.type === 'PROJECT' ? (
                     <Field label={fa.knowledge.projectSpace}>
                        <Select
                           value={toSelectValue(spaceForm.projectId)}
                           onValueChange={(value) => {
                              const projectId = fromSelectValue(value);
                              const project = projects.find((item) => item.id === projectId);
                              setSpaceForm((current) => ({
                                 ...current,
                                 projectId,
                                 key: project ? `project-${project.keyPrefix.toLowerCase()}` : current.key,
                                 name: current.name || (project ? `${project.name} ${fa.knowledge.projectSpace}` : current.name),
                              }));
                           }}
                        >
                           <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-sm text-foreground">
                              <SelectValue placeholder={fa.knowledge.selectProject} />
                           </SelectTrigger>
                           <SelectContent className="border-border bg-popover text-popover-foreground">
                              <SelectItem value={EMPTY_SELECT_VALUE}>{fa.knowledge.selectProject}</SelectItem>
                              {projects.map((project) => (
                                 <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  ) : null}
                  <Field label={fa.knowledge.spaceName}>
                     <Input
                        className="border-border bg-muted/40 text-foreground"
                        value={spaceForm.name}
                        onChange={(event) => setSpaceForm((current) => ({ ...current, name: event.target.value }))}
                     />
                  </Field>
                  <Field label={fa.knowledge.spaceKey}>
                     <Input
                        className="border-border bg-muted/40 text-foreground"
                        value={spaceForm.key}
                        onChange={(event) => setSpaceForm((current) => ({ ...current, key: event.target.value }))}
                        placeholder="workspace-handbook"
                     />
                  </Field>
                  <div className="flex justify-end gap-2">
                     <Button type="button" variant="ghost" onClick={() => setSpaceDialogOpen(false)}>
                        {fa.app.cancel}
                     </Button>
                     <Button
                        className="bg-indigo-500 hover:bg-indigo-400"
                        disabled={
                           !spaceForm.name.trim() ||
                           submittingSpace ||
                           (spaceForm.type === 'TEAM' && !spaceForm.teamId) ||
                           (spaceForm.type === 'PROJECT' && !spaceForm.projectId)
                        }
                        type="submit"
                     >
                        {submittingSpace ? <Loader2 className="size-4 animate-spin" /> : fa.knowledge.createSpace}
                     </Button>
                  </div>
               </form>
            </DialogContent>
         </Dialog>

         <Dialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
            <DialogContent className="border-border bg-popover text-popover-foreground">
               <DialogHeader>
                  <DialogTitle>{fa.knowledge.createPage}</DialogTitle>
                  <DialogDescription className="text-muted-foreground">{selectedSpace?.name || fa.knowledge.title}</DialogDescription>
               </DialogHeader>
               <form className="space-y-4" onSubmit={(event) => void createPage(event)}>
                  <Field label={fa.knowledge.pageTitle}>
                     <Input
                        className="border-border bg-muted/40 text-foreground"
                        value={pageForm.title}
                        onChange={(event) => setPageForm((current) => ({ ...current, title: event.target.value }))}
                     />
                  </Field>
                  <Field label={fa.knowledge.parentPage}>
                     <Select
                        value={toSelectValue(pageForm.parentId)}
                        onValueChange={(value) => setPageForm((current) => ({ ...current, parentId: fromSelectValue(value) }))}
                     >
                        <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-sm text-foreground">
                           <SelectValue placeholder={fa.knowledge.rootPage} />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-popover text-popover-foreground">
                           <SelectItem value={EMPTY_SELECT_VALUE}>{fa.knowledge.rootPage}</SelectItem>
                           {sortedPages.map((page) => (
                              <SelectItem key={page.id} value={page.id}>
                                 {'— '.repeat(Math.max(0, page.path.split('/').length - 1))}
                                 {page.title}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
                  <div className="flex justify-end gap-2">
                     <Button type="button" variant="ghost" onClick={() => setPageDialogOpen(false)}>
                        {fa.app.cancel}
                     </Button>
                     <Button className="bg-indigo-500 hover:bg-indigo-400" disabled={!pageForm.title.trim() || submittingPage || !selectedSpace} type="submit">
                        {submittingPage ? <Loader2 className="size-4 animate-spin" /> : fa.knowledge.createPage}
                     </Button>
                  </div>
               </form>
            </DialogContent>
         </Dialog>

         <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
            <DialogContent className="max-h-[80vh] overflow-hidden border-border bg-popover text-popover-foreground">
               <DialogHeader>
                  <DialogTitle>{fa.knowledge.versionHistory}</DialogTitle>
                  <DialogDescription className="text-muted-foreground">{selectedPage?.title}</DialogDescription>
               </DialogHeader>
               <div className="max-h-[58vh] overflow-y-auto">
                  {historyLoading ? (
                     <KnowledgeEmptyState>{fa.app.loading}</KnowledgeEmptyState>
                  ) : (
                     <div className="space-y-2">
                        {versions.map((version) => (
                           <div key={version.id} className="rounded-lg border border-border bg-muted/40 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                 <div className="flex min-w-0 items-center gap-2">
                                    <Clock3 className="size-4 text-muted-foreground" />
                                    <span className="text-sm text-foreground">v{version.version.toLocaleString('fa-IR')}</span>
                                    <span className="truncate text-xs text-muted-foreground">{formatJalaliDateTime(version.createdAt)}</span>
                                 </div>
                                 <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                    onClick={() => void revertVersion(version.version)}
                                 >
                                    {fa.knowledge.revert}
                                 </Button>
                              </div>
                              <div className="text-sm font-medium text-foreground">{version.title}</div>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{version.contentText || fa.inbox.noDescription}</p>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </DialogContent>
         </Dialog>
      </div>
   );
}

function KnowledgeEmptyState({ children }: { children: ReactNode }) {
   return (
      <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm leading-6 text-muted-foreground">
         {children}
      </div>
   );
}

function PageTreeRows({
   expandedPageIds,
   nodes,
   onCreateChild,
   onTogglePage,
   selectedPageId,
   spaceKey,
   workspaceSlug,
   depth = 0,
}: {
   expandedPageIds: string[];
   nodes: PageTreeNode[];
   onCreateChild?: (parentId?: string) => void;
   onTogglePage: (pageId: string) => void;
   selectedPageId?: string;
   spaceKey: string;
   workspaceSlug: string;
   depth?: number;
}) {
   return (
      <div className="space-y-0.5">
         {nodes.map((page) => {
            const hasChildren = page.children.length > 0;
            const expanded = expandedPageIds.includes(page.id);

            return (
               <div key={page.id}>
                  <div
                     className={cn(
                        'group flex h-8 min-w-0 items-center rounded-md text-sm transition',
                        page.id === selectedPageId
                           ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                           : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                     )}
                     style={{ paddingRight: `${28 + depth * 14}px` }}
                  >
                     <button
                        className={cn(
                           'flex size-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition',
                           hasChildren ? 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground' : 'invisible'
                        )}
                        type="button"
                        disabled={!hasChildren}
                        onClick={(event) => {
                           event.preventDefault();
                           event.stopPropagation();
                           onTogglePage(page.id);
                        }}
                        aria-label={expanded ? 'Collapse page' : 'Expand page'}
                     >
                        {expanded ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3" />}
                     </button>
                     <Link
                        className="flex min-w-0 flex-1 items-center gap-2 py-1.5"
                        to={`/${workspaceSlug}/wiki/${spaceKey}/${page.id}`}
                     >
                        <FileText className="size-4 shrink-0 text-sidebar-foreground/70" />
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                        {page.verified ? <BadgeCheck className="size-3.5 shrink-0 text-emerald-400" /> : null}
                     </Link>
                     {onCreateChild ? (
                        <button
                           className="ms-1 me-1 flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 opacity-0 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover:opacity-100"
                           type="button"
                           onClick={() => onCreateChild(page.id)}
                           aria-label={fa.knowledge.newChildPage}
                        >
                           <Plus className="size-3.5" />
                        </button>
                     ) : null}
                  </div>
                  {hasChildren && expanded ? (
                     <PageTreeRows
                        expandedPageIds={expandedPageIds}
                        nodes={page.children}
                        selectedPageId={selectedPageId}
                        spaceKey={spaceKey}
                        workspaceSlug={workspaceSlug}
                        onCreateChild={onCreateChild}
                        onTogglePage={onTogglePage}
                        depth={depth + 1}
                     />
                  ) : null}
               </div>
            );
         })}
      </div>
   );
}

function MetadataRow({
   children,
   icon,
   label,
}: {
   children: ReactNode;
   icon: ReactNode;
   label: string;
}) {
   return (
      <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3 rounded-md px-2 py-2 transition hover:bg-muted/50">
         <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
            <span className="truncate">{label}</span>
         </dt>
         <dd className="min-w-0 text-foreground">{children}</dd>
      </div>
   );
}

function SidebarAction({
   children,
   destructive = false,
   disabled = false,
   icon,
   onClick,
}: {
   children: ReactNode;
   destructive?: boolean;
   disabled?: boolean;
   icon: ReactNode;
   onClick: () => void;
}) {
   return (
      <button
         className={cn(
            'flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-start text-xs transition disabled:cursor-not-allowed disabled:opacity-50',
            destructive
               ? 'text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-200'
               : 'text-muted-foreground hover:bg-muted hover:text-foreground'
         )}
         disabled={disabled}
         type="button"
         onClick={onClick}
      >
         <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
         <span className="min-w-0 truncate">{children}</span>
      </button>
   );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
   return (
      <label className="block space-y-2">
         <span className="text-sm text-muted-foreground">{label}</span>
         {children}
      </label>
   );
}

function buildPageTree(items: TaskaraKnowledgePage[]): PageTreeNode[] {
   const sorted = [...items].sort(compareKnowledgePages);
   const nodes = new Map<string, PageTreeNode>();
   const roots: PageTreeNode[] = [];

   for (const item of sorted) {
      nodes.set(item.id, { ...item, children: [] });
   }

   for (const item of sorted) {
      const node = nodes.get(item.id);
      if (!node) continue;
      if (item.parentId && nodes.has(item.parentId)) {
         nodes.get(item.parentId)?.children.push(node);
      } else {
         roots.push(node);
      }
   }

   sortPageTree(roots);
   return roots;
}

function collectExpandablePageIds(nodes: PageTreeNode[]): string[] {
   return nodes.flatMap((node) => [
      ...(node.children.length ? [node.id] : []),
      ...collectExpandablePageIds(node.children),
   ]);
}

function findPageAncestorIds(nodes: PageTreeNode[], targetId: string, ancestors: string[] = []): string[] {
   for (const node of nodes) {
      if (node.id === targetId) return ancestors;
      const result = findPageAncestorIds(node.children, targetId, [...ancestors, node.id]);
      if (result.length) return result;
   }
   return [];
}

function sortPageTree(nodes: PageTreeNode[]) {
   nodes.sort(compareKnowledgePages);
   for (const node of nodes) sortPageTree(node.children);
}

function compareKnowledgePages(a: TaskaraKnowledgePage, b: TaskaraKnowledgePage) {
   const positionDelta = (a.position || 0) - (b.position || 0);
   if (positionDelta !== 0) return positionDelta;
   return a.path.localeCompare(b.path, 'fa');
}

function editorValueFromContent(content: unknown): string {
   if (!content) return '';
   if (typeof content === 'string') return content;
   try {
      return JSON.stringify(content);
   } catch {
      return '';
   }
}

function contentFromEditorValue(value: string): unknown {
   const trimmed = value.trim();
   if (!trimmed) return undefined;
   if (!trimmed.startsWith('{')) return trimmed;
   try {
      return JSON.parse(trimmed);
   } catch {
      return trimmed;
   }
}

function contentDirtyValue(content: unknown): string {
   return JSON.stringify(normalizeKnowledgeContentForDirty(content));
}

function normalizeKnowledgeContentForDirty(content: unknown): unknown {
   if (typeof content === 'string') {
      const parsed = parseSerializedEditorContent(content);
      return normalizeJsonForDirty(parsed || plainTextToLexicalContent(content));
   }

   if (!content) {
      return normalizeJsonForDirty(plainTextToLexicalContent(''));
   }

   return normalizeJsonForDirty(content);
}

function parseSerializedEditorContent(value: string): unknown | null {
   const trimmed = value.trim();
   if (!trimmed.startsWith('{')) return null;

   try {
      const parsed = JSON.parse(trimmed) as { root?: { children?: unknown[]; type?: unknown } } | null;
      if (parsed?.root && parsed.root.type === 'root' && Array.isArray(parsed.root.children)) {
         return parsed;
      }
   } catch {
      return null;
   }

   return null;
}

function plainTextToLexicalContent(value: string) {
   const lines = value.split('\n');
   const children = lines
      .map((line, index) => {
         if (index !== 0 && !line && lines.length <= 1) return null;
         return {
            children: line ? [{ text: line, type: 'text' }] : [],
            type: 'paragraph',
         };
      })
      .filter(Boolean);

   return {
      root: {
         children: children.length ? children : [{ children: [], type: 'paragraph' }],
         type: 'root',
      },
   };
}

function normalizeJsonForDirty(value: unknown): unknown {
   if (Array.isArray(value)) return value.map(normalizeJsonForDirty);
   if (!value || typeof value !== 'object') return value;

   const normalized: Record<string, unknown> = {};
   Object.keys(value as Record<string, unknown>)
      .sort()
      .forEach((key) => {
         const nextValue = (value as Record<string, unknown>)[key];
         if (isDefaultLexicalValue(key, nextValue)) return;
         normalized[key] = normalizeJsonForDirty(nextValue);
      });
   return normalized;
}

function isDefaultLexicalValue(key: string, value: unknown) {
   if (key === 'version' && value === 1) return true;
   if (key === 'direction' && value === null) return true;
   if (key === 'indent' && value === 0) return true;
   if (key === 'detail' && value === 0) return true;
   if (key === 'format' && (value === '' || value === 0)) return true;
   if (key === 'mode' && value === 'normal') return true;
   if (key === 'style' && value === '') return true;
   if (key === 'textFormat' && value === 0) return true;
   if (key === 'textStyle' && value === '') return true;
   return false;
}

function parseLabels(value: string): string[] {
   return [...new Set(value.split(',').map((label) => label.trim()).filter(Boolean))];
}
