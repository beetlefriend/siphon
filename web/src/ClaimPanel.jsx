import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getVaultBalances, buildClaimTransaction } from "./solana/claim";
import { getCreatedCoins } from "./solana/coins";
import "./ClaimPanel.css";

const EXPLORER = "https://solscan.io/tx/";
const PUMP_URL = "https://pump.fun/coin/";

export default function ClaimPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [lookupAddr, setLookupAddr] = useState("");
  const [activeKey, setActiveKey] = useState(null);
  const [isLookup, setIsLookup] = useState(false);

  const [balances, setBalances] = useState(null);
  const [coins, setCoins] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txSig, setTxSig] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(
    async (key) => {
      if (!key) return;
      setLoading(true);
      setError(null);
      try {
        const bal = await getVaultBalances(connection, key);
        setBalances(bal);
      } catch (e) {
        setError("Failed to fetch: " + e.message);
      } finally {
        setLoading(false);
      }
      getCreatedCoins(connection, key).then(setCoins).catch(() => setCoins(null));
    },
    [connection]
  );

  useEffect(() => {
    if (connected && publicKey && !isLookup) {
      setActiveKey(publicKey);
      setBalances(null);
      setCoins(undefined);
      setTxSig(null);
      setError(null);
      fetchData(publicKey);
    } else if (!connected && !isLookup) {
      setActiveKey(null);
      setBalances(null);
      setCoins(undefined);
      setTxSig(null);
    }
  }, [connected, publicKey, fetchData, isLookup]);

  const handleLookup = () => {
    try {
      const key = new PublicKey(lookupAddr.trim());
      setIsLookup(true);
      setActiveKey(key);
      setBalances(null);
      setCoins(undefined);
      setTxSig(null);
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
    setBalances(null);
    setCoins(undefined);
    setTxSig(null);
    setError(null);
    if (connected && publicKey) fetchData(publicKey);
  };

  const handleClaim = async () => {
    if (!publicKey || !balances) return;
    if (isLookup && activeKey?.toBase58() !== publicKey.toBase58()) {
      setError("Connect this wallet to claim");
      return;
    }
    setClaiming(true);
    setError(null);
    setTxSig(null);

    try {
      const { transaction, blockhash, lastValidBlockHeight } =
        await buildClaimTransaction(connection, publicKey, balances);

      const sig = await sendTransaction(transaction, connection);
      setTxSig(sig);

      try {
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );
      } catch (confirmErr) {
        console.warn("[Siphon] Confirmation polling timed out, tx likely landed:", confirmErr.message);
      }

      await fetchData(publicKey);
    } catch (e) {
      if (e.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else {
        setError("Claim failed: " + e.message);
      }
    } finally {
      setClaiming(false);
    }
  };

  const hasFees = balances && (balances.hasPumpFees || balances.hasAmmFees);
  const canClaim = hasFees && connected && activeKey?.toBase58() === publicKey?.toBase58();

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
          ) : balances ? (
            <>
              <div className="vault-grid">
                <VaultRow
                  label="Bonding Curve"
                  amount={balances.pumpBalanceSol}
                  active={balances.hasPumpFees}
                />
                <VaultRow
                  label="PumpSwap AMM"
                  amount={balances.ammBalanceSol}
                  active={balances.hasAmmFees}
                />
                <div className="vault-total">
                  <span>Total</span>
                  <span className="total-amount">
                    {balances.totalSol.toFixed(6)} SOL
                  </span>
                </div>
              </div>

              {coins && coins.length > 0 && (
                <div className="coins-section">
                  <div className="coins-header">
                    Created coins ({coins.length})
                  </div>
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
                          {coin.mint.slice(0, 4)}..{coin.mint.slice(-4)}
                        </span>
                        {coin.complete && (
                          <span className="coin-badge graduated">Graduated</span>
                        )}
                        {!coin.complete && (
                          <span className="coin-badge active">Bonding</span>
                        )}
                      </a>
                    ))}
                  </div>
                  <div className="coins-note">
                    Fees from all coins pool into one vault per program
                  </div>
                </div>
              )}

              {coins && coins.length === 0 && (
                <div className="no-coins">No coins found for this wallet</div>
              )}

              {coins === null && (
                <div className="coins-fallback">
                  <span>Coin lookup unavailable on free RPC — </span>
                  <a
                    href={`https://pump.fun/profile/${activeKey.toBase58()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on pump.fun
                  </a>
                </div>
              )}

              {coins === undefined && !loading && (
                <div className="status-row" style={{ padding: "8px" }}>
                  <span className="spinner" />
                  <span style={{ fontSize: "12px" }}>Loading coins...</span>
                </div>
              )}

              {canClaim ? (
                <button
                  className="claim-btn"
                  onClick={handleClaim}
                  disabled={claiming}
                >
                  {claiming ? (
                    <>
                      <span className="spinner" /> Claiming...
                    </>
                  ) : (
                    `Claim ${balances.totalSol.toFixed(4)} SOL`
                  )}
                </button>
              ) : hasFees && isLookup ? (
                <div className="connect-hint">
                  Connect this wallet to claim
                </div>
              ) : !hasFees ? (
                <div className="no-fees">No claimable fees</div>
              ) : null}

              {txSig && (
                <div className="tx-result success">
                  <span>Claimed!</span>
                  <a
                    href={EXPLORER + txSig}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View tx
                  </a>
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

function VaultRow({ label, amount, active }) {
  return (
    <div className={`vault-row ${active ? "active" : ""}`}>
      <div className="vault-label">
        <span className={`vault-dot ${active ? "on" : ""}`} />
        {label}
      </div>
      <span className="vault-amount">{amount.toFixed(6)} SOL</span>
    </div>
  );
}
