/**
 * In-memory + localStorage review history store.
 * Uses a simple hand-rolled reactive store so we avoid adding Zustand/Redux.
 */
import { useCallback, useEffect, useState } from "react";
import type { ReviewHistoryEntry } from "@/types";
import dayjs from "dayjs";

const STORAGE_KEY = "qrp_review_history";
const MAX_HISTORY = 50;

type AddEntryPayload = Omit<ReviewHistoryEntry, "id" | "timestamp">;

// ── Module-level state so all hook instances share the same array ─────────────
let _history: ReviewHistoryEntry[] = [];
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function load(): ReviewHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReviewHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: ReviewHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

// Initialise from storage once at module load.
_history = load();

// ── Public store actions ──────────────────────────────────────────────────────

function addEntry(payload: AddEntryPayload): void {
  const entry: ReviewHistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: dayjs().toISOString(),
    ...payload,
  };
  _history = [entry, ..._history].slice(0, MAX_HISTORY);
  persist(_history);
  notify();
}

function clearHistory(): void {
  _history = [];
  persist([]);
  notify();
}

// ── React hook ────────────────────────────────────────────────────────────────

interface HistoryStore {
  entries: ReviewHistoryEntry[];
  addEntry: (payload: AddEntryPayload) => void;
  clearHistory: () => void;
}

export function useHistoryStore(selector?: (s: HistoryStore) => unknown): HistoryStore {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  return { entries: _history, addEntry, clearHistory };
}
