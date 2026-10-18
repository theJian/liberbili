import type { DownloadPauseState } from 'expo-file-system';
import type { VideoSummary } from '@liberbili/api/types';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'interrupted';
export type DownloadItem = {
  id: string;
  video: VideoSummary;
  status: DownloadStatus;
  progress: number;
  bytes: number;
  totalBytes: number;
  fileUri?: string;
  destinationUri?: string;
  thumbnailUri?: string;
  error?: string;
  pauseState?: DownloadPauseState;
};
type Progress = { bytesWritten: number; totalBytes: number };
type Result = { uri: string } | null;
export type ManagedDownloadTask = {
  state: string;
  downloadAsync(): Promise<Result>;
  resumeAsync(): Promise<Result>;
  pauseAsync(): Promise<void>;
  savable(): DownloadPauseState;
  cancel(): void;
  release(): void;
};
type Source = { url: string; headers?: Record<string, string> };
type Paths = { video: string; thumbnail: string };
export type DownloadDependencies = {
  load(): string | undefined;
  save(items: DownloadItem[]): void;
  paths(id: string, token?: string): Paths;
  exists(uri: string): boolean;
  remove(uri: string): void;
  resolve(video: VideoSummary): Promise<Source>;
  create(
    source: Source,
    destination: string,
    progress: (value: Progress) => void,
  ): ManagedDownloadTask;
  restore(
    state: DownloadPauseState,
    progress: (value: Progress) => void,
  ): ManagedDownloadTask;
  thumbnail(video: VideoSummary, destination: string): Promise<string>;
  now?(): number;
};
type Operation = {
  id: string;
  paths: Paths;
  task?: ManagedDownloadTask;
  pending?: Promise<void>;
  pausing?: Promise<void>;
  lastProgress: number;
};
const statuses = new Set<DownloadStatus>([
  'queued',
  'downloading',
  'paused',
  'completed',
  'failed',
  'interrupted',
]);
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^BV1[1-9A-HJ-NP-Za-km-z]{9}$/.test(id);

