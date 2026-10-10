/** Remaining whole seconds until `endAt` (ms epoch). Uses timestamps so it survives navigation and reloads. */
export const remainingSec = (endAt: number | null, now: number) => (endAt === null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000)));
export const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
