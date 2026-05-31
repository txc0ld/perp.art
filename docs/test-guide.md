# Perpetual — Test Mint Guide

Thanks for testing **Perpetual**! You'll upload a piece of art and commit it to permanence. This runs on a **test network (Base Sepolia)** — it uses *fake* ETH, so **nothing costs real money**. The whole thing takes ~5–10 minutes.

The goal: confirm your artwork really gets stored in **four independent places** and recorded on-chain.

---

## What you'll need
1. A crypto wallet — **MetaMask** (browser extension or mobile) is easiest. Any WalletConnect wallet works.
2. A small amount of **Base Sepolia test ETH** (free — see Step 2).
3. An artwork file to upload: **image, video, or HTML**, under **4.4 MB**.
   - Supported: PNG · JPG · GIF · WEBP · SVG · MP4 · WEBM · HTML

---

## Step 1 — Add the Base Sepolia test network
In MetaMask, the easiest way:
1. Go to **https://chainlist.org**, search **"Base Sepolia"**.
2. Connect your wallet and click **Add to MetaMask** (chain ID **84532**).

*(Or add it manually: Network name `Base Sepolia`, RPC `https://sepolia.base.org`, Chain ID `84532`, Currency `ETH`, Explorer `https://sepolia.basescan.org`.)*

## Step 2 — Get free test ETH
You need a tiny bit of test ETH for gas (the mint + storage records are a few small transactions).
1. Copy your wallet address.
2. Go to a Base Sepolia faucet and paste it:
   - **https://www.alchemy.com/faucets/base-sepolia**, or
   - **https://portal.cdp.coinbase.com/products/faucet** (choose Base Sepolia)
3. Request the test ETH. It arrives in under a minute. (0.01–0.05 is plenty.)

## Step 3 — Connect on the site
1. Open **https://tryperpetual.art**
2. Click **Connect** (top right) and approve in your wallet.
3. Make sure your wallet is set to the **Base Sepolia** network. If you're on the wrong network the mint button will say "Simulated" instead of "Mint onchain" — switch networks to fix it.

## Step 4 — Upload and describe your artwork
1. Go to **Mint** (`https://tryperpetual.art/mint`).
2. **Drop your file** onto the upload box, or click to choose one. You should see **your actual artwork** appear as the preview.
3. Fill in **Artist name** and **Title** (required).
4. Optional: add a **royalty %**, a **description**, and any **Attributes** (e.g. `Background → Nebula`).
5. Step through **Royalty → Permanence → Lock → Review**. On Review you'll see your art, details, and the storage shards that will be written.

## Step 5 — Mint
1. Click **Mint onchain**.
2. Your wallet will pop up **a few times** — approve each one:
   - **1st:** mints the token + writes the on-chain proof.
   - **Next few:** records each storage location (IPFS / Arweave / Irys) on-chain.
3. Wait for the success screen — "Committed to permanence."

## Step 6 — Verify the 4 shards (the important part!)
On the success screen you'll see **Permanence shards**. Please check each one:

| Shard | What it means | How to verify |
|---|---|---|
| **Onchain proof** | Provenance + hash written into the token | Click the **Transaction** link → opens BaseScan |
| **IPFS** | Your file on IPFS | Click **view** → your artwork should load |
| **Arweave** | Your file stored permanently on Arweave | Click **view** → your artwork (may take 1–2 min to appear while it propagates) |
| **Irys** | Your file via Irys | Click **view** → your artwork should load |

✅ Each shard should show **stored** or **onchain**, and every **view** link should open *your* artwork.

---

## What to report back
Please tell us:
- ✅ Did all four shards succeed? (screenshot of the success screen is great)
- 🖼️ Did each "view" link actually show **your** artwork?
- 🐢 Anything slow, confusing, or broken?
- ❌ Any error messages? (copy the exact text)
- 📱 What device / browser / wallet did you use?

Thank you! 🙏

---

### Notes / known limits
- File size cap is **4.4 MB** for now (longer videos aren't supported yet).
- The **Arweave** link can take a couple of minutes to resolve in a browser while the transaction propagates across the network — that's normal; the file is already stored.
- This is a **testnet** — tokens minted here aren't on Ethereum/Base mainnet and have no real value.
