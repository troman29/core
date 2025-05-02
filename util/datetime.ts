export function formatDate(date: Date) {
  return `${date.toISOString().replace('T', ' ').slice(0, -5)} UTC`;
}

export function parseDate(value: string) {
  try {
    const timestamp = Date.parse(value);
    return !Number.isNaN(timestamp) ? new Date(timestamp) : undefined;
  } catch (err) {
    return undefined;
  }
}

export function toMilliseconds(seconds: number) {
  return seconds * 1000;
}

export function toSeconds(ms: number) {
  return Math.floor(ms / 1000);
}
