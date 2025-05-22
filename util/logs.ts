import { captureException } from '@sentry/node';

import { DEBUG } from '../config';

export function logError(scope: string, error?: Error | string | any, ...args: any[]) {
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] [${scope}]`, error, ...args);
    captureException(error);
  } else if (typeof error === 'string') {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] [${scope}]`, error, ...args);
    captureException(error);
  } else {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] [${scope}]`, ...args);
  }
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isCriticalError(_error: Error) {
  return false; // TODO
}

export function handleErrorAndExit(error: unknown, scope = 'handleErrorAndExit') {
  logError(scope, error);
  process.exit(1);
}

export function logErrorAndExit(message: string) {
  logError(message);
  process.exit(1);
}

process.on('uncaughtException', (error) => {
  logError('uncaughtException', error);

  if (isCriticalError(error)) {
    process.exit(1);
  }
});
