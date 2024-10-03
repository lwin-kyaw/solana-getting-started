import { SystemProgram } from "@solana/web3.js";
import { buildTx, connection, createPayer, explorerURL } from "./lib/utils"
import { Alice } from "./lib/constants";

// In here, we are making a simple transaction which transfer 0.001 SOL
// with default transaction config
(async function() {
  const payer = createPayer();

  const lamportsToSend = 1_000_000;

  const transferSolIx = SystemProgram.transfer({
    lamports: lamportsToSend,
    fromPubkey: payer.publicKey,
    toPubkey: Alice,
    programId: SystemProgram.programId,
  });

  const transferSolTx = await buildTx([transferSolIx], payer.publicKey);

  // sign
  // expected to use only 5k lamports since the transaction is only signed by 1 account (1 sig)
  transferSolTx.sign([payer]);

  const sig = await connection.sendTransaction(transferSolTx);

  // if you check on the explorer, you should see the transaction fees is 5_000 lamports
  // 5_000 lamports per signature * 1 sig
  console.log(`Transaction completed: ${explorerURL({ txSignature: sig })}`);
})();
