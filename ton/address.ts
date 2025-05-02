import { Address } from '@ton/core';

import withCache from '../utils/withCache';

const DEFAULT_SHIFT = 5;
const FILLER = '...';

export const shortenAddress = withCache((address: string, shift = DEFAULT_SHIFT, fromRight = shift) => {
  if (!address) return undefined;

  if (address.length <= shift + fromRight + FILLER.length) return address;

  return `${address.slice(0, shift)}${FILLER}${address.slice(-fromRight)}`;
});

export function parseAddress(address: string): {
  isValid: boolean;
  isRaw?: boolean;
  isUserFriendly?: boolean;
  isBounceable?: boolean;
  isTestOnly?: boolean;
  address?: Address;
} {
  try {
    if (Address.isRaw(address)) {
      return {
        address: Address.parseRaw(address),
        isRaw: true,
        isValid: true,
      };
    } else if (Address.isFriendly(address)) {
      return {
        ...Address.parseFriendly(address),
        isUserFriendly: true,
        isValid: true,
      };
    }
  } catch (err) {
    // Do nothing
  }

  return { isValid: false };
}

export function toBase64Address(address: Address | string, isBounceable = true) {
  if (typeof address === 'string') {
    address = Address.parse(address);
  }
  return address.toString({
    urlSafe: true,
    bounceable: isBounceable,
  });
}
