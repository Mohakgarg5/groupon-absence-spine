// Hook: which law applies is decided by where the employee physically works, not by the employing entity.
import { EngineError, type Employee } from './model';

/** US leave law is local: city ordinances first, then the state. Order matters (Chicago before Illinois). */
export const US_ROUTES: { test: RegExp; packId: string; law: string }[] = [
  { test: /chicago/i, packId: 'US-CHI', law: 'the Chicago Paid Leave and Paid Sick and Safe Leave Ordinance' },
  { test: /new york|\bnyc\b|brooklyn|manhattan|queens|bronx/i, packId: 'US-NYC', law: 'the NYC Earned Safe and Sick Time Act and New York State law' },
  { test: /dallas|houston|austin|texas|,\s*tx\b/i, packId: 'US-TX', law: 'Texas law (no state leave mandate)' },
  { test: /illinois|,\s*il\b/i, packId: 'US-IL', law: 'the Illinois Paid Leave for All Workers Act' },
];

export function resolvePackId(e: Employee): string {
  if (!e.packId.startsWith('US-')) return e.packId;
  const route = US_ROUTES.find((r) => r.test.test(e.workLocation));
  if (!route)
    throw new EngineError('NO_PACK_FOR_LOCATION', `${e.name} works in ${e.workLocation}, and no US rule pack covers that location yet. Counsel must author one before requests can be processed.`);
  if (route.packId !== e.packId)
    throw new EngineError('NO_PACK_FOR_LOCATION', `${e.name}'s HR record uses ${e.packId}, but they work in ${e.workLocation}, where ${route.law} applies (${route.packId}). The law follows the work location: correct the record before processing.`);
  return e.packId;
}
