import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { Button, Field, Modal, Segmented, Select, useToast } from './ui';

// One importer for every screen that holds data (23 Nov: "an Import button
// wherever there is data"). Same backend pipeline everywhere:
// preview (writes nothing) → confirm → safety backup → one transaction.

export type ImportType = 'products' | 'customers' | 'suppliers' | 'expenses' | 'catalog';

interface Preview { total_rows: number; valid_count: number; duplicate_count: number; error_count: number; errors: { row: number; reason: string }[]; duplicates: { name: string }[]; sample: Record<string, unknown>[]; mapping: Record<string, string> }

/** sample files: the header row the importer understands, plus 2 example rows */
const SAMPLES: Record<ImportType, string> = {
  products: 'Name,Sell Price,Buy Price,Stock,GST %,Unit,Category,HSN\nAashirvaad Atta 5kg,295,270,40,5,pack,Staples,1101\nTata Salt 1kg,28,24,120,0,pack,Staples,2501\n',
  customers: 'Name,Phone,City,GSTIN,Opening Balance\nRamesh Gupta,9811024681,Delhi,,1470\nPriya Sharma,9899012345,Delhi,,0\n',
  suppliers: 'Name,Phone,City,Opening Balance\nFresh Supply Co,9810098100,Delhi,23750\nAnnapurna Rice Mills,9416012345,Karnal,0\n',
  expenses: 'Date,Title,Category,Amount,Payment Mode,Notes\n01-11-2026,Shop rent,Rent,15000,Bank,November rent\n05-11-2026,Electricity bill,Electricity,2340,UPI,\n',
  catalog: 'Name,Wholesale Price,Minimum Order,Unit,Category\nSona Masoori Rice,47.5,100,kg,Staples\nFortune Soya Oil 15L,1850,5,tin,Oil & Ghee\n'
};

const INVALIDATE: Record<ImportType, string[]> = {
  products: ['products', 'billing-products', 'alerts', 'dash-summary'],
  customers: ['customers', 'dash-summary', 'alerts'],
  suppliers: ['suppliers', 'alerts'],
  expenses: ['expenses', 'dash-finance', 'reports'],
  catalog: ['mart-my-listings']
};

function useTypeLabels() {
  const { t } = useI18n();
  return {
    products: t('Products', 'सामान', 'Saaman'),
    customers: t('Customers (with old udhaar)', 'ग्राहक (पुराने उधार के साथ)', 'Customers (purane udhaar ke saath)'),
    suppliers: t('Suppliers (with old dues)', 'सप्लायर (पुराने बकाया के साथ)', 'Suppliers (purane baaki ke saath)'),
    expenses: t('Expenses', 'खर्चे', 'Kharche'),
    catalog: t('Mart catalog (price list)', 'Mart catalog (भाव लिस्ट)', 'Mart catalog (bhaav list)')
  } as Record<ImportType, string>;
}

function downloadSample(type: ImportType) {
  const blob = new Blob(['﻿' + SAMPLES[type]], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bizyour-${type}-sample.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const toB64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => { const b = new Uint8Array(r.result as ArrayBuffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); res(btoa(s)); };
  r.onerror = rej; r.readAsArrayBuffer(f);
});

