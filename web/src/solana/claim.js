import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  PUMP_PROGRAM,
  PUMP_AMM_PROGRAM,
  WSOL_MINT,
  SPL_TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  DISTRIBUTE_CREATOR_FEES_V2_DISC,
  COLLECT_CREATOR_FEE_V2_DISC,
  COLLECT_COIN_CREATOR_FEE_DISC,
  MEMO_PROGRAM,
} from "./constants";
import {
  findBondingCurve,
  findSharingConfig,
  findCreatorVault,
  findCreatorVaultPumpAmm,
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

function makeCollectCreatorFeeV2Ix(creator) {
  const creatorVault = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM
  )[0];
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

const MAX_IX_PER_TX = 4;

export function buildClaimTransactions(payer, creator, claimableItems, blockhash) {
  const perCoinItems = claimableItems.filter((c) => c.type === "sharing-config");
  const directItems = claimableItems.filter((c) => c.type === "direct");
  const ammItems = claimableItems.filter((c) => c.type === "amm");

  const txs = [];

  for (let i = 0; i < perCoinItems.length; i += MAX_IX_PER_TX) {
    const batch = perCoinItems.slice(i, i + MAX_IX_PER_TX);
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 * batch.length }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ];

    for (const item of batch) {
      instructions.push(
        makeDistributeCreatorFeesV2Ix(payer, new PublicKey(item.mint))
      );
    }

    instructions.push(
      new TransactionInstruction({
        programId: MEMO_PROGRAM,
        keys: [],
        data: Buffer.from("siphon"),
      })
    );

    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    txs.push({
      transaction: new VersionedTransaction(messageV0),
      mints: batch.map((c) => c.mint),
    });
  }

  const extraIxs = [];
  if (directItems.length > 0) extraIxs.push(makeCollectCreatorFeeV2Ix(creator));
  if (ammItems.length > 0) extraIxs.push(makeCollectCoinCreatorFeeIx(creator));

  if (extraIxs.length > 0) {
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 * extraIxs.length }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ...extraIxs,
      new TransactionInstruction({
        programId: MEMO_PROGRAM,
        keys: [],
        data: Buffer.from("siphon"),
      }),
    ];

    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    txs.push({
      transaction: new VersionedTransaction(messageV0),
      mints: ["vault-claim"],
    });
  }

  return txs;
}
