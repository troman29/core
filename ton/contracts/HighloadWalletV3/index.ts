import type {
  Address,
  Contract,
  ContractProvider,
  MessageRelaxed,
  OutAction,
  OutActionSendMsg,
  Sender,
} from '@ton/core';
import {
  beginCell,
  Cell,
  contractAddress,
  internal as internal_relaxed,
  SendMode,
  storeMessageRelaxed,
  storeOutList,
  toNano,
} from '@ton/core';
import { sign } from '@ton/crypto';

import { HighloadQueryId } from './HighloadQueryId';

export enum HighloadWalletError {
  invalid_signature = 33,
  invalid_subwallet_id = 34,
  invalid_created_at = 35,
  already_executed = 36,
  invalid_message_to_send = 37,
  invalid_timeout = 38,
}

export type HighloadWalletV3Config = {
  publicKey: Buffer;
  subwalletId?: number;
  timeout?: number;
};

export type HighloadSendBatchOptions = {
  secretKey: Buffer;
  messages: OutActionSendMsg[];
  queryId: HighloadQueryId;
  value: bigint;
  createdAt?: number;
  timeout?: number;
  subwalletId?: number;
};

export enum OP {
  InternalTransfer = 0xae42e5a4,
}

const TIMESTAMP_SIZE = 64;
const TIMEOUT_SIZE = 22;
export const DEFAULT_SUBWALLET_ID = 0x10ad;
const DEFAULT_TIMEOUT = 60 * 60 * 2; // 2 hours
export const MAX_HIGHLOAD_MSGS = 254;

export function highloadWalletV3ConfigToCell(config: HighloadWalletV3Config): Cell {
  return beginCell()
    .storeBuffer(config.publicKey)
    .storeUint(config.subwalletId ?? DEFAULT_SUBWALLET_ID, 32)
    .storeUint(0, 1 + 1 + TIMESTAMP_SIZE)
    .storeUint(config.timeout ?? DEFAULT_TIMEOUT, TIMEOUT_SIZE)
    .endCell();
}

