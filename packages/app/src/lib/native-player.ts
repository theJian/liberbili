import type { VideoPlayer } from 'expo-video';

// Expo exposes playback speed through its imperative native shared-object API.
export function applyPlaybackRate(player: VideoPlayer, speed: number): void {
  player.playbackRate = speed;
}
