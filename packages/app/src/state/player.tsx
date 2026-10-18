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

type Value = {
  player: VideoPlayer;
  current?: VideoSummary;
  queue: VideoSummary[];
  index: number;
  isPlaying: boolean;
  play(video: VideoSummary, queue?: VideoSummary[]): Promise<void>;
  playPart(video: VideoSummary, part: VideoPart): Promise<void>;
  playLocal(video: VideoSummary, uri: string): Promise<void>;
  toggle(): void;
  next(): void;
  previous(): void;
};
const Context = createContext<Value | null>(null);

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

export function usePlayer() {
  const value = useContext(Context);
  if (!value) throw new Error('usePlayer must be inside PlayerProvider');
  return value;
}

export { VideoView };
