import dotenv from 'dotenv';

dotenv.config();

export const {
  APP_ENV = 'production',
  TON_API_URL = 'https://toncenter.com/api/v2/jsonRPC',
  INDEXER_API_URL = 'https://toncenter.com/api/v3',
  ELECTIONS_API_URL = 'https://elections.toncenter.com',
  TON_API_V4_URL = 'https://mainnet-v4.tonhubapi.com',
  MAIN_WALLET_VERSION = 'v4R2',
  TON_API_KEY,
  SENTRY_DSN,
} = process.env;

if (!['v4R2', 'W5'].includes(MAIN_WALLET_VERSION)) {
  throw new Error('Unknown MAIN_WALLET_VERSION');
}

export const IS_DEV = APP_ENV === 'development';
export const IS_PROD = APP_ENV === 'production';

export const DEBUG = process.env.DEBUG === '1';
export const DEBUG_MORE = false;

export const DATABASE_URL = process.env.DATABASE_URL!;
export const MAIN_WALLET_MNEMONIC = process.env.MAIN_WALLET_MNEMONIC!;

export const BOT_TOKEN = process.env.BOT_TOKEN!;
export const REDIS_URL = process.env.REDIS_URL!;
export const ALERTS_CHAT_ID = 1220362133;

export const RETRIES = 3;
export const TIMEOUT = 10000; // 10 sec
export const ERROR_PAUSE = 500; // 0.5 sec

export const TON_CONNECT_DOMAINS: string[] = []; // todo
