// Hook: which law applies is decided by where the employee physically works, not by the employing entity.
import { EngineError, type Employee } from './model';

export function resolvePackId(e: Employee): string {
  if (e.packId === 'US-CHI' && !/chicago/i.test(e.workLocation)) {
    throw new EngineError('NO_PACK_FOR_LOCATION',
      `${e.name} works in ${e.workLocation}. The Chicago ordinance applies only to work physically in Chicago; elsewhere in Illinois the Paid Leave for All Workers Act (820 ILCS 192) applies, and no PLAWA rule pack has been authored yet.`);
  }
  return e.packId;
}
