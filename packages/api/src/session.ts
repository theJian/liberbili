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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const headerValue = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !/[\r\n\0]/.test(value);
const cookieValue = (value: unknown): value is string =>
  headerValue(value) && !/[;\s]/.test(value);
const positiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function savedSession(raw: string): BilibiliSession | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      !headerValue(value.userAgent) ||
      !headerValue(value.cookie) ||
      !positiveNumber(value.expiresAt)
    )
      return undefined;
    const session: BilibiliSession = {
      userAgent: value.userAgent,
      cookie: value.cookie,
      expiresAt: value.expiresAt,
    };
    if (
      typeof value.mixinKey === 'string' &&
      /^[a-f0-9]{32}$/i.test(value.mixinKey) &&
      typeof value.mixinDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.mixinDate)
    ) {
      session.mixinKey = value.mixinKey;
      session.mixinDate = value.mixinDate;
    }
    return session;
  } catch {
    return undefined;
  }
}

function spiCookies(value: unknown): { buvid3: string; buvid4: string } {
  if (
    !isRecord(value) ||
    (value.code !== undefined && value.code !== 0) ||
    !isRecord(value.data) ||
    !cookieValue(value.data.b_3) ||
    !cookieValue(value.data.b_4)
  )
    throw new Error(
      'Bilibili session bootstrap returned invalid fingerprint data',
    );
  return { buvid3: value.data.b_3, buvid4: value.data.b_4 };
}

function navKeys(value: unknown): [string, string] {
  // Anonymous nav responses may report -101 while still providing valid WBI keys.
  if (
    !isRecord(value) ||
    (value.code !== undefined && value.code !== 0 && value.code !== -101) ||
    !isRecord(value.data) ||
    !isRecord(value.data.wbi_img)
  )
    throw new Error('Bilibili returned invalid WBI key data');
  const { img_url: image, sub_url: sub } = value.data.wbi_img;
  const parse = (url: unknown): string => {
    if (typeof url !== 'string')
      throw new Error('Bilibili returned invalid WBI key data');
    try {
      const parsed = new URL(url);
      const key = fileKey(parsed.pathname);
      if (parsed.protocol !== 'https:' || !/^[a-f0-9]{32}$/i.test(key))
        throw new Error();
      return key;
    } catch {
      throw new Error('Bilibili returned invalid WBI key data');
    }
  };
  return [parse(image), parse(sub)];
}

export type BilibiliStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
};

