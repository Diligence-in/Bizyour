import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { Button, useToast } from './ui';
import { download } from '../lib/api';
import { useI18n } from '../lib/i18n';

type Extra = { label: string; path: string; file: string; icon?: ReactNode };

/** One Export button that offers CSV, Excel and PDF (plus optional extra files, e.g. a JSON portal file). */
export function ExportMenu({ path, name, label, size, extras = [] }: { path: string; name: string; label?: string; size?: 'sm' | 'md'; extras?: Extra[] }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const go = async (p: string, file: string) => {
    setOpen(false); setBusy(true);
    try { await download(p, file); } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
  };
  const withFmt = (f: string) => `${path}${path.includes('?') ? '&' : '?'}format=${f}`;
  const items: Extra[] = [
    { label: t('Excel (.xlsx)', 'Excel (.xlsx)', 'Excel (.xlsx)'), path: withFmt('xlsx'), file: `${name}.xlsx`, icon: <FileSpreadsheet size={16} /> },
    { label: t('PDF', 'PDF', 'PDF'), path: withFmt('pdf'), file: `${name}.pdf`, icon: <FileText size={16} /> },
    { label: t('CSV', 'CSV', 'CSV'), path: withFmt('csv'), file: `${name}.csv`, icon: <Table2 size={16} /> },
    ...extras
  ];
  return (
    <div className="export-menu" ref={box}>
      <Button size={size} icon={<Download size={size === 'sm' ? 14 : 16} />} loading={busy} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label || t('Export', 'एक्सपोर्ट', 'Export')} <ChevronDown size={14} aria-hidden />
      </Button>
      {open && (
        <div className="export-pop" role="menu">
          {items.map((it) => (
            <button key={it.file} type="button" role="menuitem" className="export-item" onClick={() => go(it.path, it.file)}>{it.icon}{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
