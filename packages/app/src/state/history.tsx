import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  historyKey,
  normalizeHistory,
  recordHistory,
  type HistoryEntry,
  type HistoryState,
} from '@/lib/watch-history';
import { storage } from '@/storage';

const KEY = '@liberbili/history/v1';
type Value = HistoryState & {
  getEntries(): HistoryEntry[];
  record(entry: HistoryEntry): void;
  remove(key: string): void;
  clear(): void;
  setPaused(paused: boolean): void;
};
const Context = createContext<Value | null>(null);

export function HistoryProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(() =>
    normalizeHistory(storage.getString(KEY)),
  );
  const latest = useRef(state);
  const update = useCallback(
    (change: (value: HistoryState) => HistoryState) => {
      const value = change(latest.current);
      if (value === latest.current) return;
      latest.current = value;
      storage.set(KEY, JSON.stringify(value));
      setState(value);
    },
    [],
  );
  const getEntries = useCallback(() => latest.current.entries, []);
  const record = useCallback(
    (entry: HistoryEntry) => update((value) => recordHistory(value, entry)),
    [update],
  );
  const remove = useCallback(
    (key: string) =>
      update((value) => ({
        ...value,
        entries: value.entries.filter((entry) => historyKey(entry) !== key),
      })),
    [update],
  );
  const clear = useCallback(
    () => update((value) => ({ ...value, entries: [] })),
    [update],
  );
  const setPaused = useCallback(
    (paused: boolean) => update((value) => ({ ...value, paused })),
    [update],
  );
  const value = useMemo(
    () => ({ ...state, getEntries, record, remove, clear, setPaused }),
    [state, getEntries, record, remove, clear, setPaused],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHistory(): Value {
  const value = useContext(Context);
  if (!value) throw new Error('useHistory must be inside HistoryProvider');
  return value;
}
