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
