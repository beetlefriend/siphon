const { TransactionInstruction } = require("@solana/web3.js");
const {
  PUMP_PROGRAM,
  PUMP_AMM_PROGRAM,
  WSOL_MINT,
  SPL_TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
  COLLECT_CREATOR_FEE_V2_DISC,
  COLLECT_COIN_CREATOR_FEE_DISC,
} = require("./constants");
const { findCreatorVaultPump, findCreatorVaultPumpAmm, findEventAuthority, findAta } = require("./pda");

function makeCollectCreatorFeeV2Ix(creator, quoteMint = WSOL_MINT, quoteTokenProgram = SPL_TOKEN_PROGRAM) {
  const [creatorVault] = findCreatorVaultPump(creator);
  const [creatorTokenAccount] = findAta(creator, quoteMint, quoteTokenProgram);
  const [creatorVaultTokenAccount] = findAta(creatorVault, quoteMint, quoteTokenProgram);
  const [eventAuthority] = findEventAuthority(PUMP_PROGRAM);

  return new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: creatorVaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: COLLECT_CREATOR_FEE_V2_DISC,
  });
}

function makeCollectCoinCreatorFeeIx(coinCreator, quoteMint = WSOL_MINT, quoteTokenProgram = SPL_TOKEN_PROGRAM) {
  const [creatorVaultAuthority] = findCreatorVaultPumpAmm(coinCreator);
  const [creatorVaultAta] = findAta(creatorVaultAuthority, quoteMint, quoteTokenProgram);
  const [coinCreatorTokenAccount] = findAta(coinCreator, quoteMint, quoteTokenProgram);
  const [eventAuthority] = findEventAuthority(PUMP_AMM_PROGRAM);

  return new TransactionInstruction({
    programId: PUMP_AMM_PROGRAM,
    keys: [
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: coinCreator, isSigner: false, isWritable: false },
      { pubkey: creatorVaultAuthority, isSigner: false, isWritable: false },
      { pubkey: creatorVaultAta, isSigner: false, isWritable: true },
      { pubkey: coinCreatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_AMM_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: COLLECT_COIN_CREATOR_FEE_DISC,
  });
}

module.exports = {
  makeCollectCreatorFeeV2Ix,
  makeCollectCoinCreatorFeeIx,
};
