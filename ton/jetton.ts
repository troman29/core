import { Address } from '@ton/core';

import withCacheAsync from '../util/withCacheAsync';
import { JettonMinter } from './contracts/Jetton/JettonMaster';
import { JettonWallet } from './contracts/Jetton/JettonWallet';
import { toBase64Address } from './address';
import { tonClient } from './client';

export const getTokenWalletAddress = withCacheAsync(
  async (address: string, tokenAddress: string) => {
    const minter = tonClient.open(JettonMinter.createFromAddress(Address.parse(tokenAddress)));
    const walletAddress = await minter.getWalletAddress(Address.parse(address));
    return toBase64Address(walletAddress, true);
  },
);

export const getTokenAddress = withCacheAsync(async (tokenWalletAddress: string) => {
  const tokenWallet = tonClient.open(JettonWallet.createFromAddress(Address.parse(tokenWalletAddress)));
  const data = await tokenWallet.getWalletData();
  return toBase64Address(data.minter, true);
});
