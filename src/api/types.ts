export type VideoSummary = {
  bvid: string;
  aid: number;
  title: string;
  thumbnail: string;
  uploader: string;
  uploaderAvatar?: string;
  duration: number;
  views: number;
  publishedAt?: number;
  requiresMembership?: boolean;
  type?: 'video' | 'live' | 'premium';
};

export type VideoPart = {
  bvid: string;
  aid: number;
  cid: number;
  page: number;
  title: string;
  duration: number;
};

export type VideoDetail = VideoSummary & {
  description: string;
  likes: number;
  comments: number;
  parts: VideoPart[];
  tags?: string[];
  related?: VideoSummary[];
};

export type DashStream = {
  id: number;
  url: string;
  backupUrls: string[];
  bandwidth: number;
  codecs: string;
  mimeType: string;
  width?: number;
  height?: number;
  frameRate?: string;
  initialization?: string;
  indexRange?: string;
};

export type PlaybackInfo = {
  quality: number;
  acceptedQualities: number[];
  duration?: number;
  progressive: ProgressiveStream[];
  video: DashStream[];
  audio: DashStream[];
  dolbyAudio: DashStream[];
  flacAudio?: DashStream;
};

export type Channel = {
  id: string;
  name: string;
  avatar: string;
  banner: string;
  description: string;
  followers: number;
  live?: VideoSummary;
};

export type ChannelSummary = { type: 'channel'; id: string; name: string; avatar: string; description?: string; followers?: number };
export type SearchItem = VideoSummary | ChannelSummary;

export type RemotePlaylist = {
  id: string;
  type: 'season' | 'series' | 'parts';
  name: string;
  thumbnail: string;
  uploader?: string;
  streamCount: number;
};

export type Subtitle = { id: number; language: string; label: string; url: string; automatic: boolean };
export type VideoShot = {
  imageUrls: string[];
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  totalFrames: number;
  durationPerFrame: number;
  points: number[];
};
export type Danmaku = {
  text: string;
  color: number;
  position: 'regular' | 'top' | 'bottom' | 'superchat';
  fontScale: number;
  time: number;
  live: boolean;
};

export type LiveRoom = {
  roomId: number;
  uid: number;
  title: string;
  uploader: string;
  avatar: string;
  thumbnail: string;
  online: number;
  status: 0 | 1 | 2;
  startedAt: number;
};

export type SearchType = 'video' | 'live_room' | 'bili_user' | 'media_bangumi' | 'media_ft';
export type SearchOrder = 'totalrank' | 'click' | 'pubdate' | 'dm' | 'scores' | 'stow';
export type SearchDuration = 0 | 1 | 2 | 3 | 4;

export type ProgressiveStream = {
  quality: number;
  label: string;
  url: string;
  backupUrls: string[];
  size?: number;
  mimeType: string;
  headers: Record<string, string>;
};

export type Comment = {
  id: string;
  oid: number;
  root: number;
  author: string;
  avatar: string;
  message: string;
  likes: number;
  createdAt: number;
  replyCount: number;
  pinned: boolean;
  pictures: string[];
  replies: Comment[];
};

export type PageResult<T> = { items: T[]; next?: string };

export type BilibiliErrorKind =
  | 'network'
  | 'antiBot'
  | 'unavailable'
  | 'restricted'
  | 'loginRequired'
  | 'invalidResponse';

export class BilibiliError extends Error {
  constructor(public kind: BilibiliErrorKind, message: string, public code?: number) {
    super(message);
    this.name = 'BilibiliError';
  }
}
