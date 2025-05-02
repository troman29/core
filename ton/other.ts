import { bigintRandom } from '../util/bigint';

export function generateQueryId() {
  return bigintRandom(8);
}
