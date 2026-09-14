import { useState } from 'react';
import Navbar, { type Tab } from './components/layout/Navbar';
import PriceTicker from '@/components/price/PriceTicker';
import BridgeCard from './components/bridge/BridgeCard';
import SwapCard from './components/swap/SwapCard';
import EarnCard from './components/earn/EarnCard';
import StockCard from './components/stocks/StockCard';
import PortfolioCard from './components/portfolio/PortfolioCard';
import LandingHero from './components/landing/LandingHero';
import { ShaderBackground } from '@/components/ui/willzoshader';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [view, setView] = useState<'landing' | 'main'>('landing');
  const [tab, setTab] = useState<Tab>('Bridge');

  return (
    <div className="min-h-screen bg-bg text-text">
      {view === 'landing' ? (
        <LandingHero onEnterApp={() => setView('main')} />
      ) : (
        <div className="relative min-h-screen">
          <ShaderBackground className="absolute inset-0 z-0 pointer-events-none" />
          <div className="relative z-10">
            <Navbar active={tab} onChange={setTab} onHome={() => setView('landing')} />
            <PriceTicker />

            <main className={`mx-auto px-4 pt-8 pb-20 ${tab === 'Stocks' || tab === 'Portfolio' ? 'max-w-6xl' : 'max-w-5xl'}`}>
              {tab === 'Bridge' && <BridgeCard />}
              {tab === 'Swap' && <SwapCard />}
              {tab === 'Invest' && <EarnCard />}
              {tab === 'Stocks' && <StockCard />}
              {tab === 'Portfolio' && <PortfolioCard />}
            </main>
            <Toaster position="bottom-right" toastOptions={{ style: { background: '#1c2427', color: '#fff', border: '1px solid #263035' } }} />
          </div>
        </div>
      )}
    </div>
  );
}
