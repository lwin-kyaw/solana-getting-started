import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { buildTx, connection, createPayer, explorerURL } from "./lib/utils";

(async function() {  
  const payer = createPayer();

  // airdrop if the account has lower balance than 1 SOL
  const accountBalance = await connection.getBalance(payer.publicKey);
  console.log("Current balance of 'payer' (in lamports):", accountBalance);
  console.log("Current balance of 'payer' (in SOL):", accountBalance / LAMPORTS_PER_SOL);

  if (accountBalance <= LAMPORTS_PER_SOL) {
    console.log(`funding to account ${payer.publicKey} from devnet airdrop`);
    await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
  }

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
})()