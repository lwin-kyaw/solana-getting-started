import { getSimulationComputeUnits } from "@solana-developers/helpers";
import { Alice } from "./lib/constants";
import { createPayer, buildSimpleSolTransferInstruction, connection, buildTxWithPriorityFees, buildTx, explorerURL, getRecentPrioritizationFees } from "./lib/utils";
import { ComputeBudgetProgram } from "@solana/web3.js";

// Here, we will explorer how to get optimal tx fees
// with the help of simulation
(async function() {
  const payer = createPayer();
  
  const lamportsToSend = 1_000_000;

  // compose a simple instruction which transfer 0.001 SOL
  const transferIx = buildSimpleSolTransferInstruction({
    from: payer.publicKey,
    to: Alice,
    lamports: lamportsToSend,
  });

  // Prioritization fees are computed the based on the requested `ComputeUnitLimit` set on the tx
  // rather than actual CUs consumed by transaction
  // thus, it's important to estimate the optimal CUs required to execute the transaction
  // so that users will not be over-charged or avoid the tx failure

  // we can get the expected CUs required to execute the tx from the simulation
  // this function, getSimulationComputeUnits, already includes the CUs (150) required for ComputeBudgetProgram.setComputeUnitLimit
  // https://github.com/solana-developers/helpers/blob/a77a7fa9b605b218dff5c4a1c5e86cec4f11ebfd/src/lib/transaction.ts#L36C5-L36C68
  // so, we don't really need to include this `ComputeBudgetProgram.setComputeUnitLimit` instruction during simulation
  const expectedCUsConsumed = await getSimulationComputeUnits(
    connection,
    [transferIx],
    payer.publicKey,
    [], // Address Lookup tables, optionally we can provide empty array here
  );
  console.log(`Expected CUs to be consumed by tx: ${expectedCUsConsumed} CUs`);

  // we will also include the instructions which set -
  //  1. PricePerComputeUnit
  const addPricePerComputeUnit = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000_000, // 1 lamport
  });

  // totalExpectedCUs for executing two instructions
  // this function, getSimulationComputeUnits, already includes the CUs (150) required for ComputeBudgetProgram.setComputeUnitLimit
  // https://github.com/solana-developers/helpers/blob/a77a7fa9b605b218dff5c4a1c5e86cec4f11ebfd/src/lib/transaction.ts#L36C5-L36C68
  // so, we don't really need to include this `ComputeBudgetProgram.setComputeUnitLimit` instruction during simulation
  const instructions = [addPricePerComputeUnit, transferIx];

  const totalExpectedCUs = await getSimulationComputeUnits(
    connection,
    instructions,
    payer.publicKey,
    [], // Address Lookup tables, optionally we can provide empty array here
  );
  console.log(`Total Expected CUs to be consumed by tx: ${totalExpectedCUs} CUs`);

  if (totalExpectedCUs) {
    const modifyComputeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
      units: totalExpectedCUs,
    });
    instructions.unshift(modifyComputeUnitLimit);
  }

  // build tx with simulated ComputeUnitLimit
  const txWithOptimalCUsLimit = await buildTx(
    instructions,
    payer.publicKey,
  );
  txWithOptimalCUsLimit.sign([payer]);

  // send tx with optimal ComputeUnitLimits
  console.log("Sending transaction with", {
    ComputeUnitLimit: totalExpectedCUs,
    PricePerComputeUnit: 1_000_000,
  })
  const sig = await connection.sendTransaction(txWithOptimalCUsLimit);
  // expected tx fee will be => (ComputeUnitLimit * PricePerCU) + No.of Sig
  // (450 * 1) + 5000 => 5400 lamports
  console.log("Transaction submitted:", explorerURL({ txSignature: sig }));
  // when we view the tx on explorer, we will see that tx fee are much less than previous tx

  // more on the optimising tx fees
  // we can also fetch the optimal `PricePerComputeUnit` which will help to increase the possibility of successful tx
  // reference: https://solana.com/developers/guides/advanced/how-to-use-priority-fees#how-do-i-estimate-priority-fees
})()