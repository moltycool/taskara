import * as React from 'react';
import { AlertCircle, Bot, CheckCircle2, Loader2, Mic, MicOff, Send, Sparkles, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { taskaraRequest } from '@/lib/taskara-client';
import { cn } from '@/lib/utils';

type AssistantMessageRole = 'assistant' | 'user';
type AssistantMessageStatus = 'completed' | 'blocked' | 'needs_clarification' | 'unsupported';

interface AssistantMessage {
   id: string;
   role: AssistantMessageRole;
   content: string;
   status?: AssistantMessageStatus;
}

interface AssistantApiResponse {
   ok: boolean;
   status: AssistantMessageStatus;
   message: string;
   task?: {
      key?: string;
      title?: string;
   };
}

interface SpeechRecognitionLike {
   lang: string;
   continuous: boolean;
   interimResults: boolean;
   start: () => void;
   stop: () => void;
   abort: () => void;
   onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
   onend: (() => void) | null;
   onerror: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const initialMessages: AssistantMessage[] = [
   {
      id: 'assistant-welcome',
      role: 'assistant',
      content: 'درخواستت را بنویس یا با میکروفون بگو. فعلا می‌توانم تسک بسازم، تسک را ویرایش کنم یا روی تسک کامنت بگذارم.',
   },
];

export function AiAssistantDock() {
   const [open, setOpen] = React.useState(false);
   const [messages, setMessages] = React.useState<AssistantMessage[]>(initialMessages);
   const [draft, setDraft] = React.useState('');
   const [submitting, setSubmitting] = React.useState(false);
   const [recording, setRecording] = React.useState(false);
   const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
   const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
   const speechSupported = Boolean(speechRecognitionConstructor());

   React.useEffect(() => {
      if (!open) return;
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
   }, [messages, open]);

   React.useEffect(() => () => {
      recognitionRef.current?.abort();
   }, []);

   async function submitMessage(event?: React.FormEvent<HTMLFormElement>) {
      event?.preventDefault();
      const text = draft.trim();
      if (!text || submitting) return;

      const userMessage: AssistantMessage = {
         id: crypto.randomUUID(),
         role: 'user',
         content: text,
      };
      setMessages((current) => [...current, userMessage]);
      setDraft('');
      setSubmitting(true);

      try {
         const response = await taskaraRequest<AssistantApiResponse>('/ai/assistant/message', {
            method: 'POST',
            body: JSON.stringify({
               message: text,
               clientNow: new Date().toISOString(),
               timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
         });
         setMessages((current) => [
            ...current,
            {
               id: crypto.randomUUID(),
               role: 'assistant',
               content: response.message,
               status: response.status,
            },
         ]);
         if (response.ok) {
            toast.success(response.task?.key ? `${response.task.key} انجام شد.` : 'درخواست انجام شد.');
         }
      } catch (error) {
         const message = error instanceof Error ? error.message : 'ارتباط با AI ناموفق بود.';
         setMessages((current) => [
            ...current,
            {
               id: crypto.randomUUID(),
               role: 'assistant',
               content: message,
               status: 'blocked',
            },
         ]);
         toast.error(message);
      } finally {
         setSubmitting(false);
      }
   }

   function toggleRecording() {
      if (recording) {
         recognitionRef.current?.stop();
         setRecording(false);
         return;
      }

      const Recognition = speechRecognitionConstructor();
      if (!Recognition) {
         toast.error('مرورگر شما ورودی صوتی را پشتیبانی نمی‌کند.');
         return;
      }

      const recognition = new Recognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
         const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript || '')
            .join(' ')
            .trim();
         if (transcript) setDraft(transcript);
      };
      recognition.onerror = () => {
         setRecording(false);
         toast.error('ضبط صدا ناموفق بود.');
      };
      recognition.onend = () => setRecording(false);
      recognitionRef.current = recognition;
      setRecording(true);
      recognition.start();
   }

   return (
      <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-3 text-right" dir="rtl">
         {open ? (
            <section className="flex h-[min(620px,calc(100dvh-6rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#18181b] shadow-2xl">
               <header className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                     <span className="inline-flex size-8 items-center justify-center rounded-md bg-indigo-400/10 text-indigo-200">
                        <Sparkles className="size-4" />
                     </span>
                     <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-100">دستیار AI</div>
                        <div className="truncate text-xs text-zinc-500">اجرای امن فرمان‌های تسک</div>
                     </div>
                  </div>
                  <Button
                     aria-label="بستن دستیار AI"
                     className="size-8 rounded-full text-zinc-500 hover:bg-white/8 hover:text-zinc-100"
                     size="icon"
                     type="button"
                     variant="ghost"
                     onClick={() => setOpen(false)}
                  >
                     <X className="size-4" />
                  </Button>
               </header>

               <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {messages.map((message) => (
                     <AssistantBubble key={message.id} message={message} />
                  ))}
                  {submitting ? (
                     <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2 className="size-3.5 animate-spin" />
                        در حال بررسی و اجرا
                     </div>
                  ) : null}
                  <div ref={messagesEndRef} />
               </div>

               <form className="border-t border-white/8 p-2" onSubmit={(event) => void submitMessage(event)}>
                  <Textarea
                     className="max-h-32 min-h-20 resize-none border-white/10 bg-white/[0.03] text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-300/30"
                     disabled={submitting}
                     placeholder="مثلا: در پروژه ۲ یک تسک با اولویت متوسط به کاربر ۳ با سررسید دو روز دیگر بساز"
                     value={draft}
                     onChange={(event) => setDraft(event.target.value)}
                     onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                           void submitMessage();
                        }
                     }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                     <Button
                        aria-label={recording ? 'توقف ضبط صدا' : 'ضبط پیام صوتی'}
                        className={cn(
                           'size-8 rounded-full border border-white/10 bg-transparent text-zinc-400 hover:bg-white/8 hover:text-zinc-100',
                           recording && 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                        )}
                        disabled={submitting || !speechSupported}
                        size="icon"
                        title={speechSupported ? 'پیام صوتی' : 'ورودی صوتی در این مرورگر پشتیبانی نمی‌شود'}
                        type="button"
                        variant="ghost"
                        onClick={toggleRecording}
                     >
                        {recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                     </Button>
                     <Button
                        className="h-8 gap-2 rounded-full bg-zinc-100 px-3 text-zinc-950 hover:bg-white"
                        disabled={submitting || !draft.trim()}
                        type="submit"
                     >
                        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        ارسال
                     </Button>
                  </div>
               </form>
            </section>
         ) : null}

         <Button
            aria-label="باز کردن دستیار AI"
            className="size-12 rounded-full border border-indigo-300/20 bg-[#1c1c20] text-indigo-200 shadow-2xl shadow-black/40 hover:bg-[#24242a] hover:text-white"
            size="icon"
            type="button"
            onClick={() => setOpen((current) => !current)}
         >
            <Sparkles className="size-5" />
         </Button>
      </div>
   );
}

function AssistantBubble({ message }: { message: AssistantMessage }) {
   const isUser = message.role === 'user';
   const Icon = isUser
      ? User
      : message.status === 'completed'
        ? CheckCircle2
        : message.status === 'blocked' || message.status === 'unsupported'
          ? AlertCircle
          : Bot;

   return (
      <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
         <div
            className={cn(
               'flex max-w-[86%] gap-2 rounded-lg px-3 py-2 text-sm leading-6',
               isUser
                  ? 'bg-indigo-400/15 text-indigo-50'
                  : 'border border-white/8 bg-white/[0.03] text-zinc-200'
            )}
         >
            <Icon
               className={cn(
                  'mt-1 size-3.5 shrink-0',
                  message.status === 'completed'
                     ? 'text-emerald-300'
                     : message.status === 'blocked' || message.status === 'unsupported'
                       ? 'text-amber-300'
                       : 'text-zinc-500'
               )}
            />
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
         </div>
      </div>
   );
}

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
   if (typeof window === 'undefined') return null;
   const candidate = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
   };
   return candidate.SpeechRecognition || candidate.webkitSpeechRecognition || null;
}
