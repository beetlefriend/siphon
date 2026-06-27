#!/usr/bin/env node
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { Command } = require("commander");
const bs58 = require("bs58");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { getVaultBalances } = require("./src/vault");
const { claimFees, bulkClaimFees } = require("./src/claim");

const program = new Command();

program
  .name("pf-claim")
  .description("Bulk claim Pump.fun creator fees")
  .version("1.0.0");

function getConnection(rpcUrl) {
  const url = rpcUrl || process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

function loadWallet(keyInput) {
  if (fs.existsSync(keyInput)) {
    const raw = JSON.parse(fs.readFileSync(keyInput, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  return Keypair.fromSecretKey(bs58.decode(keyInput));
}

function loadWallets(input) {
  if (fs.existsSync(input)) {
    const content = fs.readFileSync(input, "utf-8").trim();
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      if (line.startsWith("[")) {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(line)));
      }
      return Keypair.fromSecretKey(bs58.decode(line));
    });
  }
  return [loadWallet(input)];
}

// ── Check balances ──────────────────────────────────────────────────

program
  .command("check")
  .description("Check claimable fee balances for one or more wallets")
  .argument("<addresses...>", "Wallet public keys to check")
  .option("-r, --rpc <url>", "RPC endpoint")
  .action(async (addresses, opts) => {
    const connection = getConnection(opts.rpc);
    let totalAll = 0;

    console.log("Pump.fun Fee Checker\n");

    for (const addr of addresses) {
      const pubkey = new PublicKey(addr);
      const bal = await getVaultBalances(connection, pubkey);

      console.log(`Wallet: ${addr}`);
      console.log(`  Pump (bonding curve) vault:  ${bal.pumpBalanceSol.toFixed(6)} SOL`);
      console.log(`  AMM (PumpSwap) vault:        ${bal.ammBalanceSol.toFixed(6)} SOL`);
      console.log(`  Total claimable:             ${bal.totalSol.toFixed(6)} SOL`);
      console.log();
      totalAll += bal.totalSol;
    }

    if (addresses.length > 1) {
      console.log(`Grand total: ${totalAll.toFixed(6)} SOL`);
    }
  });

// ── Claim fees ──────────────────────────────────────────────────────

program
  .command("claim")
  .description("Claim fees for one wallet")
  .argument("<key>", "Private key (bs58) or path to keypair JSON")
  .option("-r, --rpc <url>", "RPC endpoint")
  .option("-p, --priority-fee <number>", "Priority fee in microlamports", "50000")
  .option("--dry-run", "Build transaction without sending")
  .action(async (key, opts) => {
    const connection = getConnection(opts.rpc);
    const wallet = loadWallet(key);

    console.log(`Claiming fees for ${wallet.publicKey.toBase58()}...\n`);

    const result = await claimFees(connection, wallet, {
      priorityFee: parseInt(opts.priorityFee),
      dryRun: opts.dryRun,
    });

    if (!result.transaction) {
      console.log("No fees to claim.");
      return;
    }

    console.log(`Pump vault:  ${result.balances.pumpBalanceSol.toFixed(6)} SOL`);
    console.log(`AMM vault:   ${result.balances.ammBalanceSol.toFixed(6)} SOL`);
    console.log(`Total:       ${result.balances.totalSol.toFixed(6)} SOL`);

    if (result.signature) {
      console.log(`\nTransaction: ${result.signature}`);
      console.log(`Confirmed: ${result.confirmed}`);
    } else if (result.message) {
      console.log(`\n${result.message}`);
    }
  });

// ── Bulk claim ──────────────────────────────────────────────────────

program
  .command("bulk")
  .description("Claim fees for multiple wallets")
  .argument("<keysFile>", "File with one private key (bs58) per line, or JSON arrays")
  .option("-r, --rpc <url>", "RPC endpoint")
  .option("-p, --priority-fee <number>", "Priority fee in microlamports", "50000")
  .option("-d, --delay <ms>", "Delay between claims in ms", "500")
  .option("--dry-run", "Build transactions without sending")
  .action(async (keysFile, opts) => {
    const connection = getConnection(opts.rpc);
    const wallets = loadWallets(keysFile);

    console.log(`Bulk claiming for ${wallets.length} wallet(s)...\n`);

    const results = await bulkClaimFees(connection, wallets, {
      priorityFee: parseInt(opts.priorityFee),
      dryRun: opts.dryRun,
      delayMs: parseInt(opts.delay),
    });

    console.log("\n── Summary ──");
    let claimed = 0, skipped = 0, errors = 0;
    for (const r of results) {
      if (r.signature) claimed++;
      else if (r.error) errors++;
      else skipped++;
    }
    console.log(`Claimed: ${claimed}  |  Skipped (no fees): ${skipped}  |  Errors: ${errors}`);
  });

program.parse();
