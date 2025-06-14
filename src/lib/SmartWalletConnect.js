"use client";
import { useConnect } from "wagmi";
import { base } from "wagmi/chains";

export function SmartWalletConnect({ open, onClose }) {
  const { connect, connectors, isLoading, pendingConnector } = useConnect();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-6 text-center text-indigo-700">
          Select wallet
        </h2>
        <div className="flex flex-col gap-4">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                console.log("button clicked:", connector.name);
                connect({ connector, chainId: base.id });
              }}
              disabled={isLoading}
              className="flex items-center gap-3 px-4 py-3 bg-indigo-500 text-white rounded-xl font-semibold text-lg shadow hover:bg-indigo-600 transition-colors disabled:opacity-60"
            >
              {isLoading && pendingConnector?.id === connector.id
                ? "Connecting..."
                : connector.name}
            </button>
          ))}
        </div>
        
      </div>
    </div>
  );
}