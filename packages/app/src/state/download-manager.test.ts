import { describe, expect, test } from 'bun:test';
import type { DownloadPauseState } from 'expo-file-system';
import type { VideoSummary } from '@liberbili/api/types';

import {
  DownloadManager,
  parseDownloads,
  type DownloadDependencies,
  type DownloadItem,
  type ManagedDownloadTask,
} from './download-manager';

const video: VideoSummary = {
  bvid: 'BV17x411w7KC',
  aid: 170001,
  title: 'Example',
  thumbnail: 'https://example.com/art.jpg',
  uploader: 'Creator',
  duration: 120,
  views: 1,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

class FakeTask implements ManagedDownloadTask {
  state = 'idle';
  releases = 0;
  cancels = 0;
  resumes = 0;
  operation = deferred<{ uri: string } | null>();
  constructor(
    readonly destination: string,
    readonly progress: (value: {
      bytesWritten: number;
      totalBytes: number;
    }) => void,
    private files: Set<string>,
  ) {}
  downloadAsync = async () => {
    this.state = 'active';
    return this.operation.promise;
  };
  resumeAsync = async () => {
    this.resumes += 1;
    this.state = 'active';
    this.operation = deferred();
    return this.operation.promise;
  };
  pauseAsync = async () => {
    this.state = 'paused';
    this.operation.resolve(null);
  };
  savable = (): DownloadPauseState => ({
    url: 'https://cdn.example/video.mp4',
    fileUri: this.destination,
    isDirectory: false,
    resumeData: 'opaque',
  });
  cancel = () => {
    this.cancels += 1;
    if (this.state === 'active') this.operation.reject(new Error('Cancelled'));
    this.state = 'cancelled';
  };
  release = () => {
    this.releases += 1;
  };
  finish = () => {
    this.state = 'completed';
    this.files.add(this.destination);
    this.operation.resolve({ uri: this.destination });
  };
}

function fixture(overrides: Partial<DownloadDependencies> = {}) {
  const files = new Set<string>();
  const tasks: FakeTask[] = [];
  const saved: DownloadItem[][] = [];
  let time = 10000;
  const deps: DownloadDependencies = {
    load: () => undefined,
    save: (items) => {
      saved.push(structuredClone(items));
    },
    paths: (id, token) => ({
      video: `/downloads/${id}${token ? `-${token}` : ''}.mp4`,
      thumbnail: `/downloads/${id}${token ? `-${token}` : ''}.jpg`,
    }),
    exists: (uri) => files.has(uri),
    remove: (uri) => {
      files.delete(uri);
    },
    resolve: async () => ({ url: 'https://cdn.example/video.mp4' }),
    create: (_source, destination, progress) => {
      const task = new FakeTask(destination, progress, files);
      tasks.push(task);
      files.add(destination);
      return task;
    },
    restore: (state, progress) => {
      const task = new FakeTask(state.fileUri, progress, files);
      task.state = 'paused';
      tasks.push(task);
      return task;
    },
    thumbnail: async (_video, destination) => {
      files.add(destination);
      return destination;
    },
    now: () => time,
    ...overrides,
  };
  const manager = new DownloadManager(deps);
  return {
    manager,
    deps,
    files,
    tasks,
    saved,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('download persistence recovery', () => {
  test('ignores corrupt/non-array JSON, malformed rows and duplicate IDs', () => {
    for (const raw of ['{', '{}', 'null', '[null,{}]'])
      expect(parseDownloads(raw)).toEqual([]);
    const row = {
      id: video.bvid,
      video,
      status: 'downloading',
      progress: 2,
      bytes: -1,
      totalBytes: 20,
    };
    expect(parseDownloads(JSON.stringify([row, row]))).toMatchObject([
      { status: 'interrupted', progress: 1, bytes: 0 },
    ]);
    expect(
      parseDownloads(JSON.stringify([{ ...row, id: '../escape' }])),
    ).toEqual([]);
  });

  test('marks missing completed files retryable on startup and before playback', async () => {
    const row = {
      id: video.bvid,
      video,
      status: 'completed',
      fileUri: '/downloads/missing.mp4',
      progress: 1,
      bytes: 10,
      totalBytes: 10,
    };
    const f = fixture({ load: () => JSON.stringify([row]) });
    expect(f.manager.getSnapshot()[0]).toMatchObject({
      status: 'failed',
      error: 'missingFile',
    });
    const run = f.manager.resume(video.bvid);
    await tick();
    f.tasks[0].finish();
    await run;
    expect(f.manager.verify(video.bvid)).toBe(true);
    f.files.delete(f.tasks[0].destination);
    expect(f.manager.verify(video.bvid)).toBe(false);
    expect(f.manager.getSnapshot()[0].status).toBe('failed');
  });
});

describe('download task ownership', () => {
  test('deduplicates repeated starts and resumes during lookup and transfer', async () => {
    const source = deferred<{ url: string }>();
    const f = fixture({ resolve: () => source.promise });
    const first = f.manager.start(video);
    const second = f.manager.start(video);
    const third = f.manager.resume(video.bvid);
    expect(f.manager.getSnapshot()).toHaveLength(1);
    expect(f.manager.getSnapshot()[0].status).toBe('queued');
    source.resolve({ url: 'https://cdn.example/video.mp4' });
    await tick();
    expect(f.tasks).toHaveLength(1);
    const fourth = f.manager.start(video);
    f.tasks[0].finish();
    await Promise.all([first, second, third, fourth]);
    expect(f.manager.getSnapshot()[0].status).toBe('completed');
    expect(f.tasks[0].releases).toBe(1);
    await f.manager.start(video);
    expect(f.tasks).toHaveLength(1);
  });

  test('removal during lookup never creates a native task and deletes legacy partial files', async () => {
    const source = deferred<{ url: string }>();
    const f = fixture({ resolve: () => source.promise });
    const legacy = f.deps.paths(video.bvid);
    f.files.add(legacy.video);
    f.files.add(legacy.thumbnail);
    const running = f.manager.start(video);
    f.manager.remove(video.bvid);
    source.resolve({ url: 'https://cdn.example/video.mp4' });
    await running;
    expect(f.tasks).toHaveLength(0);
    expect(f.manager.getSnapshot()).toEqual([]);
    expect(f.files.size).toBe(0);
  });

  test('removing an active transfer cannot corrupt a restarted transfer', async () => {
    const f = fixture();
    const first = f.manager.start(video);
    await tick();
    const oldTask = f.tasks[0];
    f.manager.remove(video.bvid);
    const second = f.manager.start(video);
    await tick();
    expect(f.tasks).toHaveLength(2);
    expect(f.tasks[1].destination).not.toBe(oldTask.destination);
    f.tasks[1].finish();
    await Promise.all([first, second]);
    expect(f.manager.getSnapshot()[0]).toMatchObject({
      status: 'completed',
      fileUri: f.tasks[1].destination,
    });
    expect(f.files.has(oldTask.destination)).toBe(false);
    expect(f.files.has(f.tasks[1].destination)).toBe(true);
    expect(oldTask.releases).toBe(1);
  });

  test('pause while queued invalidates lookup and resume creates one new task', async () => {
    const source = deferred<{ url: string }>();
    let calls = 0;
    const f = fixture({
      resolve: () =>
        ++calls === 1
          ? source.promise
          : Promise.resolve({ url: 'https://cdn.example/video.mp4' }),
    });
    const first = f.manager.start(video);
    await f.manager.pause(video.bvid);
    expect(f.manager.getSnapshot()[0].status).toBe('paused');
    const resumed = f.manager.resume(video.bvid);
    source.resolve({ url: 'https://cdn.example/video.mp4' });
    await tick();
    expect(f.tasks).toHaveLength(1);
    f.tasks[0].finish();
    await Promise.all([first, resumed]);
    expect(f.manager.getSnapshot()[0].status).toBe('completed');
  });

  test('pause/resume retains one task and completion releases it', async () => {
    const f = fixture();
    const first = f.manager.start(video);
    await tick();
    await Promise.all([
      f.manager.pause(video.bvid),
      f.manager.pause(video.bvid),
    ]);
    await first;
    expect(f.manager.getSnapshot()[0].status).toBe('paused');
    expect(f.tasks[0].releases).toBe(0);
    const resumed = f.manager.resume(video.bvid);
    const duplicate = f.manager.resume(video.bvid);
    await tick();
    expect(f.tasks[0].resumes).toBe(1);
    f.tasks[0].finish();
    await Promise.all([resumed, duplicate]);
    expect(f.tasks[0].releases).toBe(1);
    expect(f.manager.getSnapshot()[0].pauseState).toBeUndefined();
  });

  test('resume waits for pause settlement and then starts the paused transfer', async () => {
    const f = fixture();
    const run = f.manager.start(video);
    await tick();
    const task = f.tasks[0];
    task.pauseAsync = async () => {
      task.state = 'paused';
    };
    await f.manager.pause(video.bvid);
    const resume = f.manager.resume(video.bvid);
    task.operation.resolve(null);
    await tick();
    expect(task.resumes).toBe(1);
    task.finish();
    await Promise.all([run, resume]);
    expect(f.manager.getSnapshot()[0].status).toBe('completed');
  });

  test('pause failure remains visible without failing the active transfer', async () => {
    const f = fixture();
    const run = f.manager.start(video);
    await tick();
    f.tasks[0].pauseAsync = async () => {
      throw new Error('Pause unavailable');
    };
    await f.manager.pause(video.bvid);
    expect(f.manager.getSnapshot()[0]).toMatchObject({
      status: 'downloading',
      error: 'pauseFailed',
    });
    f.tasks[0].finish();
    await run;
    expect(f.manager.getSnapshot()[0].error).toBeUndefined();
  });

  test('restores a saved paused task without starting a fresh transfer', async () => {
    const pauseState = {
      url: 'https://cdn.example/video.mp4',
      fileUri: '/downloads/saved.mp4',
      isDirectory: false,
      resumeData: 'opaque',
    };
    const row = {
      id: video.bvid,
      video,
      status: 'paused',
      progress: 0.5,
      bytes: 5,
      totalBytes: 10,
      pauseState,
    };
    const f = fixture({
      load: () => JSON.stringify([row]),
      create: () => {
        throw new Error('must restore');
      },
    });
    const run = f.manager.resume(video.bvid);
    await tick();
    expect(f.tasks).toHaveLength(1);
    expect(f.tasks[0].destination).toBe(pauseState.fileUri);
    expect(f.tasks[0].resumes).toBe(1);
    f.tasks[0].finish();
    await run;
    expect(f.manager.getSnapshot()[0].fileUri).toBe(pauseState.fileUri);
    expect(f.tasks[0].releases).toBe(1);
  });

  test('expired saved resume state falls back to fresh source', async () => {
    const pauseState = {
      url: 'https://cdn.example/expired',
      fileUri: '/downloads/old.mp4',
      isDirectory: false,
      resumeData: 'opaque',
    };
    const row = {
      id: video.bvid,
      video,
      status: 'paused',
      progress: 0.5,
      bytes: 5,
      totalBytes: 10,
      pauseState,
    };
    const f = fixture({
      load: () => JSON.stringify([row]),
      restore: () => {
        throw new Error('Expired');
      },
    });
    f.files.add(pauseState.fileUri);
    const run = f.manager.resume(video.bvid);
    await tick();
    f.tasks[0].finish();
    await run;
    expect(f.manager.getSnapshot()[0].status).toBe('completed');
    expect(f.files.has(pauseState.fileUri)).toBe(false);
  });

  test('removal during artwork download cleans files after late completion', async () => {
    const artwork = deferred<string>();
    let thumbnailPath = '';
    const f = fixture({
      thumbnail: async (_video, destination) => {
        thumbnailPath = destination;
        await artwork.promise;
        f.files.add(destination);
        return destination;
      },
    });
    const run = f.manager.start(video);
    await tick();
    f.tasks[0].finish();
    await tick();
    f.manager.remove(video.bvid);
    artwork.resolve('done');
    await run;
    expect(f.manager.getSnapshot()).toEqual([]);
    expect(f.files.has(thumbnailPath)).toBe(false);
    expect(f.files.has(f.tasks[0].destination)).toBe(false);
  });

  test('failed transfers release handles and retry clears their partial destination', async () => {
    const f = fixture();
    const first = f.manager.start(video);
    await tick();
    const oldTask = f.tasks[0];
    oldTask.state = 'error';
    oldTask.operation.reject(new Error('Network interrupted'));
    await first;
    expect(f.manager.getSnapshot()[0]).toMatchObject({
      status: 'failed',
      error: 'Network interrupted',
    });
    expect(oldTask.releases).toBe(1);
    const retry = f.manager.resume(video.bvid);
    await tick();
    expect(f.files.has(oldTask.destination)).toBe(false);
    oldTask.progress({ bytesWritten: 999, totalBytes: 1000 });
    expect(f.manager.getSnapshot()[0].bytes).toBe(0);
    f.tasks[1].finish();
    await retry;
    expect(f.manager.getSnapshot()[0].status).toBe('completed');
  });

  test('bounds progress storage writes and flushes terminal state', async () => {
    const f = fixture();
    const run = f.manager.start(video);
    await tick();
    const before = f.saved.length;
    for (let index = 1; index <= 100; index += 1) {
      f.advance(10);
      f.tasks[0].progress({ bytesWritten: index, totalBytes: 100 });
    }
    expect(f.saved.length - before).toBeLessThanOrEqual(1);
    f.tasks[0].finish();
    await run;
    expect(f.saved.at(-1)?.[0].status).toBe('completed');
    expect(f.saved.at(-1)?.[0].progress).toBe(1);
  });
});
