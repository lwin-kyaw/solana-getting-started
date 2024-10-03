import { generateKeyPairSigner } from '@solana/signers';
import { Alice } from "./lib/constants";
import { createPayer, buildSimpleSolTransferInstruction, connection, buildTx, createRandomAccount, buildTxWithPriorityFees, explorerURL } from "./lib/utils";
import nacl from 'tweetnacl';
import { Keypair } from '@solana/web3.js';

// Here, we gonna explorer about Transaction Simulation from Higher Level
(async function() {
  const payer = createPayer();
  
  const lamportsToSend = 1_000_000;

  // compose a simple instruction which transfer 0.001 SOL
  const transferIx = buildSimpleSolTransferInstruction({
    from: payer.publicKey,
    to: Alice,
    lamports: lamportsToSend,
  });

  const txWithoutSig = await buildTx([transferIx], payer.publicKey);

  // simulation are done off-chain by the rpc-servers
  // we don't necessarily need to sign the transaction to be simulation
  // * Notice that the simulation result returns the expected Compute Units consumed by tx
  const simResultWithoutSig = await connection.simulateTransaction(txWithoutSig);
  console.log("simResultWithoutSig without sig", simResultWithoutSig);

  
  // signature verification can be optionally included in the simulation
  // by setting `sigVerify` to `true` in simulation config

  // here, we will generate random key pair to sign the transaction
  // to mimic the signature verification error
  const kp = Keypair.generate();
  const txSig = nacl.sign.detached(
    txWithoutSig.serialize(),
    kp.secretKey,
  );
  txWithoutSig.addSignature(payer.publicKey, Buffer.from(txSig));
  const txWithIncorrectSig = txWithoutSig;
  try {
    const simResultWithIncorrectSig = await connection.simulateTransaction(txWithIncorrectSig, {
      sigVerify: true,
    });
    console.log("simResultWithIncorrectSig without sig", simResultWithIncorrectSig);
  } catch (e: unknown) {
    console.error("simulation failed", e);
  }

  // transaction simulation is recommended to use by solana docs
  // simulations are being used in -
  //  - preflight checks
  //  - getting compute units required for a transaction (we'll come back to this later)

  // preflights (https://solana.com/docs/rpc/http/sendtransaction)
  // By default, preflight checks are being called before tx submission
  // preflight checks do the following
  //  - Verify that all signatures are valid
  //  - Check that the referenced blockhash is within the last 150 blocks
  //  - Simulate the transaction against the bank slot specified by the preflightCommitment
  // Preflight checks can be optionally skipped by setting `skipPreflight` field to `true` in tx config

  // sending tx with preflight (DEFAULT)
  // this tx will be failed during preflight due to signature issue
  try {
    await connection.sendTransaction(txWithIncorrectSig);
  } catch (e: unknown) {
    console.error("tx failed during preflight:", e);
  }

  // Besides, signature issues preflight checks can also catch other issues before tx submission
  // for e.g, `Computational budget exceeded`
  const prioritizedTx = await buildTxWithPriorityFees({
    instructions: [transferIx],
    payer: payer.publicKey,
    computeUnitPrice: 1_000_000, // 1 lamports
    computeUnitLimit: 200, // intentionally set it to very low so that tx will failed
  });
  prioritizedTx.sign([payer]);

  try {
    // tx failed during the preflight coz `ComputeUnitLimit` is very low
    // and actual CU consumption exceeds the limit 
    await connection.sendTransaction(prioritizedTx);
  } catch (e: unknown) {
    console.error("tx failed during preflight:", e);
  }

  // send the same tx again with preflight disabled
  const sig = await connection.sendTransaction(prioritizedTx, {
    skipPreflight: true
  });

  // when you view the tx on the explorer, it was actually submitted
  // however, it resulted in error due to insufficient compute units
  // *Notice: that the tx fee was deducted even though tx did not success
  console.log("Transaction submitted:", explorerURL({ txSignature: sig }));
})()