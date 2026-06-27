import { useMemo, useState, useCallback } from "react";
import { Connection } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./App.css";
import ClaimPanel from "./ClaimPanel";

const RPC_ENDPOINTS = [
  import.meta.env.VITE_RPC_URL,
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

async function findWorkingRpc() {
  for (const url of RPC_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      if (res.ok) {
        console.log("[Siphon] Using RPC:", url);
        return url;
      }
    } catch {}
  }
  return RPC_ENDPOINTS[0];
}

let rpcPromise = null;
function getRpcUrl() {
  if (!rpcPromise) rpcPromise = findWorkingRpc();
  return rpcPromise;
}

export default function App() {
  const [rpcUrl, setRpcUrl] = useState(null);

  useMemo(() => {
    getRpcUrl().then(setRpcUrl);
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  if (!rpcUrl) {
    return (
      <div className="app">
        <header>
          <h1>Siphon</h1>
          <p className="subtitle">Connecting to Solana...</p>
        </header>
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app">
            <div className="app-body">
              <header>
                <h1>Siphon</h1>
                <p className="subtitle">
                  Bulk claim your Pump.fun creator fees
                </p>
              </header>

              <main>
                <ClaimPanel />
              </main>
            </div>

            <footer>
              <div className="links">
                <a
                  href="https://github.com/beetlefriend/siphon"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                <span className="dot" />
                <a
                  href="https://pump.fun"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pump.fun
                </a>
              </div>
              <p className="disclaimer">
                Open source. No fees taken. Transactions go directly on-chain.
              </p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
