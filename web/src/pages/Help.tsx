import { useQuery } from '@tanstack/react-query';
import { MessageCircle, PlayCircle } from 'lucide-react';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { PageHeader, usePageTitle } from '../components/shell/AppShell';

export default function HelpPage() {
  const { t } = useI18n();
  usePageTitle(t('Help', 'मदद', 'Help'));
  const q = useQuery({ queryKey: ['help'], queryFn: () => get<{ support_link: string; help_video_url: string }>('/api/help') });
  const faqs: [string, string][] = [
    [t('How do I make a bill?', 'बिल कैसे बनाऊँ?', 'Bill kaise banau?'), t('Open Sell → New bill (or press N). Pick the customer, tap products to add them, enter what they paid, and save. Anything unpaid becomes udhaar.', 'Sell → नया बिल खोलें (या N दबाएं)। ग्राहक चुनें, सामान जोड़ें, जो पैसा मिला वो डालें और सेव करें। जो बाकी रहा वो उधार बन जाता है।', 'Sell → Naya bill kholo (ya N dabao). Customer chuno, saaman jodo, jo paisa mila woh daalo aur save karo. Jo baaki raha woh udhaar ban jata hai.')],
    [t('A customer paid me later. Where do I record it?', 'ग्राहक ने बाद में पैसे दिए, कहाँ लिखूँ?', 'Customer ne baad me paise diye, kahan likhun?'), t('Open the customer under Collect and record a payment. It is matched to their oldest unpaid bills first.', 'Collect में ग्राहक खोलें और पेमेंट दर्ज करें। यह उनके सबसे पुराने बकाया बिलों में लगता है।', 'Collect me customer kholo aur payment darj karo. Yeh unke sabse purane baaki bills me lagta hai.')],
    [t('How do I add stock I bought?', 'खरीदा हुआ माल कैसे जोड़ूँ?', 'Khareeda hua maal kaise jodun?'), t('Use Stock → Purchases → Record purchase. Stock goes up automatically and what you still owe the supplier is tracked.', 'Stock → Purchases → खरीद दर्ज करें। Stock अपने आप बढ़ता है और सप्लायर को जो देना है उसका हिसाब रहता है।', 'Stock → Purchases → Khareed likho. Stock apne aap badhta hai aur supplier ko jo dena hai uska hisab rehta hai.')],
    [t('What is an estimate?', 'एस्टीमेट क्या है?', 'Estimate kya hai?'), t('A quotation. It does not change stock or udhaar. When the customer agrees, open it and press Make bill.', 'कोटेशन। इससे stock या उधार नहीं बदलता। ग्राहक मान जाए तो खोलकर "बिल बनाएं" दबाएं।', 'Quotation. Isse stock ya udhaar nahi badalta. Customer maan jaye to kholkar "Bill banao" dabao.')],
    [t('How do I turn GST on?', 'GST कैसे चालू करूँ?', 'GST kaise chalu karun?'), t('Settings → Shop → "My shop charges GST", then enter your GSTIN. Add HSN codes on your products so GSTR-1 is ready to file.', 'Settings → दुकान → "मेरी दुकान GST लेती है", फिर GSTIN डालें। GSTR-1 के लिए सामान में HSN code भरें।', 'Settings → Dukaan → "Meri dukaan GST leti hai", phir GSTIN daalo. GSTR-1 ke liye saaman me HSN code bharo.')],
    [t('Can my staff use it?', 'क्या मेरा स्टाफ़ इस्तेमाल कर सकता है?', 'Kya mera staff use kar sakta hai?'), t('Yes. Settings → Staff. Give each person their own login: billing only, stock only, or both. Reports, expenses and history stay with you.', 'हाँ। Settings → स्टाफ़। हर व्यक्ति को अपना लॉगिन दें: सिर्फ़ बिलिंग, सिर्फ़ stock, या दोनों। रिपोर्ट, खर्चा और हिस्ट्री आपके पास रहते हैं।', 'Haan. Settings → Staff. Har vyakti ko apna login do: sirf billing, sirf stock, ya dono. Report, kharcha aur history aapke paas rehte hain.')],
    [t('Is my data safe?', 'क्या मेरा डेटा सुरक्षित है?', 'Kya mera data surakshit hai?'), t('It is backed up automatically. You can also back up on demand, download your data, and restore an earlier backup from Settings → Data.', 'यह अपने आप बैकअप होता है। Settings → डेटा से आप खुद बैकअप ले सकते हैं, डेटा डाउनलोड कर सकते हैं और पुराना बैकअप वापस ला सकते हैं।', 'Yeh apne aap backup hota hai. Settings → Data se aap khud backup le sakte ho, data download kar sakte ho aur purana backup wapas la sakte ho.')],
    [t('What is free and what is paid?', 'क्या फ्री है और क्या पेड?', 'Kya free hai aur kya paid?'), t('Business Mart is free, always. Workspace starts with a 30-day free trial; after that you choose a plan. If a plan ends, your data stays and you can still view it.', 'Business Mart हमेशा फ्री है। Workspace 30 दिन के फ्री ट्रायल से शुरू होता है; फिर आप प्लान चुनते हैं। प्लान खत्म हो तो डेटा रहता है और आप देख सकते हैं।', 'Business Mart hamesha free hai. Workspace 30 din ke free trial se shuru hota hai; phir aap plan chunte ho. Plan khatam ho to data rehta hai aur aap dekh sakte ho.')]
  ];
  return (
    <div className="page">
      <PageHeader title={t('Help', 'मदद', 'Help')} sub={t('Quick answers. Still stuck? Message us.', 'छोटे जवाब। फिर भी अटके हैं? हमें लिखें।', 'Chhote jawab. Phir bhi atke ho? Humein likho.')}
        actions={<>
          {q.data?.help_video_url && <a className="btn btn-secondary" href={q.data.help_video_url} target="_blank" rel="noreferrer noopener"><PlayCircle size={16} /> {t('Watch the video', 'वीडियो देखें', 'Video dekho')}</a>}
          {q.data?.support_link && <a className="btn btn-primary" href={q.data.support_link} target="_blank" rel="noreferrer noopener"><MessageCircle size={16} /> {t('Chat on WhatsApp', 'WhatsApp पर बात करें', 'WhatsApp par baat karo')}</a>}
        </>} />
      <section className="panel" style={{ maxWidth: 760 }}><div className="panel-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {faqs.map(([q1, a]) => <details key={q1} className="faq"><summary>{q1}</summary><p>{a}</p></details>)}
      </div></section>
      <p className="muted" style={{ marginTop: 16 }}>{t('BizYour by DILIGENCE · thediligence.in', 'BizYour by DILIGENCE · thediligence.in', 'BizYour by DILIGENCE · thediligence.in')}</p>
    </div>
  );
}
