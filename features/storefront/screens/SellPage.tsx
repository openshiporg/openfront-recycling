import Link from 'next/link';
import { getYardRules, getYards } from '../lib/data/public';
import { IconCash, IconLaptopCheck, IconQr, IconTruckScale } from '../components/icons';
import { PageHead } from '../components/ui';
import { PaymentFacts, WhatToBring } from './RulesPage';

/** P10: how selling works, and the way into check-in. */
export default async function SellPage() {
  const yardsR = await getYards();
  const yards = yardsR.ok ? yardsR.data : [];
  const rulesR = yards[0] ? await getYardRules(yards[0].slug) : null;
  const rules = rulesR?.ok ? rulesR.data : null;
  return (
    <>
      <PageHead title="Sell your scrap" crumbs={[{ href: '/', label: 'Home' }, { label: 'Sell scrap' }]} lead="Check in online before you drive over. Your details are ready at the scale, so the window takes minutes, not a queue.">
        <div className="sf-cluster" style={{ marginTop: 20 }}>
          <Link className="sf-btn sf-btn-light" href="/sell/check-in">Check in now</Link>
          <Link className="sf-btn sf-btn-ghost" style={{ color: 'var(--sf-on-rust)', borderColor: 'var(--sf-on-rust)' }} href="/prices">Today’s prices</Link>
        </div>
      </PageHead>
      <div className="sf-wrap sf-section sf-stack">
        <ol className="sf-steps" style={{ marginBottom: 12 }}>
          <li className="sf-step"><IconLaptopCheck size={64} /><h3>1. Your details, once</h3><p>Create an account and add your ID and vehicle. You do this once.</p></li>
          <li className="sf-step"><IconQr size={64} /><h3>2. Check in</h3><p>Choose the yard and day and what you’re bringing. You get a scale pass.</p></li>
          <li className="sf-step"><IconTruckScale size={64} /><h3>3. At the scale</h3><p>Show the pass. We weigh your load, unload, and weigh the empty vehicle.</p></li>
          <li className="sf-step"><IconCash size={64} /><h3>4. Get paid</h3><p>Each material is graded and priced at today’s posted price. Your ticket shows every line.</p></li>
        </ol>
        {rules ? (
          <div className="sf-grid sf-grid-2">
            <section className="sf-card"><h2 className="sf-h3" style={{ marginBottom: 10 }}>What to bring{yards.length > 1 ? ` to ${rules.yardName}` : ''}</h2><WhatToBring rules={rules} /></section>
            <section className="sf-card"><h2 className="sf-h3" style={{ marginBottom: 10 }}>How you get paid</h2><PaymentFacts rules={rules} /></section>
          </div>
        ) : null}
        <div className="sf-grid sf-grid-3">
          <Link className="sf-bizlink" href="/calculator"><div><strong>Estimate your load</strong><span>See what today’s prices come to</span></div></Link>
          <Link className="sf-bizlink" href="/rules"><div><strong>Selling rules</strong><span>ID, payment, and items with special rules</span></div></Link>
          <Link className="sf-bizlink" href="/track"><div><strong>Find a receipt</strong><span>With the number and code on your ticket</span></div></Link>
        </div>
        <p className="sf-muted">No account? You can still sell at the window with your ID. Checking in online is quicker. Large amounts or regular loads? <Link className="sf-link" href="/commercial">Open a business account</Link> or <Link className="sf-link" href="/pickup">ask us to pick it up</Link>.</p>
      </div>
    </>
  );
}
