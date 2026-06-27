const { Connection, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { findCreatorVaultPump, findCreatorVaultPumpAmm, findAta } = require("./pda");
const { WSOL_MINT, SPL_TOKEN_PROGRAM } = require("./constants");

async function getVaultBalances(connection, creator) {
  const [pumpVault] = findCreatorVaultPump(creator);
  const [ammVaultAuthority] = findCreatorVaultPumpAmm(creator);
  const [ammVaultAta] = findAta(ammVaultAuthority, WSOL_MINT, SPL_TOKEN_PROGRAM);

  const [pumpAcct, ammAcct] = await Promise.all([
    connection.getAccountInfo(pumpVault).catch(() => null),
    connection.getAccountInfo(ammVaultAta).catch(() => null),
  ]);

  // Pump vault: SOL balance minus rent-exempt minimum (~890880 lamports)
  const RENT_EXEMPT = 890880;
  let pumpBalance = 0;
  if (pumpAcct) {
    pumpBalance = Math.max(0, pumpAcct.lamports - RENT_EXEMPT);
  }

  // AMM vault: SPL token account, balance is in the token account data
  let ammBalance = 0;
  if (ammAcct && ammAcct.data.length >= 72) {
    ammBalance = Number(ammAcct.data.readBigUInt64LE(64));
  }

  return {
    pumpVault: pumpVault.toBase58(),
    ammVault: ammVaultAta.toBase58(),
    pumpBalanceLamports: pumpBalance,
    ammBalanceLamports: ammBalance,
    pumpBalanceSol: pumpBalance / LAMPORTS_PER_SOL,
    ammBalanceSol: ammBalance / LAMPORTS_PER_SOL,
    totalSol: (pumpBalance + ammBalance) / LAMPORTS_PER_SOL,
    hasPumpFees: pumpBalance > 0,
    hasAmmFees: ammBalance > 0,
  };
}

module.exports = { getVaultBalances };
