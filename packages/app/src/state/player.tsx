import { useVideoPlayer, type VideoPlayer, VideoView } from 'expo-video';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import type { VideoPart, VideoSummary } from '@liberbili/api/types';
import { bilibiliApi } from '@/lib/bilibili';
import { applyPlaybackRate } from '@/lib/native-player';
import {
  createPlaybackTransitions,
  moveInQueue,
  nextOnEnd,
  parsePlaybackPreferences,
  PLAYBACK_SPEEDS,
  queueFor,
  removeFromQueue,
  sleepDeadline,
  sleepExpired,
  stopForSleep,
  type PlaybackPreferences,
  type QueueState,
} from '@/lib/playback';
import { storage } from '@/storage';

const PREFERENCES_KEY = '@liberbili/playback/v1';
type Selection = { video: VideoSummary; part?: VideoPart; uri?: string };
type Value = QueueState &
  PlaybackPreferences & {
    player: VideoPlayer;
    current?: VideoSummary;
    isPlaying: boolean;
    loading: boolean;
    error?: string;
    sleepUntil?: number;
    play(video: VideoSummary, queue?: VideoSummary[]): Promise<void>;
    playPart(video: VideoSummary, part: VideoPart): Promise<void>;
    playLocal(video: VideoSummary, uri: string): Promise<void>;
    toggle(): void;
    next(): void;
    previous(): void;
    select(position: number): void;
    remove(position: number): void;
    move(from: number, to: number): void;
    retry(): void;
    setPreferences(patch: Partial<PlaybackPreferences>): void;
    setSleepTimer(minutes?: number): void;
  };
const Context = createContext<Value | null>(null);

