// Minimal, safe markdown renderer for the repo's own docs: builds React elements, never injects HTML.
import type { ReactNode } from 'react';

let onDocLink: ((file: string) => void) | null = null;

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{inline(m[2], i)}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={k}>{m[4]}</code>);
    else if (m[5]) {
      const href = m[6];
      const safe = /^(https?:|#|\.\/|\.\.\/|[\w-]+\.md)/.test(href);
      const md = /^(\.\/)?([\w-]+\.md)$/.exec(href);
      out.push(safe && /^https?:/.test(href) ? <a key={k} href={href} target="_blank" rel="noreferrer">{m[5]}</a>
        : md && onDocLink ? <a key={k} href={`#/docs`} onClick={(ev) => { ev.preventDefault(); onDocLink?.(md[2]); }}>{m[5]}</a>
        : <span key={k} className="muted">{m[5]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, onLink }: { source: string; onLink?: (file: string) => void }) {
  onDocLink = onLink ?? null;
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const body: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++}><code>{body.join('\n')}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const content = inline(h[2]);
      blocks.push(lvl === 1 ? <h1 key={k++}>{content}</h1> : lvl === 2 ? <h2 key={k++}>{content}</h2> : <h3 key={k++}>{content}</h3>);
      i++; continue;
    }
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={k++} />); i++; continue; }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <table key={k++}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    if (line.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={k++}>{inline(body.join(' '))}</blockquote>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const indent = /^\s*/.exec(lines[i])![0].length;
        const text = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        if (indent >= 2 && items.length) items[items.length - 1].sub.push(text); else items.push({ text, sub: [] });
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items[items.length - 1].text += ' ' + lines[i].trim(); i++; }
      }
      const lis = items.map((it, j) => <li key={j}>{inline(it.text)}{it.sub.length > 0 && <ul>{it.sub.map((s, q) => <li key={q}>{inline(s)}</li>)}</ul>}</li>);
      blocks.push(ordered ? <ol key={k++}>{lis}</ol> : <ul key={k++}>{lis}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||>|```|\s*([-*]|\d+\.)\s+|---+$)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{inline(para.join(' '))}</p>);
  }
  return <div className="md">{blocks}</div>;
}
