import type { KeyPair } from '@ton/crypto';
import { mnemonicToPrivateKey } from '@ton/crypto';
import type { OpenedContract } from '@ton/ton';
import { Address, WalletContractV5R1 } from '@ton/ton';

import { MAIN_WALLET_MNEMONIC } from '../../config';
import { logError, logInfo } from '../utils/logs';
import withCacheAsync from '../utils/withCacheAsync';
import { toBase64Address } from './address';
import { tonClient } from './client';
import { WORKCHAIN } from './constants';

export type WalletSlug = 'main';

const bySlug: Record<WalletSlug, {
  keyPair: Promise<KeyPair>;
  wallet?: OpenedContract<WalletContractV5R1>;
  address?: string;
}> = {
  main: {
    keyPair: mnemonicToPrivateKey(MAIN_WALLET_MNEMONIC.split(' ')),
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
    const contract = WalletContractV5R1.create({
      publicKey: Buffer.from(keyPair.publicKey),
      workchain: WORKCHAIN,
    });
    config.wallet = tonClient.open(contract);
    config.address = toBase64Address(config.wallet.address, false);

    logInfo(`Wallet ${slug} was configured ${config.address}`);
  }

  return {
    wallet: config.wallet,
    address: config.address,
    secretKey: keyPair.secretKey,
  };
}
