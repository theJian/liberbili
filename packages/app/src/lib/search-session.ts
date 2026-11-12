import type {
  PageResult,
  SearchDuration,
  SearchOrder,
  VideoSummary,
} from '@liberbili/api/types';

export const SEARCH_HISTORY_KEY = '@liberbili/search-history/v1';
export const SEARCH_HISTORY_LIMIT = 20;
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
export function readRecentSearches(value?: string): string[] {
  try {
    return recentSearches(value ? JSON.parse(value) : []);
  } catch {
    return [];
  }
}
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

// Own the submitted selection independently of the editable input and reject late responses.
export class SearchSession {
  private state: State = { items: [], loading: false };
  private generation = 0;
  private pendingPage = 1;
  private listeners = new Set<() => void>();
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
  more = (): Promise<void> =>
    this.state.next && !this.state.error
      ? this.load(Number(this.state.next))
      : Promise.resolve();
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
