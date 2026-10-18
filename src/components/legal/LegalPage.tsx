import { useEffect, type ReactNode } from 'react';
import './legal.css';

// /privacy and /terms. Plain-language first drafts; have counsel review before
// relying on them. Update UPDATED when the text changes.

const UPDATED = 'October 18, 2026';
const CONTACT = 'salesteam@magpollo.com';

function Page({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · VVS Lab`;
  }, [title]);
  return (
    <main className="legal">
      <a className="legal__home" href="/">VVS Lab</a>
      <h1>{title}</h1>
      <p className="legal__meta">Last updated {UPDATED}</p>
      {children}
      <p className="legal__meta">Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy">
      <p>VVS Lab is a design tool made by Magpollo. Jewelry shops use it so their customers can design custom grillz, see a price and get a studio photo of the design. This page explains what happens to your information when you use a shop's builder, and when a shop uses VVS Lab.</p>

      <h2>If you design a set in a shop's builder</h2>
      <p><strong>The shop is in charge of your information.</strong> You're sending your design to that shop. We store and deliver it for them, and we don't sell it or use it to contact you ourselves.</p>
      <p>What we collect when you send a design:</p>
      <ul>
        <li>Your name, Instagram handle or phone number, and email if you give one</li>
        <li>Your note to the shop, your design choices and the estimate</li>
        <li>An image of your 3D design, and the AI studio photo made from it</li>
        <li>Where you came from (for example the shop's Instagram link or website), but not your browsing history</li>
        <li>A scrambled (hashed) version of your IP address, and a check from Cloudflare Turnstile, used only to stop spam</li>
      </ul>
      <p>We also measure how the builder is used (pages viewed, steps completed) with PostHog, to improve it and to show shops how their builder is doing. We don't use advertising trackers.</p>
      <p><strong>Who receives it:</strong> the shop you sent it to. To run the service we use Supabase (database and file storage), Vercel (hosting), Resend (email), Black Forest Labs (the AI that makes the studio photo, which receives only the image of your design), Cloudflare (spam protection) and PostHog (usage measurement). Each handles the information only to provide its service.</p>
      <p><strong>Texts:</strong> we don't text you. If a shop adds text messages later, we'll ask for your permission first.</p>
      <p><strong>How long we keep it:</strong> 24 months, then it's deleted. If the shop stops using VVS Lab, it's deleted 90 days later.</p>
      <p><strong>Deleting your information:</strong> ask the shop, or email us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with the shop's name and the contact you used. Your design, photo and notes are deleted for good.</p>
      <p><strong>The photo is AI-generated.</strong> It shows your design, but the finished piece is handmade and may vary.</p>

      <h2>If you run a shop on VVS Lab</h2>
      <p>We keep your account email, your team members' emails, your shop settings and their history, and the design requests your customers send. We use them to run your builder, deliver your leads and support you. We don't sell them or share them with other shops. You can download everything from your dashboard (Team → Your data) at any time.</p>

      <h2>Children</h2>
      <p>VVS Lab isn't meant for anyone under 13, and we don't knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this page in a way that matters, we'll update the date above and tell shops by email.</p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Terms for jewelers">
      <p>These terms cover shops that use VVS Lab, the custom grillz builder made by Magpollo (“we”). By setting up a shop you agree to them.</p>

      <h2>The service</h2>
      <ul>
        <li>A builder at your own link (and optionally your own domain or website) where customers design grillz with your options and prices.</li>
        <li>Each design request delivered to your inbox and dashboard with the design, a 3D image, an AI studio photo and the customer's contact.</li>
        <li>A monthly allowance of AI photos, set by your plan. When it runs out, customers still send designs and see the 3D image instead of a photo.</li>
      </ul>

      <h2>Price</h2>
      <p>$199 a month, unless we've agreed something else in writing. Founding shops keep their price for 12 months. You can cancel any time; the service runs to the end of the period you've paid for.</p>
      <p>Shops that sign up on their own get a 14-day free trial. You don't need a card to start. If you add one during the trial, you're not charged until the trial ends, and you can cancel before then to pay nothing. After that the plan renews every month until you cancel. If the trial ends without a plan, your page stops taking designs until you start one.</p>

      <h2>Your part</h2>
      <ul>
        <li>Prices, quotes, deposits, production and delivery are between you and your customer. The builder's estimate is based on the prices you set, and you confirm the final price.</li>
        <li>Keep your prices and options up to date, and reply to customers who send you designs.</li>
        <li>Don't use the builder to collect information for anything other than quoting and making the customer's order, and don't upload content you don't have the rights to.</li>
        <li>Tell your customers that studio photos are AI-generated from their design. The builder already says so.</li>
      </ul>

      <h2>Customer information</h2>
      <p>Your customers' information belongs to you. We process it only to run the builder and deliver your leads, following your instructions and the <a href="/privacy">privacy page</a>. We keep it secure, limit access to the people who need it to support you, use the service providers listed on the privacy page, delete it after 24 months by default, and help you respond if a customer asks to see or delete their information.</p>

      <h2>Leaving</h2>
      <p>If you cancel or we close your shop, your page stops taking designs. You can still download your leads for 90 days; then they're deleted. Your link is never given to another shop.</p>

      <h2>Availability</h2>
      <p>We work to keep the builder running and fix problems quickly, but we can't promise it will never be down. If something breaks, we'll tell you what happened.</p>

      <h2>Limits</h2>
      <p>The service is provided as it is. Our total responsibility for any claim is limited to what you paid us in the 3 months before it. Neither side is responsible for indirect losses such as lost profits.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If a change matters, we'll email you at least 30 days before it takes effect.</p>
    </Page>
  );
}
