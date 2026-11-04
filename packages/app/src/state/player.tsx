/**
 * Shares an Expo Video player and queue for streamed videos and local downloads.
 * Mount PlayerProvider beneath HistoryProvider, then call usePlayer() for state
 * and controls; render the re-exported VideoView with the returned player.
 * Streamed playback fetches video parts and progressive MP4 URLs from bilibiliApi
 * and uses watch history to select a part and resume position. Once playback
 * starts, it records progress periodically, on pause/background, on completion,
 * and before replacing the source. Local downloads neither resume nor record
 * their progress because they lack a saved part identity.
 */
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { VideoPart, VideoSummary } from '@liberbili/api/types';

import { AppState } from 'react-native';
import {
  historyKey,
  resumePosition,
  selectHistoryPart,
} from '@/lib/watch-history';
import { useHistory } from '@/state/history';

import { bilibiliApi } from '@/lib/bilibili';

/**
 * Shared playback state and controls. current and index describe the selected
 * queue item, which can differ from the loaded source while loading or after an
 * error. The play methods update the queue before loading and reject on API or
 * source-replacement failure without restoring the previous queue. A newer play
 * request can supersede an older one without rejecting its promise.
 */
type Value = {
  player: VideoPlayer;
  current?: VideoSummary;
  queue: VideoSummary[];
  index: number;
  isPlaying: boolean;
  /**
   * Starts the video's most recently saved part if still available, otherwise
   * its first part, resuming eligible progress. Defaults to a one-video queue;
   * a supplied queue should contain video (the first matching bvid is selected,
   * or index 0 if absent). Rejects if no part or compatible MP4 stream exists.
   */
  play(video: VideoSummary, queue?: VideoSummary[]): Promise<void>;
  /**
   * Replaces the queue with video and resumes the requested part's eligible
   * progress. Rejects if its cid is unavailable rather than choosing another part,
   * or if no compatible MP4 stream exists.
   */
  playPart(video: VideoSummary, part: VideoPart): Promise<void>;
  /** Replaces the queue with video and plays uri without resuming or recording it. */
  playLocal(video: VideoSummary, uri: string): Promise<void>;
  /** Pauses or plays the currently loaded source. */
  toggle(): void;
  /** Selects the next queue item, if any; its asynchronous load is not awaited. */
  next(): void;
  /** Selects the previous queue item, if any; its asynchronous load is not awaited. */
  previous(): void;
};
const Context = createContext<Value | null>(null);

/**
 * Owns the shared player and its playback/background listeners for descendants.
 * Requires a parent HistoryProvider; usePlayer consumers must be inside this
 * provider. Listeners are removed on unmount; progress is not explicitly saved
 * on unmount, so persistence relies on the playback events described above.
 */
