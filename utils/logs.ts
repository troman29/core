import { captureException } from '@sentry/node';

import { DEBUG } from '../../config';

export function logError(scope: string, error: Error | string | any, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.error(`[ERROR] [${scope}]`, error, ...args);

  captureException(error);
}

export function logWarning(message: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.warn(`[WARNING] ${message}`, ...args);
}

export function logInfo(message: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.info(`[INFO] ${message}`, ...args);
}

export function logDebug(message: string, ...args: any[]) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.debug('[DEBUG]', message, ...args);
}
