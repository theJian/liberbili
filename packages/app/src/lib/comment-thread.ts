import type { Comment, PageResult } from '@liberbili/api/types';

type State = {
  items: Comment[];
  loading: boolean;
  error?: Error;
  next?: string;
  started: boolean;
};
export function mergeComments(
  existing: Comment[],
  incoming: Comment[],
): Comment[] {
  const comments = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    comments.set(item.id, {
      ...item,
      pinned: item.pinned || Boolean(comments.get(item.id)?.pinned),
    });
  }
  return [...comments.values()];
}

export class CommentThread {
  private state: State = { items: [], loading: false, started: false };
  private cursor: string | undefined;
  private completed = new Set<string>();
  private listeners = new Set<() => void>();
  constructor(
    readonly videoId: string,
    readonly aid: number | undefined,
    private fetchPage: (
      aid: number,
      cursor?: string,
    ) => Promise<PageResult<Comment>>,
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
  load = async (): Promise<void> => {
    if (
      !this.aid ||
      this.state.loading ||
      (this.state.started && !this.state.next && !this.state.error)
    )
      return;
    const cursor = this.cursor;
    this.update({ ...this.state, loading: true, error: undefined });
    try {
      const result = await this.fetchPage(this.aid, cursor);
      this.completed.add(cursor ?? '');
      const next =
        result.next && !this.completed.has(result.next)
          ? result.next
          : undefined;
      this.cursor = next;
      this.update({
        items: mergeComments(this.state.items, result.items),
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
  more = (): Promise<void> =>
    this.state.error ? Promise.resolve() : this.load();
}
