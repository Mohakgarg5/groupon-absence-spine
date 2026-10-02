import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  employees, scenario, setPackOverride, getPack, inflate, validatePack,
  type Inputs, type LeaveRequest, type SicknessRecord, type Pack,
} from '@spine/engine';

export type View = 'overview' | 'desk' | 'ledger' | 'unify' | 'packs' | 'update' | 'docs';
interface Override { id: string; year: number; pack: Pack }
interface State { view: View; employeeId: string; inputs: Inputs; overrides: Override[]; rev: number; deskPreset?: { from: string; to: string; autorun: boolean } }
type Action =
  | { type: 'go'; view: View; employeeId?: string; deskPreset?: State['deskPreset'] }
  | { type: 'select'; employeeId: string }
  | { type: 'addRequest'; request: LeaveRequest }
  | { type: 'removeRequest'; id: string }
  | { type: 'addSickness'; record: SicknessRecord }
  | { type: 'removeSickness'; id: string }
  | { type: 'toggleNotice'; employeeId: string; leaveYear: number; sentOn: string }
  | { type: 'override'; id: string; year: number; pack: Pack | null }
  | { type: 'consumePreset' }
  | { type: 'reset' };

const KEY = 'spine-state-v1';
const fresh = (): State => ({ view: 'overview', employeeId: 'de-lena', inputs: structuredClone(scenario.inputs), overrides: [], rev: 0 });

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    if (!s?.inputs?.requests) return fresh();
    return { ...fresh(), ...s, view: 'overview', deskPreset: undefined };
  } catch { return fresh(); }
}

function syncOverrides(list: Override[]) {
  for (const p of ['DE-BE', 'PL', 'IE', 'UK', 'ES-MD', 'US-CHI']) for (const y of [2026, 2027]) setPackOverride(null, p, y);
  for (const o of list) setPackOverride(o.pack);
}

function reducer(s: State, a: Action): State {
  const bump = (n: Partial<State>): State => ({ ...s, ...n, rev: s.rev + 1 });
  switch (a.type) {
    case 'go': return { ...s, view: a.view, employeeId: a.employeeId ?? s.employeeId, deskPreset: a.deskPreset };
    case 'select': return { ...s, employeeId: a.employeeId };
    case 'consumePreset': return { ...s, deskPreset: undefined };
    case 'addRequest': return bump({ inputs: { ...s.inputs, requests: [...s.inputs.requests.filter((r) => r.id !== a.request.id), a.request] } });
    case 'removeRequest': return bump({ inputs: { ...s.inputs, requests: s.inputs.requests.filter((r) => r.id !== a.id), sickness: s.inputs.sickness } });
    case 'addSickness': return bump({ inputs: { ...s.inputs, sickness: [...s.inputs.sickness, a.record] } });
    case 'removeSickness': return bump({ inputs: { ...s.inputs, sickness: s.inputs.sickness.filter((x) => x.id !== a.id) } });
    case 'toggleNotice': {
      const has = s.inputs.notices.some((n) => n.employeeId === a.employeeId && n.leaveYear === a.leaveYear);
      const notices = has ? s.inputs.notices.filter((n) => !(n.employeeId === a.employeeId && n.leaveYear === a.leaveYear))
        : [...s.inputs.notices, { employeeId: a.employeeId, leaveYear: a.leaveYear, sentOn: a.sentOn }];
      return bump({ inputs: { ...s.inputs, notices } });
    }
    case 'override': {
      const overrides = s.overrides.filter((o) => !(o.id === a.id && o.year === a.year));
      if (a.pack) overrides.push({ id: a.id, year: a.year, pack: a.pack });
      syncOverrides(overrides);
      return bump({ overrides });
    }
    case 'reset': syncOverrides([]); return { ...fresh(), view: s.view, rev: s.rev + 1 };
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const s = load();
    // Re-inflate stored overrides so citations keep their pack stamp, then apply them before first render.
    s.overrides = s.overrides.filter((o) => { try { getPack(o.id, o.year); return true; } catch { return false; } })
      .map((o) => ({ ...o, pack: inflate(o.pack) }))
      .filter((o) => validatePack(o.pack).length === 0); // drop stale or invalid corrections instead of crashing
    syncOverrides(s.overrides);
    return s;
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, deskPreset: undefined })); } catch { /* storage unavailable: state stays in memory */ }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export const TODAY = scenario.today;
export const people = employees;
export const personById = (id: string) => employees.find((e) => e.id === id)!;
export const ENTITY_ORDER = ['DE-BE', 'PL', 'IE', 'UK', 'ES-MD', 'US-CHI'];
