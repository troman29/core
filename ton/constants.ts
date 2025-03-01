export const WORKCHAIN = 0;

export const TON_GAS = {
  NetworkFee: 500000000n, // 0.005 TON
  TokenTransfer: 50000000n, // 0.05 TON
  TokenTransferForward: 1n, // 0.000000001 TON
  NftTransfer: 100000000n, // 0.1 TON
  NftTransferForward: 1n, // 0.000000001 TON
};

export const TONCOIN = {
  name: 'Toncoin',
  symbol: 'TON',
  slug: 'toncoin',
  decimals: 9,
} as const;

export const ONE_TON = 1000000000n;
