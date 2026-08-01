import { z } from 'zod';

const sourceSchema = z
  .object({
    label: z.string().optional(),
    res: z.string().optional(),
    src: z.string().optional(),
  })
  .passthrough();

const fpvEntrySchema = z
  .object({
    role: z.string().optional(),
    headimg: z.string().nullable().optional(),
    sources: z.array(sourceSchema).optional(),
  })
  .passthrough();

const liveZoneSchema = z
  .object({
    zoneId: z.union([z.string(), z.number()]).optional(),
    zoneName: z.string().optional(),
    liveState: z.number().optional(),
    matchState: z.number().optional(),
    zoneLiveString: z.array(sourceSchema).optional(),
    fpvData: z.array(fpvEntrySchema).optional(),
  })
  .passthrough();

export const liveGameInfoSchema = z
  .object({
    eventData: z.array(liveZoneSchema).optional(),
  })
  .passthrough();

const arrayOrWrapper = (keys: string[]) =>
  z.union([
    z.array(z.object({}).passthrough()),
    z
      .object(
        Object.fromEntries(keys.map((k) => [k, z.array(z.object({}).passthrough()).optional()])),
      )
      .passthrough(),
  ]);

export const currentAndNextMatchesSchema = arrayOrWrapper(['data', 'list', 'records']);

export const scheduleSchema = z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]);

export const groupsOrderSchema = z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]);

export const groupRankInfoSchema = z.union([
  z.array(z.object({}).passthrough()),
  z.object({}).passthrough(),
]);

export const robotDataSchema = z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]);
