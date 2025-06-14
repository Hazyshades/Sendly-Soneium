"use client";

import { WagmiConfig, createConfig, http } from 'wagmi';
import { soneium } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { coinbaseWallet, metaMask } from 'wagmi/connectors';

const config = createConfig({
  chains: [soneium],
  transports: {
    [soneium.id]: http(),
  },
  connectors: [
    coinbaseWallet({
      appName: 'Sendly Gift Cards',
      chains: [soneium],
    }),
    metaMask({
      chains: [soneium],
    }),
  ],
});

export default function ProvidersWrapper({ children }) {
  return (
    <WagmiConfig config={config}>
      <OnchainKitProvider>
          {children}
      </OnchainKitProvider>
    </WagmiConfig>
  );
}