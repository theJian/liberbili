/**
 * applyPlaybackRate bridges PlayerProvider's speed preference to expo-video's
 * imperative native VideoPlayer property.
 */
import type { VideoPlayer } from 'expo-video';

export function applyPlaybackRate(player: VideoPlayer, speed: number): void {
  player.playbackRate = speed;
}
