import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getVaultBalances, buildClaimTransaction } from "./solana/claim";
import "./ClaimPanel.css";

const EXPLORER = "https://solscan.io/tx/";

export default function ClaimPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txSig, setTxSig] = useState(null);
  const [error, setError] = useState(null);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const bal = await getVaultBalances(connection, publicKey);
      setBalances(bal);
    } catch (e) {
      setError("Failed to fetch balances: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      setBalances(null);
      setTxSig(null);
      setError(null);
      fetchBalances();
    } else {
      setBalances(null);
      setTxSig(null);
    }
  }, [connected, publicKey, fetchBalances]);

  const handleClaim = async () => {
    if (!publicKey || !balances) return;
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
        console.warn("[Siphon] Confirmation polling failed, tx likely still landed:", confirmErr.message);
      }

      await fetchBalances();
    } catch (e) {
      if (e.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else if (txSig) {
        console.warn("[Siphon] Post-send error (tx may have landed):", e.message);
      } else {
        setError("Claim failed: " + e.message);
      }
    } finally {
      setClaiming(false);
    }
  };

  const hasFees = balances && (balances.hasPumpFees || balances.hasAmmFees);

  return (
    <div className="claim-panel">
      <div className="connect-row">
        <WalletMultiButton />
      </div>

      {connected && (
        <div className="card">
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

              {hasFees ? (
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
              ) : (
                <div className="no-fees">No claimable fees</div>
              )}

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
                onClick={fetchBalances}
                disabled={loading}
              >
                Refresh
              </button>
            </>
          ) : null}
        </div>
      )}

      {!connected && (
        <div className="hint">Connect your wallet to check for claimable fees</div>
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
