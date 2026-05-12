function envValue(names: string[]): string | undefined {
   const config = typeof window === 'undefined' ? undefined : window.__TASKARA_CONFIG__;
   for (const name of names) {
      const runtimeValue = config?.[name as keyof typeof config];
      if (typeof runtimeValue === 'string' && runtimeValue.trim()) return runtimeValue.trim();

      const buildValue = (import.meta.env as Record<string, unknown>)[name];
      if (typeof buildValue === 'string' && buildValue.trim()) return buildValue.trim();
   }
   return undefined;
}

function parseAiTestUserIds(): Set<string> {
   const raw = envValue(['TASKARA_AI_TEST_USER_IDS', 'VITE_TASKARA_AI_TEST_USER_IDS']) || '';
   return new Set(
      raw
         .split(',')
         .map((item) => item.trim())
         .filter(Boolean)
   );
}

const aiTestUserIds = parseAiTestUserIds();

export function isAiEnabledForUserId(userId?: string | null): boolean {
   if (!userId) return false;
   return aiTestUserIds.has(userId);
}
