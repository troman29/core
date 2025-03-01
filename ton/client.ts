import { TIMEOUT, TON_API_KEY, TON_API_URL } from '../../config';

import { TonClient } from './TonClient';

export const tonClient = new TonClient({
  endpoint: TON_API_URL,
  apiKey: TON_API_KEY,
  timeout: TIMEOUT,
});