export class HighloadWalletV3 implements Contract {
  static readonly code = 'b5ee9c7241021001000228000114ff00f4a413f4bcf2c80b01020120020d'
    + '02014803040078d020d74bc00101c060b0915be101d0d3030171b0915be0fa4030f828c705b39130e0d31f018210ae42e5a4ba9d8040d7'
    + '21d74cf82a01ed55fb04e030020120050a02027306070011adce76a2686b85ffc00201200809001aabb6ed44d0810122d721d70b3f0018'
    + 'aa3bed44d08307d721d70b1f0201200b0c001bb9a6eed44d0810162d721d70b15800e5b8bf2eda2edfb21ab09028409b0ed44d0810120d'
    + '721f404f404d33fd315d1058e1bf82325a15210b99f326df82305aa0015a112b992306dde923033e2923033e25230800df40f6fa19ed02'
    + '1d721d70a00955f037fdb31e09130e259800df40f6fa19cd001d721d70a00937fdb31e0915be270801f6f2d48308d718d121f900ed44d0'
    + 'd3ffd31ff404f404d33fd315d1f82321a15220b98e12336df82324aa00a112b9926d32de58f82301de541675f910f2a106d0d31fd4d307'
    + 'd30cd309d33fd315d15168baf2a2515abaf2a6f8232aa15250bcf2a304f823bbf2a35304800df40f6fa199d024d721d70a00f2649130e2'
    + '0e01fe5309800df40f6fa18e13d05004d718d20001f264c858cf16cf8301cf168e1030c824cf40cf8384095005a1a514cf40e2f800c940'
    + '39800df41704c8cbff13cb1ff40012f40012cb3f12cb15c9ed54f80f21d0d30001f265d3020171b0925f03e0fa4001d70b01c000f2a5fa'
    + '4031fa0031f401fa0031fa00318060d721d300010f0020f265d2000193d431d19130e272b1fb00b585bf03';

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new HighloadWalletV3(address);
  }

  static createFromConfig(config: HighloadWalletV3Config, workchain = 0) {
    const data = highloadWalletV3ConfigToCell(config);
    const code = Cell.fromBoc(Buffer.from(HighloadWalletV3.code, 'hex'))[0];

    const init = { code, data };
    return new HighloadWalletV3(contractAddress(workchain, init), init);
  }

  // eslint-disable-next-line class-methods-use-this
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      bounce: false,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendExternalMessage(
    provider: ContractProvider,
    secretKey: Buffer,
    opts: {
      message: MessageRelaxed | Cell;
      mode: number;
      query_id: bigint | HighloadQueryId;
      createdAt: number;
      subwalletId: number;
      timeout: number;
    },
  ) {
    let messageCell: Cell;

    if (opts.message instanceof Cell) {
      messageCell = opts.message;
    } else {
      const messageBuilder = beginCell();
      messageBuilder.store(storeMessageRelaxed(opts.message));
      messageCell = messageBuilder.endCell();
    }

    const queryId = (opts.query_id instanceof HighloadQueryId) ? opts.query_id.getQueryId() : opts.query_id;

    const messageInner = beginCell()
      .storeUint(opts.subwalletId, 32)
      .storeRef(messageCell)
      .storeUint(opts.mode, 8)
      .storeUint(queryId, 23)
      .storeUint(opts.createdAt, TIMESTAMP_SIZE)
      .storeUint(opts.timeout, TIMEOUT_SIZE)
      .endCell();

    await provider.external(
      beginCell()
        .storeBuffer(sign(messageInner.hash(), secretKey))
        .storeRef(messageInner)
        .endCell(),
    );
  }

  // eslint-disable-next-line class-methods-use-this
  sendBatch(provider: ContractProvider, options: HighloadSendBatchOptions) {
    const {
      secretKey,
      messages,
      queryId,
      value,
      createdAt = Math.floor(Date.now() / 1000),
      timeout = DEFAULT_TIMEOUT,
      subwalletId = DEFAULT_SUBWALLET_ID,
    } = options;

    return this.sendExternalMessage(provider, secretKey, {
      message: this.packActions(messages, value, queryId),
      mode: value > 0n ? SendMode.PAY_GAS_SEPARATELY : SendMode.CARRY_ALL_REMAINING_BALANCE,
      query_id: queryId,
      createdAt,
      subwalletId,
      timeout,
    });
  }

  static createInternalTransferBody(opts: {
    actions: OutAction[] | Cell;
    queryId: HighloadQueryId;
  }) {
    let actionsCell: Cell;
    if (opts.actions instanceof Cell) {
      actionsCell = opts.actions;
    } else {
      if (opts.actions.length > 254) {
        throw TypeError('Max allowed action count is 254. Use packActions instead.');
      }
      const actionsBuilder = beginCell();
      storeOutList(opts.actions)(actionsBuilder);
      actionsCell = actionsBuilder.endCell();
    }
    return beginCell().storeUint(OP.InternalTransfer, 32)
      .storeUint(opts.queryId.getQueryId(), 64)
      .storeRef(actionsCell)
      .endCell();
  }

  createInternalTransfer(opts: {
    actions: OutAction[] | Cell;
    queryId: HighloadQueryId;
    value: bigint;
  }) {
    return internal_relaxed({
      to: this.address,
      value: opts.value,
      body: HighloadWalletV3.createInternalTransferBody(opts),
    });
    /* beginCell()
        .storeUint(0x10, 6)
        .storeAddress(this.address)
        .storeCoins(opts.value)
        .storeUint(0, 107)
        .storeSlice(body.asSlice())
        .endCell();
        */
  }

  packActions(messages: OutAction[], value: bigint = toNano('1'), query_id: HighloadQueryId) {
    let batch: OutAction[];
    if (messages.length > 254) {
      batch = messages.slice(0, 253);
      batch.push({
        type: 'sendMsg',
        mode: value > 0n ? SendMode.PAY_GAS_SEPARATELY : SendMode.CARRY_ALL_REMAINING_BALANCE,
        outMsg: this.packActions(messages.slice(253), value, query_id),
      });
    } else {
      batch = messages;
    }
    return this.createInternalTransfer({
      actions: batch,
      queryId: query_id,
      value,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async getPublicKey(provider: ContractProvider): Promise<Buffer> {
    const res = (await provider.get('get_public_key', [])).stack;
    const pubKeyU = res.readBigNumber();
    return Buffer.from(pubKeyU.toString(16).padStart(32 * 2, '0'), 'hex');
  }

  // eslint-disable-next-line class-methods-use-this
  async getSubwalletId(provider: ContractProvider): Promise<number> {
    const res = (await provider.get('get_subwallet_id', [])).stack;
    return res.readNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getTimeout(provider: ContractProvider): Promise<number> {
    const res = (await provider.get('get_timeout', [])).stack;
    return res.readNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getLastCleaned(provider: ContractProvider): Promise<number> {
    const res = (await provider.get('get_last_clean_time', [])).stack;
    return res.readNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getProcessed(provider: ContractProvider, queryId: HighloadQueryId, needClean = true): Promise<boolean> {
    const res = (await provider.get('processed?', [{ type: 'int', value: queryId.getQueryId() }, {
      type: 'int',
      value: needClean ? -1n : 0n,
    }])).stack;
    return res.readBoolean();
  }
}
