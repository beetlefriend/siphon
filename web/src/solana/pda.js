import { PublicKey } from "@solana/web3.js";
import {
  PUMP_PROGRAM,
  PUMP_AMM_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SPL_TOKEN_PROGRAM,
} from "./constants";

export function findCreatorVaultPump(creator) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM
  );
}

export function findCreatorVaultPumpAmm(creator) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), creator.toBuffer()],
    PUMP_AMM_PROGRAM
  );
}

export function findEventAuthority(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId
  );
}

export function findAta(owner, mint, tokenProgram = SPL_TOKEN_PROGRAM) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM
  );
}
