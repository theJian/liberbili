import { signWbi } from './crypto';
import { bilibiliSession, dmImgParams } from './session';
import {
  BilibiliError,
  Comment,
  PageResult,
  ProgressiveStream,
  VideoDetail,
  VideoPart,
  VideoSummary,
} from './types';

const API = 'https://api.bilibili.com';
const QUALITY: Record<number, string> = {
  6: '240P',
  16: '360P',
  32: '480P',
  64: '720P',
  80: '1080P',
};

type ApiEnvelope<T> = { code: number; message?: string; data: T };
type Json = Record<string, any>;

const https = (url?: string) => (url ?? '').replace(/^http:/, 'https:');
const stripHtml = (text = '') =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

function mapError(code: number, message = 'Bilibili request failed') {
  if (code === -400) return new BilibiliError('invalidResponse', message, code);
  if (message.includes('地区')) return new BilibiliError('restricted', message, code);
  if (code === -10403 || message.includes('登录') || message.includes('大会员'))
    return new BilibiliError('loginRequired', message, code);
  return new BilibiliError('unavailable', message, code);
}

export const recommendationsUrl = () => `${API}/x/web-interface/index/top/rcmd?fresh_type=3`;

export function normalizeSummary(item: Json): VideoSummary {
  const bvid = item.bvid || item.uri?.match(/BV[\w]+/)?.[0] || item.arcurl?.match(/BV[\w]+/)?.[0];
  return {
    bvid,
    aid: Number(item.aid ?? item.id ?? 0),
    title: stripHtml(item.title),
    thumbnail: https(item.pic?.startsWith('//') ? `https:${item.pic}` : item.pic),
    uploader: item.owner?.name ?? item.author ?? '',
    uploaderAvatar: https(item.owner?.face ?? item.upic),
    duration:
      typeof item.duration === 'string'
        ? item.duration.split(':').reduce((sum: number, value: string) => sum * 60 + Number(value), 0)
        : Number(item.duration ?? 0),
    views: Number(item.stat?.view ?? item.play ?? 0),
    publishedAt: Number(item.pubdate ?? 0) || undefined,
    requiresMembership: item.elec_arc_type === 1 || JSON.stringify(item.badges ?? []).includes('充电专属'),
    type: 'video',
  };
}

function normalizeComment(item: Json): Comment {
  let message = stripHtml(item.content?.message ?? '');
  const jumpUrl = Object.keys(item.content?.jump_url ?? {}).find((url) => url.startsWith('https://'));
  if (message.endsWith('...') && jumpUrl) message += `\n\n${jumpUrl}`;
  const pictureDetails = (item.content?.pictures ?? []).map((picture: Json) => ({
    url: https(picture.img_src),
    width: Number(picture.img_width ?? 0),
    height: Number(picture.img_height ?? 0),
  }));
  return {
    id: String(item.rpid_str ?? item.rpid),
    oid: Number(item.oid),
    root: Number(item.root || item.rpid),
    author: item.member?.uname ?? '',
    authorId: String(item.mid ?? item.member?.mid ?? ''),
    authorUrl: `https://space.bilibili.com/${item.mid ?? item.member?.mid ?? ''}`,
    avatar: https(item.member?.avatar),
    message,
    likes: Number(item.like ?? 0),
    createdAt: Number(item.ctime ?? 0),
    replyCount: Number(item.rcount ?? 0),
    pinned: Boolean(item.isTop),
    heartedByUploader: Boolean(item.up_action?.like),
    pictures: pictureDetails.map((picture: { url: string }) => picture.url),
    pictureDetails,
    replies: (item.replies ?? []).map(normalizeComment),
  };
}

export class BilibiliClient {
  protected async request<T>(url: string, retry = true): Promise<T> {
    try {
      const response = await fetch(url, { headers: await bilibiliSession.headers() });
      if (response.status === 412 && retry) {
        await bilibiliSession.clear();
        return this.request(url, false);
      }
      if (!response.ok)
        throw new BilibiliError(response.status === 412 ? 'antiBot' : 'network', `HTTP ${response.status}`);
      const json = (await response.json()) as ApiEnvelope<T>;
      if (json.code !== 0) throw mapError(json.code, json.message);
      return json.data;
    } catch (error) {
      if (error instanceof BilibiliError) throw error;
      throw new BilibiliError('network', error instanceof Error ? error.message : 'Network error');
    }
  }

