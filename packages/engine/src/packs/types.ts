import type { RequestKind, RuleRef, Unit } from '../model';

export type EntitlementStrategy = 'werktage' | 'weeks' | 'calendar-days' | 'pl-seniority' | 'per-hours-worked';
export type AccrualStrategy = 'de-waiting-period' | 'front-load-prorata' | 'monthly' | 'pl-proportional' | 'uk-first-year-monthly' | 'hours-worked' | 'unlimited-with-floor';
export type SickMode = 'restore-if-certified' | 'restore-on-request' | 'restore' | 'convert-to-sick-bank';
export type CountingMode = 'working-days' | 'calendar-days' | 'working-hours';

export interface Bucket {
  id: string;
  label: string;
  unit: Unit;
  requestKinds: RequestKind[];
  usableFromDays: number;
  onDemandMax?: number;
  entitlement: { strategy: EntitlementStrategy; params: Record<string, any>; rule: RuleRef };
  accrual: { strategy: AccrualStrategy; params: Record<string, any>; rule: RuleRef };
  carryOver: { max: number | null; expiresMonthDay: string | null; conditionalOnNotice: boolean; /** Employer deadline to grant carried leave; the leave itself does not lapse (PL art. 168). */ grantByMonthDay?: string; rule: RuleRef };
  sickDuringLeave: { mode: SickMode; rule: RuleRef };
  payoutOnTermination: { mode: 'remaining' | 'none'; rule: RuleRef };
}

export interface Holiday { date: string; name: string }

export interface Pack {
  id: string;
  version: string;
  year: number;
  entity: string;
  country: string;
  region: string;
  summary: string;
  owner: { role: string; signOff: { status: 'pending' | 'signed'; by: string | null; on: string | null } };
  locationAssumption: RuleRef;
  leaveYear: { startMonth: number; startDay: number };
  counting: { mode: CountingMode; dayEquivalentHours?: number; rule: RuleRef };
  holidays: { loaded: boolean; source: RuleRef; dates: Holiday[] };
  holidayPolicy: {
    onNonWorkingDay: 'nothing' | 'extra-leave' | 'designate-day-off-task';
    saturdayOnly?: boolean;
    minHoursInPrior5Weeks?: number;
    deductFromEntitlement: boolean;
    deductOrder?: string[];
    rule: RuleRef;
  };
  buckets: Bucket[];
  extras: (RuleRef & { label: string })[];
}
