import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/landing.css';

// Public Privacy Policy for BizYour by DILIGENCE.
// Plain English, kept honest to what the product actually does:
// no data selling, no ad tracking, WhatsApp sharing is always
// started by the user, never sent by us on their behalf.

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy — BizYour by DILIGENCE';
    const c = document.querySelector('link[rel="canonical"]'); if (c) c.setAttribute('href', 'https://www.bizyour.in/privacy');
    const og = document.querySelector('meta[property="og:url"]'); if (og) og.setAttribute('content', 'https://www.bizyour.in/privacy');
  }, []);

  return (
    <div className="lp lp-legal-page">
      <header className="lp-legal-top">
        <Link to="/" className="lp-logo" aria-label="BizYour home">
          <img src="/bizyour-mark-512.png?v=c" alt="" width={30} height={30} />
          <span><b>BizYour</b><small>by DILIGENCE</small></span>
        </Link>
        <Link to="/" className="lp-legal-back"><ArrowLeft size={15} aria-hidden /> Back to home</Link>
      </header>

      <main className="lp-legal">
        <h1>Privacy Policy</h1>
        <p className="lp-legal-meta">Effective from 24 November 2026 · BizYour is a product of DILIGENCE, Delhi, India.</p>

        <p>This policy explains what information BizYour collects, why we collect it, and the choices you have. We have written it in plain language on purpose. If anything here is unclear, write to us at <a href="mailto:diligence.in@zohomail.in">diligence.in@zohomail.in</a> or call <a href="tel:+918506059604">+91 8506059604</a>.</p>

        <h2>1. What we collect</h2>
        <p><b>Account details.</b> Your name, email address and mobile number when you sign up. Your password is stored only as a secure hash — we cannot see it.</p>
        <p><b>Business details.</b> Your business name, category, address, PIN code, city, state and, if you choose to add it, your GSTIN and UPI QR code for your bills.</p>
        <p><b>Your business data.</b> The records you create while using BizYour: products and stock, bills and estimates, purchases, expenses, and the names and phone numbers of your customers and suppliers that you enter for udhaar and billing.</p>
        <p><b>Business Mart activity.</b> Requests you post, quotes you send or receive, orders, and chats with other businesses inside Business Mart.</p>
        <p><b>Technical details.</b> Basic device, browser and log information needed to run and secure the service, such as your IP address and the time of a request.</p>

        <h2>2. How we use it</h2>
        <p>We use this information only to run BizYour for you: to create and secure your account, send sign-in and verification (OTP) emails, show your business's records back to you, generate bills, reports and GST files, connect buyers and sellers on Business Mart, answer your support questions, prevent fraud and misuse, and meet our legal duties. We also look at overall, combined usage patterns — never your individual business records — to understand which features need improvement.</p>

        <h2>3. What we never do</h2>
        <p>We do not sell your personal or business data. We do not use it for advertising, and BizYour carries no advertising trackers. Your business's sales, stock and customer records are yours; other businesses cannot see them.</p>

        <h2>4. When information is shared</h2>
        <p><b>Service providers.</b> We use trusted providers for cloud hosting and email delivery so the app and your OTP emails work. They process data only to provide those services to us.</p>
        <p><b>Other BizYour businesses.</b> Only on Business Mart, and only because you chose to take part: your business profile, the requests you post, the quotes you send and your order chats are visible to the businesses you deal with.</p>
        <p><b>WhatsApp.</b> When you tap a share button, your bill or reminder opens in WhatsApp for you to send. That sending is done by you, through WhatsApp, under WhatsApp's own privacy policy. We do not send WhatsApp messages on your behalf.</p>
        <p><b>Legal reasons.</b> We may disclose information if the law requires it, or to protect the rights and safety of our users and the public.</p>

        <h2>5. Data you enter about your customers</h2>
        <p>When you add a customer's name, phone number or udhaar record, you are responsible for having the right to store it. We process that data only to provide the service to you — for example, to show the balance or to prepare a reminder that you send yourself. A customer's public Hisab link shows that customer only their own balance with your business.</p>

        <h2>6. Storage and security</h2>
        <p>Your data is stored on cloud servers with encryption in transit (HTTPS), hashed passwords and access controls that keep every business's data separate from every other business's. No system is perfectly secure, but we work to protect your information and to fix problems quickly when we find them.</p>

        <h2>7. How long we keep it</h2>
        <p>We keep your data while your account is active. If you delete your account yourself from the app (Settings → Data → Delete account), or ask us to delete it, we delete or anonymise your personal data within a reasonable period, except records we must keep by law (for example, tax and billing records) or to resolve disputes.</p>

        <h2>8. Your rights</h2>
        <p>Under India's Digital Personal Data Protection Act, 2023, you can ask us to show you the personal data we hold about you, correct it, or delete it. Much of this you can do yourself: your records are visible in the app, you can export or take a backup of your business data at any time, and the account owner can permanently delete the account and its data from Settings → Data → Delete account (the section above explains the few records the law may require us to keep). For anything else, contact us using the details below and we will respond within the time the law allows.</p>

        <h2>9. Cookies and local storage</h2>
        <p>BizYour uses only the storage your browser needs for the app to work — keeping you signed in, remembering your language and keeping the app usable offline. We do not use advertising or cross-site tracking cookies.</p>

        <h2>10. Who can use BizYour</h2>
        <p>BizYour is a business tool meant for adults running a business. It is not directed at children.</p>

        <h2>11. Changes to this policy</h2>
        <p>If we change this policy, we will post the new version on this page with a new effective date. If a change is significant, we will also let you know inside the app or by email.</p>

        <h2>12. Contact and grievances</h2>
        <p>DILIGENCE, Delhi, India<br />
        Email: <a href="mailto:diligence.in@zohomail.in">diligence.in@zohomail.in</a><br />
        Phone: <a href="tel:+918506059604">+91 8506059604</a></p>
        <p>For any privacy question or grievance, write to us on the email above and we will get back to you.</p>
      </main>

      <footer className="lp-legal-foot">
        <span>© 2026 BizYour by DILIGENCE</span>
        <Link to="/">bizyour.in</Link>
      </footer>
    </div>
  );
}
