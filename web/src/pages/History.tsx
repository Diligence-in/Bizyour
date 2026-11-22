import { useInfiniteQuery } from '@tanstack/react-query';
import { History as HistoryIcon } from 'lucide-react';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Badge, Button, Empty, SkelRows } from '../components/ui';
import { PageHeader, usePageTitle } from '../components/shell/AppShell';

interface Entry { id: number; user_name: string; action: string; entity: string; summary: string; created_at: string }
const PAGE = 50;

export default function HistoryPage() {
  const { t } = useI18n();
  usePageTitle(t('History', 'हिस्ट्री', 'History'));
  const q = useInfiniteQuery({
    queryKey: ['audit'], initialPageParam: 0,
    queryFn: ({ pageParam }) => get<{ total: number; entries: Entry[] }>(`/api/audit?limit=${PAGE}&offset=${pageParam}`),
    getNextPageParam: (last, all) => { const n = all.reduce((s, p) => s + p.entries.length, 0); return n < last.total ? n : undefined; }
  });
  const rows = q.data?.pages.flatMap((p) => p.entries) || [];
  const act = (a: string) => a === 'delete' ? { tone: 'owed' as const, l: t('Deleted', 'हटाया', 'Hataya') } : a === 'create' ? { tone: 'in' as const, l: t('Added', 'जोड़ा', 'Joda') } : { tone: 'info' as const, l: t('Changed', 'बदला', 'Badla') };
  const when = (s: string) => { const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z'); return Number.isNaN(+d) ? s : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); };
  return (
    <div className="page">
      <PageHeader title={t('History', 'हिस्ट्री', 'History')} sub={t('Who did what in your shop — bills, edits, deletions. Only you can see this.', 'दुकान में किसने क्या किया — बिल, बदलाव, हटाना। सिर्फ़ आप देख सकते हैं।', 'Dukaan me kisne kya kiya — bill, badlav, hatana. Sirf aap dekh sakte ho.')} />
      <section className="panel">
        {q.isLoading ? <SkelRows rows={8} /> : !rows.length ? <Empty icon={<HistoryIcon size={28} />} title={t('Nothing here yet', 'अभी कुछ नहीं', 'Abhi kuch nahi')} body={t('Every bill, edit and deletion will be listed here.', 'हर बिल, बदलाव और हटाना यहाँ दिखेगा।', 'Har bill, badlav aur hatana yahan dikhega.')} /> : (
          <>
            {rows.map((e) => { const a = act(e.action); return (
              <div key={e.id} className="hist-row">
                <span className="hist-when">{when(e.created_at)}</span>
                <span className="hist-act"><Badge tone={a.tone}>{a.l}</Badge></span>
                <span className="grow" style={{ minWidth: 0 }}>{e.summary}<span className="muted"> · {e.user_name}</span></span>
              </div>); })}
            {q.hasNextPage && <div style={{ padding: 16, textAlign: 'center' }}><Button loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t('Show older', 'पुराना दिखाएं', 'Purana dikhao')}</Button></div>}
          </>
        )}
      </section>
    </div>
  );
}
