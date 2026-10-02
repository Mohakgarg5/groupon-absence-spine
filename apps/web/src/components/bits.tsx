import { useState, type ReactNode } from 'react';
import type { RuleRef, Verification } from '@spine/engine';
import { getPack } from '@spine/engine';

const VLABEL: Record<Verification, string> = {
  'public-verified': 'Checked against source',
  'public-unverified': 'Public law, not yet checked',
  assumption: 'Our assumption',
};

export function Verif({ v }: { v: Verification }) {
  return <span className={`verif verif-${v}`} title={VLABEL[v]}><span className="verif-dot" aria-hidden />{VLABEL[v]}</span>;
}

export function Citation({ rule, compact = false }: { rule: RuleRef; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  let owner = '';
  try { owner = getPack(rule.packId, Number(rule.packVersion.slice(0, 4))).owner.role; } catch { /* override or missing */ }
  return (
    <div className="cite">
      <span className="cite-mark" aria-hidden>§</span>
      <span>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>{compact && !open ? rule.citation.split(':')[0] : rule.citation}</button>{' '}
        <Verif v={rule.verification} />
      </span>
      {open && (
        <span className="cite-note reveal">
          {rule.note && <>{rule.note} </>}
          Rule <code>{rule.ruleId}</code> in {rule.packId} v{rule.packVersion}{owner && <>; owner: {owner}</>}.
          {rule.url && <> <a href={rule.url} target="_blank" rel="noreferrer">Source</a></>}
        </span>
      )}
    </div>
  );
}

export function Ent({ id }: { id: string }) { return <span className="chip ent">{id}</span>; }

export function Amount({ n, unit }: { n: number; unit?: string }) {
  const v = Math.round(n * 100) / 100;
  const cls = v > 0 ? 'amt-pos' : v < 0 ? 'amt-neg' : 'amt-zero';
  return <span className={cls}>{v > 0 ? '+' : ''}{v === 0 ? '0' : v}{unit ? <span className="muted small"> {unit === 'hours' ? 'h' : 'd'}</span> : null}</span>;
}

export const fmt = (n: number) => String(Math.round(n * 100) / 100);
export const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function Toast({ children }: { children: ReactNode }) { return <div className="toast" role="status">{children}</div>; }

export function SpineMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--spine)" />
      <path d="M16 5v22" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="16" cy="11" r="3" fill="#fff" />
      <circle cx="16" cy="21" r="3" fill="#fff" />
    </svg>
  );
}
