import { useState } from 'react';
import { Markdown } from '../components/Markdown';
import decision from '@docs/DECISION.md?raw';
import plan from '@docs/CHANGE-AND-CULTURE-PLAN.md?raw';
import assumptions from '@docs/ASSUMPTIONS-AND-VERIFICATION.md?raw';
import request from '@docs/00-source-material-request.md?raw';
import readme from '@docs/README.md?raw';

const DOCS = [
  { id: 'decision', label: 'Decision and reasoning', file: 'DECISION.md', src: decision },
  { id: 'plan', label: 'Change and culture plan', file: 'CHANGE-AND-CULTURE-PLAN.md', src: plan },
  { id: 'assumptions', label: 'Assumptions to verify', file: 'ASSUMPTIONS-AND-VERIFICATION.md', src: assumptions },
  { id: 'request', label: 'Source material request', file: '00-source-material-request.md', src: request },
  { id: 'readme', label: 'How to run this', file: 'README.md', src: readme },
];

export function Docs() {
  const [id, setId] = useState('decision');
  const doc = DOCS.find((d) => d.id === id)!;
  return (
    <div className="docs">
      <nav className="docnav" aria-label="Documents">
        {DOCS.map((d) => <button key={d.id} aria-current={d.id === id} onClick={() => setId(d.id)}>{d.label}</button>)}
        <p className="small muted" style={{ padding: '0 0.65rem' }}>These are the same files as in the repository root.</p>
      </nav>
      <article className="panel" style={{ padding: 'clamp(1rem, 3vw, 2.25rem)' }}>
        <p className="small muted" style={{ marginTop: 0 }}>{doc.file}</p>
        <Markdown source={doc.src} />
      </article>
    </div>
  );
}
