# Siphon

Bulk claim your [Pump.fun](https://pump.fun) creator fees.

Pump.fun accumulates creator fees per-coin in each bonding curve's vault. If you've created hundreds of coins, claiming them all manually is painful. Siphon finds every coin you're set as creator for and claims all uncollected fees in batched transactions.

## Web App

Connect your Solana wallet (Phantom, Solflare) and click claim. You can also paste any wallet address to check its unclaimed fees.

### Run locally

```bash
cd web
npm install
npm run dev
```

### Deploy

Import the repo on [Vercel](https://vercel.com/new) with **Root Directory** set to `web`. Framework auto-detects as Vite.

## How it works

- **Per-coin vaults** — each coin has its own creator vault derived from its sharing-config PDA. Siphon queries all sharing-configs where you're the creator, checks each vault balance, and batches `distributeCreatorFeesV2` instructions (~5 per transaction).
- **Permissionless** — anyone can trigger a fee distribution for any creator. The SOL goes to the creator's wallet regardless of who signs.
- **No backend** — everything runs client-side against Solana RPCs. No keys leave your browser.

## Tech

- Vite + React frontend with `@solana/wallet-adapter`
- `getProgramAccounts` on the Pump Fee program to discover all coins for a creator
- `getMultipleAccountsInfo` to batch-check vault balances
- Manual instruction building — no SDK dependency
- Programs: Pump (`6EF8r...`), Pump Fee (`pfeeU...`), PumpSwap AMM (`pAMMB...`)

## License

MIT
