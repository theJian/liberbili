import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { VideoSummary } from '@/api/types';
import { storage } from '@/storage';

const STORAGE_KEY = '@liberbili/playlists/v1';
export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  items: VideoSummary[];
};
type Value = {
  playlists: Playlist[];
  create(name: string): string;
  rename(id: string, name: string): void;
  remove(id: string): void;
  add(id: string, video: VideoSummary): void;
  removeItem(id: string, bvid: string): void;
};
const Context = createContext<Value | null>(null);

function loadPlaylists(): Playlist[] {
  const data = storage.getString(STORAGE_KEY);
  return data ? (JSON.parse(data) as Playlist[]) : [];
}

export function PlaylistProvider({ children }: PropsWithChildren) {
  const [playlists, setPlaylists] = useState(loadPlaylists);
  useEffect(() => {
    storage.set(STORAGE_KEY, JSON.stringify(playlists));
  }, [playlists]);
  const create = useCallback((name: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaylists((current) => [
      ...current,
      { id, name: name.trim(), createdAt: Date.now(), items: [] },
    ]);
    return id;
  }, []);
  const rename = useCallback(
    (id: string, name: string) =>
      setPlaylists((all) =>
        all.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)),
      ),
    [],
  );
  const remove = useCallback(
    (id: string) => setPlaylists((all) => all.filter((p) => p.id !== id)),
    [],
  );
  const add = useCallback(
    (id: string, video: VideoSummary) =>
      setPlaylists((all) =>
        all.map((p) =>
          p.id === id && !p.items.some((item) => item.bvid === video.bvid)
            ? { ...p, items: [...p.items, video] }
            : p,
        ),
      ),
    [],
  );
  const removeItem = useCallback(
    (id: string, bvid: string) =>
      setPlaylists((all) =>
        all.map((p) =>
          p.id === id
            ? { ...p, items: p.items.filter((item) => item.bvid !== bvid) }
            : p,
        ),
      ),
    [],
  );
  const value = useMemo(
    () => ({ playlists, create, rename, remove, add, removeItem }),
    [playlists, create, rename, remove, add, removeItem],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePlaylists() {
  const value = useContext(Context);
  if (!value) throw new Error('usePlaylists must be inside PlaylistProvider');
  return value;
}
