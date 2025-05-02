import { buildCacheKey } from './withCache';

const cache = new WeakMap<AnyFunction, Map<string, any>>();

export default function withCacheAsync<T extends AnyAsyncFunction>(
  fn: T,
  canBeCached: (value: ReturnType<T>) => boolean = (value) => !!value,
) {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let fnCache = cache.get(fn);
    const cacheKey = buildCacheKey(args);

    if (fnCache) {
      const cached = fnCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    } else {
      fnCache = new Map();
      cache.set(fn, fnCache);
    }

    const newValue = await fn(...args);

    if (canBeCached(newValue)) {
      fnCache.set(cacheKey, newValue);
    }

    return newValue;
  };
}
