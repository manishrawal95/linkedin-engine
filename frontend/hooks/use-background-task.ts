import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TaskState<T = unknown> {
  running: boolean;
  result: T | null;
  error: string | null;
}

// Persist active task IDs in sessionStorage so we can resume polling after navigation
const STORAGE_KEY = "bg_tasks";

function getStoredTasks(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeTask(hookKey: string, taskId: string): void {
  const tasks = getStoredTasks();
  tasks[hookKey] = taskId;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function clearStoredTask(hookKey: string): void {
  const tasks = getStoredTasks();
  delete tasks[hookKey];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/**
 * Hook for launching and polling background tasks.
 * Survives page navigation: stores task ID in sessionStorage and resumes polling on remount.
 *
 * Usage:
 *   const { running, result, launch } = useBackgroundTask<{ ideas: Idea[] }>({ key: "ideas_generate" });
 *   launch("/api/linkedin/ideas/generate", { method: "POST" }, "Generating ideas...");
 */
export function useBackgroundTask<T = unknown>({
  key,
  onDone,
  successMessage,
}: {
  /** Unique key for this hook instance — used to persist task ID across navigation */
  key?: string;
  onDone?: (result: T) => void;
  successMessage?: string;
} = {}) {
  const [state, setState] = useState<TaskState<T>>({
    running: false,
    result: null,
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const successMessageRef = useRef(successMessage);
  successMessageRef.current = successMessage;

  const stopPolling = useCallback((hookKey?: string) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (hookKey) clearStoredTask(hookKey);
  }, []);

  const pollTask = useCallback(
    (taskId: string) => {
      // Don't start duplicate polling
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/linkedin/tasks/${taskId}`);
          if (!res.ok) return;
          const task = await res.json();

          if (task.status === "done") {
            stopPolling(key);
            const taskResult = task.result as T;
            setState({ running: false, result: taskResult, error: null });
            if (successMessageRef.current) toast.success(successMessageRef.current);
            onDoneRef.current?.(taskResult);
          } else if (task.status === "error") {
            stopPolling(key);
            setState({ running: false, result: null, error: task.error });
            toast.error(task.error || "Task failed");
          }
        } catch {
          // Poll failed, keep trying
        }
      }, 2000);
    },
    [stopPolling, key]
  );

  // On mount: resume polling if there's a stored task for this key
  useEffect(() => {
    if (!key) return;
    const stored = getStoredTasks()[key];
    if (stored) {
      taskIdRef.current = stored;
      setState({ running: true, result: null, error: null });
      pollTask(stored);
    }
  }, [key, pollTask]);

  // Cleanup interval on unmount (but keep sessionStorage so next mount resumes)
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const launch = useCallback(
    async (
      url: string,
      options: RequestInit = {},
      loadingMessage?: string
    ) => {
      setState({ running: true, result: null, error: null });
      if (loadingMessage) toast.info(loadingMessage);

      try {
        const res = await fetch(url, options);
        const data = await res.json();

        if (!res.ok) {
          setState({ running: false, result: null, error: data.detail || "Request failed" });
          toast.error(data.detail || "Request failed");
          return;
        }

        if (data.task_id) {
          taskIdRef.current = data.task_id;
          if (key) storeTask(key, data.task_id);
          pollTask(data.task_id);
        } else {
          // Endpoint returned result directly (not backgrounded)
          setState({ running: false, result: data as T, error: null });
          if (successMessageRef.current) toast.success(successMessageRef.current);
          onDoneRef.current?.(data as T);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setState({ running: false, result: null, error: msg });
        toast.error(msg);
      }
    },
    [pollTask, key]
  );

  return {
    running: state.running,
    result: state.result,
    error: state.error,
    launch,
  };
}
