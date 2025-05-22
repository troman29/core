import { INDEXER_API_URL, TON_API_KEY } from '../../config';
import { fetchJson } from '../../util/fetch';

export function callToncenterV3<T = any>(path: string, data?: AnyLiteral) {
  const url = `${INDEXER_API_URL}${path}`;

  return fetchJson(url, data, {
    headers: {
      ...(TON_API_KEY && { 'X-Api-Key': TON_API_KEY }),
    },
  }) as Promise<T>;
}
