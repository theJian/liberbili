import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { bilibiliApi } from '@/lib/bilibili';
import { storage } from '@/storage';
import { DownloadManager } from './download-manager';

export type { DownloadItem, DownloadStatus } from './download-manager';

const STORAGE_KEY = '@liberbili/downloads/v1';
const downloadsDirectory = new Directory(Paths.document, 'downloads');
const rootUri = `${downloadsDirectory.uri.replace(/\/$/, '')}/`;
const ownedFile = (uri: string): File => {
  if (!uri.startsWith(rootUri) || uri.slice(rootUri.length).includes('/'))
    throw new Error('Invalid download destination');
  return new File(uri);
};
const ensureDirectory = () => {
  if (!downloadsDirectory.exists)
    downloadsDirectory.create({ intermediates: true, idempotent: true });
};

function createDownloadManager(): DownloadManager {
  return new DownloadManager({
    load: () => storage.getString(STORAGE_KEY),
    save: (items) => storage.set(STORAGE_KEY, JSON.stringify(items)),
    paths: (id, token) => {
      const name = token ? `${id}-${token}` : id;
      return {
        video: new File(downloadsDirectory, `${name}.mp4`).uri,
        thumbnail: new File(downloadsDirectory, `${name}.jpg`).uri,
      };
    },
    exists: (uri) => ownedFile(uri).exists,
    remove: (uri) => {
      const file = ownedFile(uri);
      if (file.exists) file.delete();
    },
    resolve: async (video) => {
      const detail = await bilibiliApi.getVideo(video.bvid);
      const part = detail.parts[0];
      if (!part) throw new Error('No playable video part');
      const [stream] = await bilibiliApi.getProgressiveStreams(part);
      if (!stream) throw new Error('No compatible MP4 stream');
      return stream;
    },
    create: (source, destination, onProgress) => {
      ensureDirectory();
      return File.createDownloadTask(source.url, ownedFile(destination), {
        headers: source.headers,
        sessionType: 'background',
        onProgress,
      });
    },
    restore: (state, onProgress) => {
      ownedFile(state.fileUri);
      return DownloadTask.fromSavable(state, {
        onProgress,
        sessionType: 'background',
      });
    },
    thumbnail: async (video, destination) => {
      const result = await File.downloadFileAsync(
        video.thumbnail,
        ownedFile(destination),
        { idempotent: true },
      );
      return result.uri;
    },
  });
}

type Value = Pick<
  DownloadManager,
  'start' | 'pause' | 'resume' | 'remove' | 'verify'
> & {
  downloads: ReturnType<DownloadManager['getSnapshot']>;
};
const Context = createContext<Value | null>(null);

export function DownloadProvider({ children }: PropsWithChildren) {
  const [manager] = useState(createDownloadManager);
  const downloads = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', () =>
      manager.flush(),
    );
    return () => {
      subscription.remove();
      manager.flush();
    };
  }, [manager]);
  return (
    <Context.Provider
      value={{
        downloads,
        start: manager.start,
        pause: manager.pause,
        resume: manager.resume,
        remove: manager.remove,
        verify: manager.verify,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useDownloads() {
  const value = useContext(Context);
  if (!value) throw new Error('useDownloads must be inside DownloadProvider');
  return value;
}
