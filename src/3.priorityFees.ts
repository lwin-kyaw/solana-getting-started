import { Alice } from "./lib/constants";
import { buildSimpleSolTransferInstruction, buildTxWithPriorityFees, connection, createPayer, explorerURL } from "./lib/utils"

// Here, we gonna make use of Computation fees and priority fees
// to boost the tx speed and ensure the tx is landed on network
(async function() {
  const payer = createPayer();
  
  const lamportsToSend = 1_000_000;

  // compose a simple instruction which transfer 0.001 SOL
  const transferIx = buildSimpleSolTransferInstruction({
    from: payer.publicKey,
    to: Alice,
    lamports: lamportsToSend,
  });

  // we gonna build the transaction with priority fees
  // by default, Compute Units Limit for a single transaction is set to 200K CUs
  // and here, we set `PricePerComputeUnits` to 1 lamport
  const prioritizedTransferSolTx = await buildTxWithPriorityFees({
    instructions: [transferIx],
    payer: payer.publicKey,
    computeUnitPrice: 1_000_000, // 1 lamport
  });
  prioritizedTransferSolTx.sign([payer]);

  // when we inspect the tx on the explorer, we expect to the tx fee to be
  // (`PricePerComputeUnits` * `ComputeUnitLimit`) + Base Fee (Sig verification)
  // (200_000 * 1) + 5000 = 205_000 lamports
  const pSig = await connection.sendTransaction(prioritizedTransferSolTx);
  console.log("Transaction submitted:", explorerURL({ txSignature: pSig }));


  // when you inspect the above tx,
  // you will notice that the actual compute units consumed (450 CUs)
  // is way less than the default `ComputeUnitLimit` value set in the transaction
  // we can lower the `ComputeUnitLimit` to achieve way less tx fee

  // Note: if compute unit limit is lower than actual compute unit consume,
  // tx will result in error, so we have to give error margin here
  const COMPUTE_UNIT_LIMIT = 500;
  
  const prioritizedTransferSolTx2 = await buildTxWithPriorityFees({
    instructions: [transferIx],
    payer: payer.publicKey,
    computeUnitPrice: 1_000_000, // 1 lamport
    computeUnitLimit: COMPUTE_UNIT_LIMIT,
  });
  prioritizedTransferSolTx2.sign([payer]);
  // the expected tx fee for this tx will be
  // (`PricePerComputeUnits` * `ComputeUnitLimit`) + Base Fee (Sig verification)
  // (500 * 1) + 5000 = 5_500 lamports
  const pSig2 = await connection.sendTransaction(prioritizedTransferSolTx2);
  console.log("Transaction submitted:", explorerURL({ txSignature: pSig2 }));
})()