import { useId } from 'react';
import { ImagePlus, Store } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { prepLogo, prepPhoto } from '../lib/images';

/** One optional shop image (logo or shop photo) with preview, change and remove. */
export function ShopImagePick({ kind, value, onChange, onError, shopName, disabled }: {
  kind: 'logo' | 'photo'; value: string | null; onChange: (v: string | null) => void; onError: (msg: string) => void; shopName?: string; disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const initial = (shopName || '').trim()[0]?.toUpperCase() || '';
  const pick = async (file?: File) => {
    if (!file) return;
    try { onChange(kind === 'logo' ? await prepLogo(file) : await prepPhoto(file)); }
    catch { onError(t('That file is not an image. Choose a photo (JPG or PNG).', 'यह फ़ाइल तस्वीर नहीं है। JPG या PNG फ़ोटो चुनें।', 'Ye file tasveer nahi hai. JPG ya PNG photo chuno.')); }
  };
  const title = kind === 'logo' ? t('Shop logo', 'दुकान का लोगो', 'Dukaan ka logo') : t('Photo of your shop', 'दुकान की फ़ोटो', 'Dukaan ki photo');
  const hint = kind === 'logo'
    ? t('Prints on every bill. Without one, the bill shows your shop’s first letter.', 'हर बिल पर छपेगा। न हो तो बिल पर दुकान का पहला अक्षर दिखेगा।', 'Har bill pe chhapega. Na ho to bill pe dukaan ka pehla akshar dikhega.')
    : t('The shopfront or counter. Helps customers and wholesalers recognise you.', 'दुकान का सामने का हिस्सा या काउंटर। ग्राहक और थोक वाले पहचान पाएंगे।', 'Dukaan ka saamne ka hissa ya counter. Customer aur wholesaler pehchaan payenge.');
  return (
    <div className={`sip sip-${kind}`}>
      <div className="sip-preview" aria-hidden={!value}>
        {value ? <img src={value} alt={title} /> : kind === 'logo'
          ? (initial ? <span className="sip-initial">{initial}</span> : <Store size={22} />)
          : <ImagePlus size={22} />}
      </div>
      <div className="sip-body">
        <b>{title}</b>
        <span className="sip-hint">{hint}</span>
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <label htmlFor={id} className={`btn btn-secondary btn-sm ${disabled ? 'is-disabled' : ''}`} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <ImagePlus size={14} /> {value ? t('Change', 'बदलें', 'Badlo') : t('Upload', 'डालें', 'Upload')}
          </label>
          <input id={id} type="file" accept="image/png,image/jpeg,image/*" hidden disabled={disabled} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          {value && !disabled && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>{t('Remove', 'हटाएं', 'Hatao')}</button>}
        </div>
      </div>
    </div>
  );
}
