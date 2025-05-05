import { ALERTS_CHAT_ID, BOT_TOKEN } from '../../config';
import { handleFetchErrors } from './fetch';
import { logError, logInfo } from './logs';
import { pause } from './schedulers';

const INTERVAL = 3100;

let sentAt: Date | undefined;

async function sendTelegramNotification(message: string, data?: object, isMarkdown?: boolean) {
  // eslint-disable-next-line no-console
  logInfo('[sendTelegramNotification]', message, data);

  if (data) {
    if (isMarkdown) {
      message = `${message}
\`\`\`
${JSON.stringify(data, undefined, 2)}
\`\`\``;
    } else {
      message = `${message}\n\n${JSON.stringify(data, undefined, 2)}`;
    }
  }

  if (!BOT_TOKEN || !ALERTS_CHAT_ID) {
    return;
  }

  if (sentAt) {
    while (true) {
      const delta = Date.now() - sentAt.getTime();
      if (delta < INTERVAL) {
        await pause(INTERVAL - delta);
      } else {
        break;
      }
    }
  }
  sentAt = new Date();

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ALERTS_CHAT_ID,
        text: message,
        ...(isMarkdown && {
          parse_mode: 'MarkdownV2',
        }),
      }),
    });

    await handleFetchErrors(response);
  } catch (err) {
    logError('sendTelegramNotification', err);
  }
}

export default sendTelegramNotification;
