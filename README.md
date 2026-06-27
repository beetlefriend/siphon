# Siphon

Bulk claim your [Pump.fun](https://pump.fun) creator fees in one click.

Manually claiming fees across hundreds of coins is tedious. Siphon scans your wallet, shows every unclaimed vault, and batches all the claims into a single approval.

## Usage

1. Connect your Solana wallet (Phantom, Solflare)
2. See all your unclaimed creator fees broken down by coin
3. Click claim — sign once, all transactions fire automatically

You can also paste any wallet address to view its unclaimed fees.

## Run locally

```bash
cd web
npm install
cp .env.example .env   # add your RPC endpoint
npm run dev
```

## Deploy

Import the repo on [Vercel](https://vercel.com/new) with **Root Directory** set to `web`. Set `VITE_RPC_URL` in environment variables.

## License

MIT
