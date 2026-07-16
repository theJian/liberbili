import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, DownloadPauseState, DownloadTask, File, Paths } from 'expo-file-system';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { bilibiliApi } from '@/api/bilibili';
import { VideoSummary } from '@/api/types';

const STORAGE_KEY = '@liberbili/downloads/v1';
const downloadsDirectory = new Directory(Paths.document, 'downloads');
export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'interrupted';
export type DownloadItem = {
  id: string;
  video: VideoSummary;
  status: DownloadStatus;
  progress: number;
  bytes: number;
  totalBytes: number;
  fileUri?: string;
  thumbnailUri?: string;
  error?: string;
  pauseState?: DownloadPauseState;
};
type Task = ReturnType<typeof File.createDownloadTask>;
type Value = {
  downloads: DownloadItem[];
  start(video: VideoSummary): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  remove(id: string): void;
};
const Context = createContext<Value | null>(null);

export function DownloadProvider({ children }: PropsWithChildren) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [ready, setReady] = useState(false);
  const tasks = useRef(new Map<string, Task>());
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        const items = (JSON.parse(data) as DownloadItem[]).map((item) =>
          item.status === 'downloading' || item.status === 'queued' ? { ...item, status: 'interrupted' as const } : item,
        );
        setDownloads(items);
      }
      setReady(true);
    });
  }, []);
  useEffect(() => { if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloads)); }, [downloads, ready]);

  const update = useCallback((id: string, patch: Partial<DownloadItem>) =>
    setDownloads((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)), []);

  const run = useCallback(async (id: string, video: VideoSummary) => {
    try {
      if (!downloadsDirectory.exists) downloadsDirectory.create({ intermediates: true, idempotent: true });
      const detail = await bilibiliApi.getVideo(video.bvid);
      const streams = await bilibiliApi.getProgressiveStreams(detail.parts[0]);
      const stream = streams[0];
      if (!stream) throw new Error('No compatible MP4 stream');
      const file = new File(downloadsDirectory, `${video.bvid}.mp4`);
      if (file.exists) file.delete();
      const task = File.createDownloadTask(stream.url, file, {
        headers: stream.headers,
        sessionType: 'background',
        onProgress: ({ bytesWritten, totalBytes }) => update(id, {
          bytes: bytesWritten,
          totalBytes,
          progress: totalBytes > 0 ? bytesWritten / totalBytes : 0,
        }),
      });
      tasks.current.set(id, task);
      update(id, { status: 'downloading', error: undefined });
      const result = await task.downloadAsync();
      if (result) {
        let thumbnailUri: string | undefined;
        try {
          const thumbnail = await File.downloadFileAsync(video.thumbnail, new File(downloadsDirectory, `${video.bvid}.jpg`), { idempotent: true });
          thumbnailUri = thumbnail.uri;
        } catch { /* The video remains usable if artwork cannot be cached. */ }
        update(id, { status: 'completed', progress: 1, fileUri: result.uri, thumbnailUri });
      }
    } catch (error) {
      update(id, { status: 'failed', error: error instanceof Error ? error.message : 'Download failed' });
    }
  }, [update]);

  const start = useCallback(async (video: VideoSummary) => {
    const id = video.bvid;
    setDownloads((items) => [
      { id, video, status: 'queued', progress: 0, bytes: 0, totalBytes: 0 },
      ...items.filter((item) => item.id !== id),
    ]);
    await run(id, video);
  }, [run]);
  const pause = useCallback(async (id: string) => {
    const task = tasks.current.get(id);
    if (!task) return;
    await task.pauseAsync();
    update(id, { status: 'paused', pauseState: task.savable() });
  }, [update]);
  const resume = useCallback(async (id: string) => {
    const task = tasks.current.get(id);
    const item = downloads.find((candidate) => candidate.id === id);
    if (!item) return;
    try {
      const resumable = task?.state === 'paused' ? task : item.pauseState ? DownloadTask.fromSavable(item.pauseState, {
        onProgress: ({ bytesWritten, totalBytes }) => update(id, { bytes: bytesWritten, totalBytes, progress: totalBytes > 0 ? bytesWritten / totalBytes : 0 }),
      }) : undefined;
      if (resumable) {
        tasks.current.set(id, resumable);
        update(id, { status: 'downloading' });
        const result = await resumable.resumeAsync();
        if (result) update(id, { status: 'completed', progress: 1, fileUri: result.uri, pauseState: undefined });
      } else await run(id, item.video);
    } catch {
      await run(id, item.video);
    }
  }, [downloads, run, update]);
  const remove = useCallback((id: string) => {
    const item = downloads.find((candidate) => candidate.id === id);
    tasks.current.get(id)?.cancel();
    tasks.current.delete(id);
    if (item?.fileUri) {
      const file = new File(item.fileUri);
      if (file.exists) file.delete();
    }
    if (item?.thumbnailUri) {
      const thumbnail = new File(item.thumbnailUri);
      if (thumbnail.exists) thumbnail.delete();
    }
    setDownloads((items) => items.filter((candidate) => candidate.id !== id));
  }, [downloads]);
  const value = useMemo(() => ({ downloads, start, pause, resume, remove }), [downloads, start, pause, resume, remove]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDownloads() {
  const value = useContext(Context);
  if (!value) throw new Error('useDownloads must be inside DownloadProvider');
  return value;
}
