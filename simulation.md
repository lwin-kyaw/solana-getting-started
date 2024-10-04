## Transaction Simulation
> TLDR: Alternatively, you can check this script [/src/4.simulation.ts](https://github.com/lwin-kyaw/solana-getting-started/blob/main/src/4.simulations.ts) to inspect how simulation can be done and return values from the simulation.

Transaction Simulations are supported natively in Solana and done off-chain by the RPC-Servers via `simulationTransaction` [RPC method](https://solana.com/docs/rpc/http/simulatetransaction).
We can do simulation any transactions or instructions, by default, the simulated transactions are not required to be signed. However, we can include the signature verification in the simulation by setting `sig_verify` to `true` in the simulation config.
Simulation does not mutate any state in the network, RPC servers have the up-to-date internal state and simulations are done against those states.
During Simulation
- transaction data is decoded
- every operations inside the instructions provided are executed against the states of RPC Server
- verify and validate signature against the provided account pubkey, if `sig_verify` is set to `true` in the simulation config

### Simulation higher-level flow
![Screenshot 2024-10-04 at 11 57 13](https://github.com/user-attachments/assets/a51e3859-209a-47ce-8b41-04335c34842b)
There are two major components which play the huge role in the simulation
- RPC Server
   - RPC server itself does not do the simulation
   - it verify the signature if `sig_verify` is set to `true` in the config
   - it relays the transaction input to `bank server` to simulate transaction
- Bank Server
   - bank server has the local forked bank state which is the recent snapshot of the ledger
   - the bank server validates and executes the instructions against the state in the bank
   - also measure the compute units used to execute each operation in the transaction/instructions
   - the simulation behaviour is very close to the actual transaction, except it does not commit the simulated state changes to the ledger
Reference:
- https://github.com/joncinque/solana
- bank simulation (https://github.com/joncinque/solana/blob/master/banks-server/src/banks_server.rs#L176)
- rpc simulation (https://github.com/joncinque/solana/blob/master/rpc/src/rpc.rs#L3772)

### Where and how simulations are used?
Simulations can be used for (not limited to) following operations
- [Preflight checks](https://solana.com/docs/advanced/retry#the-cost-of-skipping-preflight)
- [Compute Unit Estimation](https://solana.com/developers/guides/advanced/how-to-use-priority-fees#how-do-i-estimate-priority-fees)

#### Preflight checkss
In solana, preflight checks are performed before transactions are submitted to network, by default and do the followings -
- Signature verification
- Validate blokhash
- Transaction simulation
Preflight checks are very useful in `sendTransaction` and majority of the errors can be catched during the preflights.
> Preflights are not compulsory but recommended and can be skipped/disabled by setting `skipPreflightCheck` to `true` in `SendTransactionConfig`.
> Successful preflight does not guarantee the successful transaction, sometimes transactions might be failed due to [UDP Packet loss](https://solana.com/docs/advanced/retry#how-transactions-get-dropped) during the times of intense network load.

#### `ComputeUnit` Estimation
> You can inspect and run this script, [/src/5.optimalTxFees.ts](https://github.com/lwin-kyaw/solana-getting-started/blob/main/src/5.optimalTxFees.ts) for calculation of optimal transaction fees.

RPC Server executes every operations required for transaction/instructions provided in simulation input, thus it can estimate almost exact amount of minimal `ComputeUnits` required by a transaction.
In rare cases, the RPC Server state is not sync with the network and estimation could go wrong, but the error margin is very less and it's less likely to happen.
Estimated `ComputeUnits` can be set to `ComputeUnitLimit` for the transaction and very useful in caclulation of [Prioritization Fees](https://github.com/lwin-kyaw/solana-getting-started/blob/main/TxFee.md#requested-computeunitlimit-vs-actual-consumed-computeunit).
Optimizing `ComputeUnitsLimit` using transaction simulation enables users to pay less transaction fee as well as increases the [higher chances](https://github.com/solana-labs/solana/pull/34888) of transaction landings.

