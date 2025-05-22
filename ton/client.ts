import { TonClient4 } from '@ton/ton';

import {
  TIMEOUT,
  TON_API_KEY,
  TON_API_URL,
  TON_API_V4_URL,
} from '../config';

import { TonClient } from './TonClient';

export const tonClient = new TonClient({
  endpoint: TON_API_URL,
  apiKey: TON_API_KEY,
  timeout: TIMEOUT,
});

export const tonClient4 = new TonClient4({
  endpoint: TON_API_V4_URL,
  timeout: TIMEOUT,
});
