/** Reconnect the same browser, otherwise prefer its choice and use a free seat. */
export function chooseSeat(
  players: Record<string, { id: string }>,
  occupied: readonly boolean[],
  playerId: string,
  preferred: number,
): 0 | 1 | null {
  for (const role of [0, 1] as const)
    if (players[role]?.id === playerId) return role;
  for (const role of [preferred, 1 - preferred] as (0 | 1)[])
    if (!occupied[role]) return role;
  return null;
}
export const seatKey = (key: string, role: number) => `${key}:seat:${role}`;
export const savePoseScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('EXPIRE', KEYS[1], 15)
  redis.call('SET', KEYS[2], ARGV[2], 'EX', 15)
  redis.call('SET', KEYS[3], ARGV[2], 'EX', 604800)
  return 1`;
export const releaseSeatScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('PUBLISH', KEYS[3], ARGV[2])
  return 1`;
