import type { Sender } from '@ton/core';
import type { KeyPair } from '@ton/crypto';
import { mnemonicToPrivateKey } from '@ton/crypto';
import type { OpenedContract } from '@ton/ton';
import { Address, WalletContractV4, WalletContractV5R1 } from '@ton/ton';

import { MAIN_WALLET_MNEMONIC, MAIN_WALLET_VERSION } from '../../config';
import { logError, logInfo } from '../util/logs';
import withCacheAsync from '../util/withCacheAsync';
import { toBase64Address } from './address';
import { tonClient } from './client';
import { WORKCHAIN } from './constants';

export type WalletVersion = 'v4R2' | 'W5';
export type WalletSlug = 'main' | 'mainW5' | 'mainV4';

const bySlug: Record<WalletSlug, {
  keyPair: Promise<KeyPair>;
  wallet?: OpenedContract<WalletContractV5R1 | WalletContractV4>;
  address?: string;
  sender?: Sender;
  version?: 'v4R2' | 'W5';
}> = {
  main: {
    keyPair: mnemonicToPrivateKey(MAIN_WALLET_MNEMONIC.split(' ')),
    version: MAIN_WALLET_VERSION as WalletVersion,
  },
  mainW5: {
    keyPair: mnemonicToPrivateKey(MAIN_WALLET_MNEMONIC.split(' ')),
    version: 'W5',
  },
  mainV4: {
    keyPair: mnemonicToPrivateKey(MAIN_WALLET_MNEMONIC.split(' ')),
    version: 'v4R2',
  },
};

export const getWalletPublicKey = withCacheAsync(async (address: string) => {
  try {
    const res = await tonClient.callGetMethod(Address.parse(address), 'get_public_key');
    const bigintKey = res.stack.readBigNumber();
    const hex = bigintKey.toString(16).padStart(64, '0');
    return Buffer.from(hex);
  } catch (err) {
    logError('getWalletPublicKey', err);
    return undefined;
  }
});

export async function getWallet(slug: WalletSlug) {
  const config = bySlug[slug];
  const keyPair = await config.keyPair;

  if (!config.wallet) {
    const walletClass = config.version === 'v4R2' ? WalletContractV4 : WalletContractV5R1;
    const contract = walletClass.create({
      publicKey: Buffer.from(keyPair.publicKey),
      workchain: WORKCHAIN,
    });
    config.wallet = tonClient.open(contract);
    config.address = toBase64Address(config.wallet.address, false);
    config.sender = config.wallet.sender(keyPair.secretKey);

    logInfo(`Wallet ${slug} was configured ${config.address}`);
  }

  return {
    wallet: config.wallet,
    address: config.address!,
    sender: config.sender!,
    secretKey: keyPair.secretKey!,
  };
}
