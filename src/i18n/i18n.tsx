import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@liberbili/locale/v1';

const en = {
  home: 'Home', search: 'Search', playlists: 'Playlists', downloads: 'Downloads', recommended: 'Recommended',
  retry: 'Try again', loading: 'Loading…', noResults: 'Nothing here yet', searchPlaceholder: 'Search Bilibili videos',
  views: 'views', comments: 'Comments', likes: 'likes', parts: 'Parts', description: 'Description', addPlaylist: 'Add to playlist',
  download: 'Download', createPlaylist: 'New playlist', playlistName: 'Playlist name', create: 'Create', cancel: 'Cancel',
  delete: 'Delete', remove: 'Remove', emptyPlaylist: 'Add videos from Home or Search.', emptyDownloads: 'Downloaded videos appear here.',
  play: 'Play', pause: 'Pause', previous: 'Previous', next: 'Next', language: 'Language', english: 'English', chinese: '简体中文',
  network: 'Unable to reach Bilibili.', antiBot: 'Bilibili blocked this request. Please retry.', unavailable: 'This video is unavailable.',
  restricted: 'This video is not available in your region.', loginRequired: 'This content requires a Bilibili account.',
  invalidResponse: 'Bilibili returned an unexpected response.', downloadQueued: 'Download started', downloaded: 'Downloaded',
  downloading: 'Downloading', paused: 'Paused', failed: 'Failed', interrupted: 'Interrupted', resume: 'Resume',
  allComments: 'All comments', replies: 'replies', choosePlaylist: 'Choose a playlist', noPlaylist: 'Create a playlist first.',
  queue: 'Queue', qualityNote: 'Highest anonymous MP4 quality', settings: 'Settings', refresh: 'Refresh',
} as const;

const zh: Record<keyof typeof en, string> = {
  home: '首页', search: '搜索', playlists: '播放列表', downloads: '下载', recommended: '推荐视频', retry: '重试', loading: '加载中…',
  noResults: '这里还没有内容', searchPlaceholder: '搜索哔哩哔哩视频', views: '播放', comments: '评论', likes: '点赞', parts: '分P',
  description: '简介', addPlaylist: '添加到播放列表', download: '下载', createPlaylist: '新建播放列表', playlistName: '播放列表名称',
  create: '创建', cancel: '取消', delete: '删除', remove: '移除', emptyPlaylist: '从首页或搜索结果添加视频。',
  emptyDownloads: '下载的视频会显示在这里。', play: '播放', pause: '暂停', previous: '上一个', next: '下一个', language: '语言',
  english: 'English', chinese: '简体中文', network: '无法连接哔哩哔哩。', antiBot: '请求被哔哩哔哩拦截，请重试。',
  unavailable: '该视频不可用。', restricted: '该视频在当前地区不可用。', loginRequired: '该内容需要登录哔哩哔哩账号。',
  invalidResponse: '哔哩哔哩返回了异常数据。', downloadQueued: '已开始下载', downloaded: '已下载', downloading: '下载中',
  paused: '已暂停', failed: '失败', interrupted: '已中断', resume: '继续', allComments: '全部评论', replies: '条回复',
  choosePlaylist: '选择播放列表', noPlaylist: '请先创建播放列表。', queue: '播放队列', qualityNote: '匿名可用的最高 MP4 清晰度',
  settings: '设置', refresh: '刷新',
};

export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'zh-Hans';
type I18nValue = { locale: Locale; setLocale(locale: Locale): void; t(key: TranslationKey): string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const deviceLocale: Locale = locales[0]?.languageCode === 'zh' ? 'zh-Hans' : 'en';
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then((saved) => saved && setLocaleState(saved as Locale)); }, []);
  const setLocale = useCallback((next: Locale) => { setLocaleState(next); void AsyncStorage.setItem(STORAGE_KEY, next); }, []);
  const t = useCallback((key: TranslationKey) => (locale === 'zh-Hans' ? zh : en)[key], [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function formatCount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
}

