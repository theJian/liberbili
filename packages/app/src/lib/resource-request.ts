export function sameResourceDependencies(
  previous: readonly unknown[],
  current: readonly unknown[],
): boolean {
  return (
    previous.length === current.length &&
    previous.every((value, index) => Object.is(value, current[index]))
  );
}

export type ResourceSnapshot<T> = { data?: T; error?: Error; loading: boolean };

// A resource instance belongs to one dependency key; old instances cannot supply a new key's snapshot.
export class ResourceRequest<T> {
  private state: ResourceSnapshot<T> = { loading: true };
  private controller?: AbortController;
  private listeners = new Set<() => void>();
  getSnapshot = (): ResourceSnapshot<T> => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: ResourceSnapshot<T>): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  cancel = (): void => {
    this.controller?.abort();
  };
  run = async (load: (signal: AbortSignal) => Promise<T>): Promise<void> => {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    this.update({ data: this.state.data, loading: true });
    try {
      const data = await load(controller.signal);
      if (!controller.signal.aborted) this.update({ data, loading: false });
    } catch (error) {
      if (!controller.signal.aborted)
        this.update({
          data: this.state.data,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        });
    }
  };
}
