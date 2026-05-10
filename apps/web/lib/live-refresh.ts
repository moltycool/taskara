import { useCallback, useEffect, useRef } from 'react';

export const workspaceRefreshEvent = 'taskara:workspace-refresh';

type WorkspaceRefreshDetail = {
   source?: string;
};

type LiveRefreshOptions = {
   enabled?: boolean;
   fireOnMount?: boolean;
   intervalMs?: number;
   minIntervalMs?: number;
   refreshOnFocus?: boolean;
   refreshOnInterval?: boolean;
   refreshOnOnline?: boolean;
   refreshOnPageShow?: boolean;
   refreshOnVisibility?: boolean;
   refreshOnWorkspaceEvent?: boolean;
};

export function dispatchWorkspaceRefresh(detail: WorkspaceRefreshDetail = {}) {
   if (typeof window === 'undefined') return;
   window.dispatchEvent(new CustomEvent(workspaceRefreshEvent, { detail }));
}

export function useLiveRefresh(onRefresh: () => void | Promise<void>, options: LiveRefreshOptions = {}) {
   const {
      enabled = true,
      fireOnMount = true,
      intervalMs = 60000,
      minIntervalMs = 1500,
      refreshOnFocus = true,
      refreshOnInterval = true,
      refreshOnOnline = true,
      refreshOnPageShow = true,
      refreshOnVisibility = true,
      refreshOnWorkspaceEvent = true,
   } = options;
   const onRefreshRef = useRef(onRefresh);
   const inFlightRef = useRef(false);
   const queuedRef = useRef(false);
   const lastRunRef = useRef(0);

   useEffect(() => {
      onRefreshRef.current = onRefresh;
   }, [onRefresh]);

   const requestRefresh = useCallback(
      (force = false) => {
         if (!enabled) return;
         const now = Date.now();
         if (!force && now - lastRunRef.current < minIntervalMs) return;
         if (inFlightRef.current) {
            queuedRef.current = true;
            return;
         }

         inFlightRef.current = true;
         lastRunRef.current = now;
         void Promise.resolve(onRefreshRef.current())
            .catch(() => undefined)
            .finally(() => {
               inFlightRef.current = false;
               if (!queuedRef.current) return;
               queuedRef.current = false;
               requestRefresh(true);
            });
      },
      [enabled, minIntervalMs]
   );

   useEffect(() => {
      if (!enabled) return;

      const handleWake = () => {
         if (document.visibilityState === 'hidden') return;
         requestRefresh();
      };
      const handleWorkspaceRefresh = () => {
         if (document.visibilityState === 'hidden') return;
         requestRefresh(true);
      };
      const handlePageShow = () => requestRefresh(true);

      if (fireOnMount) requestRefresh(true);
      const interval = refreshOnInterval ? window.setInterval(handleWake, intervalMs) : null;
      if (refreshOnFocus) window.addEventListener('focus', handleWake);
      if (refreshOnOnline) window.addEventListener('online', handleWake);
      if (refreshOnPageShow) window.addEventListener('pageshow', handlePageShow);
      if (refreshOnWorkspaceEvent) window.addEventListener(workspaceRefreshEvent, handleWorkspaceRefresh);
      if (refreshOnVisibility) document.addEventListener('visibilitychange', handleWake);

      return () => {
         if (interval) window.clearInterval(interval);
         if (refreshOnFocus) window.removeEventListener('focus', handleWake);
         if (refreshOnOnline) window.removeEventListener('online', handleWake);
         if (refreshOnPageShow) window.removeEventListener('pageshow', handlePageShow);
         if (refreshOnWorkspaceEvent) window.removeEventListener(workspaceRefreshEvent, handleWorkspaceRefresh);
         if (refreshOnVisibility) document.removeEventListener('visibilitychange', handleWake);
      };
   }, [
      enabled,
      fireOnMount,
      intervalMs,
      refreshOnFocus,
      refreshOnInterval,
      refreshOnOnline,
      refreshOnPageShow,
      refreshOnVisibility,
      refreshOnWorkspaceEvent,
      requestRefresh,
   ]);
}
