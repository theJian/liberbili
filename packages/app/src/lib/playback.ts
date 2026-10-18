import type { VideoSummary } from '@liberbili/api/types';

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type RepeatMode = 'off' | 'one' | 'all';
export type PlaybackPreferences = {
  speed: number;
  repeat: RepeatMode;
  autoplay: boolean;
};
export const DEFAULT_PREFERENCES: PlaybackPreferences = {
  speed: 1,
  repeat: 'off',
  autoplay: true,
};
export type QueueState = { queue: VideoSummary[]; index: number };

export function parsePlaybackPreferences(raw?: string): PlaybackPreferences {
  try {
    const value = JSON.parse(raw ?? '{}');
    return {
      speed: PLAYBACK_SPEEDS.includes(value?.speed) ? value.speed : 1,
      repeat: ['off', 'one', 'all'].includes(value?.repeat)
        ? value.repeat
        : 'off',
      autoplay: typeof value?.autoplay === 'boolean' ? value.autoplay : true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function queueFor(
  video: VideoSummary,
  queue: VideoSummary[],
): QueueState {
  const items = [...new Map(queue.map((item) => [item.bvid, item])).values()];
  const index = items.findIndex((item) => item.bvid === video.bvid);
  return index >= 0
    ? { queue: items, index }
    : { queue: [video, ...items], index: 0 };
}

export function nextOnEnd(
  state: QueueState,
  preferences: PlaybackPreferences,
): number | undefined {
  if (!preferences.autoplay || state.index < 0 || !state.queue.length)
    return undefined;
  if (preferences.repeat === 'one') return state.index;
  if (state.index < state.queue.length - 1) return state.index + 1;
  return preferences.repeat === 'all' ? 0 : undefined;
}

export function removeFromQueue(
  state: QueueState,
  position: number,
): QueueState {
  if (position < 0 || position >= state.queue.length) return state;
  const queue = state.queue.filter((_, index) => index !== position);
  const index = !queue.length
    ? -1
    : position < state.index
      ? state.index - 1
      : Math.min(state.index, queue.length - 1);
  return { queue, index };
}

export function moveInQueue(
  state: QueueState,
  from: number,
  to: number,
): QueueState {
  if (
    from < 0 ||
    to < 0 ||
    from >= state.queue.length ||
    to >= state.queue.length ||
    from === to
  )
    return state;
  const current = state.queue[state.index];
  const queue = [...state.queue];
  queue.splice(to, 0, ...queue.splice(from, 1));
  return { queue, index: current ? queue.indexOf(current) : -1 };
}

export function sleepDeadline(
  minutes: number,
  now: number,
): number | undefined {
  return [15, 30, 60].includes(minutes) ? now + minutes * 60_000 : undefined;
}
export function sleepExpired(
  deadline: number | undefined,
  now: number,
): boolean {
  return deadline !== undefined && now >= deadline;
}

// Native replacements must be serialized: an older asynchronous replacement can
// otherwise finish after the new selection and overwrite its source.
export function createPlaybackTransitions() {
  let generation = 0;
  let tail = Promise.resolve();
  return {
    begin: () => ++generation,
    isCurrent: (token: number) => token === generation,
    replace(token: number, operation: () => Promise<void>): Promise<boolean> {
      const result = tail.then(async () => {
        if (token !== generation) return false;
        await operation();
        return token === generation;
      });
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export function stopForSleep(
  deadline: number | undefined,
  now: number,
  transitions: ReturnType<typeof createPlaybackTransitions>,
  pause: () => void,
): boolean {
  if (!sleepExpired(deadline, now)) return false;
  transitions.begin();
  pause();
  return true;
}
