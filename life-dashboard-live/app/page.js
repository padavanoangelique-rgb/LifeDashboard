'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import OverviewSection from './components/sections/OverviewSection';
import GuardianSection from './components/sections/GuardianSection';
import MajesticSection from './components/sections/MajesticSection';
import NutritionSection from './components/sections/NutritionSection';
import BillsSection from './components/sections/BillsSection';
import FinanceSection from './components/sections/FinanceSection';
import PortfolioSection from './components/sections/PortfolioSection';
import GoalsSection from './components/sections/GoalsSection';

// Tab order matches the person's stated "assumed daily priority."
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'guardian', label: 'Guardian Permits' },
  { key: 'majestic', label: 'Majestic Permits' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'bills', label: 'Bills' },
  { key: 'finance', label: 'Finance' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'goals', label: 'Personal Goals' }
];

export default function Home() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [tab, setTab] = useState('overview');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) router.push('/login');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (!sess) router.push('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (session === undefined) return <div className="empty">Loading…</div>;
  if (!session) return null; // redirect in flight

  return (
    <>
      <header>
        <h1>🏠 My Life Dashboard</h1>
        <div className="btn-row no-print">
          <button className="small" onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <nav className="tabs no-print">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'overview' && <OverviewSection onNavigate={setTab} />}
        {tab === 'guardian' && <GuardianSection />}
        {tab === 'majestic' && <MajesticSection />}
        {tab === 'nutrition' && <NutritionSection />}
        {tab === 'bills' && <BillsSection />}
        {tab === 'finance' && <FinanceSection />}
        {tab === 'portfolio' && <PortfolioSection />}
        {tab === 'goals' && <GoalsSection />}
      </main>
      <footer className="no-print">My Life Dashboard</footer>
    </>
  );
}
