import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PublicErrorQueue, type ErrorReport } from "@/lib/public-errors";

const ErrorContext = createContext<PublicErrorQueue | null>(null);
const emptySnapshot: readonly never[] = [];

export function PublicErrorProvider({
  queue,
  children,
}: {
  queue: PublicErrorQueue;
  children: ReactNode;
}) {
  useEffect(() => () => queue.clear(), [queue]);
  return (
    <ErrorContext.Provider value={queue}>
      {children}
      <PublicErrorDialog queue={queue} />
    </ErrorContext.Provider>
  );
}

export function PublicErrorDialog({ queue }: { queue: PublicErrorQueue }) {
  const errors = useSyncExternalStore(queue.subscribe, queue.getSnapshot, () => emptySnapshot);
  const error = errors[0];
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (error?.retrying) closeRef.current?.focus();
  }, [error?.retrying]);
  return (
    <AlertDialog
      open={!!error}
      onOpenChange={(open) => {
        if (!open && error) queue.dismiss(error.id);
      }}
    >
      {error && (
        <AlertDialogContent
          className="w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg"
          onOpenAutoFocus={(event) => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            closeRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
          onEscapeKeyDown={() => queue.dismiss(error.id)}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{error.title}</AlertDialogTitle>
            <AlertDialogDescription>{error.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {error.traceId && (
            <p className="break-all text-xs text-muted-foreground">
              追踪标识：<span className="select-all">{error.traceId}</span>
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button ref={closeRef} variant="outline" onClick={() => queue.dismiss(error.id)}>
              关闭
            </Button>
            {error.canRetry && (
              <Button disabled={error.retrying} onClick={() => void queue.retry(error.id)}>
                {error.retrying && <Loader2 className="animate-spin" aria-hidden="true" />}
                {error.retrying ? "重试中" : "重试"}
              </Button>
            )}
          </div>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}

/** Capture this entry before starting a read. Unmount/scope changes retire the lease. */
// The hook intentionally shares this provider context.
// eslint-disable-next-line react-refresh/only-export-components
export function usePublicError() {
  const queue = useContext(ErrorContext);
  if (!queue) throw new Error("usePublicError requires PublicErrorProvider");
  const lease = useMemo(() => {
    const state = { active: true };
    return { queue, state, valid: () => state.active };
  }, [queue]);
  useEffect(() => {
    lease.state.active = true;
    return () => {
      lease.state.active = false;
      queue.release(lease);
    };
  }, [queue, lease]);
  return useCallback((input: ErrorReport) => queue.report(lease, input), [queue, lease]);
}