export function PlayerProvider({ children }: PropsWithChildren) {
  const { getEntries, record } = useHistory();
  const active = useRef<
    { video: VideoSummary; part: VideoPart; started: boolean } | undefined
  >(undefined);
  const request = useRef(0);
  const player = useVideoPlayer(null, (instance) => {
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    instance.timeUpdateEventInterval = 5;
  });
  const [queue, setQueue] = useState<VideoSummary[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const current = queue[index];
  const previousIndex = useRef(index);

  const saveProgress = useCallback(
    (completed = false) => {
      const item = active.current;
      if (!item?.started || !Number.isFinite(player.currentTime)) return;
      const duration =
        player.duration > 0 ? player.duration : item.part.duration;
      record({
        video: item.video,
        part: item.part,
        position: completed ? duration : Math.max(0, player.currentTime),
        duration,
        watchedAt: Date.now(),
        completed,
      });
    },
    [player, record],
  );

  const load = useCallback(
    async (video: VideoSummary, requestedPart?: VideoPart) => {
      const generation = ++request.current;
      const detail = await bilibiliApi.getVideo(video.bvid);
      const part = selectHistoryPart(
        detail.parts,
        getEntries(),
        video.bvid,
        requestedPart,
      );
      if (!part) throw new Error('Video part is unavailable');
      const streams = await bilibiliApi.getProgressiveStreams(part);
      const stream = streams[0];
      if (!stream) throw new Error('No compatible MP4 stream');
      if (generation !== request.current) return;
      saveProgress();
      active.current = undefined;
      await player.replaceAsync({
        uri: stream.url,
        contentType: 'progressive',
        headers: stream.headers,
        metadata: {
          title: video.title,
          artist: video.uploader,
          artwork: video.thumbnail,
        },
      });
      if (generation !== request.current) return;
      const entry = getEntries().find(
        (item) => historyKey(item) === `${video.bvid}:${part.cid}`,
      );
      const position = resumePosition(entry, player.duration || part.duration);
      if (position) player.seekBy(position - player.currentTime);
      active.current = { video, part, started: false };
      player.play();
    },
    [getEntries, player, saveProgress],
  );

  const play = useCallback(
    async (video: VideoSummary, nextQueue = [video]) => {
      const position = Math.max(
        0,
        nextQueue.findIndex((item) => item.bvid === video.bvid),
      );
      previousIndex.current = position;
      setQueue(nextQueue);
      setIndex(position);
      await load(video);
    },
    [load],
  );
  const playPart = useCallback(
    async (video: VideoSummary, part: VideoPart) => {
      previousIndex.current = 0;
      setQueue([video]);
      setIndex(0);
      await load(video, part);
    },
    [load],
  );
  const playLocal = useCallback(
    async (video: VideoSummary, uri: string) => {
      const generation = ++request.current;
      saveProgress();
      // Downloads do not retain a cid; never apply another part's progress.
      active.current = undefined;
      previousIndex.current = 0;
      setQueue([video]);
      setIndex(0);
      await player.replaceAsync({
        uri,
        contentType: 'progressive',
        metadata: {
          title: video.title,
          artist: video.uploader,
          artwork: video.thumbnail,
        },
      });
      if (generation === request.current) player.play();
    },
    [player, saveProgress],
  );
  const next = useCallback(
    () => setIndex((value) => (value < queue.length - 1 ? value + 1 : value)),
    [queue.length],
  );
  const previous = useCallback(
    () => setIndex((value) => (value > 0 ? value - 1 : value)),
    [],
  );
  const toggle = useCallback(
    () => (player.playing ? player.pause() : player.play()),
    [player],
  );

  useEffect(() => {
    const playing = player.addListener(
      'playingChange',
      ({ isPlaying: value }) => {
        setIsPlaying(value);
        if (value && active.current) active.current.started = true;
        if (!value) saveProgress();
      },
    );
    const progress = player.addListener('timeUpdate', () => {
      if (player.playing && active.current) {
        active.current.started = true;
        saveProgress();
      }
    });
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveProgress();
    });
    const ended = player.addListener('playToEnd', () => {
      saveProgress(true);
      active.current = undefined;
      next();
    });
    return () => {
      playing.remove();
      ended.remove();
      progress.remove();
      background.remove();
    };
  }, [next, player, saveProgress]);
  useEffect(() => {
    if (
      index >= 0 &&
      previousIndex.current >= 0 &&
      index !== previousIndex.current &&
      current
    )
      void load(current);
    previousIndex.current = index;
  }, [current, index, load]);
  const value = useMemo(
    () => ({
      player,
      current,
      queue,
      index,
      isPlaying,
      play,
      playPart,
      playLocal,
      toggle,
      next,
      previous,
    }),
    [
      player,
      current,
      queue,
      index,
      isPlaying,
      play,
      playPart,
      playLocal,
      toggle,
      next,
      previous,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Returns the parent PlayerProvider's reactive state, native player, and controls.
 * Await play, playPart, or playLocal to handle load failures. Queue selection may
 * already have changed when they reject. Throws outside PlayerProvider.
 */
export function usePlayer() {
  const value = useContext(Context);
  if (!value) throw new Error('usePlayer must be inside PlayerProvider');
  return value;
}

export { VideoView };