  protected async wbi(path: string, params: Record<string, string | number>) {
    const query = signWbi(params, await bilibiliSession.getMixinKey());
    return `${API}${path}?${query}`;
  }

  async getRecommendations() {
    const data = await this.request<Json>(recommendationsUrl());
    return (data.item ?? []).filter((item: Json) => item.bvid || item.uri?.includes('/video/')).map(normalizeSummary);
  }

  async searchVideos(query: string, page = 1): Promise<PageResult<VideoSummary>> {
    const url = new URL(`${API}/x/web-interface/search/type`);
    url.searchParams.set('search_type', 'video');
    url.searchParams.set('keyword', query);
    url.searchParams.set('page', String(page));
    const data = await this.request<Json>(url.toString());
    const items = (data.result ?? []).map(normalizeSummary);
    return { items, next: items.length ? String(page + 1) : undefined };
  }

  async getVideo(bvid: string): Promise<VideoDetail> {
    const data = await this.request<Json>(`${API}/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    const summary = normalizeSummary(data);
    const parts: VideoPart[] = (data.pages ?? []).map((part: Json) => ({
      bvid,
      aid: Number(data.aid),
      cid: Number(part.cid),
      page: Number(part.page),
      title: part.part || data.title,
      duration: Number(part.duration),
    }));
    return {
      ...summary,
      aid: Number(data.aid),
      description: data.desc ?? '',
      likes: Number(data.stat?.like ?? 0),
      comments: Number(data.stat?.reply ?? 0),
      uploaderId: String(data.owner?.mid ?? ''),
      uploaderUrl: `https://space.bilibili.com/${data.owner?.mid ?? ''}`,
      uploaderVerified: false,
      paid: Number(data.rights?.pay ?? 0) === 1,
      stats: Object.fromEntries(
        Object.entries(data.stat ?? {}).map(([key, value]) => [key, typeof value === 'number' ? value : String(value)]),
      ),
      staff: (data.staff ?? []).map((member: Json) => ({
        id: String(member.mid),
        name: String(member.name ?? ''),
        role: String(member.title ?? ''),
        avatar: https(member.face),
        url: `https://space.bilibili.com/${member.mid}`,
      })),
      parts,
    };
  }

  async getProgressiveStreams(part: VideoPart): Promise<ProgressiveStream[]> {
    const url = await this.wbi('/x/player/wbi/playurl', {
      avid: part.aid,
      bvid: part.bvid,
      cid: part.cid,
      qn: 64,
      fnver: 0,
      fnval: 1,
      fourk: 0,
      try_look: 1,
      web_location: 1315873,
      ...dmImgParams(),
    });
    const data = await this.request<Json>(url);
    const headers = await bilibiliSession.headers();
    const quality = Number(data.quality ?? 32);
    return (data.durl ?? []).map((stream: Json) => ({
      quality,
      label: QUALITY[quality] ?? `${quality}P`,
      url: https(stream.url),
      backupUrls: (stream.backup_url ?? stream.backupUrl ?? []).map(https),
      size: Number(stream.size ?? 0) || undefined,
      mimeType: 'video/mp4',
      headers: { Referer: headers.Referer, 'User-Agent': headers['User-Agent'] },
    }));
  }

  async getComments(aid: number, cursor = ''): Promise<PageResult<Comment>> {
    const url = await this.wbi('/x/v2/reply/wbi/main', {
      oid: aid,
      type: 1,
      mode: 3,
      pagination_str: JSON.stringify({ offset: cursor }),
      plat: 1,
      web_location: 1315875,
    });
    const data = await this.request<Json>(url);
    const items = [...(data.top_replies ?? []).map((item: Json) => ({ ...item, isTop: true })), ...(data.replies ?? [])].map(
      normalizeComment,
    );
    const next = data.cursor?.is_end ? undefined : data.cursor?.pagination_reply?.next_offset;
    return { items, next };
  }

  async getCommentReplies(oid: number, root: number, page = 1): Promise<PageResult<Comment>> {
    const data = await this.request<Json>(
      `${API}/x/v2/reply/reply?type=1&ps=10&web_location=333.788&oid=${oid}&root=${root}&pn=${page}`,
    );
    const items = (data.replies ?? []).map(normalizeComment);
    return { items, next: items.length >= 10 ? String(page + 1) : undefined };
  }
}

export const bilibiliApi = new BilibiliClient();
