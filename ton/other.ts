import { bigintRandom } from '../utils/bigint';

export function generateQueryId() {
  return bigintRandom(8);
}
