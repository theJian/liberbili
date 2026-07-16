import { DependencyList, useCallback, useEffect, useState } from 'react';

export type Resource<T> = { data?: T; error?: Error; loading: boolean; reload(): void };

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): Resource<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<Resource<T>, 'reload'>>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ data, loading: false }),
      (error) => !controller.signal.aborted && setState({ error: error as Error, loading: false }),
    );
    return () => controller.abort();
  }, [...deps, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => { setState((current) => ({ ...current, loading: true, error: undefined })); setVersion((value) => value + 1); }, []);
  return { ...state, reload };
}
