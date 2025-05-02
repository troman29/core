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
  const isIncoming = !!rawTx.in_msg.source && !rawTx.out_msgs.length;
  const inMsgHash = rawTx.in_msg.hash;
  const msgs: TransactionMessage[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  const oneMsgFee = BigInt(totalFees) / BigInt(msgs.length);

  const transactions: TonTransaction[] = [];

  msgs.forEach((msg, i) => {
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

    const fromAddress = addressBook[source!].user_friendly;
    const toAddress = addressBook[destination!].user_friendly;
    const normalizedAddress = toBase64Address(isIncoming ? source! : destination!, true);
    const fee = oneMsgFee + BigInt(fwdFee ?? 0);

    const tx: TonTransaction = omitUndefined({
      txId: msgs.length > 1 ? `${hash}:${i}` : hash,
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
  });

  return transactions;
}
