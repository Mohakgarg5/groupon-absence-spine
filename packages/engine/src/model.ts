// Core types shared by every part of the spine. Rule packs supply the local law; these types are the unified record.

export type ISODate = string; // 'YYYY-MM-DD'
export type Verification = 'public-verified' | 'public-unverified' | 'assumption';
export type Unit = 'days' | 'hours';

/** Every number the engine produces points back at one of these. */
export interface RuleRef {
  packId: string;
  packVersion: string;
  ruleId: string;
  citation: string;
  url?: string;
  verification: Verification;
  note?: string;
}
export type RuleRefLite = Omit<RuleRef, 'packId' | 'packVersion'>;

export interface WorkPattern {
  days: number[]; // 0=Sun..6=Sat
  hoursPerDay: number;
}

export type Education =
  | 'none' | 'basic-vocational' | 'secondary-vocational' | 'general-secondary' | 'post-secondary' | 'higher';

export interface Employee {
  id: string;
  name: string;
  title: string;
  packId: string;
  workLocation: string;
  hireDate: ISODate;
  terminationDate?: ISODate;
  pattern: WorkPattern;
  managerId?: string;
  /** bucketId → balance migrated from the legacy system as at 2026-01-01 (leave year 2025). */
  openingBalances?: Record<string, number>;
  pl?: { priorServiceYears: number; education: Education; firstJob: boolean };
  de?: { severeDisability?: boolean };
  persona?: string;
}

export type RequestKind = 'annual' | 'on-demand' | 'sick-bank';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export interface LeaveRequest {
  id: string;
  employeeId: string;
  from: ISODate;
  to: ISODate;
  kind: RequestKind;
  status: RequestStatus;
  submittedOn: ISODate;
  note?: string;
}
export interface SicknessRecord {
  id: string;
  employeeId: string;
  from: ISODate;
  to: ISODate;
  certified: boolean;
  employeeAskedToReschedule?: boolean;
}
/** German duty-to-inform (CJEU C-684/16): written notice that untaken leave will lapse. */
export interface ExpiryNotice { employeeId: string; leaveYear: number; sentOn: ISODate }
export interface Inputs { requests: LeaveRequest[]; sickness: SicknessRecord[]; notices: ExpiryNotice[] }

export type EventType =
  | 'OPENING' | 'GRANT' | 'ACCRUE' | 'DEBIT' | 'RESTORE' | 'CARRY_OVER' | 'EXPIRE' | 'EXPIRY_BLOCKED' | 'PAYOUT' | 'ADJUST';

export interface LedgerEvent {
  id: string;
  date: ISODate;
  employeeId: string;
  bucket: string;
  type: EventType;
  amount: number; // signed, in `unit`
  unit: Unit;
  leaveYear: number;
  rule: RuleRef;
  explanation: string;
  requestId?: string;
  projected?: boolean;
  /** Running balance of the bucket immediately after this event. */
  balanceAfter?: number;
}

export interface DayLine {
  date: ISODate;
  kind: 'counted' | 'weekend' | 'non-working' | 'holiday';
  holidayName?: string;
  amount: number;
  unit: Unit;
}

export interface HrTask { date: ISODate; title: string; rule: RuleRef }

/** Distinct weekdays 0–6 and 0 < hours per day ≤ 24. */
export const isValidPattern = (p: WorkPattern | undefined): boolean =>
  !!p?.days?.length && new Set(p.days).size === p.days.length && p.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && p.hoursPerDay > 0 && p.hoursPerDay <= 24;

export class EngineError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'EngineError';
  }
}
