import { z } from 'zod';
import { parseOptNum } from '../components/ui';

// Validation messages are i18n keys; forms translate them at render time.
export const optNumber = (min: number, max: number) =>
  z.preprocess(parseOptNum, z.number({ invalid_type_error: 'val.number' }).min(min, 'val.range').max(max, 'val.range').optional());
export const reqNumber = (min: number, max: number) =>
  z.preprocess(parseOptNum, z.number({ required_error: 'val.required', invalid_type_error: 'val.required' }).min(min, 'val.range').max(max, 'val.range'));
export const reqString = z.string().trim().min(1, 'val.required');
export const dateTimeStr = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'val.date');
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'val.date');
