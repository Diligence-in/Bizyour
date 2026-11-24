import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/landing.css';

// Public Terms of Service for BizYour by DILIGENCE.
// Plain English, kept honest to what the product actually does:
// 30-day trial from Workspace activation, no card and no auto-charge,
// Business Mart deals are contracts between the two businesses only.
//
// NOTE (next dist build): wire this page in App.tsx with
//   import Terms from './pages/Terms';
//   <Route path="/terms" element={<Terms />} />
// and add a "Terms of Service" link next to the Privacy link in the
// landing footer. Until then, the same text is served as a static
// page at /terms.html from web/dist.

export default function Terms() {
  useEffect(() => { document.title = 'Terms of Service — BizYour by DILIGENCE'; }, []);

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
        <h1>Terms of Service</h1>
        <p className="lp-legal-meta">Effective from 25 November 2026 · BizYour is a product of DILIGENCE, Delhi, India.</p>

        <p>These terms are an agreement between you and DILIGENCE (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for the use of BizYour at bizyour.in and in the BizYour app. By creating an account or using BizYour, you agree to these terms. If you do not agree, please do not use BizYour. We have written them in plain language on purpose. If anything is unclear, write to us at <a href="mailto:diligence.in@zohomail.in">diligence.in@zohomail.in</a> or call <a href="tel:+918506059604">+91 8506059604</a>. How we handle your information is described in our <Link to="/privacy">Privacy Policy</Link>.</p>

        <h2>1. What BizYour is</h2>
        <p>BizYour is a software service for Indian businesses with two parts under one account: <b>Workspace</b> — billing, stock, udhaar, expenses, reports and GST-ready records for your own business — and <b>Business Mart</b> — a B2B bazaar where businesses find each other, send inquiries and quotes, and place orders. BizYour is a tool. Your business, your records and your decisions remain yours, and running your business lawfully remains your responsibility.</p>

        <h2>2. Who can use BizYour</h2>
        <p>BizYour is for business use. You must be at least 18 years old and have the authority to act for the business you register. The details you give us — business name, category, address, and your GSTIN if you add one — must be accurate, because they appear on your bills and your Business Mart profile.</p>

        <h2>3. Your account</h2>
        <p>You sign up with an email address and a mobile number. Business Mart buying opens with your account; Workspace opens after you submit your business details. The account owner is responsible for the account, for the staff access the owner creates, and for keeping the password safe. Tell us promptly if you believe your account has been compromised. One business should use one account unless we agree otherwise.</p>

        <h2>4. Free trial</h2>
        <p>Workspace comes with a free trial of 30 days, starting when you activate your Workspace by submitting your business details. Business Mart buying is free. We do not take your card for the trial and we never auto-charge you. When the trial ends, a paid plan is needed to keep adding and changing records; your existing data stays visible to you in a read-only mode, as described in the app, so nothing is held hostage.</p>

        <h2>5. Paid plans, payment and refunds</h2>
        <p>Plan prices are shown in the app in Indian Rupees at the time of purchase, for the period shown, with taxes extra as shown or as applicable. A plan becomes active when your payment is confirmed through the payment methods offered in the app. If a payment fails or is reversed, the plan may be paused. Fees for a period that has already started are not refundable, except where the law requires it or where we were unable to provide the service — in that case we will refund the unused part of the period. If we change prices, the new prices apply only from your next period and will be shown in the app before you pay.</p>

        <h2>6. Your data and your responsibilities</h2>
        <p>The records you create in BizYour — products, bills, customers, suppliers, udhaar — are your data. You are responsible for their correctness. In particular: BizYour helps you prepare bills and GST-ready reports, but it is not a chartered accountant or tax advisor; filing your returns and meeting your tax duties remain your responsibility. You must have the right to store the customer and supplier details you enter. You can export or back up your business data from the app at any time. If the account is deleted, data is handled as described in the Privacy Policy.</p>

        <h2>7. Business Mart rules</h2>
        <p>Business Mart introduces businesses to each other. Any inquiry, quote, order or deal on Business Mart is a contract between the buyer business and the seller business only. DILIGENCE is not a party to it: we do not buy or sell goods, and we do not guarantee quality, quantity, price, payment or delivery. Please check the other business before you deal with it, as you would in any bazaar. Badges, ratings and &ldquo;verified&rdquo; markers are information aids based on the details in the app; they are not a guarantee or an endorsement by us. On Business Mart you must not post fake inquiries, orders or reviews, impersonate another business (including by using another business&rsquo;s GSTIN), post misleading listings, or spam other businesses. We may remove content or restrict Business Mart access for violations.</p>

        <h2>8. Acceptable use</h2>
        <p>Do not use BizYour to break the law, infringe anyone&rsquo;s rights, upload harmful code, probe or attack the service or other accounts, scrape or bulk-collect other businesses&rsquo; data, resell access without our permission, or send spam. Sharing on WhatsApp from BizYour is always done by you, from your own WhatsApp account.</p>

        <h2>9. Availability and changes to the service</h2>
        <p>We work to keep BizYour available and fast, but we do not promise uninterrupted service; maintenance, internet or provider problems can interrupt it. We may improve, change or retire features. If a change removes a core feature of a paid plan during a period you have paid for, we will handle it fairly, including a refund of the unused part where appropriate.</p>

        <h2>10. Intellectual property</h2>
        <p>The BizYour software, name and logo belong to DILIGENCE. These terms give you the right to use the service for your own business — nothing more. Your data, and your business&rsquo;s own name and marks, remain yours. If you give us feedback or suggestions, we may use them without payment.</p>

        <h2>11. Suspension and ending the service</h2>
        <p>You may stop using BizYour at any time; the account owner can permanently delete the account and its data from Settings &rarr; Data &rarr; Delete account. We may suspend or limit an account that breaks these terms, does not pay, or creates a legal or security risk. Where it is practical, we will warn you first; for serious misuse we may act immediately. Sections of these terms that should reasonably survive — payments due, liability, governing law — continue after the service ends.</p>

        <h2>12. Liability</h2>
        <p>Within what the law allows, BizYour is provided &ldquo;as is&rdquo;. We are not liable for indirect losses such as lost profit or lost business, or for deals between businesses on Business Mart. Our total liability for any claim connected with BizYour is limited to the fees you paid us in the three months before the claim arose, or &#8377;1,000 if you paid nothing. Nothing in these terms limits a liability that Indian law does not allow to be limited.</p>

        <h2>13. Changes to these terms</h2>
        <p>If we change these terms, we will post the new version on this page with a new effective date. If a change is significant, we will also let you know inside the app or by email. Continuing to use BizYour after the effective date means you accept the new terms.</p>

        <h2>14. Governing law</h2>
        <p>These terms are governed by the laws of India. Disputes will be subject to the courts of Delhi, India.</p>

        <h2>15. Contact and grievances</h2>
        <p>DILIGENCE, Delhi, India<br />
        Email: <a href="mailto:diligence.in@zohomail.in">diligence.in@zohomail.in</a><br />
        Phone: <a href="tel:+918506059604">+91 8506059604</a></p>
        <p>For any question about these terms, write to us on the email above and we will get back to you.</p>
      </main>

      <footer className="lp-legal-foot">
        <span>© 2026 BizYour by DILIGENCE</span>
        <Link to="/">bizyour.in</Link>
      </footer>
    </div>
  );
}
