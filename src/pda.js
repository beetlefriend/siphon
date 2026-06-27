const { PublicKey } = require("@solana/web3.js");
const {
  PUMP_PROGRAM,
  PUMP_AMM_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SPL_TOKEN_PROGRAM,
} = require("./constants");

function findCreatorVaultPump(creator) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM
  );
}

function findCreatorVaultPumpAmm(creator) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), creator.toBuffer()],
    PUMP_AMM_PROGRAM
  );
}

function findEventAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId
  );
}

function findAta(owner, mint, tokenProgram = SPL_TOKEN_PROGRAM) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM
  );
}

module.exports = {
  findCreatorVaultPump,
  findCreatorVaultPumpAmm,
  findEventAuthority,
  findAta,
};
