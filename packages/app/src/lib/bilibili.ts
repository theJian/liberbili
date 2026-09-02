import { bilibiliApi } from '@liberbili/api/bilibili';
import { configureBilibiliStorage } from '@liberbili/api/session';

import { storage } from '@/storage';

configureBilibiliStorage(storage);

export { bilibiliApi };
