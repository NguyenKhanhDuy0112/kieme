import { devices } from 'playwright-core';
import { z } from 'zod';
import { EngineError } from '../errors';
import { BROWSER_KINDS } from './detect';

/** How to launch the browser for a run [G-01, G-05]. */
export const LaunchSettingsSchema = z.object({
  /** `auto`: Edge/Chrome already on the machine, else downloaded Chromium. */
  browser: z.enum(['auto', ...BROWSER_KINDS]).default('auto'),
  /** `false` shows the browser window; `true` runs in the background [G-05]. */
  headless: z.boolean().default(true),
  /** Slow every action down (ms) so testers can follow a headed run. */
  slowMoMs: z.number().int().nonnegative().optional(),
});
export type LaunchSettings = z.infer<typeof LaunchSettingsSchema>;
export type LaunchSettingsInput = z.input<typeof LaunchSettingsSchema>;

/** Screen size / mobile device emulation for each session's context [G-03]. */
export const ViewportSettingsSchema = z.object({
  /** Playwright device name, e.g. `iPhone 15`, `Pixel 7`. */
  device: z.string().min(1).optional(),
  /** Window size in CSS pixels; overrides the device's size. */
  viewport: z
    .object({
      width: z.number().int().min(200).max(7680),
      height: z.number().int().min(200).max(4320),
    })
    .optional(),
});
export type ViewportSettings = z.infer<typeof ViewportSettingsSchema>;

/** Default window size when nothing is set. */
export const DEFAULT_VIEWPORT = { width: 1366, height: 768 } as const;

/** Device names that can be emulated, for the settings dropdown. */
export function listDevices(): string[] {
  return Object.keys(devices);
}

export interface ContextEmulation {
  viewport: { width: number; height: number };
  userAgent?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

/** Turns viewport settings into Playwright `newContext` options [G-03]. */
export function contextEmulation(settings: ViewportSettings = {}): ContextEmulation {
  if (settings.device === undefined)
    return { viewport: settings.viewport ?? { ...DEFAULT_VIEWPORT } };
  const d = devices[settings.device];
  if (!d) {
    throw new EngineError('UNKNOWN_DEVICE', `Unknown device "${settings.device}"`, {
      device: settings.device,
    });
  }
  return {
    viewport: settings.viewport ?? d.viewport,
    userAgent: d.userAgent,
    deviceScaleFactor: d.deviceScaleFactor,
    isMobile: d.isMobile,
    hasTouch: d.hasTouch,
  };
}
