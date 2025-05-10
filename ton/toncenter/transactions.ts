import type { AddressBook, Transaction, TransactionMessage } from './types';

import { toSeconds } from '../../util/datetime';
import { omitUndefined } from '../../util/iteratees';
import { toBase64Address } from '../address';
import { callToncenterV3 } from './other';

export async function fetchTransactions(options: {
  address: string | string[];
  limit: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  shouldIncludeFrom?: boolean;
  shouldIncludeTo?: boolean;
}): Promise<TonTransaction[]> {
  const {
    address,
    limit,
    toTimestamp,
    fromTimestamp,
    shouldIncludeFrom,
    shouldIncludeTo,
  } = options;

  const data: {
    transactions: Transaction[];
    address_book: AddressBook;
  } = await callToncenterV3('/transactions', {
    account: address,
    limit,
    start_utime: fromTimestamp && toSeconds(fromTimestamp) + (!shouldIncludeFrom ? 1 : 0),
    end_utime: toTimestamp && toSeconds(toTimestamp) - (!shouldIncludeTo ? 1 : 0),
    sort: 'desc',
  });

  const {
    transactions: rawTransactions,
    address_book: addressBook,
  } = data;

  if (!rawTransactions.length) {
    return [];
  }

  return rawTransactions
    .map((rawTx) => parseRawTransaction(rawTx, addressBook))
    .flat();
}

export function parseRawTransaction(
  rawTx: Transaction,
  addressBook: AddressBook,
): TonTransaction[] {
  const {
    now,
    hash,
    total_fees: totalFees,
    description: {
      compute_ph: {
        exit_code: exitCode,
      },
    },
  } = rawTx;

  const timestamp = now as number * 1000;
  const inMsgHash = rawTx.in_msg.hash;
  const outMsgFee = rawTx.out_msgs.length ? BigInt(totalFees) / BigInt(rawTx.out_msgs.length) : 0n;
  const transactions: TonTransaction[] = [];

  function parseMessage(msg: TransactionMessage, type: 'in' | 'out', index: number = 0) {
    const {
      source,
      destination,
      value,
      fwd_fee: fwdFee,
      opcode,
      hash: msgHash,
    } = msg;

    if (!destination) {
      // This is log
      return;
    }

    const isIncoming = type === 'in';
    const fromAddress = addressBook[source!].user_friendly;
    const toAddress = addressBook[destination!].user_friendly;
    const normalizedAddress = toBase64Address(isIncoming ? source! : destination!, true);
    const fee = isIncoming ? 0n : outMsgFee + BigInt(fwdFee ?? 0);

    const tx: TonTransaction = omitUndefined({
      index,
      hash,
      timestamp,
      isIncoming,
      fromAddress,
      toAddress,
      amount: isIncoming ? BigInt(value!) : -BigInt(value!),
      fee,
      externalMsgHash: isIncoming ? undefined : inMsgHash,
      normalizedAddress,
      opCode: Number(opcode) || undefined,
      msgHash,
      exitCode,
    });

    transactions.push(tx);
  }

  if (rawTx.in_msg.source) {
    parseMessage(rawTx.in_msg, 'in');
  }

  for (const [i, outMsg] of rawTx.out_msgs.entries()) {
    parseMessage(outMsg, 'out', i);
  }

  return transactions;
}
