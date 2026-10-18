import { bilibiliExtractorApi } from '@liberbili/api/extractor-api';
import type { VideoPart, VideoSummary } from '@liberbili/api/types';
import type { StreamReference } from '@liberbili/api/extractor-api';

export type VideoLink = Extract<StreamReference, { kind: 'video' }>;

export async function resolveVideoLink(input: string): Promise<VideoLink> {
  const reference = await bilibiliExtractorApi.resolveStreamUrl(input);
  if (reference.kind !== 'video') throw new Error('Unsupported video type');
  return reference;
}

export function canonicalVideoUrl(bvid: string): string {
  if (!/^BV1[1-9A-HJ-NP-Za-km-z]{9}$/.test(bvid))
    throw new Error('Invalid BV identifier');
  return `https://www.bilibili.com/video/${bvid}`;
}

export async function playVideoReference(
  video: VideoSummary,
  parts: VideoPart[],
  position: { page?: string; timestamp?: string },
  playback: {
    play(video: VideoSummary): Promise<void>;
    playPart(video: VideoSummary, part: VideoPart): Promise<void>;
    isCurrent(): boolean;
    seek(seconds: number): void;
  },
): Promise<void> {
  const page = Number(position.page ?? 1);
  const timestamp = Number(position.timestamp ?? 0);
  const part = parts[page - 1];
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !part ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  )
    throw new Error('Invalid video position');
  if (position.page) await playback.playPart(video, part);
  else await playback.play(video);
  if (playback.isCurrent() && timestamp)
    playback.seek(Math.min(timestamp, part.duration || timestamp));
}