export function PlayerProvider({ children }: PropsWithChildren) {
  const player = useVideoPlayer(null, (instance) => {
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
  });
  const [state, setState] = useState<QueueState>({ queue: [], index: -1 });
  const latest = useRef(state);
  const [preferences, updatePreferences] = useState(() =>
    parsePlaybackPreferences(storage.getString(PREFERENCES_KEY)),
  );
  const speedRef = useRef(preferences.speed);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [sleepUntil, setSleepUntil] = useState<number>();
  const sleepRef = useRef<number | undefined>(undefined);
  const ready = useRef(false);
  const selection = useRef<Selection | undefined>(undefined);
  const [transitions] = useState(createPlaybackTransitions);
  const updateQueue = useCallback((value: QueueState) => {
    latest.current = value;
    setState(value);
  }, []);
  const setPreferences = useCallback((patch: Partial<PlaybackPreferences>) => {
    updatePreferences((value) =>
      parsePlaybackPreferences(JSON.stringify({ ...value, ...patch })),
    );
  }, []);
  useEffect(() => {
    speedRef.current = preferences.speed;
    storage.set(PREFERENCES_KEY, JSON.stringify(preferences));
    applyPlaybackRate(player, preferences.speed);
  }, [player, preferences]);

  const load = useCallback(
    async (nextSelection: Selection) => {
      const token = transitions.begin();
      ready.current = false;
      selection.current = nextSelection;
      setLoading(true);
      setError(undefined);
      player.pause();
      try {
        const { video, uri, part } = nextSelection;
        let source;
        if (uri) source = { uri, contentType: 'progressive' as const };
        else {
          const detail = await bilibiliApi.getVideo(video.bvid);
          const selected = part
            ? detail.parts.find((item) => item.cid === part.cid)
            : detail.parts[0];
          if (!selected) throw new Error('Video part unavailable');
          const streams = await bilibiliApi.getProgressiveStreams(selected);
          if (!streams[0]) throw new Error('No compatible MP4 stream');
          source = {
            uri: streams[0].url,
            headers: streams[0].headers,
            contentType: 'progressive' as const,
          };
        }
        const applied = await transitions.replace(token, () =>
          player.replaceAsync({
            ...source,
            metadata: {
              title: video.title,
              artist: video.uploader,
              artwork: video.thumbnail,
            },
          }),
        );
        if (applied) {
          ready.current = true;
          setError(undefined);
          applyPlaybackRate(player, speedRef.current);
          player.play();
        }
      } catch {
        if (transitions.isCurrent(token)) setError('playback');
      } finally {
        if (transitions.isCurrent(token)) setLoading(false);
      }
    },
    [player, transitions],
  );

  const play = useCallback(
    async (video: VideoSummary, queue = [video]) => {
      updateQueue(queueFor(video, queue));
      await load({ video });
    },
    [load, updateQueue],
  );
  const playPart = useCallback(
    async (video: VideoSummary, part: VideoPart) => {
      updateQueue({ queue: [video], index: 0 });
      await load({ video, part });
    },
    [load, updateQueue],
  );
  const playLocal = useCallback(
    async (video: VideoSummary, uri: string) => {
      updateQueue({ queue: [video], index: 0 });
      await load({ video, uri });
    },
    [load, updateQueue],
  );
  const select = useCallback(
    (position: number) => {
      const value = latest.current;
      const video = value.queue[position];
      if (!video) return;
      updateQueue({ ...value, index: position });
      void load(
        position === value.index && selection.current?.video.bvid === video.bvid
          ? selection.current
          : { video },
      );
    },
    [load, updateQueue],
  );
  const next = useCallback(() => select(latest.current.index + 1), [select]);
  const previous = useCallback(
    () => select(latest.current.index - 1),
    [select],
  );
  const retry = useCallback(() => {
    if (selection.current) void load(selection.current);
  }, [load]);
  const toggle = useCallback(() => {
    if (error || !ready.current) retry();
    else if (!loading) {
      if (player.playing) player.pause();
      else if (player.duration > 0 && player.currentTime >= player.duration)
        player.replay();
      else player.play();
    }
  }, [error, loading, player, retry]);
  const remove = useCallback(
    (position: number) => {
      const old = latest.current;
      const value = removeFromQueue(old, position);
      updateQueue(value);
      if (value === old || position !== old.index) return;
      if (value.index >= 0) void load({ video: value.queue[value.index] });
      else {
        const token = transitions.begin();
        ready.current = false;
        selection.current = undefined;
        player.pause();
        setLoading(false);
        setError(undefined);
        void transitions
          .replace(token, () => player.replaceAsync(null))
          .catch(() => {
            if (transitions.isCurrent(token)) setError('playback');
          });
      }
    },
    [load, player, transitions, updateQueue],
  );
  const move = useCallback(
    (from: number, to: number) =>
      updateQueue(moveInQueue(latest.current, from, to)),
    [updateQueue],
  );
  const setSleepTimer = useCallback((minutes?: number) => {
    const deadline = minutes ? sleepDeadline(minutes, Date.now()) : undefined;
    sleepRef.current = deadline;
    setSleepUntil(deadline);
  }, []);
  useEffect(() => {
    if (sleepUntil === undefined) return;
    const expire = () => {
      if (
        !stopForSleep(sleepRef.current, Date.now(), transitions, () =>
          player.pause(),
        )
      )
        return;
      ready.current = false;
      setLoading(false);
      setSleepTimer();
    };
    const timer = setTimeout(expire, Math.max(0, sleepUntil - Date.now()));
    const foreground = AppState.addEventListener('change', expire);
    return () => {
      clearTimeout(timer);
      foreground.remove();
    };
  }, [player, setSleepTimer, sleepUntil, transitions]);
  useEffect(() => {
    const playing = player.addListener(
      'playingChange',
      ({ isPlaying: value }) => setIsPlaying(value),
    );
    const status = player.addListener('statusChange', ({ status: value }) => {
      if (value === 'error') {
        setError('playback');
        setLoading(false);
      }
    });
    const ended = player.addListener('playToEnd', () => {
      if (!ready.current) return;
      if (sleepExpired(sleepRef.current, Date.now())) {
        player.pause();
        setSleepTimer();
        return;
      }
      const position = nextOnEnd(latest.current, preferences);
      if (position === undefined) {
        player.pause();
        return;
      }
      if (position === latest.current.index) {
        player.replay();
      } else select(position);
    });
    return () => {
      playing.remove();
      status.remove();
      ended.remove();
    };
  }, [player, preferences, select, setSleepTimer]);
  const value = useMemo(
    () => ({
      ...state,
      ...preferences,
      player,
      current: state.queue[state.index],
      isPlaying,
      loading,
      error,
      sleepUntil,
      play,
      playPart,
      playLocal,
      toggle,
      next,
      previous,
      select,
      remove,
      move,
      retry,
      setPreferences,
      setSleepTimer,
    }),
    [
      state,
      preferences,
      player,
      isPlaying,
      loading,
      error,
      sleepUntil,
      play,
      playPart,
      playLocal,
      toggle,
      next,
      previous,
      select,
      remove,
      move,
      retry,
      setPreferences,
      setSleepTimer,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePlayer(): Value {
  const value = useContext(Context);
  if (!value) throw new Error('usePlayer must be inside PlayerProvider');
  return value;
}
export { VideoView, PLAYBACK_SPEEDS };
