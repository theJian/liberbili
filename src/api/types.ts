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
};

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