/** the import form itself — used inline in Settings and inside the dialog */
export function ImportForm({ types, initialType, onDone }: { types: ImportType[]; initialType?: ImportType; onDone?: () => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const labels = useTypeLabels();
  const [type, setType] = useState<ImportType>(initialType || types[0]);
  const [dup, setDup] = useState<'skip' | 'update'>('skip');
  const [file, setFile] = useState<File | null>(null); const [prev, setPrev] = useState<Preview | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState('');
  const reset = () => { setPrev(null); setPayload(null); setDone(''); setError(''); };
  const check = async () => {
    if (!file) { setError(t('Choose a CSV or Excel file first.', 'पहले CSV या Excel फ़ाइल चुनें।', 'Pehle CSV ya Excel file chuno.')); return; }
    if (/\.xls$/i.test(file.name)) { setError(t('Old .xls files are not supported — save as .xlsx or CSV.', 'पुरानी .xls फ़ाइल नहीं चलेगी — .xlsx या CSV में सेव करें।', 'Purani .xls file nahi chalegi — .xlsx ya CSV me save karo.')); return; }
    setBusy(true); reset();
    try {
      const xlsx = /\.xlsx$/i.test(file.name);
      const p: Record<string, unknown> = { content: xlsx ? await toB64(file) : await file.text(), duplicate: dup, ...(xlsx ? { format: 'xlsx' } : {}) };
      setPrev(await post<Preview>(`/api/import/${type}/preview`, p)); setPayload(p);
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!payload) return; setBusy(true);
    try {
      const r = await post<{ created: number; updated: number; skipped: number; error_count: number }>(`/api/import/${type}/commit`, { ...payload, duplicate: dup });
      INVALIDATE[type].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setPrev(null); setPayload(null);
      setDone(t(`Imported — ${r.created} new, ${r.updated} updated, ${r.skipped} skipped. A backup was saved first.`, `हो गया — ${r.created} नए, ${r.updated} अपडेट, ${r.skipped} छोड़े। पहले बैकअप बना लिया गया।`, `Ho gaya — ${r.created} naye, ${r.updated} update, ${r.skipped} chhode. Pehle backup bana liya gaya.`));
      toast({ text: t('Import done', 'इम्पोर्ट हो गया', 'Import ho gaya') });
      onDone?.();
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  const canUpdate = type !== 'expenses';
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="muted" style={{ margin: 0 }}>{t('Upload from Excel, CSV, Vyapar or Tally exports. Column names are matched for you. You see a preview first, and nothing changes until you confirm.', 'Excel, CSV, Vyapar या Tally की फ़ाइल डालें। कॉलम अपने आप मिल जाते हैं। पहले प्रिव्यू दिखेगा, पक्का करने तक कुछ नहीं बदलता।', 'Excel, CSV, Vyapar ya Tally ki file daalo. Column apne aap mil jaate hain. Pehle preview dikhega, pakka karne tak kuch nahi badalta.')}</p>
      <div className="form-3">
        {types.length > 1 && (
          <Field label={t('What are you importing?', 'क्या डाल रहे हैं?', 'Kya daal rahe ho?')}>{(id) => (
            <Select id={id} value={type} onChange={(e) => { setType(e.target.value as ImportType); reset(); }}>
              {types.map((x) => <option key={x} value={x}>{labels[x]}</option>)}
            </Select>)}</Field>
        )}
        {canUpdate && (
          <Field label={t('If it already exists', 'अगर पहले से है', 'Agar pehle se hai')}>{() => <Segmented label="dup" value={dup} onChange={(v) => { setDup(v); reset(); }} options={[{ value: 'skip', label: t('Skip', 'छोड़ें', 'Chhodo') }, { value: 'update', label: t('Update', 'अपडेट', 'Update') }]} />}</Field>
        )}
        <Field label={t('File', 'फ़ाइल', 'File')}>{(id) => <input id={id} className="input" type="file" accept=".csv,.tsv,.txt,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); reset(); }} />}</Field>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button loading={busy && !prev} icon={<FileSpreadsheet size={15} />} onClick={check}>{t('Check the file', 'फ़ाइल जाँचें', 'File jaanch lo')}</Button>
        <Button variant="ghost" icon={<Download size={15} />} onClick={() => downloadSample(type)}>{t('Download sample file', 'नमूना फ़ाइल डाउनलोड करें', 'Sample file download karo')}</Button>
      </div>
      {error && <div className="banner banner-owed" role="alert">{error}</div>}
      {done && <div className="banner banner-info" role="status">{done}</div>}
      {prev && (
        <div className="stack" style={{ gap: 12 }}>
          <div>{t('Rows', 'पंक्तियाँ', 'Rows')}: <b>{prev.total_rows}</b> · {t('Good', 'सही', 'Sahi')}: <b>{prev.valid_count}</b> · {t('Already there', 'पहले से हैं', 'Pehle se hain')}: <b>{prev.duplicate_count}</b> · {t('Problems', 'गलत', 'Galat')}: <b>{prev.error_count}</b></div>
          {prev.errors.slice(0, 6).map((e) => <div key={e.row} className="meta amt-neg">{t('Row', 'पंक्ति', 'Row')} {e.row}: {e.reason}</div>)}
          {!!prev.sample.length && (() => { const cols = Object.keys(prev.sample[0]).filter((k) => k !== 'row' && k !== 'duplicate'); return (
            <div className="table-wrap"><table className="table table-dense"><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{prev.sample.slice(0, 8).map((s, i) => <tr key={i}>{cols.map((c) => <td key={c}>{s[c] == null ? '' : String(s[c])}</td>)}</tr>)}</tbody></table></div>); })()}
          <div><Button variant="primary" loading={busy} disabled={!prev.valid_count} onClick={commit}>{t(`Import ${prev.valid_count} rows`, `${prev.valid_count} पंक्तियाँ डालें`, `${prev.valid_count} rows daalo`)}</Button></div>
        </div>
      )}
    </div>
  );
}

/** the Import button that sits in a page header — owner-only, opens in place */
export function ImportButton({ types, initialType, label, className = 'hide-mobile' }: { types: ImportType[]; initialType?: ImportType; label?: string; className?: string }) {
  const { t } = useI18n();
  const { can } = useSession();
  const [sp, setSp] = useSearchParams();
  // ?import=1 (Home → "Import data") opens the dialog straight away.
  const [open, setOpenRaw] = useState(() => sp.get('import') === '1');
  const setOpen = (v: boolean) => { setOpenRaw(v); if (!v && sp.get('import')) { sp.delete('import'); setSp(sp, { replace: true }); } };
  if (!can.owner) return null;
  const title = label || t('Import', 'इम्पोर्ट', 'Import');
  return (
    <>
      <Button className={className} icon={<Upload size={16} />} onClick={() => setOpen(true)}>{title}</Button>
      <Modal open={open} onClose={() => setOpen(false)} label={title} className="modal-import">
        <div className="import-modal">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('Import your data', 'अपना डेटा इम्पोर्ट करें', 'Apna data import karo')}</h2>
            <button type="button" className="icon-btn icon-btn-sm" aria-label={t('Close', 'बंद', 'Band')} onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
          <ImportForm types={types} initialType={initialType} />
        </div>
      </Modal>
    </>
  );
}
