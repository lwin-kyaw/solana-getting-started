import "dotenv/config";
import { clusterApiUrl, ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { existsSync, readFileSync } from "fs";


if (!process.env.LOCAL_PAYER_JSON_ABSPATH) {
  throw new Error(`LOCAL_PAYER_JSON_ABSPATH path is required!`);
}

const RPC_URL = process.env.RPC_URL ?? clusterApiUrl("devnet");

export const connection = new Connection(RPC_URL);

export function createPayer() {
  const absPath = process.env.LOCAL_PAYER_JSON_ABSPATH;
  if (!absPath) throw new Error(`LOCAL_PAYER_JSON_ABSPATH path is required!`);
  if (!existsSync(absPath)) throw Error()

  const keyfileBytes = JSON.parse(readFileSync(absPath, { encoding: "utf-8" }));
  const payer = Keypair.fromSecretKey(new Uint8Array(keyfileBytes));

  return payer;
}

export async function getRecentBlockhash() {
  return connection.getLatestBlockhash().then(res => res.blockhash);
}

export async function createRandomAccount() {
  const payer = createPayer();

  // generate new, random wallet
  const keypair = Keypair.generate();

  // on-chain space to be allocated (number of bytes on chain)
  const space = 0;

  // request the cost, `rent` to allocate `space`
  const rent = await connection.getMinimumBalanceForRentExemption(space);
  console.log(`Minimum balance for rent examption: ${rent} lamports.`);

  // create account instruction
  // creating new account is handled by SystemProgram
  const createAccountIx = SystemProgram.createAccount({
    // signer
    fromPubkey: payer.publicKey,
    // new account pubkey
    newAccountPubkey: keypair.publicKey,
    /** Amount of lamports to transfer to the created account */
    lamports: rent,
    // total space allocated
    space,
    // program owner (program owner can write to this account)
    programId: SystemProgram.programId,
  });
  console.log("createAccountIx", createAccountIx);

  const createAccountTx = await buildTx(
    [createAccountIx],
    payer.publicKey,
  );

  // sign the tx
  // expected to use 10_000 lamports since the transaction is signed by two signers (two sigs)
  createAccountTx.sign([payer, keypair]);

  const sig = await connection.sendTransaction(createAccountTx);

  // if you check on the explorer, you should see the transaction fees is 10_000 lamports
  // 5_000 lamports per signature * 2 sigs
  console.log(`New account created ${explorerURL({ txSignature: sig })}`);

  return keypair;
}

export function explorerURL({
  address,
  txSignature,
  cluster,
}: {
  address?: string;
  txSignature?: string;
  cluster?: "devnet" | "testnet" | "mainnet" | "mainnet-beta";
}) {
  let baseUrl: string;
  //
  if (address) baseUrl = `https://explorer.solana.com/address/${address}`;
  else if (txSignature) baseUrl = `https://explorer.solana.com/tx/${txSignature}`;
  else return "[unknown]";

  // auto append the desired search params
  const url = new URL(baseUrl);
  url.searchParams.append("cluster", cluster || "devnet");
  return url.toString() + "\n";
}

export function buildSimpleSolTransferInstruction(params: {
  to: PublicKey,
  from: PublicKey,
  lamports: number,
}) {
  const { from, to, lamports } = params;
  const transferIx = SystemProgram.transfer({
    lamports,
    fromPubkey: from,
    toPubkey: to,
    programId: SystemProgram.programId,
  });
  return transferIx;
}

export async function buildTx(instructions: TransactionInstruction[], payer: PublicKey) {
  const recentBlockhash = await getRecentBlockhash();
  const txMessage = new TransactionMessage({
    instructions,
    payerKey: payer,
    recentBlockhash,
  }).compileToV0Message();

  const tx = new VersionedTransaction(txMessage);
  return tx;
}
// instructions: TransactionInstruction[],
//   payer: PublicKey,
//   computeUnitPrice: number = 1_000_000,
//   computeUnitLimit: number = 200_000,
export async function buildTxWithPriorityFees(params: {
  instructions: TransactionInstruction[],
  payer: PublicKey,
  computeUnitPrice?: number,
  computeUnitLimit?: number,
}) {
  const { instructions, payer } = params;
  let { computeUnitLimit, computeUnitPrice } = params;

  // Default compute unit limit for a transaction is 200K CUs
  // A transaction can have max CUs of 1.4 million
  // src: https://solana.com/docs/core/fees#compute-unit-limit
  if (!computeUnitLimit) computeUnitLimit = 200_00;

  if (!computeUnitPrice) computeUnitPrice = 1_000_000;

  const modifyComputeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: computeUnitLimit,
  });

  const addPriorityFeesIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: computeUnitPrice,
  });

  const tx = await buildTx([
    addPriorityFeesIx,
    modifyComputeUnitIx,
    ...instructions,
  ], payer)

  return tx;
}

export async function getRecentPrioritizationFees(accounts: PublicKey[]) {
  // reference: https://solana.com/docs/rpc/http/getrecentprioritizationfees
  const resp = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getRecentPrioritizationFees",
      params: [accounts.map((acc) => acc.toBase58())],
    }),
  });

  const data = await resp.json();

  return data;
}
