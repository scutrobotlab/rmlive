import { z } from 'zod';

const sourceSchema = z
  .object({
    label: z.string().nullable().optional(),
    res: z.string().nullable().optional(),
    src: z.string().nullable().optional(),
  })
  .passthrough();

const fpvEntrySchema = z
  .object({
    role: z.string().nullable().optional(),
    headimg: z.string().nullable().optional(),
    sources: z.array(sourceSchema).nullable().optional(),
  })
  .passthrough();

const liveZoneSchema = z
  .object({
    zoneId: z.union([z.string(), z.number()]).nullable().optional(),
    zoneName: z.string().nullable().optional(),
    liveState: z.number().nullable().optional(),
    matchState: z.number().nullable().optional(),
    zoneLiveString: z.array(sourceSchema).nullable().optional(),
    fpvData: z.array(fpvEntrySchema).nullable().optional(),
  })
  .passthrough();

export const liveGameInfoSchema = z
  .object({
    eventData: z.array(liveZoneSchema).nullable().optional(),
  })
  .passthrough();

export const currentAndNextMatchesSchema = z.preprocess(
  (v) => (v === null ? [] : v),
  z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]),
);

export const scheduleSchema = z.preprocess(
  (v) => (v === null ? [] : v),
  z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]),
);

export const groupsOrderSchema = z.preprocess(
  (v) => (v === null ? [] : v),
  z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]),
);

export const groupRankInfoSchema = z.preprocess(
  (v) => (v === null ? {} : v),
  z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]),
);

export const robotDataSchema = z.preprocess(
  (v) => (v === null ? [] : v),
  z.union([z.array(z.object({}).passthrough()), z.object({}).passthrough()]),
);
