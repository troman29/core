import type { TupleReader } from '@ton/core';
import type { Cell } from '@ton/ton';

import { bigintRandom } from '../util/bigint';
import safeExec from '../util/safeExec';

export function generateQueryId() {
  return bigintRandom(8);
}

export function readCellOpt(stack: TupleReader): Cell | undefined {
  return safeExec(() => stack.readCellOpt(), {
    shouldIgnoreError: true,
  }) ?? undefined;
}
