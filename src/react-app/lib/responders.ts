import type { ActivityWithAvailability } from "../queries/activities.ts";

/** One user's answer, as it arrives over the wire. */
export type ActivityResponse = ActivityWithAvailability["responses"][number];
type ResponseSlot = ActivityResponse["slots"][number];

export type Responder = { userId: string; name: string };

const timeToMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** A slot with no `from`/`to` covers the whole day. */
const slotRange = (slot: ResponseSlot) => ({
  from: slot.from ? timeToMinutes(slot.from) : 0,
  to: slot.to ? timeToMinutes(slot.to) : 24 * 60,
});

/** Key an availability grid cell is looked up by: the date alone at day
 * granularity, `date|hour` at hourly granularity. */
export const slotKey = (date: string, hour?: number) =>
  hour === undefined ? date : `${date}|${hour}`;

/** Every key a stored slot occupies — the date alone for a whole-day slot,
 * or one key per hour cell its range overlaps. */
const keysForSlot = (slot: ResponseSlot): string[] => {
  if (!slot.from || !slot.to) return [slot.date];

  const startHour = Math.floor(timeToMinutes(slot.from) / 60);
  const endHourExclusive = Math.ceil(timeToMinutes(slot.to) / 60);
  return Array.from({ length: Math.max(0, endHourExclusive - startHour) }, (_, i) =>
    slotKey(slot.date, startHour + i),
  );
};

/** Who picked each slot, keyed by `slotKey`. Pass `excludeUserId` to leave
 * the viewer out, so a cell's badge counts *other* people — their own pick
 * is already shown by the cell's fill. */
export const respondersBySlot = (
  responses: ActivityResponse[],
  excludeUserId?: string,
): Record<string, Responder[]> => {
  const bySlot: Record<string, Responder[]> = {};

  for (const response of responses) {
    if (response.userId === excludeUserId) continue;

    for (const slot of response.slots) {
      for (const key of keysForSlot(slot)) {
        const list = bySlot[key] ?? [];
        list.push({ userId: response.userId, name: response.name });
        bySlot[key] = list;
      }
    }
  }

  return bySlot;
};

/** The hour ranges a user offered on one date, formatted for display —
 * empty for a whole-day slot, which needs no qualifier. */
export const rangesForDate = (slots: ResponseSlot[], date: string): string[] =>
  slots
    .filter((slot) => slot.date === date && slot.from && slot.to)
    .map((slot) => `${slot.from}–${slot.to}`);

/** Dates anyone offered, ascending — the rows a breakdown lists when the
 * activity has no fixed set of suggested dates to go by. */
export const respondedDates = (responses: ActivityResponse[]): string[] => {
  const dates = new Set<string>();
  for (const response of responses) {
    for (const slot of response.slots) dates.add(slot.date);
  }
  return [...dates].sort();
};

/** Who said they could make a concrete date + time window. A whole-day slot
 * counts for any window on that date; an hourly slot has to actually
 * overlap it. */
export const availableForBooking = (
  responses: ActivityResponse[],
  date: string,
  from: string,
  to: string,
): Responder[] => {
  const windowFrom = timeToMinutes(from);
  const windowTo = timeToMinutes(to);

  return responses
    .filter((response) =>
      response.slots.some((slot) => {
        if (slot.date !== date) return false;
        const range = slotRange(slot);
        return range.from < windowTo && range.to > windowFrom;
      }),
    )
    .map((response) => ({ userId: response.userId, name: response.name }));
};

/** Split the channel roster by what each member answered — the three lists
 * a one-off activity's organizer actually wants to see. */
export const splitByResponse = (
  responses: ActivityResponse[],
  members: Responder[],
): { available: Responder[]; declined: Responder[]; noAnswer: Responder[] } => {
  const byUserId = new Map(responses.map((response) => [response.userId, response]));

  const available = responses
    .filter((response) => !response.declined)
    .map((response) => ({ userId: response.userId, name: response.name }));
  const declined = responses
    .filter((response) => response.declined)
    .map((response) => ({ userId: response.userId, name: response.name }));
  const noAnswer = members.filter((member) => !byUserId.has(member.userId));

  return { available, declined, noAnswer };
};

/** Everyone who offered something on one date, with the hour ranges they
 * offered — empty ranges meaning a whole-day slot, which needs no qualifier.
 * Unlike `availableForBooking` this doesn't narrow to a time window: it's
 * what you read *before* choosing one. */
export const offersOnDate = (
  responses: ActivityResponse[],
  date: string,
): { userId: string; name: string; ranges: string[] }[] =>
  responses
    .filter((response) => response.slots.some((slot) => slot.date === date))
    .map((response) => ({
      userId: response.userId,
      name: response.name,
      ranges: rangesForDate(response.slots, date),
    }));
