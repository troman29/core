import { ERROR_PAUSE, RETRIES, TIMEOUT } from '../config';
import { HttpError } from './errors';
import { logDebug } from './logs';
import { pause } from './schedulers';

type QueryParams = Record<string, string | number | boolean | string[]>;

const MAX_TIMEOUT = 30000; // 30 sec

export async function fetchJson(url: string | URL, data?: QueryParams, init?: RequestInit) {
  const urlObject = new URL(url);
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          urlObject.searchParams.append(key, item.toString());
        });
      } else {
        urlObject.searchParams.set(key, value.toString());
      }
    });
  }

  const response = await fetchWithRetry(urlObject, init);

  return response.json();
}

export async function fetchWithRetry(url: string | URL, init?: RequestInit, options?: {
  retries?: number;
  timeouts?: number | number[];
  shouldSkipRetryFn?: (message?: string, statusCode?: number) => boolean;
}) {
  const {
    retries = RETRIES,
    timeouts = TIMEOUT,
    shouldSkipRetryFn = isNotTemporaryError,
  } = options ?? {};

  let message = 'Unknown error.';
  let statusCode: number | undefined;

  for (let i = 1; i <= retries; i++) {
    try {
      if (i > 1) {
        logDebug(`Retry request #${i}:`, url.toString(), statusCode);
      }

      const timeout = Array.isArray(timeouts)
        ? timeouts[i - 1] ?? timeouts[timeouts.length - 1]
        : Math.min(timeouts * i, MAX_TIMEOUT);
      const response = await fetchWithTimeout(url, init, timeout);
      statusCode = response.status;

      if (statusCode >= 400) {
        const { error } = await response.json().catch(() => {});
        throw new Error(error ?? `HTTP Error ${statusCode}`);
      }

      return response;
    } catch (err: any) {
      message = typeof err === 'string' ? err : err.message ?? message;

      const shouldSkipRetry = shouldSkipRetryFn(message, statusCode);

      if (shouldSkipRetry) {
        throw new HttpError(message, statusCode);
      }

      if (i < retries) {
        await pause(ERROR_PAUSE * i);
      }
    }
  }

  throw new HttpError(message);
}

export async function fetchWithTimeout(url: string | URL, init?: RequestInit, timeout = TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

export async function handleFetchErrors(response: Response) {
  if (!response.ok) {
    let jsonBody: object | undefined;
    let text: string | undefined;

    if (response.headers.get('content-type') === 'application/json') {
      jsonBody = (await response.json().catch(() => undefined)) as any | undefined;
    }

    if (!jsonBody) {
      text = (await response.text().catch(() => undefined))?.slice(0, 1000);
    }

    throw new HttpError(response.statusText, response.status, {
      jsonBody,
      url: response.url,
      text,
    });
  }
  return response;
}

function isNotTemporaryError(message?: string, statusCode?: number) {
  return statusCode && [400, 404].includes(statusCode);
}
