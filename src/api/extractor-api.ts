import { inflateRaw } from 'pako';

import { BilibiliClient, normalizeSummary } from './bilibili';
import { avToBv, bvToAv, signApp } from './crypto';
import { bilibiliSession, dmImgParams } from './session';
import {
  Channel,
  ChannelSummary,
  Danmaku,
  DashStream,
  LiveRoom,
  PageResult,
  PlaybackInfo,
  PremiumEpisode,
  PremiumSeason,
  ProgressiveStream,
  RemotePlaylist,
  RemotePlaylistPage,
  RoundPlay,
  SearchDuration,
  SearchOrder,
  SearchType,
  SearchItem,
  Subtitle,
  VideoDetail,
  VideoPart,
  VideoShot,
  VideoSummary,
} from './types';

type Json = Record<string, any>;
const API = 'https://api.bilibili.com';
const LIVE_API = 'https://api.live.bilibili.com';
const APP_KEY = '1d8b6e7d45233436';
const APP_SECRET = '560c52ccd288fed045859ed18bffd973';
const QUALITY: Record<number, string> = { 6: '240P', 16: '360P', 32: '480P', 64: '720P', 74: '720P60', 80: '1080P', 112: '1080P+', 116: '1080P60', 120: '4K', 125: 'HDR', 126: 'Dolby Vision', 127: '8K' };
const AUDIO_QUALITY: Record<number, string> = { 30216: '64K', 30232: '132K', 30280: '192K', 30250: 'Dolby Atmos', 30255: 'Dolby Atmos', 30251: 'Hi-Res lossless' };
const https = (value = '') => value.replace(/^http:/, 'https:').replace(/^\/\//, 'https://');
const entity = (value: string) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

const hostnameMatches = (url: string, pattern: RegExp) => {
  try {
    return pattern.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

export const isBilibiliUrl = (url: string) => hostnameMatches(url, /(^|\.)bilibili\.com$/i);
export const isBilibiliMediaUrl = (url: string) => hostnameMatches(url, /(^|\.)(bilivideo\.com|akamaized\.net)$/i);
export const videoQualityLabel = (id: number) => QUALITY[id] ?? 'Unknown resolution';
export const audioQualityLabel = (id: number) => AUDIO_QUALITY[id] ?? 'Unknown bitrate';

function dash(item: Json): DashStream {
  return {
    id: Number(item.id),
    url: https(item.baseUrl ?? item.base_url),
    backupUrls: (item.backupUrl ?? item.backup_url ?? []).map(https),
    bandwidth: Number(item.bandwidth ?? 0),
    codecs: item.codecs ?? '',
    mimeType: item.mimeType ?? item.mime_type ?? '',
    width: item.width,
    height: item.height,
    frameRate: item.frameRate ?? item.frame_rate,
    initialization: item.SegmentBase?.Initialization ?? item.segment_base?.initialization,
    indexRange: item.SegmentBase?.indexRange ?? item.segment_base?.index_range,
  };
}

function liveSummary(item: Json, nested = false): VideoSummary {
  return {
    bvid: `live:${item.roomid ?? item.room_id}`,
    aid: Number(item.roomid ?? item.room_id),
    title: item.live_status === 2 ? `${item.uname}的投稿视频轮播` : item.title,
    thumbnail: https(item.user_cover || item.system_cover || item.cover_from_user),
    uploader: item.uname ?? '',
    uploaderAvatar: https(item.uface ?? item.face),
    duration: -1,
    views: Number(item.online ?? item.watched_show?.num ?? 0),
    publishedAt: nested ? undefined : Date.parse(`${item.live_time}+08:00`) / 1000 || undefined,
    type: 'live',
  };
}

function premiumEpisode(item: Json): PremiumEpisode {
  const url = String(item.url ?? item.share_url ?? '');
  return {
    bvid: String(item.bvid ?? ''),
    aid: Number(item.aid ?? 0),
    cid: Number(item.cid ?? 0),
    episodeId: url.match(/\/(ep\d+)/)?.[1] ?? String(item.ep_id ?? item.id ?? ''),
    episodeNumber: item.title,
    title: entity(String(item.share_copy ?? item.long_title ?? item.title ?? '').replace(/<[^>]+>/g, '')),
    description: item.long_title,
    thumbnail: https(item.cover),
    uploader: 'BiliBili',
    duration: Number(item.duration ?? 0) / 1000,
    views: -1,
    publishedAt: Number(item.pub_time ?? item.pubtime ?? 0) || undefined,
    paid: Number(item.rights?.pay ?? 0) === 1,
    type: 'premium',
  };
}

export type StreamReference =
  | { kind: 'video'; id: string; bvid: string; page: number; timestamp: number }
  | { kind: 'premium'; id: string }
  | { kind: 'live'; id: string };

export class BilibiliExtractorApi extends BilibiliClient {
  private async raw<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { ...(await bilibiliSession.headers()), ...(init?.headers as object) } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }

  private async result(url: string, authenticated = false) {
    const envelope = await this.raw<Json>(url, authenticated ? { headers: await bilibiliSession.headers(true) } : undefined);
    if (Number(envelope.code) !== 0) throw new Error(envelope.message ?? 'Bilibili request failed');
    return envelope.data ?? envelope.result;
  }

  async resolveStreamUrl(input: string): Promise<StreamReference> {
    let url = input;
    if (url.includes('b23.tv')) {
      const response = await fetch(url, { redirect: 'manual' });
      url = response.headers.get('location') ?? response.url;
    }
    const parsed = new URL(url);
    const timestamp = Number(parsed.searchParams.get('t') ?? 0);
    const page = Number(parsed.searchParams.get('p') ?? 1);
    const premium = parsed.pathname.match(/\/bangumi\/play\/(ss\d+|ep\d+)/)?.[1];
    if (premium) return { kind: 'premium', id: premium };
    if (parsed.hostname === 'live.bilibili.com') return { kind: 'live', id: parsed.pathname.split('/').filter(Boolean).at(-1)! };
    const rawId = parsed.pathname.match(/\/(BV[\w]+|av\d+)/)?.[1] ?? parsed.searchParams.get('bvid') ?? (parsed.searchParams.get('aid') ? `av${parsed.searchParams.get('aid')}` : undefined);
    if (!rawId) throw new Error('Not a Bilibili stream URL');
    const bvid = rawId.startsWith('av') ? avToBv(Number(rawId.slice(2))) : rawId;
    return { kind: 'video', id: `${bvid}?p=${page}${timestamp ? `#timestamp=${timestamp}` : ''}`, bvid, page, timestamp };
  }

  async getSuggestions(query: string) {
    const response = await this.raw<Json>(`https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(query)}`);
    return (response.result?.tag ?? []).map((item: Json) => String(item.value));
  }

  async search(query: string, options: { type?: SearchType; order?: SearchOrder; duration?: SearchDuration; page?: number } = {}): Promise<PageResult<SearchItem>> {
    const url = new URL(`${API}/x/web-interface/search/type`);
    url.searchParams.set('search_type', options.type ?? 'video');
    url.searchParams.set('keyword', query);
    url.searchParams.set('page', String(options.page ?? 1));
    if (options.order) url.searchParams.set('order', options.order);
    if (options.duration !== undefined) url.searchParams.set('duration', String(options.duration));
    const data = await this.request<Json>(url.toString());
    const type = options.type ?? 'video';
    const items: SearchItem[] = (data.result ?? []).map((item: Json) => {
      if (type === 'live_room') return liveSummary(item);
      if (type === 'bili_user') return { type: 'channel', id: String(item.mid), name: String(item.uname).replace(/<[^>]+>/g, ''), avatar: https(item.upic), description: item.usign, followers: Number(item.fans ?? 0), videos: Number(item.videos ?? 0), verified: false } satisfies ChannelSummary;
      if (type === 'media_bangumi' || type === 'media_ft') return {
        bvid: String(item.url ?? item.share_url), aid: Number(item.season_id ?? item.media_id ?? 0), title: String(item.title ?? '').replace(/<[^>]+>/g, ''), thumbnail: https(item.cover), uploader: String(item.org_title ?? 'BiliBili').replace(/<[^>]+>/g, ''), duration: Number(item.duration ?? 0) / 1000, views: -1, publishedAt: Number(item.pubtime ?? item.pub_time ?? 0), type: 'premium' as const,
      };
      return normalizeSummary(item);
    });
    return { items, next: items.length ? String((options.page ?? 1) + 1) : undefined };
  }

  async getTop100() {
    const data = await this.request<Json>(`${API}/x/web-interface/ranking/v2`);
    return (data.list ?? []).map(normalizeSummary);
  }

  async getRecommendedLives(page = 1) {
    const data = await this.request<Json>(`${LIVE_API}/xlive/web-interface/v1/second/getUserRecommend?page_size=30&platform=web&page=${page}`);
    return (data.list ?? []).map((item: Json) => liveSummary(item));
  }

  async getVideoComplete(bvid: string, page = 1): Promise<VideoDetail> {
    const detail = await this.getVideo(bvid);
    const [tags, related] = await Promise.all([this.getTags(bvid), this.getRelated(bvid)]);
    const part = detail.parts[Math.max(0, page - 1)] ?? detail.parts[0];
    return { ...detail, duration: part?.duration ?? detail.duration, tags, related };
  }

  async getTags(bvid: string) {
    const data = await this.request<Json>(`${API}/x/web-interface/view/detail/tag?bvid=${encodeURIComponent(bvid)}`);
    return (Array.isArray(data) ? data : []).map((item: Json) => String(item.tag_name));
  }

  async getRelated(bvid: string) {
    const data = await this.request<Json>(`${API}/x/web-interface/archive/related?bvid=${encodeURIComponent(bvid)}`);
    return (Array.isArray(data) ? data : []).map(normalizeSummary);
  }

  async getVideoParts(bvid: string): Promise<VideoPart[]> {
    const data = await this.request<Json[]>(`${API}/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`);
    const aid = bvToAv(bvid);
    return data.map((part) => ({
      bvid,
      aid,
      cid: Number(part.cid),
      page: Number(part.page),
      title: String(part.part ?? ''),
      duration: Number(part.duration ?? 0),
    }));
  }

  async getPlayback(part: VideoPart, options: { quality?: number; premium?: boolean; dash?: boolean; authenticated?: boolean } = {}): Promise<PlaybackInfo> {
    const params = {
      avid: part.aid,
      bvid: part.bvid,
      cid: part.cid,
      qn: options.quality ?? 120,
      fnver: 0,
      fnval: options.dash === false ? 1 : 4048,
      fourk: 1,
      try_look: 1,
      web_location: 1315873,
      ...dmImgParams(),
    };
    const url = options.premium
      ? `${API}/pgc/player/web/v2/playurl?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()}`
      : await this.wbi('/x/player/wbi/playurl', params);
    const raw = await this.result(url, options.authenticated ?? false);
    const data = options.premium ? raw.video_info ?? raw : raw;
    const headers = await bilibiliSession.headers(options.authenticated);
    const quality = Number(data.quality ?? options.quality ?? 32);
    const progressive: ProgressiveStream[] = (data.durl ?? []).map((item: Json) => ({ quality, label: QUALITY[quality] ?? String(quality), url: https(item.url), backupUrls: (item.backup_url ?? []).map(https), size: item.size, mimeType: 'video/mp4', headers: { Referer: headers.Referer, 'User-Agent': headers['User-Agent'] } }));
    return {
      quality,
      acceptedQualities: data.accept_quality ?? [],
      duration: data.dash?.duration,
      progressive,
      video: (data.dash?.video ?? []).map(dash),
      audio: (data.dash?.audio ?? []).map(dash),
      dolbyAudio: (data.dash?.dolby?.audio ?? []).map(dash),
      flacAudio: data.dash?.flac?.audio ? dash(data.dash.flac.audio) : undefined,
    };
  }

  async getSubtitles(part: VideoPart, authenticated = false): Promise<Subtitle[]> {
    const url = await this.wbi('/x/player/wbi/v2', { aid: part.aid, cid: part.cid, isGaiaAvoided: 'false', web_location: 1315873, ...dmImgParams() });
    const response = await fetch(url, { headers: await bilibiliSession.headers(authenticated) });
    const envelope = await response.json() as Json;
    if (Number(envelope.code) !== 0) throw new Error(envelope.message ?? 'Subtitle request failed');
    const data = envelope.data;
    return (data.subtitle?.subtitles ?? []).map((item: Json) => ({ id: Number(item.id), language: String(item.lan).replace('ai-', ''), label: item.lan_doc, url: https(item.subtitle_url), automatic: Number(item.ai_status) !== 0 }));
  }

  async getSubtitleSrt(subtitle: Subtitle) {
    const payload = await this.raw<Json>(subtitle.url);
    const timestamp = (seconds: number) => {
      const milliseconds = Math.floor((seconds % 1) * 1000);
      const total = Math.floor(seconds);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const rest = total % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
    };
    return (payload.body ?? []).map((line: Json, index: number) => `${index + 1}\n${timestamp(Number(line.from))} --> ${timestamp(Number(line.to))}\n${line.content}\n`).join('\n');
  }

  async getVideoShot(bvid: string, cid?: number): Promise<VideoShot> {
    const url = new URL(`${API}/x/player/videoshot`);
    url.searchParams.set('index', '1');
    url.searchParams.set('bvid', bvid);
    if (cid !== undefined) url.searchParams.set('cid', String(cid));
    const data = await this.request<Json>(url.toString());
    const points: number[] = data.index ?? [];
    const totalFrames = Math.max(0, points.length - 1);
    const durationPerFrame = totalFrames > 1 ? ((points.at(-1)! - points[0]) * 1000) / totalFrames : 0;
    return { imageUrls: (data.image ?? []).map(https), frameWidth: Number(data.img_x_size ?? 0), frameHeight: Number(data.img_y_size ?? 0), columns: Number(data.img_x_len ?? 10), rows: Number(data.img_y_len ?? 10), totalFrames, durationPerFrame, points };
  }

  async getPremiumSeason(id: string): Promise<PremiumSeason> {
    const key = id.startsWith('ss') ? 'season_id' : 'ep_id';
    const data = await this.result(`${API}/pgc/view/web/season?${key}=${encodeURIComponent(id.slice(2))}`);
    const episodes = (data.episodes ?? []).map(premiumEpisode);
    const selectedEpisode = id.startsWith('ss')
      ? episodes[0]
      : episodes.find((episode: PremiumEpisode) => episode.episodeId === id);
    if (!selectedEpisode) throw new Error(`Premium episode ${id} was not found`);
    return {
      id: String(data.season_id ?? id),
      title: String(data.title ?? selectedEpisode.title),
      description: String(data.evaluate ?? ''),
      thumbnail: https(data.cover),
      uploader: data.up_info ? { id: String(data.up_info.mid), name: String(data.up_info.uname), avatar: https(data.up_info.avatar) } : undefined,
      views: Number(data.stat?.views ?? 0),
      likes: Number(data.stat?.likes ?? 0),
      episodes,
      selectedEpisode,
    };
  }

  async getChannel(mid: string): Promise<Channel> {
    const [profile, live] = await Promise.all([
      this.request<Json>(`${API}/x/web-interface/card?photo=true&mid=${encodeURIComponent(mid)}`),
      this.request<Json>(`${LIVE_API}/room/v1/Room/get_status_info_by_uids?uids[]=${encodeURIComponent(mid)}`),
    ]);
    const card = profile.card ?? {};
    const liveData = live[mid];
    return { id: mid, name: card.name, avatar: https(card.face), banner: https(profile.space?.l_img), description: card.sign ?? '', followers: Number(card.fans ?? 0), live: liveData?.live_status ? liveSummary(liveData, true) : undefined };
  }

  async getChannelVideos(mid: string, options: { page?: number; mode?: 'web' | 'search' | 'client'; lastAid?: number } = {}): Promise<PageResult<VideoSummary>> {
    const page = options.page ?? 1;
    if (options.mode === 'client') {
      const params: Record<string, string | number> = { vmid: mid, order: 'pubdate', mobi_app: 'android', ts: Math.floor(Date.now() / 1000), appkey: APP_KEY };
      if (options.lastAid) params.aid = options.lastAid;
      params.sign = signApp(params, APP_SECRET);
      const data = await this.request<Json>(`https://app.bilibili.com/x/v2/space/archive/cursor?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()}`);
      const items = (data.item ?? []).map((item: Json) => normalizeSummary({ ...item, pic: item.cover }));
      return { items, next: items.length ? String(bvToAv(items.at(-1)!.bvid)) : undefined };
    }
    const path = options.mode === 'search' ? '/x/series/recArchivesByKeywords' : '/x/space/wbi/arc/search';
    const params = options.mode === 'search'
      ? { mid, keywords: '', order: 'pubdate', pn: page, ps: 20, ...dmImgParams() }
      : { mid, order: 'pubdate', ps: 25, pn: page, order_avoided: 'true', platform: 'web', web_location: 333.1387, ...dmImgParams() };
    const data = await this.request<Json>(await this.wbi(path, params));
    const source = options.mode === 'search' ? data.archives : data.list?.vlist;
    const items = (source ?? []).map(normalizeSummary);
    return { items, next: items.length ? String(page + 1) : undefined };
  }

  async getChannelPlaylists(mid: string, page = 1): Promise<PageResult<RemotePlaylist>> {
    const data = await this.request<Json>(`${API}/x/polymer/web-space/seasons_series_list?mid=${encodeURIComponent(mid)}&page_num=${page}&page_size=10`);
    const seasons = (data.items_lists?.seasons_list ?? []).map((item: Json) => ({ id: String(item.meta.season_id), type: 'season' as const, name: item.meta.name, thumbnail: https(item.meta.cover), streamCount: Number(item.meta.total) }));
    const series = (data.items_lists?.series_list ?? []).map((item: Json) => ({ id: String(item.meta.series_id), type: 'series' as const, name: item.meta.name, thumbnail: https(item.meta.cover), streamCount: Number(item.meta.total) }));
    const items = [...seasons, ...series].filter((item) => item.streamCount > 0);
    return { items, next: items.length ? String(page + 1) : undefined };
  }

  async getRemotePlaylist(mid: string, id: string, type: 'season' | 'series', page = 1): Promise<RemotePlaylistPage> {
    const url = type === 'season'
      ? `${API}/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${id}&sort_reverse=false&page_num=${page}&page_size=30`
      : `${API}/x/series/archives?mid=${mid}&series_id=${id}&only_normal=true&sort=desc&pn=${page}&ps=30`;
    const data = await this.request<Json>(url);
    const items = (data.archives ?? []).map(normalizeSummary);
    return {
      items,
      next: items.length ? String(page + 1) : undefined,
      total: Number(data.page?.total ?? items.length),
      playlist: {
        id,
        type,
        name: String(data.meta?.name ?? ''),
        thumbnail: https(data.meta?.cover),
        uploaderId: String(data.meta?.mid ?? mid),
      },
    };
  }

  async getRecordedDanmaku(cid: number): Promise<Danmaku[]> {
    const response = await fetch(`${API}/x/v1/dm/list.so?oid=${cid}`, { headers: await bilibiliSession.headers() });
    const compressed = new Uint8Array(await response.arrayBuffer());
    let xml: string;
    try { xml = new TextDecoder().decode(inflateRaw(compressed)); } catch { xml = new TextDecoder().decode(compressed); }
    if (/<state>1<\/state>/.test(xml)) return [];
    return [...xml.matchAll(/<d p="([^"]+)">([\s\S]*?)<\/d>/g)].flatMap((match) => {
      const attr = match[1].split(',');
      if (attr[5] === '3') return [];
      const mode = attr[1];
      let text = entity(match[2]);
      try {
        const array = JSON.parse(text);
        if (Array.isArray(array) && typeof array[4] === 'string' && array[4]) text = array[4];
      } catch { /* Standard danmaku content is plain text. */ }
      return [{ text, color: 0xff000000 + Number(attr[3]), position: mode === '4' ? 'bottom' as const : mode === '5' ? 'top' as const : 'regular' as const, fontScale: attr[2] === '18' ? 0.5 : attr[2] === '36' ? 0.7 : 0.6, time: Number(attr[0]) + 2.5, live: false }];
    });
  }

  async getLiveRoom(id: string): Promise<LiveRoom> {
    const init = await this.request<Json>(`${LIVE_API}/room/v1/Room/room_init?id=${encodeURIComponent(id)}`);
    const statuses = await this.request<Json>(`${LIVE_API}/room/v1/Room/get_status_info_by_uids?uids[]=${init.uid}`);
    const room = statuses[String(init.uid)] ?? {};
    return {
      roomId: Number(init.room_id),
      uid: Number(init.uid),
      title: room.title,
      uploader: room.uname,
      avatar: https(room.face),
      thumbnail: https(room.cover_from_user),
      online: Number(room.online ?? 0),
      status: Number(init.live_status) as 0 | 1 | 2,
      startedAt: Number(init.live_time ?? 0),
      tags: [room.tag_name, ...(String(room.tags ?? '').split(','))].filter(Boolean),
    };
  }

  async getLiveStream(roomId: number) {
    const data = await this.request<Json>(`${LIVE_API}/room/v1/Room/playUrl?qn=10000&platform=web&cid=${roomId}`);
    return (data.durl ?? []).map((item: Json) => https(item.url));
  }

  async getRoundPlay(roomId: number, timestamp = Date.now()): Promise<RoundPlay> {
    const round = await this.result(`https://api.live.bilibili.com/live/getRoundPlayVideo?room_id=${roomId}&a=${timestamp}&type=flv`);
    if (Number(round.cid) < 0) throw new Error('Round play is unavailable');
    const playback = await this.request<Json>(`${API}/x/player/playurl?cid=${round.cid}&bvid=${round.bvid}&fnval=4048&qn=120&fourk=1&try_look=1`);
    return { bvid: String(round.bvid), cid: Number(round.cid), title: String(round.title), playTime: Number(round.play_time), nextTimestamp: timestamp + Number(playback.dash?.duration ?? 0) * 1000, video: (playback.dash?.video ?? []).map(dash), audio: (playback.dash?.audio ?? []).map(dash) };
  }

  async getChannelVideosWithFallback(mid: string, page = 1) {
    const failures: unknown[] = [];
    for (const mode of ['web', 'search', 'client'] as const) {
      try { return await this.getChannelVideos(mid, { page, mode }); } catch (error) { failures.push(error); }
    }
    throw new AggregateError(failures, 'All Bilibili creator-video APIs failed');
  }

  async getLiveDanmakuCredentials(roomId: number) {
    const data = await this.request<Json>(`${LIVE_API}/xlive/web-room/v1/index/getDanmuInfo?type=0&id=${roomId}`);
    return { roomId, token: String(data.token), hosts: data.host_list ?? [] };
  }
}

export const bilibiliExtractorApi = new BilibiliExtractorApi();
