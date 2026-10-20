import { randomInt, randomUUID } from 'crypto';

const LIVE_CODES = new Set<string>();

export function generateRoomCode(): string {
  for (let i = 0; i < 20; i += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!LIVE_CODES.has(code)) {
      LIVE_CODES.add(code);
      return code;
    }
  }
  throw new Error('Не удалось выдать код комнаты');
}

export function releaseRoomCode(code: string) {
  LIVE_CODES.delete(code);
}

export function newPlayerToken() {
  return randomUUID();
}
