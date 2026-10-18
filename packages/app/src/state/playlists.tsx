import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { VideoSummary } from '@liberbili/api/types';

import {
  makePlaylist,
  normalizePlaylists,
  playlistName,
  renamePlaylist,
  type Playlist,
} from '@/lib/playlist-data';
import { storage } from '@/storage';

export type { Playlist } from '@/lib/playlist-data';

const STORAGE_KEY = '@liberbili/playlists/v1';
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
  return normalizePlaylists(storage.getString(STORAGE_KEY));
}

export function PlaylistProvider({ children }: PropsWithChildren) {
  const [playlists, setPlaylists] = useState(loadPlaylists);
  useEffect(() => {
    storage.set(STORAGE_KEY, JSON.stringify(playlists));
  }, [playlists]);
  const create = useCallback((name: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const playlist = makePlaylist(name, id, Date.now());
    setPlaylists((current) => [...current, playlist]);
    return id;
  }, []);
  const rename = useCallback((id: string, name: string) => {
    // Validate synchronously so invalid actions never enter React's state updater.
    const trimmed = playlistName(name);
    setPlaylists((all) => renamePlaylist(all, id, trimmed));
  }, []);
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
