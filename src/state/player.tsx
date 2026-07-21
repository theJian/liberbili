import { createVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
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

import { bilibiliApi } from '@/api/bilibili';
import { VideoPart, VideoSummary } from '@/api/types';

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
  const [player] = useState(() => {
    const instance = createVideoPlayer(null);
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    return instance;
  });
  const [queue, setQueue] = useState<VideoSummary[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const current = queue[index];

  const load = useCallback(
    async (video: VideoSummary, requestedPart?: VideoPart) => {
      const detail = await bilibiliApi.getVideo(video.bvid);
      const streams = await bilibiliApi.getProgressiveStreams(
        requestedPart ?? detail.parts[0],
      );
      const stream = streams[0];
      if (!stream) throw new Error('No compatible MP4 stream');
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
      player.play();
    },
    [player],
  );

  const play = useCallback(
    async (video: VideoSummary, nextQueue = [video]) => {
      const position = Math.max(
        0,
        nextQueue.findIndex((item) => item.bvid === video.bvid),
      );
      setQueue(nextQueue);
      setIndex(position);
      await load(video);
    },
    [load],
  );
  const playPart = useCallback(
    async (video: VideoSummary, part: VideoPart) => {
      setQueue([video]);
      setIndex(0);
      await load(video, part);
    },
    [load],
  );
  const playLocal = useCallback(
    async (video: VideoSummary, uri: string) => {
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
      player.play();
    },
    [player],
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
      ({ isPlaying: value }) => setIsPlaying(value),
    );
    const ended = player.addListener('playToEnd', next);
    return () => {
      playing.remove();
      ended.remove();
    };
  }, [next, player]);
  const previousIndex = useRef(index);
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
  useEffect(() => () => player.release(), [player]);
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
