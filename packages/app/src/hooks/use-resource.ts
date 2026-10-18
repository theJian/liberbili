import {
  DependencyList,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  ResourceRequest,
  sameResourceDependencies,
} from '@/lib/resource-request';

export type Resource<T> = {
  data?: T;
  error?: Error;
  loading: boolean;
  reload(): void;
};

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): Resource<T> {
  // Guarded render-time state adjustment prevents even one render of the old key's data.
  const [scope, setScope] = useState(() => ({
    deps: [...deps],
    request: new ResourceRequest<T>(),
  }));
  let request = scope.request;
  if (!sameResourceDependencies(scope.deps, deps)) {
    request = new ResourceRequest<T>();
    setScope({ deps: [...deps], request });
  }
  const loader = useRef(load);
  useLayoutEffect(() => {
    loader.current = load;
  });
  useEffect(() => {
    void request.run(loader.current);
    return request.cancel;
  }, [request]);
  const state = useSyncExternalStore(
    request.subscribe,
    request.getSnapshot,
    request.getSnapshot,
  );
  const reload = useCallback(() => {
    void request.run(loader.current);
  }, [request]);
  return { ...state, reload };
}
