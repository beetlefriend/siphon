import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PUMP_PROGRAM, PUMP_FEE_PROGRAM } from "./constants";
import { findCreatorVault } from "./pda";

const RENT_EXEMPT = 890880;

export async function discoverCoins(connection, wallet) {
  const configs = await connection.getProgramAccounts(PUMP_FEE_PROGRAM, {
    filters: [{ memcmp: { offset: 80, bytes: wallet.toBase58() } }],
    dataSlice: { offset: 11, length: 32 },
  });

  const coins = configs.map((a) => ({
    mint: new PublicKey(a.account.data).toBase58(),
    sharingConfig: a.pubkey,
  }));

  const vaultKeys = configs.map((a) => {
    const [cv] = findCreatorVault(a.pubkey);
    return cv;
  });

  const results = [];
  const BATCH = 100;

  for (let i = 0; i < vaultKeys.length; i += BATCH) {
    const batch = vaultKeys.slice(i, i + BATCH);
    const infos = await connection.getMultipleAccountsInfo(batch);

    for (let j = 0; j < batch.length; j++) {
      const info = infos[j];
      const claimable = info ? Math.max(0, info.lamports - RENT_EXEMPT) : 0;
      results.push({
        mint: coins[i + j].mint,
        lamports: claimable,
        sol: claimable / LAMPORTS_PER_SOL,
      });
    }
  }

  results.sort((a, b) => b.lamports - a.lamports);
  return results;
}
