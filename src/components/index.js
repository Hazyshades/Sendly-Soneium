import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { PaymasterProvider } from './PaymasterProvider';
import { WagmiConfig, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { coinbaseWallet, metaMask } from 'wagmi/connectors';

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http()
  },
  connectors: [
    coinbaseWallet({
      appName: 'Sendly Gift Cards',
      chains: [base],
    }),
    metaMask({
      chains: [base],
    })
  ]
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiConfig config={config}>
      <OnchainKitProvider>
      <PaymasterProvider>
      <OnchainKitProvider>
        <App />
        </OnchainKitProvider>
        </PaymasterProvider>
      </OnchainKitProvider>
    </WagmiConfig>
  </React.StrictMode>
);

reportWebVitals();