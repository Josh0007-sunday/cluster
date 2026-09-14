import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId="cmu171saw00uk0dl01nt8litn"
      config={{
        loginMethods: ['email'],
        appearance: {
          theme: 'dark',
          accentColor: '#714fba',
          logo: 'https://cluster.finance/logo.png', // Or your default logo
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
