import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PUMP_PROGRAM, PUMP_AMM_PROGRAM, PUMP_FEE_PROGRAM, WSOL_MINT, SPL_TOKEN_PROGRAM } from "./constants";
import { findCreatorVault, findCreatorVaultPumpAmm, findAta } from "./pda";

const RENT_EXEMPT = 890880;

export async function discoverCoins(connection, wallet) {
  const directVaultPda = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), wallet.toBuffer()],
    PUMP_PROGRAM
  )[0];

  const [ammVaultAuthority] = findCreatorVaultPumpAmm(wallet);
  const [ammVaultAta] = findAta(ammVaultAuthority, WSOL_MINT, SPL_TOKEN_PROGRAM);

  const [configs, directVaultInfo, ammAtaInfo] = await Promise.all([
    connection.getProgramAccounts(PUMP_FEE_PROGRAM, {
      filters: [{ memcmp: { offset: 80, bytes: wallet.toBase58() } }],
      dataSlice: { offset: 11, length: 32 },
    }),
    connection.getAccountInfo(directVaultPda),
    connection.getAccountInfo(ammVaultAta).catch(() => null),
  ]);

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
        type: "sharing-config",
      });
    }
  }

  const directClaimable = directVaultInfo
    ? Math.max(0, directVaultInfo.lamports - RENT_EXEMPT)
    : 0;
  if (directClaimable > 0) {
    results.push({
      mint: null,
      lamports: directClaimable,
      sol: directClaimable / LAMPORTS_PER_SOL,
      type: "direct",
    });
  }

  if (ammAtaInfo) {
    const decoded = ammAtaInfo.data;
    if (decoded.length >= 72) {
      const amount = decoded.readBigUInt64LE(64);
      if (amount > 0n) {
        results.push({
          mint: null,
          lamports: Number(amount),
          sol: Number(amount) / LAMPORTS_PER_SOL,
          type: "amm",
        });
      }
    }
  }

  results.sort((a, b) => b.lamports - a.lamports);
  return results;
}
