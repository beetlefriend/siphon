import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  PUMP_PROGRAM,
  WSOL_MINT,
  SPL_TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  DISTRIBUTE_CREATOR_FEES_V2_DISC,
} from "./constants";
import {
  findBondingCurve,
  findSharingConfig,
  findCreatorVault,
  findEventAuthority,
  findAta,
} from "./pda";

function makeDistributeCreatorFeesV2Ix(payer, mintPubkey) {
  const [bondingCurve] = findBondingCurve(mintPubkey);
  const [sharingConfig] = findSharingConfig(mintPubkey);
  const [creatorVault] = findCreatorVault(sharingConfig);
  const [eventAuthority] = findEventAuthority(PUMP_PROGRAM);
  const [creatorVaultQuoteTokenAccount] = findAta(
    creatorVault,
    WSOL_MINT,
    SPL_TOKEN_PROGRAM
  );

  const data = Buffer.alloc(9);
  data.set(DISTRIBUTE_CREATOR_FEES_V2_DISC, 0);
  data[8] = 1;

  return new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: false },
      { pubkey: sharingConfig, isSigner: false, isWritable: false },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: creatorVaultQuoteTokenAccount, isSigner: false, isWritable: true },
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
    data,
  });
}

const MAX_IX_PER_TX = 4;

export function buildClaimTransactions(payer, claimableMints, blockhash) {
  const txs = [];

  for (let i = 0; i < claimableMints.length; i += MAX_IX_PER_TX) {
    const batch = claimableMints.slice(i, i + MAX_IX_PER_TX);
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 * batch.length }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ];

    for (const mintStr of batch) {
      instructions.push(
        makeDistributeCreatorFeesV2Ix(payer, new PublicKey(mintStr))
      );
    }

    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    txs.push({
      transaction: new VersionedTransaction(messageV0),
      mints: batch,
    });
  }

  return txs;
}
