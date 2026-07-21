import AsyncStorage from '@react-native-async-storage/async-storage';

import { mixinKey, randomHex, ticketSignature } from './crypto';

const STORAGE_KEY = '@liberbili/session/v1';
const ACCOUNT_KEY = '@liberbili/account-cookie/v1';
const REFERER = 'https://www.bilibili.com/';
const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type BilibiliSession = {
  userAgent: string;
  cookie: string;
  expiresAt: number;
  mixinKey?: string;
  mixinDate?: string;
};

type SpiResponse = { data: { b_3: string; b_4: string } };
type TicketResponse = {
  data: { ticket: string; created_at: number; ttl: number };
};
type NavResponse = { data: { wbi_img: { img_url: string; sub_url: string } } };

const chromium = () => 130 + Math.floor(Math.random() * 8);
const userAgent = () =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromium()}.0.0.0 Safari/537.36`;

const headerCookie = (cookies: Record<string, string | number>) =>
  Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

function fpUuid() {
  const raw = randomHex(16).toUpperCase();
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}${String(Date.now() % 100000).padStart(5, '0')}infoc`;
}

function fileKey(url: string) {
  return url.split('/').at(-1)?.split('.')[0] ?? '';
}

function asciiBase64(value: string) {
  let result = '';
  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index);
    const second = value.charCodeAt(index + 1);
    const third = value.charCodeAt(index + 2);
    const chunk =
      (first << 16) |
      ((Number.isNaN(second) ? 0 : second) << 8) |
      (Number.isNaN(third) ? 0 : third);
    result += BASE64[(chunk >> 18) & 63] + BASE64[(chunk >> 12) & 63];
    result += Number.isNaN(second) ? '=' : BASE64[(chunk >> 6) & 63];
    result += Number.isNaN(third) ? '=' : BASE64[chunk & 63];
  }
  return result;
}

export function dmImgParams() {
  const random = Math.floor(Math.random() * 114);
  return {
    dm_img_list: '[]',
    dm_img_str: asciiBase64('WebGL 1.0 (OpenGL ES 2.0 Chromium)').slice(0, -2),
    dm_cover_img_str: asciiBase64(
      'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)Google Inc. (Intel)',
    ).slice(0, -2),
    dm_img_inter: JSON.stringify({
      ds: [],
      wh: [5940 + random * 3, 6750 + random, random],
      of: [random, random * 2, random],
    }),
  };
}

export class SessionManager {
  private session?: BilibiliSession;
  private accountCookie?: string;

  async get(force = false) {
    if (
      !force &&
      this.session &&
      this.session.expiresAt > Date.now() / 1000 + 60
    )
      return this.session;
    if (!force) {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as BilibiliSession;
        if (parsed.expiresAt > Date.now() / 1000 + 60)
          return (this.session = parsed);
      }
    }
    return this.bootstrap();
  }

  async clear() {
    this.session = undefined;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  private async bootstrap() {
    const ua = userAgent();
    const headers = {
      'User-Agent': ua,
      Referer: REFERER,
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };
    const spiResponse = await fetch(
      'https://api.bilibili.com/x/frontend/finger/spi',
      { headers },
    );
    if (!spiResponse.ok)
      throw new Error(
        `Bilibili session bootstrap failed (${spiResponse.status})`,
      );
    const spi = (await spiResponse.json()) as SpiResponse;
    const now = Math.floor(Date.now() / 1000);
    const cookies: Record<string, string | number> = {
      buvid3: spi.data.b_3,
      buvid4: spi.data.b_4,
      b_nut: now,
      b_lsid: `${randomHex(16).toUpperCase()}_${Date.now().toString(16).toUpperCase()}`,
      _uuid: fpUuid(),
      buvid_fp: randomHex(16),
    };
    const ticketUrl = new URL(
      'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket',
    );
    ticketUrl.searchParams.set('key_id', 'ec02');
    ticketUrl.searchParams.set('hexsign', ticketSignature(now));
    ticketUrl.searchParams.set('context[ts]', String(now));
    ticketUrl.searchParams.set('csrf', '');
    const ticketResponse = await fetch(ticketUrl, {
      method: 'POST',
      headers: { ...headers, Cookie: headerCookie(cookies) },
    });
    let expiresAt = now + 3600;
    if (ticketResponse.ok) {
      const ticket = (await ticketResponse.json()) as TicketResponse;
      cookies.bili_ticket = ticket.data.ticket;
      expiresAt = ticket.data.created_at + ticket.data.ttl;
      cookies.bili_ticket_expires = expiresAt;
    }
    this.session = { userAgent: ua, cookie: headerCookie(cookies), expiresAt };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    return this.session;
  }

  async setAccountCookies(cookie?: string) {
    this.accountCookie = cookie?.trim() || undefined;
    if (this.accountCookie)
      await AsyncStorage.setItem(ACCOUNT_KEY, this.accountCookie);
    else await AsyncStorage.removeItem(ACCOUNT_KEY);
  }

  async hasAccountCookies() {
    if (this.accountCookie) return true;
    this.accountCookie = (await AsyncStorage.getItem(ACCOUNT_KEY)) ?? undefined;
    return Boolean(this.accountCookie);
  }

  async headers(authenticated = false) {
    const session = await this.get();
    if (authenticated && !this.accountCookie)
      this.accountCookie =
        (await AsyncStorage.getItem(ACCOUNT_KEY)) ?? undefined;
    return {
      'User-Agent': session.userAgent,
      Referer: REFERER,
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Cookie:
        authenticated && this.accountCookie
          ? this.accountCookie
          : session.cookie,
    };
  }

  async getMixinKey() {
    const session = await this.get();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
    }).format(new Date());
    if (session.mixinKey && session.mixinDate === date) return session.mixinKey;
    const response = await fetch(
      'https://api.bilibili.com/x/web-interface/nav',
      {
        headers: await this.headers(),
      },
    );
    if (!response.ok)
      throw new Error(`Unable to load WBI key (${response.status})`);
    const nav = (await response.json()) as NavResponse;
    session.mixinKey = mixinKey(
      fileKey(nav.data.wbi_img.img_url),
      fileKey(nav.data.wbi_img.sub_url),
    );
    session.mixinDate = date;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session.mixinKey;
  }
}

export const bilibiliSession = new SessionManager();
