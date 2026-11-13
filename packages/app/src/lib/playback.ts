/**
 * Playback policy and source-change ordering used by PlayerProvider.
 * parsePlaybackPreferences normalizes stored JSON with DEFAULT_PREFERENCES as
 * fallbacks; PLAYBACK_SPEEDS lists supported rates. queueFor, removeFromQueue,
 * and moveInQueue return queue state; nextOnEnd chooses an index from autoplay/repeat policy.
 *
 * sleepDeadline and sleepExpired model the timer; stopForSleep invalidates pending
 * playback and pauses on expiry. createPlaybackTransitions serializes native
 * replacements so callers can gate seeking and autoplay on the latest selection.
 */
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
/** index identifies the selected video; -1 represents no selection. */
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

/** Deduplicates by BV ID and selects video, prepending it when absent. */
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

/** Returns the next index, or undefined to stop; autoplay off also disables repeats. */
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

/**
 * Returns a deadline for 15, 30, or 60 minutes; unsupported values return undefined.
 * now and the returned deadline are Unix timestamps in milliseconds.
 */
export function sleepDeadline(
  minutes: number,
  now: number,
): number | undefined {
  return [15, 30, 60].includes(minutes) ? now + minutes * 60_000 : undefined;
}
/** Compares Unix millisecond timestamps; an undefined deadline never expires. */
export function sleepExpired(
  deadline: number | undefined,
  now: number,
): boolean {
  return deadline !== undefined && now >= deadline;
}

/**
 * Creates one ordering boundary for a native player. Replacements run in order so
 * an older source cannot finish after a newer replacement and overwrite it.
 * Invalidating a token does not cancel native work that has already started.
 */
export function createPlaybackTransitions() {
  let generation = 0;
  let tail = Promise.resolve();
  return {
    /** Starts a selection and invalidates every previously issued token. */
    begin: () => ++generation,
    /** Tests whether a token still belongs to the latest selection. */
    isCurrent: (token: number) => token === generation,
    /**
     * Queues a `Promise<void>` operation, skipping it if its token is stale when its
     * turn arrives. Resolves true only if the token is still current after the
     * operation finishes; callers must check this before seeking or playing.
     * Operation errors reject this result without blocking later replacements.
     */
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

/**
 * On expiry, invalidates pending transitions, calls pause, and returns true.
 * deadline and now are Unix milliseconds; an unset or future deadline returns false.
 */
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
