const {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} = require("@solana/web3.js");
const { makeCollectCreatorFeeV2Ix, makeCollectCoinCreatorFeeIx } = require("./instructions");
const { getVaultBalances } = require("./vault");

async function buildClaimTransaction(connection, payer, creator, { priorityFee = 50000 } = {}) {
  const balances = await getVaultBalances(connection, creator);

  if (!balances.hasPumpFees && !balances.hasAmmFees) {
    return { balances, transaction: null, message: "No fees to claim" };
  }

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
  ];

  if (balances.hasPumpFees) {
    instructions.push(makeCollectCreatorFeeV2Ix(creator));
  }

  if (balances.hasAmmFees) {
    instructions.push(makeCollectCoinCreatorFeeIx(creator));
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  return { balances, transaction, lastValidBlockHeight, blockhash };
}

async function claimFees(connection, wallet, { priorityFee = 50000, dryRun = false } = {}) {
  const creator = wallet.publicKey;
  const result = await buildClaimTransaction(connection, creator, creator, { priorityFee });

  if (!result.transaction) {
    return result;
  }

  if (dryRun) {
    return { ...result, message: "Dry run — transaction built but not sent" };
  }

  result.transaction.sign([wallet]);

  const signature = await connection.sendTransaction(result.transaction, {
    skipPreflight: false,
    maxRetries: 3,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash: result.blockhash, lastValidBlockHeight: result.lastValidBlockHeight },
    "confirmed"
  );

  return {
    ...result,
    signature,
    confirmed: !confirmation.value.err,
    error: confirmation.value.err,
  };
}

async function bulkClaimFees(connection, wallets, { priorityFee = 50000, dryRun = false, delayMs = 500 } = {}) {
  const results = [];

  for (const wallet of wallets) {
    const creator = wallet.publicKey;
    console.log(`\nChecking ${creator.toBase58()}...`);

    try {
      const result = await claimFees(connection, wallet, { priorityFee, dryRun });
      results.push({ wallet: creator.toBase58(), ...result });

      if (result.signature) {
        console.log(`  Claimed ${result.balances.totalSol.toFixed(6)} SOL — tx: ${result.signature}`);
      } else {
        console.log(`  ${result.message || "No fees to claim"}`);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      results.push({ wallet: creator.toBase58(), error: err.message });
    }

    if (wallets.indexOf(wallet) < wallets.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

module.exports = { buildClaimTransaction, claimFees, bulkClaimFees };
