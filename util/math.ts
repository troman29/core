export function round(num: number, decimals: number = 0) {
  return Math.round(num * 10 ** decimals) / 10 ** decimals;
}
