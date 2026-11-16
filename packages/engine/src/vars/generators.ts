import { fakerVI } from '@faker-js/faker';
import { endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { v7 as uuidv7 } from 'uuid';

const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function randomString(length: number, alphabet = ALNUM): string {
  let s = '';
  for (let i = 0; i < length; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/** Bare generator names usable as `{{name}}` [E-05, E-06]. Weeks start on Monday (VN). */
export const GENERATORS: Record<string, (now: Date) => unknown> = {
  random: () => randomInt(100000, 999999),
  timestamp: (now) => now.getTime(),
  uuid: () => uuidv7(),
  now: (now) => now,
  today: (now) => startOfDay(now),
  tomorrow: (now) => startOfDay(new Date(now.getTime() + 86_400_000)),
  yesterday: (now) => startOfDay(new Date(now.getTime() - 86_400_000)),
  startOfMonth: (now) => startOfMonth(now),
  endOfMonth: (now) => startOfDay(endOfMonth(now)),
  startOfWeek: (now) => startOfWeek(now, { weekStartsOn: 1 }),
  endOfWeek: (now) => startOfDay(endOfWeek(now, { weekStartsOn: 1 })),
};

/** Vietnamese fake data: `{{fake.name}}`, `{{fake.phone}}`… [E-05]. */
export const FAKE: Record<string, () => string> = {
  name: () => fakerVI.person.fullName(),
  firstName: () => fakerVI.person.firstName(),
  lastName: () => fakerVI.person.lastName(),
  phone: () => `0${randomString(1, '35789')}${randomString(8, '0123456789')}`,
  email: () =>
    `${fakerVI.person.firstName().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()}.${randomString(6)}@example.com`,
  address: () => `${fakerVI.location.streetAddress()}, ${fakerVI.location.city()}`,
  city: () => fakerVI.location.city(),
  company: () => fakerVI.company.name(),
  word: () => fakerVI.lorem.word(),
  sentence: () => fakerVI.lorem.sentence(),
};
