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
    zoneLiveString: z.array(sourceSchema).nullable().optional(),
    fpvData: z.array(fpvEntrySchema).nullable().optional(),
  })
  .passthrough();

export const liveGameInfoSchema = z
  .object({
    eventData: z.array(liveZoneSchema).nullable().optional(),
  })
  .passthrough();

const item = z.object({}).passthrough();

export const currentAndNextMatchesSchema = z
  .union([z.array(item), z.object({}).passthrough()])
  .nullable();

export const scheduleSchema = z
  .union([z.array(item), z.object({}).passthrough()])
  .nullable();

export const groupsOrderSchema = z
  .union([z.array(item), z.object({}).passthrough()])
  .nullable();

export const groupRankInfoSchema = z
  .union([z.array(item), z.object({}).passthrough()])
  .nullable();

export const robotDataSchema = z
  .union([z.array(item), z.object({}).passthrough()])
  .nullable();
