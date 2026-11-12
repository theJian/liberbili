/**
 * Maintains a paginated upload list for one creator. Validate a route ID with
 * `isCreatorId(value)` (a positive safe integer written as decimal digits), then
 * create one `CreatorUploads(fetchPage)` instance per creator. The callback is:
 *
 * ```ts
 * (cursor?: string, lastAid?: number) => Promise<{
 *   items: VideoSummary[];
 *   next?: string;
 * }>
 * ```
 *
 * The first call receives two `undefined` arguments. Later calls receive the
 * previous result's opaque `next` and the accumulated list's final numeric `aid`,
 * which lets the API continue through a creator endpoint fallback.
 *
 * Subscribe with `subscribe` and `getSnapshot` (suitable for React's
 * `useSyncExternalStore`) to observe accumulated `items`, request `loading` and
 * `error`, and pagination `next`. Call `load()` to start or explicitly retry a
 * failed page, and `more()` for scroll-driven loading. Fetch failures appear in
 * the snapshot rather than rejecting the load promise. Loaded videos are unique
 * by BV ID, and a repeated completed cursor ends pagination to prevent loops.
 */
import type { PageResult, VideoSummary } from '@liberbili/api/types';

export function isCreatorId(value: string): boolean {
  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

type State = {
  items: VideoSummary[];
  loading: boolean;
  error?: Error;
  next?: string;
  /** True after the first successful page, including an empty page. */
  started: boolean;
};
export class CreatorUploads {
  private state: State = { items: [], loading: false, started: false };
  private cursor: string | undefined;
  private completed = new Set<string>();
  private listeners = new Set<() => void>();
  constructor(
    private fetchPage: (
      cursor?: string,
      lastAid?: number,
    ) => Promise<PageResult<VideoSummary>>,
  ) {}
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
   * Loads the current cursor or retries it after failure, retaining existing
   * items. Does nothing while loading or after a successful page with no `next`.
   */
  load = async (): Promise<void> => {
    if (
      this.state.loading ||
      (this.state.started && !this.state.next && !this.state.error)
    )
      return;
    const cursor = this.cursor;
    this.update({ ...this.state, loading: true, error: undefined });
    try {
      const result = await this.fetchPage(cursor, this.state.items.at(-1)?.aid);
      this.completed.add(cursor ?? '');
      const next =
        result.next && !this.completed.has(result.next)
          ? result.next
          : undefined;
      this.cursor = next;
      this.update({
        items: [
          ...new Map(
            [...this.state.items, ...result.items].map((item) => [
              item.bvid,
              item,
            ]),
          ).values(),
        ],
        next,
        started: true,
        loading: false,
      });
    } catch (error) {
      this.update({
        ...this.state,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };
  /** Stops automatic pagination after an error until `load()` explicitly retries. */
  more = (): Promise<void> =>
    this.state.error ? Promise.resolve() : this.load();
}
