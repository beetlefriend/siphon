# Siphon

Bulk claim your [Pump.fun](https://pump.fun) creator fees in one transaction.

Pump.fun aggregates creator fees into two vaults per wallet — one for the bonding curve program, one for PumpSwap AMM. Siphon reads both vaults and claims everything in a single tx.

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

## CLI

```bash
npm install
npx pf-claim check <WALLET_ADDRESS>
npx pf-claim claim <PRIVATE_KEY_OR_KEYPAIR_FILE>
npx pf-claim bulk <KEYS_FILE>
```

## How it works

- **Two vaults, one tx** — fees from all your coins pool into one vault per program (bonding curve + AMM). Claiming requires at most 2 instructions, not one per coin.
- **Permissionless** — anyone can trigger a claim for any creator. The SOL goes to the creator's wallet regardless of who signs.
- **No backend** — everything runs client-side against public Solana RPCs. No keys leave your browser.

## Tech

- Vite + React frontend with `@solana/wallet-adapter`
- Manual instruction building (no SDK dependency)
- RPC fallback chain: PublicNode > dRPC > Solana mainnet
- PDA derivation for both `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` (Pump) and `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` (PumpSwap)

## License

MIT
