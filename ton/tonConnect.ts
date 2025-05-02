import { sha256 } from '@ton/crypto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/ton';
import type { Account, IStorage, TonProofItemReplySuccess, WalletInfoRemote } from '@tonconnect/sdk';
import { isWalletInfoRemote, WalletsListManager } from '@tonconnect/sdk';
import { Buffer } from 'buffer';
import { sign } from 'tweetnacl';

import { TON_CONNECT_DOMAINS } from '../../config';
import { DAY } from '../util/constants';
import { buildCollectionByKey, pick } from '../util/iteratees';
import { redis } from '../util/redis';
import { getWalletPublicKey } from './wallets';
import { tryParsePublicKey } from './walletsData';

type CheckProofRequest = {
  address: string;
  network: ValueOf<CHAIN>;
  public_key: string;
  proof: {
    timestamp: number;
    domain: {
      lengthBytes: number;
      value: string;
    };
    payload:string;
    signature: string;
    state_init: string;
  };
};

enum CHAIN {
  MAINNET = '-239',
  TESTNET = '-3',
}

const tonProofPrefix = 'ton-proof-item-v2/';
const tonConnectPrefix = 'ton-connect';
const validAuthTime = 15 * 60; // 15 minute

const WALLETS_LIST_CACHE_TTL = DAY;
const REDIS_PREFIX = 'tonConnect:';

const walletsListManager = new WalletsListManager({
  cacheTTLMs: Number(WALLETS_LIST_CACHE_TTL),
});

export async function getTonConnectWallets(appNames?: string[]): Promise<WalletInfoRemote[]> {
  const wallets = (await walletsListManager.getWallets()).filter(isWalletInfoRemote);
  if (!appNames) return wallets;

  const byWalletId = buildCollectionByKey(wallets, 'appName');
  return Object.values(pick(byWalletId, appNames));
}

export class TonConnectStorage implements IStorage {
  constructor(private readonly chatId: number) {}

  private getKey(key: string): string {
    return [REDIS_PREFIX, this.chatId.toString(), key].join(':');
  }

  async removeItem(key: string): Promise<void> {
    await redis.del(this.getKey(key));
  }

  async setItem(key: string, value: string): Promise<void> {
    await redis.set(this.getKey(key), value);
  }

  async getItem(key: string): Promise<string | null> {
    // eslint-disable-next-line no-null/no-null
    return await redis.get(this.getKey(key)) || null;
  }
}

export function checkTonConnectProof(proof: TonProofItemReplySuccess['proof'], account: Account) {
  return checkProof({
    address: account.address,
    network: account.chain,
    public_key: account.publicKey!,
    proof: {
      ...proof,
      state_init: account.walletStateInit,
    },
  });
}

async function checkProof(payload: CheckProofRequest): Promise<boolean> {
  try {
    const stateInit = loadStateInit(Cell.fromBase64(payload.proof.state_init).beginParse());

    // 1. First, try to obtain public key via get_public_key get-method on smart contract deployed at Address.
    // 2. If the smart contract is not deployed yet, or the get-method is missing, you need:
    //  2.1. Parse TonAddressItemReply.walletStateInit and get public key from stateInit. You can compare the walletStateInit.code
    //  with the code of standard wallets contracts and parse the data according to the found wallet version.
    const publicKey = tryParsePublicKey(stateInit) ?? await getWalletPublicKey(payload.address);
    if (!publicKey) {
      return false;
    }

    // 2.2. Check that TonAddressItemReply.publicKey equals to obtained public key
    const wantedPublicKey = Buffer.from(payload.public_key, 'hex');
    if (!publicKey.equals(wantedPublicKey)) {
      return false;
    }

    // 2.3. Check that TonAddressItemReply.walletStateInit.hash() equals to TonAddressItemReply.address. .hash() means BoC hash.
    const wantedAddress = Address.parse(payload.address);
    const address = contractAddress(wantedAddress.workChain, stateInit);
    if (!address.equals(wantedAddress)) {
      return false;
    }

    if (!TON_CONNECT_DOMAINS.includes(payload.proof.domain.value)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - validAuthTime > payload.proof.timestamp) {
      return false;
    }

    const message = {
      workchain: address.workChain,
      address: address.hash,
      domain: {
        lengthBytes: payload.proof.domain.lengthBytes,
        value: payload.proof.domain.value,
      },
      signature: Buffer.from(payload.proof.signature, 'base64'),
      payload: payload.proof.payload,
      stateInit: payload.proof.state_init,
      timestamp: payload.proof.timestamp,
    };

    const wc = Buffer.alloc(4);
    wc.writeUInt32BE(message.workchain, 0);

    const ts = Buffer.alloc(8);
    ts.writeBigUInt64LE(BigInt(message.timestamp), 0);

    const dl = Buffer.alloc(4);
    dl.writeUInt32LE(message.domain.lengthBytes, 0);

    // message = utf8_encode("ton-proof-item-v2/") ++
    //           Address ++
    //           AppDomain ++
    //           Timestamp ++
    //           Payload
    const msg = Buffer.concat([
      Buffer.from(tonProofPrefix),
      wc,
      message.address,
      dl,
      Buffer.from(message.domain.value),
      ts,
      Buffer.from(message.payload),
    ]);

    const msgHash = Buffer.from(await sha256(msg));

    // signature = Ed25519Sign(privkey, sha256(0xffff ++ utf8_encode("ton-connect") ++ sha256(message)))
    const fullMsg = Buffer.concat([
      Buffer.from([0xff, 0xff]),
      Buffer.from(tonConnectPrefix),
      msgHash,
    ]);

    const result = Buffer.from(await sha256(fullMsg));

    return sign.detached.verify(result, message.signature, publicKey);
  } catch (e) {
    return false;
  }
}
