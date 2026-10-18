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
  more = (): Promise<void> =>
    this.state.error ? Promise.resolve() : this.load();
}