/** Invalid persistence must never prevent app startup or create unsafe filenames. */
export function parseDownloads(raw: string | undefined): DownloadItem[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((value): DownloadItem[] => {
      if (!value || typeof value !== 'object') return [];
      const item = value as DownloadItem;
      if (
        !validId(item.id) ||
        seen.has(item.id) ||
        !item.video ||
        item.video.bvid !== item.id ||
        typeof item.video.title !== 'string' ||
        typeof item.video.thumbnail !== 'string' ||
        typeof item.video.uploader !== 'string' ||
        !statuses.has(item.status)
      )
        return [];
      seen.add(item.id);
      const finite = (number: unknown) =>
        typeof number === 'number' && Number.isFinite(number) && number >= 0
          ? number
          : 0;
      const string = (text: unknown) =>
        typeof text === 'string' ? text : undefined;
      return [
        {
          id: item.id,
          video: item.video,
          status:
            item.status === 'queued' || item.status === 'downloading'
              ? 'interrupted'
              : item.status,
          progress: Math.min(1, finite(item.progress)),
          bytes: finite(item.bytes),
          totalBytes: finite(item.totalBytes),
          fileUri: string(item.fileUri),
          destinationUri: string(item.destinationUri),
          thumbnailUri: string(item.thumbnailUri),
          error: string(item.error),
          pauseState:
            item.pauseState &&
            typeof item.pauseState.url === 'string' &&
            typeof item.pauseState.fileUri === 'string' &&
            typeof item.pauseState.resumeData === 'string' &&
            item.pauseState.isDirectory === false
              ? item.pauseState
              : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

/** Owns each transfer independently of React rendering and stale async callbacks. */
export class DownloadManager {
  private items: DownloadItem[];
  private operations = new Map<string, Operation>();
  private listeners = new Set<() => void>();
  private sequence = 0;
  private readonly runtime = Date.now().toString(36);
  private lastPersist = 0;
  private dirty = false;

  constructor(private readonly deps: DownloadDependencies) {
    this.items = parseDownloads(deps.load()).map((item) =>
      item.status === 'completed' &&
      (!item.fileUri || !this.exists(item.fileUri))
        ? {
            ...item,
            status: 'failed',
            fileUri: undefined,
            progress: 0,
            error: 'missingFile',
          }
        : item,
    );
  }

  getSnapshot = (): DownloadItem[] => this.items;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private exists(uri: string): boolean {
    try {
      return this.deps.exists(uri);
    } catch {
      return false;
    }
  }
  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }
  flush = (): void => {
    if (!this.dirty) return;
    try {
      this.deps.save(this.items);
      this.dirty = false;
      this.lastPersist = this.now();
    } catch {
      /* Keep the snapshot dirty so a later lifecycle flush can retry. */
    }
  };
  private emit(immediate = true): void {
    this.dirty = true;
    if (immediate || this.now() - this.lastPersist >= 1000) this.flush();
    this.listeners.forEach((listener) => listener());
  }
  private patch(
    id: string,
    patch: Partial<DownloadItem>,
    immediate = true,
  ): void {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    this.emit(immediate);
  }
  private owns(op: Operation): boolean {
    return this.operations.get(op.id) === op;
  }
  private clean(...uris: (string | undefined)[]): void {
    for (const uri of new Set(uris)) {
      if (!uri) continue;
      try {
        this.deps.remove(uri);
      } catch {
        /* Retry owned-path cleanup when pending work settles. */
      }
    }
  }
  private release(task?: ManagedDownloadTask): void {
    try {
      task?.release();
    } catch {
      /* A cancelled task can already have released its native handle. */
    }
  }
  private cancel(task?: ManagedDownloadTask): void {
    try {
      task?.cancel();
    } catch {
      /* Removal must still clean local files. */
    }
  }
  private progress(op: Operation, progress: Progress): void {
    if (!this.owns(op) || this.now() - op.lastProgress < 250) return;
    op.lastProgress = this.now();
    const bytes = Math.max(
      0,
      Number.isFinite(progress.bytesWritten) ? progress.bytesWritten : 0,
    );
    const totalBytes = Math.max(
      0,
      Number.isFinite(progress.totalBytes) ? progress.totalBytes : 0,
    );
    this.patch(
      op.id,
      {
        bytes,
        totalBytes,
        progress: totalBytes > 0 ? Math.min(1, bytes / totalBytes) : 0,
      },
      false,
    );
  }

  start = async (video: VideoSummary): Promise<void> => {
    if (!validId(video.bvid)) return;
    const existing = this.items.find((item) => item.id === video.bvid);
    if (existing) {
      await this.resume(existing.id);
      return;
    }
    this.items = [
      {
        id: video.bvid,
        video,
        status: 'queued',
        progress: 0,
        bytes: 0,
        totalBytes: 0,
      },
      ...this.items,
    ];
    this.emit();
    await this.resume(video.bvid);
  };

  resume = async (id: string): Promise<void> => {
    const previous = this.operations.get(id);
    if (previous?.pausing) {
      await previous.pausing;
      await this.resume(id);
      return;
    }
    if (previous?.pending) {
      const waitingForPause = previous.task?.state === 'paused';
      await previous.pending;
      if (
        waitingForPause &&
        this.owns(previous) &&
        previous.task?.state === 'paused'
      )
        await this.resume(id);
      return;
    }
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) return;
    if (
      item.status === 'completed' &&
      item.fileUri &&
      this.exists(item.fileUri)
    )
      return;
    if (!previous && !item.pauseState) {
      const legacy = this.deps.paths(id);
      this.clean(
        item.fileUri,
        item.destinationUri,
        item.thumbnailUri,
        legacy.video,
        legacy.thumbnail,
      );
    }
    const op = previous ?? {
      id,
      paths: this.deps.paths(id, `${this.runtime}-${++this.sequence}`),
      lastProgress: -Infinity,
    };
    this.operations.set(id, op);
    op.pending = this.run(op, item);
    await op.pending;
  };

  private async run(op: Operation, item: DownloadItem): Promise<void> {
    try {
      const onProgress = (value: Progress) => this.progress(op, value);
      let result: Result | undefined;
      if (op.task?.state === 'paused' || item.pauseState) {
        try {
          op.paths.video =
            item.pauseState?.fileUri ?? item.destinationUri ?? op.paths.video;
          op.task ??= this.deps.restore(item.pauseState!, onProgress);
          this.patch(op.id, { status: 'downloading', error: undefined });
          result = await op.task.resumeAsync();
        } catch {
          this.cancel(op.task);
          this.release(op.task);
          op.task = undefined;
          if (!this.owns(op)) return;
          this.clean(op.paths.video);
          // Expired/corrupt resume data falls back to a fresh source and destination.
          op.paths = this.deps.paths(
            op.id,
            `${this.runtime}-${++this.sequence}`,
          );
        }
      }
      if (result === undefined) {
        this.patch(op.id, {
          status: 'queued',
          progress: 0,
          bytes: 0,
          totalBytes: 0,
          fileUri: undefined,
          pauseState: undefined,
          error: undefined,
          destinationUri: op.paths.video,
        });
        const source = await this.deps.resolve(item.video);
        if (!this.owns(op)) return;
        op.task = this.deps.create(source, op.paths.video, onProgress);
        this.patch(op.id, { status: 'downloading' });
        result = await op.task.downloadAsync();
      }
      if (!this.owns(op)) return;
      if (!result) {
        this.patch(op.id, { status: 'paused', pauseState: op.task?.savable() });
        return;
      }
      let thumbnailUri: string | undefined;
      try {
        thumbnailUri = await this.deps.thumbnail(
          item.video,
          op.paths.thumbnail,
        );
      } catch {
        /* Playback remains available without cached artwork. */
      }
      if (!this.owns(op)) return;
      this.patch(op.id, {
        status: 'completed',
        progress: 1,
        fileUri: result.uri,
        thumbnailUri,
        destinationUri: op.paths.video,
        pauseState: undefined,
        error: undefined,
      });
    } catch (error) {
      if (this.owns(op))
        this.patch(op.id, {
          status: 'failed',
          pauseState: undefined,
          error: error instanceof Error ? error.message : 'Download failed',
        });
    } finally {
      op.pending = undefined;
      if (!this.owns(op)) {
        this.cancel(op.task);
        this.release(op.task);
        this.clean(op.paths.video, op.paths.thumbnail);
      } else if (op.task?.state !== 'paused') {
        this.release(op.task);
        this.operations.delete(op.id);
      }
    }
  }

  pause = async (id: string): Promise<void> => {
    const op = this.operations.get(id);
    if (!op) return;
    if (op.pausing) {
      await op.pausing;
      return;
    }
    if (!op.task) {
      this.operations.delete(id);
      this.patch(id, { status: 'paused', pauseState: undefined });
      return;
    }
    if (op.task.state !== 'active') return;
    op.pausing = (async () => {
      try {
        await op.task!.pauseAsync();
        if (this.owns(op) && op.task?.state === 'paused')
          this.patch(id, { status: 'paused', pauseState: op.task.savable() });
      } catch {
        if (this.owns(op) && op.task?.state !== 'completed')
          this.patch(id, {
            error: 'pauseFailed',
          });
      } finally {
        op.pausing = undefined;
      }
    })();
    await op.pausing;
  };

  remove = (id: string): void => {
    const op = this.operations.get(id);
    const item = this.items.find((candidate) => candidate.id === id);
    this.operations.delete(id);
    this.cancel(op?.task);
    if (!op?.pending) this.release(op?.task);
    const legacy = validId(id) ? this.deps.paths(id) : undefined;
    this.clean(
      op?.paths.video,
      op?.paths.thumbnail,
      item?.fileUri,
      item?.destinationUri,
      item?.thumbnailUri,
      item?.pauseState?.fileUri,
      legacy?.video,
      legacy?.thumbnail,
    );
    this.items = this.items.filter((candidate) => candidate.id !== id);
    this.emit();
  };

  verify = (id: string): boolean => {
    const item = this.items.find((candidate) => candidate.id === id);
    if (item?.status !== 'completed') return false;
    if (item.fileUri && this.exists(item.fileUri)) return true;
    this.patch(id, {
      status: 'failed',
      fileUri: undefined,
      progress: 0,
      error: 'missingFile',
    });
    return false;
  };
}
