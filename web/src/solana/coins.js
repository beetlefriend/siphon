import { PUMP_PROGRAM } from "./constants";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function getCreatedCoins(connection, creator) {
  try {
    const accounts = await withTimeout(
      connection.getProgramAccounts(PUMP_PROGRAM, {
        filters: [
          { dataSize: 313 },
          { memcmp: { offset: 49, bytes: creator.toBase58() } },
        ],
        dataSlice: { offset: 48, length: 1 },
      }),
      5000
    );

    return accounts.map((a) => ({
      mint: a.pubkey.toBase58(),
      complete: a.account.data[0] === 1,
    }));
  } catch (e) {
    console.warn("[Siphon] Coin lookup unavailable:", e.message);
    return null;
  }
}
