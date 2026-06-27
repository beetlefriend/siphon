import {
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  PUMP_PROGRAM,
  PUMP_AMM_PROGRAM,
  WSOL_MINT,
  SPL_TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  COLLECT_CREATOR_FEE_V2_DISC,
  COLLECT_COIN_CREATOR_FEE_DISC,
} from "./constants";
import {
  findCreatorVaultPump,
  findCreatorVaultPumpAmm,
  findEventAuthority,
  findAta,
} from "./pda";

function readTokenAmount(data) {
  if (!data || data.length < 72) return 0;
  const bytes = new Uint8Array(data);
  let val = BigInt(0);
  for (let i = 7; i >= 0; i--) {
    val = (val << BigInt(8)) | BigInt(bytes[64 + i]);
  }
  return Number(val);
}

export async function getVaultBalances(connection, creator) {
  const [pumpVault] = findCreatorVaultPump(creator);
  const [ammVaultAuthority] = findCreatorVaultPumpAmm(creator);
  const [ammVaultAta] = findAta(ammVaultAuthority, WSOL_MINT, SPL_TOKEN_PROGRAM);

  console.log("[Siphon] Creator:", creator.toBase58());
  console.log("[Siphon] Pump vault PDA:", pumpVault.toBase58());
  console.log("[Siphon] AMM vault authority:", ammVaultAuthority.toBase58());
  console.log("[Siphon] AMM vault ATA:", ammVaultAta.toBase58());

  const [pumpAcct, ammAcct] = await Promise.all([
    connection.getAccountInfo(pumpVault).catch((e) => { console.error("[Siphon] Pump vault fetch error:", e); return null; }),
    connection.getAccountInfo(ammVaultAta).catch((e) => { console.error("[Siphon] AMM vault fetch error:", e); return null; }),
  ]);

  console.log("[Siphon] Pump vault exists:", !!pumpAcct, pumpAcct ? `lamports=${pumpAcct.lamports} dataLen=${pumpAcct.data.length}` : "");
  console.log("[Siphon] AMM vault exists:", !!ammAcct, ammAcct ? `lamports=${ammAcct.lamports} dataLen=${ammAcct.data.length}` : "");

  let pumpBalance = 0;
  if (pumpAcct) {
    const rentExempt = await connection.getMinimumBalanceForRentExemption(pumpAcct.data.length);
    pumpBalance = Math.max(0, pumpAcct.lamports - rentExempt);
    console.log("[Siphon] Pump vault: lamports=%d, rentExempt=%d, claimable=%d", pumpAcct.lamports, rentExempt, pumpBalance);
  }

  let ammBalance = 0;
  if (ammAcct) {
    ammBalance = readTokenAmount(ammAcct.data);
    console.log("[Siphon] AMM vault token amount:", ammBalance);
  }

  const result = {
    pumpBalanceLamports: pumpBalance,
    ammBalanceLamports: ammBalance,
    pumpBalanceSol: pumpBalance / LAMPORTS_PER_SOL,
    ammBalanceSol: ammBalance / LAMPORTS_PER_SOL,
    totalSol: (pumpBalance + ammBalance) / LAMPORTS_PER_SOL,
    hasPumpFees: pumpBalance > 0,
    hasAmmFees: ammBalance > 0,
  };
  console.log("[Siphon] Result:", result);
  return result;
}

function makeCollectCreatorFeeV2Ix(creator) {
  const [creatorVault] = findCreatorVaultPump(creator);
  const [creatorTokenAccount] = findAta(creator, WSOL_MINT, SPL_TOKEN_PROGRAM);
  const [creatorVaultTokenAccount] = findAta(creatorVault, WSOL_MINT, SPL_TOKEN_PROGRAM);
  const [eventAuthority] = findEventAuthority(PUMP_PROGRAM);

  return new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: creatorVaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(COLLECT_CREATOR_FEE_V2_DISC),
  });
}

function makeCollectCoinCreatorFeeIx(coinCreator) {
  const [creatorVaultAuthority] = findCreatorVaultPumpAmm(coinCreator);
  const [creatorVaultAta] = findAta(creatorVaultAuthority, WSOL_MINT, SPL_TOKEN_PROGRAM);
  const [coinCreatorTokenAccount] = findAta(coinCreator, WSOL_MINT, SPL_TOKEN_PROGRAM);
  const [eventAuthority] = findEventAuthority(PUMP_AMM_PROGRAM);

  return new TransactionInstruction({
    programId: PUMP_AMM_PROGRAM,
    keys: [
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: coinCreator, isSigner: false, isWritable: false },
      { pubkey: creatorVaultAuthority, isSigner: false, isWritable: false },
      { pubkey: creatorVaultAta, isSigner: false, isWritable: true },
      { pubkey: coinCreatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_AMM_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(COLLECT_COIN_CREATOR_FEE_DISC),
  });
}

export async function buildClaimTransaction(connection, creator, balances) {
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  ];

  if (balances.hasPumpFees) {
    instructions.push(makeCollectCreatorFeeV2Ix(creator));
  }
  if (balances.hasAmmFees) {
    instructions.push(makeCollectCoinCreatorFeeIx(creator));
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return {
    transaction: new VersionedTransaction(messageV0),
    blockhash,
    lastValidBlockHeight,
  };
}
