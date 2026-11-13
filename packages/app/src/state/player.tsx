/**
 * PlayerProvider owns the shared native player. Mount it beneath HistoryProvider,
 * then usePlayer for state and controls and render VideoView with its `player`.
 * Start a stream with `play`, an explicit part with `playPart`, or a download URI
 * with `playLocal`; their loading and failure contracts are documented below.
 *
 * usePlayer exposes `toggle`, `next`, `previous`, and `retry` for transport;
 * `select`, `remove`, and `move` for the queue; and `setPreferences`/`setSleepTimer`.
 * PLAYBACK_SPEEDS lists supported rates. Preferences persist; queue and timer do not.
 * lib/playback supplies queue policy and serialized source replacement, while
 * lib/watch-history selects streamed parts and resume positions. Playback events
 * record streamed progress through HistoryProvider; local downloads skip history.
 */
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
import {
  historyKey,
  resumePosition,
  selectHistoryPart,
} from '@/lib/watch-history';
import { useHistory } from '@/state/history';
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
    /** Selected queue item, updated before its native source has loaded. */
    current?: VideoSummary;
    isPlaying: boolean;
    loading: boolean;
    error?: string;
    /** Unix millisecond deadline, or undefined when the sleep timer is off. */
    sleepUntil?: number;
    /**
     * Replaces the queue with the supplied videos (default: [video]), deduplicated
     * by BV ID, and selects video, prepending it if absent. Loads the latest saved
     * part or the first available part and resumes eligible history.
     *
     * play, playPart, and playLocal update queue/current before loading. API and
     * native load failures are caught and reported through error; awaiting these
     * methods does not establish playback success. Superseded loads cannot seek
     * or autoplay after replacement completes.
     */
    play(video: VideoSummary, queue?: VideoSummary[]): Promise<void>;
    /** Replaces the queue with [video] and resumes part; an unavailable cid sets error. */
    playPart(video: VideoSummary, part: VideoPart): Promise<void>;
    /** Loads a download uri with queue [video], without resuming or recording its progress. */
    playLocal(video: VideoSummary, uri: string): Promise<void>;
    /** Retries an unready/failed selection; otherwise pauses, plays, or replays at the end. */
    toggle(): void;
    next(): void;
    previous(): void;
    select(position: number): void;
    /**
     * Removing the selected item starts its successor, or its predecessor at the
     * end of the queue. Removing the final item clears playback.
     */
    remove(position: number): void;
    move(from: number, to: number): void;
    /** Reloads the last video/part/URI selection, or does nothing without one. */
    retry(): void;
    setPreferences(patch: Partial<PlaybackPreferences>): void;
    /** Starts a 15/30/60-minute timer; no argument or an unsupported value cancels it. */
    setSleepTimer(minutes?: number): void;
  };
const Context = createContext<Value | null>(null);

export function PlayerProvider({ children }: PropsWithChildren) {
  const { getEntries, record } = useHistory();
  // selection keeps the last request, including local URIs, for retry; active
  // tracks only the loaded streamed part for history. ready gates use of the
  // loaded source. A new load clears active and ready; the timer's expiry
  // callback clears ready but retains selection for retry.
  const active = useRef<
    { video: VideoSummary; part: VideoPart; started: boolean } | undefined
  >(undefined);
  const player = useVideoPlayer(null, (instance) => {
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    instance.timeUpdateEventInterval = 5;
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
      if (completed) item.started = false;
    },
    [player, record],
  );

  const load = useCallback(
    async (nextSelection: Selection) => {
      const token = transitions.begin();
      ready.current = false;
      selection.current = nextSelection;
      setLoading(true);
      setError(undefined);
      saveProgress();
      active.current = undefined;
      player.pause();
      try {
        const { video, uri, part } = nextSelection;
        let source;
        let selected: VideoPart | undefined;
        if (uri) source = { uri, contentType: 'progressive' as const };
        else {
          const detail = await bilibiliApi.getVideo(video.bvid);
          selected = selectHistoryPart(
            detail.parts,
            getEntries(),
            video.bvid,
            part,
          );
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
          if (selected) {
            const entry = getEntries().find(
              (item) => historyKey(item) === `${video.bvid}:${selected.cid}`,
            );
            const position = resumePosition(
              entry,
              player.duration || selected.duration,
            );
            if (position) player.seekBy(position - player.currentTime);
            active.current = { video, part: selected, started: false };
          }
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
    [getEntries, player, saveProgress, transitions],
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
        saveProgress();
        active.current = undefined;
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
    [load, player, saveProgress, transitions, updateQueue],
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
      ({ isPlaying: value }) => {
        setIsPlaying(value);
        if (value && ready.current && active.current)
          active.current.started = true;
        if (!value) saveProgress();
      },
    );
    const progress = player.addListener('timeUpdate', () => {
      if (ready.current && player.playing && active.current) {
        active.current.started = true;
        saveProgress();
      }
    });
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveProgress();
    });
    const status = player.addListener('statusChange', ({ status: value }) => {
      if (value === 'error') {
        setError('playback');
        setLoading(false);
      }
    });
    const ended = player.addListener('playToEnd', () => {
      if (!ready.current) return;
      saveProgress(true);
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
      progress.remove();
      background.remove();
    };
  }, [player, preferences, saveProgress, select, setSleepTimer]);
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

/** Returns shared playback state and controls; throws outside PlayerProvider. */
export function usePlayer(): Value {
  const value = useContext(Context);
  if (!value) throw new Error('usePlayer must be inside PlayerProvider');
  return value;
}
export { VideoView, PLAYBACK_SPEEDS };
