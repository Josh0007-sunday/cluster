import { useEffect, useState } from 'react';
import { setConnectedWallet, truncate, useWallet } from '../../hooks/useWallet';
import ConnectModal from './ConnectModal';
import { usePrivy } from '@privy-io/react-auth';

export default function WalletButton({ onNavigatePortfolio }: { onNavigatePortfolio?: () => void }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const { logout, authenticated } = usePrivy();

  useEffect(() => {
    const onRequest = () => setOpen(true);
    window.addEventListener('cluster:connect-request', onRequest);
    return () => window.removeEventListener('cluster:connect-request', onRequest);
  }, []);

  if (wallet) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigatePortfolio?.()}
          title={`${wallet.label} ${wallet.address}`}
          className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-base font-medium text-white hover:bg-card-hover transition-colors"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${wallet.demo ? 'bg-amber-400' : 'bg-green-400'}`} />
          {wallet.demo ? 'Demo' : truncate(wallet.address)}
        </button>
        <button
          onClick={() => {
            setConnectedWallet(null);
            if (authenticated) logout();
          }}
          className="rounded-2xl border border-border bg-card px-4 py-2.5 text-base font-medium text-text-muted hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-white px-6 py-2.5 text-base font-semibold text-bg transition hover:bg-white/90 active:scale-[0.98]"
      >
        Connect
      </button>
      <ConnectModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