const values = new Map<string, string>();
const memoryStorage: BilibiliStorage = {
  getString: (key) => values.get(key),
  set: (key, value) => {
    values.set(key, value);
  },
  remove: (key) => {
    values.delete(key);
  },
};

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
  private generation = 0;
  private pendingSession?: Promise<BilibiliSession>;
  private pendingMixin?: Promise<string>;

  private invalidate(): void {
    this.generation += 1;
    this.session = undefined;
    this.pendingSession = undefined;
    this.pendingMixin = undefined;
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation)
      throw new Error('Bilibili session changed; retry the request');
  }

  constructor(private storage: BilibiliStorage = memoryStorage) {}

  configureStorage(storage: BilibiliStorage): void {
    this.invalidate();
    this.storage = storage;
    this.accountCookie = undefined;
  }

  get(force = false): Promise<BilibiliSession> {
    if (this.pendingSession) return this.pendingSession;
    if (
      !force &&
      this.session &&
      this.session.expiresAt > Date.now() / 1000 + 60
    )
      return Promise.resolve(this.session);
    if (!force) {
      const saved = this.storage.getString(STORAGE_KEY);
      if (saved) {
        const parsed = savedSession(saved);
        if (parsed && parsed.expiresAt > Date.now() / 1000 + 60) {
          this.session = parsed;
          return Promise.resolve(parsed);
        }
        this.storage.remove(STORAGE_KEY);
      }
    }
    if (force) this.invalidate();
    const pending = this.bootstrap(this.generation, this.storage).finally(
      () => {
        if (this.pendingSession === pending) this.pendingSession = undefined;
      },
    );
    this.pendingSession = pending;
    return pending;
  }

  clear(): void {
    this.invalidate();
    this.storage.remove(STORAGE_KEY);
  }

  private async bootstrap(
    generation: number,
    storage: BilibiliStorage,
  ): Promise<BilibiliSession> {
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
    const fingerprints = spiCookies(await spiResponse.json());
    this.assertCurrent(generation);
    const now = Math.floor(Date.now() / 1000);
    const cookies: Record<string, string | number> = {
      ...fingerprints,
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
    let ticketResponse: Response | undefined;
    try {
      ticketResponse = await fetch(ticketUrl, {
        method: 'POST',
        headers: { ...headers, Cookie: headerCookie(cookies) },
      });
    } catch {
      // Anonymous fingerprints are usable even when the optional ticket service is offline.
    }
    let expiresAt = now + 3600;
    if (ticketResponse?.ok) {
      let ticket: unknown;
      try {
        ticket = await ticketResponse.json();
      } catch {
        /* Fingerprint-only sessions remain usable without an optional ticket. */
      }
      if (
        isRecord(ticket) &&
        (ticket.code === undefined || ticket.code === 0) &&
        isRecord(ticket.data) &&
        cookieValue(ticket.data.ticket) &&
        positiveNumber(ticket.data.created_at) &&
        positiveNumber(ticket.data.ttl) &&
        Number.isFinite(ticket.data.created_at + ticket.data.ttl)
      ) {
        cookies.bili_ticket = ticket.data.ticket;
        expiresAt = ticket.data.created_at + ticket.data.ttl;
        cookies.bili_ticket_expires = expiresAt;
      }
    }
    this.assertCurrent(generation);
    const session = { userAgent: ua, cookie: headerCookie(cookies), expiresAt };
    storage.set(STORAGE_KEY, JSON.stringify(session));
    this.session = session;
    return session;
  }

  setAccountCookies(cookie?: string): void {
    this.accountCookie = cookie?.trim() || undefined;
    if (this.accountCookie) this.storage.set(ACCOUNT_KEY, this.accountCookie);
    else this.storage.remove(ACCOUNT_KEY);
  }

  hasAccountCookies(): boolean {
    if (this.accountCookie) return true;
    this.accountCookie = this.storage.getString(ACCOUNT_KEY);
    return Boolean(this.accountCookie);
  }

  async headers(authenticated = false): Promise<Record<string, string>> {
    const generation = this.generation;
    const session = await this.get();
    this.assertCurrent(generation);
    if (authenticated && !this.accountCookie)
      this.accountCookie = this.storage.getString(ACCOUNT_KEY);
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

  getMixinKey(): Promise<string> {
    if (this.pendingMixin) return this.pendingMixin;
    const pending = this.loadMixinKey(this.generation).finally(() => {
      if (this.pendingMixin === pending) this.pendingMixin = undefined;
    });
    this.pendingMixin = pending;
    return pending;
  }

  private async loadMixinKey(generation: number): Promise<string> {
    const session = await this.get();
    this.assertCurrent(generation);
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
    }).format(new Date());
    if (session.mixinKey && session.mixinDate === date) return session.mixinKey;
    const response = await fetch(
      'https://api.bilibili.com/x/web-interface/nav',
      {
        headers: {
          'User-Agent': session.userAgent,
          Referer: REFERER,
          'Accept-Language': 'zh-CN,zh;q=0.9',
          Cookie: session.cookie,
        },
      },
    );
    if (!response.ok)
      throw new Error(`Unable to load WBI key (${response.status})`);
    const [image, sub] = navKeys(await response.json());
    this.assertCurrent(generation);
    if (this.session !== session)
      throw new Error('Bilibili session changed; retry the request');
    const key = mixinKey(image, sub);
    const updated = { ...session, mixinKey: key, mixinDate: date };
    this.storage.set(STORAGE_KEY, JSON.stringify(updated));
    this.session = updated;
    return key;
  }
}

export const bilibiliSession = new SessionManager();

export function configureBilibiliStorage(storage: BilibiliStorage): void {
  bilibiliSession.configureStorage(storage);
}
