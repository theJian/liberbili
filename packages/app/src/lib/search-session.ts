/**
 * Coordinates paginated video searches and recent-query history for search screens.
 *
 * @remarks
 * To restore history, pass the serialized JSON string read from
 * `SEARCH_HISTORY_KEY` to `readRecentSearches`; it returns a normalized string
 * array, or an empty array for missing or invalid data. Pass that array and a
 * query to `rememberSearch`, then serialize and persist the new array it returns
 * under the same key. To normalize untrusted values directly, use
 * `recentSearches(value)`. All three helpers return new arrays of trimmed,
 * distinct, nonempty strings in first-occurrence order, capped at
 * `SEARCH_HISTORY_LIMIT`; `rememberSearch` moves a nonempty trimmed query first.
 *
 * Construct `SearchSession` with an async loader accepting a `SearchSelection`
 * and a page number starting at 1. The loader receives the trimmed submitted
 * query and returns video summaries with an optional next-page cursor:
 *
 * ```ts
 * type SearchSelection = {
 *   query: string;
 *   order: SearchOrder;
 *   duration: SearchDuration;
 * };
 *
 * type FetchPage = (
 *   selection: SearchSelection,
 *   page: number,
 * ) => Promise<{
 *   items: VideoSummary[];
 *   next?: string;
 * }>;
 * ```
 *
 * `SearchOrder`, `SearchDuration`, and `VideoSummary` come from
 * `@liberbili/api/types`. Return `next` as a string representing an integer page
 * greater than the fetched page; omit it when pagination ends.
 *
 * Call `submit` with a selection to start fresh results, keeping editable input
 * separately. `getSnapshot()` returns the current state:
 *
 * ```ts
 * type State = {
 *   selection?: SearchSelection;
 *   items: VideoSummary[];
 *   loading: boolean;
 *   error?: Error;
 *   next?: string;
 * };
 * ```
 *
 * `subscribe(listener)` calls the listener without arguments when the snapshot
 * changes and returns an unsubscribe function to call when the consumer detaches.
 * Later pages append results, deduplicated by `bvid`. `more` loads the next page
 * for the submitted selection, while `retry` repeats the last attempted page.
 * Newer submissions supersede pending responses from earlier searches. Render
 * loader failures from the snapshot's `error`; page-loading promises resolve
 * after those failures have been handled.
 *
 * @module
 */
import type {
  PageResult,
  SearchDuration,
  SearchOrder,
  VideoSummary,
} from '@liberbili/api/types';

export const SEARCH_HISTORY_KEY = '@liberbili/search-history/v1';
export const SEARCH_HISTORY_LIMIT = 20;

/**
 * Keeps up to SEARCH_HISTORY_LIMIT distinct, trimmed, nonempty strings in
 * first-occurrence order. Non-array values produce an empty history.
 */
export function recentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, SEARCH_HISTORY_LIMIT);
}

/**
 * Parses and normalizes stored JSON, returning an empty history for missing or
 * invalid data.
 */
export function readRecentSearches(value?: string): string[] {
  try {
    return recentSearches(value ? JSON.parse(value) : []);
  } catch {
    return [];
  }
}

/**
 * Moves a nonempty, trimmed query to the front and normalizes the resulting
 * history.
 */
export function rememberSearch(history: string[], query: string): string[] {
  return recentSearches([query, ...history]);
}

export type SearchSelection = {
  query: string;
  order: SearchOrder;
  duration: SearchDuration;
};
type State = {
  selection?: SearchSelection;
  items: VideoSummary[];
  loading: boolean;
  error?: Error;
  next?: string;
};
type FetchPage = (
  selection: SearchSelection,
  page: number,
) => Promise<PageResult<VideoSummary>>;

export class SearchSession {
  private state: State = { items: [], loading: false };
  private generation = 0;
  private pendingPage = 1;
  private listeners = new Set<() => void>();

  /**
   * The loader receives the submitted selection with a trimmed query and page
   * numbers starting at 1. Its result.next must represent an integer page greater
   * than the fetched page; an absent or invalid next value ends pagination.
   */
  constructor(private fetchPage: FetchPage) {}

  getSnapshot = (): State => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(state: State): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Starts at page 1 with cleared results; an empty trimmed query leaves the
   * current search unchanged.
   */
  submit(selection: SearchSelection): Promise<void> {
    if (!selection.query.trim()) return Promise.resolve();
    ++this.generation;
    this.pendingPage = 1;
    this.update({
      selection: { ...selection, query: selection.query.trim() },
      items: [],
      loading: false,
    });
    return this.load(1);
  }

  /**
   * Loads the next page unless already loading or an error is present. A failed
   * page retains existing results; use retry to attempt that page again.
   */
  more = (): Promise<void> =>
    this.state.next && !this.state.error
      ? this.load(Number(this.state.next))
      : Promise.resolve();

  /**
   * Reloads the last attempted page, even after success; ignored while loading or
   * before submission.
   */
  retry = (): Promise<void> => this.load(this.pendingPage);

  private async load(page: number): Promise<void> {
    const { selection } = this.state;
    if (!selection || this.state.loading || !Number.isInteger(page) || page < 1)
      return;
    const generation = this.generation;
    this.pendingPage = page;
    this.update({ ...this.state, loading: true, error: undefined });
    try {
      const result = await this.fetchPage(selection, page);
      if (generation !== this.generation) return;
      const items =
        page === 1 ? result.items : [...this.state.items, ...result.items];
      const next = Number(result.next);
      this.update({
        ...this.state,
        items: [...new Map(items.map((item) => [item.bvid, item])).values()],
        next: Number.isInteger(next) && next > page ? String(next) : undefined,
        loading: false,
      });
    } catch (error) {
      if (generation === this.generation)
        this.update({
          ...this.state,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
    }
  }
}
