import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { discoverCoins } from "./solana/coins";
import { buildClaimTransactions } from "./solana/claim";
import "./ClaimPanel.css";

const EXPLORER = "https://solscan.io/tx/";
const PUMP_URL = "https://pump.fun/coin/";
const SEND_BATCH = 10;

export default function ClaimPanel() {
  const { connection } = useConnection();
  const { publicKey, signAllTransactions, connected } = useWallet();

  const [lookupAddr, setLookupAddr] = useState("");
  const [activeKey, setActiveKey] = useState(null);
  const [isLookup, setIsLookup] = useState(false);

  const [coins, setCoins] = useState(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimProgress, setClaimProgress] = useState(null);
  const [txSigs, setTxSigs] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(
    async (key) => {
      if (!key) return;
      setLoading(true);
      setError(null);
      setCoins(null);

      try {
        const results = await discoverCoins(connection, key);
        setCoins(results);
      } catch (e) {
        setError("Failed to scan: " + e.message);
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  useEffect(() => {
    if (connected && publicKey && !isLookup) {
      setActiveKey(publicKey);
      setTxSigs([]);
      setError(null);
      fetchData(publicKey);
    } else if (!connected && !isLookup) {
      setActiveKey(null);
      setCoins(null);
      setTxSigs([]);
    }
  }, [connected, publicKey, fetchData, isLookup]);

  const handleLookup = () => {
    try {
      const key = new PublicKey(lookupAddr.trim());
      setIsLookup(true);
      setActiveKey(key);
      setTxSigs([]);
      setError(null);
      fetchData(key);
    } catch {
      setError("Invalid wallet address");
    }
  };

  const handleClearLookup = () => {
    setIsLookup(false);
    setLookupAddr("");
    setActiveKey(connected ? publicKey : null);
    setCoins(null);
    setTxSigs([]);
    setError(null);
    if (connected && publicKey) fetchData(publicKey);
  };

  const handleClaim = async () => {
    if (!publicKey || !coins || !signAllTransactions) return;
    if (isLookup && activeKey?.toBase58() !== publicKey.toBase58()) {
      setError("Connect this wallet to claim");
      return;
    }

    const claimable = coins.filter((c) => c.lamports > 0);
    if (claimable.length === 0) return;

    setClaiming(true);
    setError(null);
    setTxSigs([]);

    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const txBundles = buildClaimTransactions(
        publicKey,
        claimable.map((c) => c.mint),
        blockhash
      );

      setClaimProgress(`Signing ${txBundles.length} transactions...`);

      const unsigned = txBundles.map((b) => b.transaction);
      const signed = await signAllTransactions(unsigned);

      setClaimProgress(`Sending ${signed.length} transactions...`);
      const sigs = [];
      let sent = 0;

      for (let i = 0; i < signed.length; i += SEND_BATCH) {
        const batch = signed.slice(i, i + SEND_BATCH);
        const batchSigs = await Promise.all(
          batch.map((tx) =>
            connection.sendRawTransaction(tx.serialize(), {
              skipPreflight: true,
              maxRetries: 3,
            })
          )
        );
        sigs.push(...batchSigs);
        sent += batch.length;
        setClaimProgress(`Sent ${sent}/${signed.length} transactions...`);
      }

      setTxSigs(sigs);
      setClaimProgress("Confirming...");

      await Promise.allSettled(
        sigs.map((sig) =>
          connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            "confirmed"
          )
        )
      );

      await fetchData(activeKey);
    } catch (e) {
      if (e.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else {
        setError("Claim failed: " + e.message);
      }
    } finally {
      setClaiming(false);
      setClaimProgress(null);
    }
  };

  const totalSol = coins ? coins.reduce((sum, c) => sum + c.sol, 0) : 0;
  const claimableCount = coins ? coins.filter((c) => c.lamports > 0).length : 0;
  const txCount = Math.ceil(claimableCount / 4);
  const canClaim =
    claimableCount > 0 && connected && activeKey?.toBase58() === publicKey?.toBase58();

  return (
    <div className="claim-panel">
      <div className="connect-row">
        <WalletMultiButton />
        {connected && publicKey && (
          <div className="connected-info">
            <span className="connected-dot" />
            <a
              className="connected-addr"
              href={`https://pump.fun/profile/${publicKey.toBase58()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {publicKey.toBase58().slice(0, 4)}..{publicKey.toBase58().slice(-4)}
            </a>
          </div>
        )}
      </div>

      <div className="lookup-section">
        <div className="lookup-row">
          <input
            type="text"
            className="lookup-input"
            placeholder="Paste any wallet address to check..."
            value={lookupAddr}
            onChange={(e) => setLookupAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <button className="lookup-btn" onClick={handleLookup}>
            Check
          </button>
        </div>
        {isLookup && (
          <button className="clear-lookup" onClick={handleClearLookup}>
            Back to my wallet
          </button>
        )}
      </div>

      {activeKey && (
        <div className="card">
          <div className="wallet-label">
            <a
              className="wallet-label-link"
              href={`https://pump.fun/profile/${activeKey.toBase58()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {activeKey.toBase58().slice(0, 4)}..{activeKey.toBase58().slice(-4)}
            </a>
            {isLookup && !canClaim && (
              <span className="view-only-badge">View only</span>
            )}
          </div>

          {loading ? (
            <div className="status-row">
              <span className="spinner" />
              <span>Checking vaults...</span>
            </div>
          ) : coins ? (
            <>
              <div className="vault-total">
                <span>Unclaimed ({claimableCount} of {coins.length} coins)</span>
                <span className="total-amount">{totalSol.toFixed(6)} SOL</span>
              </div>

              {coins.length > 0 && (
                <div className="coins-section">
                  <div className="coins-header">Coins ({coins.length})</div>
                  <div className="coins-list">
                    {coins.map((coin) => (
                      <a
                        key={coin.mint}
                        className="coin-row"
                        href={PUMP_URL + coin.mint}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="coin-mint">
                          {coin.mint.slice(0, 6)}..{coin.mint.slice(-4)}
                        </span>
                        {coin.lamports > 0 ? (
                          <span className="coin-badge graduated">
                            {coin.sol.toFixed(4)} SOL
                          </span>
                        ) : (
                          <span className="coin-badge empty">claimed</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {coins.length === 0 && (
                <div className="no-coins">No coins found for this wallet</div>
              )}

              {canClaim ? (
                <button
                  className="claim-btn"
                  onClick={handleClaim}
                  disabled={claiming}
                >
                  {claiming ? (
                    <>
                      <span className="spinner" />
                      {claimProgress || "Claiming..."}
                    </>
                  ) : (
                    `Claim ${totalSol.toFixed(4)} SOL (${txCount} tx${txCount > 1 ? "s" : ""}, one approval)`
                  )}
                </button>
              ) : claimableCount > 0 && isLookup ? (
                <div className="connect-hint">Connect this wallet to claim</div>
              ) : coins.length > 0 && claimableCount === 0 ? (
                <div className="no-fees">All fees claimed</div>
              ) : null}

              {txSigs.length > 0 && (
                <div className="tx-results">
                  <div className="tx-result success">
                    <span>{txSigs.length} transactions confirmed</span>
                    <a
                      href={EXPLORER + txSigs[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View first tx
                    </a>
                  </div>
                </div>
              )}

              {error && <div className="tx-result error">{error}</div>}

              <button
                className="refresh-btn"
                onClick={() => fetchData(activeKey)}
                disabled={loading}
              >
                Refresh
              </button>
            </>
          ) : null}
        </div>
      )}

      {!activeKey && (
        <div className="hint">
          Connect your wallet or paste an address above to check fees
        </div>
      )}
    </div>
  );
}
