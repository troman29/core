import { bigintRandom } from '../bigint';

export function generateQueryId() {
  return bigintRandom(8);
}
