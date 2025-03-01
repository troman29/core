import { Address, Cell } from '@ton/core';
import { Builder } from '@ton/ton';

import { TON_GAS } from './constants';
import { generateQueryId } from './other';

enum OpCode {
  Comment = 0,
  Encrypted = 0x2167da4b,
}

enum JettonOpCode {
  Transfer = 0xf8a7ea5,
  TransferNotification = 0x7362d09c,
  InternalTransfer = 0x178d4519,
  Excesses = 0xd53276db,
  Burn = 0x595f07bc,
  BurnNotification = 0x7bdd97de,
}

enum NftOpCode {
  TransferOwnership = 0x5fcc3d14,
  OwnershipAssigned = 0x05138d91,
}

const TON_MAX_COMMENT_BYTES = 127;
const NFT_PAYLOAD_SAFE_MARGIN = 14 * 8;

export function packBytesAsSnake(bytes: Uint8Array, maxBytes = TON_MAX_COMMENT_BYTES): Uint8Array | Cell {
  const buffer = Buffer.from(bytes);
  if (buffer.length <= maxBytes) {
    return bytes;
  }

  return packBytesAsSnakeCell(bytes);
}

export function packBytesAsSnakeCell(bytes: Uint8Array): Cell {
  const bytesPerCell = TON_MAX_COMMENT_BYTES;
  const cellCount = Math.ceil(bytes.length / bytesPerCell);
  let headCell: Cell | undefined;

  for (let i = cellCount - 1; i >= 0; i--) {
    const cellOffset = i * bytesPerCell;
    const cellLength = Math.min(bytesPerCell, bytes.length - cellOffset);
    // This creates a buffer that references the input bytes instead of copying them
    const cellBuffer = Buffer.from(bytes.buffer, bytes.byteOffset + cellOffset, cellLength);

    const nextHeadCell = new Builder().storeBuffer(cellBuffer);
    if (headCell) {
      nextHeadCell.storeRef(headCell);
    }
    headCell = nextHeadCell.endCell();
  }

  return headCell ?? Cell.EMPTY;
}

export function buildTokenTransferBody(params: {
  queryId?: bigint;
  tokenAmount: bigint;
  toAddress: string;
  responseAddress: string;
  forwardAmount?: bigint;
  forwardPayload?: Cell | Uint8Array | string;
  customPayload?: Cell;
}) {
  const {
    queryId,
    tokenAmount,
    toAddress,
    responseAddress,
    forwardAmount = TON_GAS.TokenTransferForward,
    customPayload,
  } = params;
  let forwardPayload = params.forwardPayload;

  let builder = new Builder()
    .storeUint(JettonOpCode.Transfer, 32)
    .storeUint(queryId || generateQueryId(), 64)
    .storeCoins(tokenAmount)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(responseAddress))
    .storeMaybeRef(customPayload)
    .storeCoins(forwardAmount ?? 0n);

  if (forwardPayload instanceof Uint8Array) {
    const freeBytes = Math.round(builder.availableBits / 8);
    forwardPayload = packBytesAsSnake(forwardPayload, freeBytes);
  }

  if (!forwardPayload) {
    builder.storeBit(false);
  } else if (typeof forwardPayload === 'string') {
    builder = builder.storeBit(false)
      .storeUint(0, 32)
      .storeBuffer(Buffer.from(forwardPayload));
  } else if (forwardPayload instanceof Uint8Array) {
    builder = builder.storeBit(false)
      .storeBuffer(Buffer.from(forwardPayload));
  } else {
    builder = builder.storeBit(true)
      .storeRef(forwardPayload);
  }

  return builder.endCell();
}

export function buildNftTransferPayload({
  fromAddress,
  toAddress,
  payload,
  forwardAmount = TON_GAS.NftTransferForward,
}: {
  fromAddress: string;
  toAddress: string;
  payload?: string | Cell;
  forwardAmount?: bigint;
}) {
  let builder = new Builder()
    .storeUint(NftOpCode.TransferOwnership, 32)
    .storeUint(generateQueryId(), 64)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(fromAddress))
    .storeBit(false) // null custom_payload
    .storeCoins(forwardAmount);

  let forwardPayload: Cell | Uint8Array | undefined;

  if (payload) {
    if (typeof payload === 'string') {
      const bytes = commentToBytes(payload);
      const freeBytes = Math.floor((builder.availableBits - NFT_PAYLOAD_SAFE_MARGIN) / 8);
      forwardPayload = packBytesAsSnake(bytes, freeBytes);
    } else {
      forwardPayload = payload;
    }
  }

  if (forwardPayload instanceof Uint8Array) {
    builder.storeBit(0);
    builder = builder.storeBuffer(Buffer.from(forwardPayload));
  } else {
    builder = builder.storeMaybeRef(forwardPayload);
  }

  return builder.endCell();
}

export function commentToBytes(comment: string): Uint8Array {
  const buffer = Buffer.from(comment);
  const bytes = new Uint8Array(buffer.length + 4);

  const startBuffer = Buffer.alloc(4);
  startBuffer.writeUInt32BE(OpCode.Comment);
  bytes.set(startBuffer, 0);
  bytes.set(buffer, 4);

  return bytes;
}
