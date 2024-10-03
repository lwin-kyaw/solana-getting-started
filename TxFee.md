## Fees on solana
In solana, generally there're three types of [fees](https://solana.com/docs/core/fees) -  
- Rental fees
- Transaction fees
- Prioritization fees

The first one is related to storage space rental when new accounts are created on the network. The later twos are related to the transactions and we will focus on the transactions here.
### Transaction fees 
Total fees required to submit transaction to the network can be calculated by combination of Base Fees (and optionally Prioritization fees).
![Screenshot 2024-10-04 at 00 55 38](https://github.com/user-attachments/assets/478c615e-1eec-4bcf-bc69-784b61f9a8f2)


### Base Fees
By default, solana networks (and validators) only charge **fixed Base Fees** for a transaction. Base Fee is **usually** the *cost to verify signature* and has fixed amount of **5000 lamports per signature**. In other words, without any extra configuration, users only need to pay **signature validation fees** for transactions. For example, 
- for a simple SOL transfer, the sender only needs to pay fixed amount of `0.000005` SOL as transaction fee for the sender's signature regardless of the network traffic and amounts.
- for `AccountCreation`, the transaction is needed to be signed by both new account and the fee payer. So, the total transaction cost will be `2 signatures * 5k lamports = 10k lamports`.
- Optionally, you can run the these scripts (`src/1.createAccount.ts` and `src/2.transaction.ts`) to inspect tx costs

However, in the [recent](https://docs.solanalabs.com/proposals/comprehensive-compute-fees#fee) proposal for the complex transactions (such as `precompiled program instructions`) will be charged as base fees due to the high computation costs.
> Base fees are charged upfront before any computation and hence they do not have any influence on the Computation costs on chain and validators' transaction scheduling decisions.

### Prioritization Fees
> Optionally, we can check this script `src/3.priorityFees.ts` to inspect how prioritization fee works and affects on the transaction on chain.

Transactions can be boosted and increase the guarantee of successful landings on chain by setting `Prioritization Fees`. Transactions with higher priority fees are more likely to be included on chain, compared to the transactions with based fees. Users can send transactions only with the Base Fees but when blocks are saturated with transactions with priority fees, [validators will drop transactions without priority fees](https://solana.com/developers/guides/advanced/how-to-use-priority-fees#why-should-i-use-priority-fees). Prioritization fees are highly dependable on the [Compute Units](https://solana.com/developers/guides/advanced/how-to-use-priority-fees#why-should-i-use-priority-fees) required to execute the transaction.
Prioritization fees are set upon each compute unit and can be set by modifying `ComputeUnitPrice` value in `ComputeBudget` program. By default, `ComputeUnitPrice` is zero. The calculated prioritization fees are added on top of the Base Fees to form the final fee.
#### Compute Units
All the operations on chain require certain amount of computation resources and Validators are responsible to execute those operations using their computation resources. Depending on each operation in Instructions within a transaction, the computation unit may [differ](https://github.com/anza-xyz/agave/blob/b7bbe36918f23d98e2e73502e3c4cba78d395ba9/program-runtime/src/compute_budget.rs#L133-L178).
In solana, each transaction has default value of `200K Compute Units` per transaction. This can be modified by setting `ComputeUnitLimit` in `ComputeBudget` program. The maximum value of `ComputeUnitLimit` for a transaction is `1.4 million CUs` and `200K CUs` for an instruction respectively.
As a transaction is processed, compute units are incrementally consumed by each of its instructions being executed and will result in failure when consumed units exceed the `ComputeUnitLimit`.
#### How prioritization fees are being added to transaction fee?
Prioritization fees can be computed by `ComputeUnitPrice * ComputeUnitLimit` and is later added to the Base Fee.
Final fee => `(ComputeUnitPrice * ComputeUnitLimit) + (5K lamports * No.of.Signature used)`.
#### Requested `ComputeUnitLimit` vs Actual Consumed `ComputeUnit`
Actual consumed units must be always less than or equal `ComputeUnitLimit`, otherwise transaction will fail. Most of the time the actual Compute Units consumed by transaction is way less than the default `ComputeUnitLimit(200K CU)`. Please run this [script](https://github.com/lwin-kyaw/solana-getting-started/blob/main/src/3.priorityFees.ts) to view in action how much actual Compute Units consumed by a normal transaction is less than default `ComputeUnitLimit`. 
> Users need to pay for the requested `ComputeUnitLimit`, instead of actual consumed `ComputeUnit`, so it's important to set the optimal value for `ComputeUnitLimit`.
> E.g, A simple transaction which transfer SOL, only consumes `150 CU` for the whole operation, however with the default `ComputeUnitLimit`, (assuming `ComputeUnitPrice` is set to 1 lamport) user will have to pay
> `1 * 200_000 + 5000 = 205_000 lamports` instead of `1 * 150 + 5000 = 5_150 lamports`.  

**Over requesting the `ComputeUnitLimit` doesn't mean that the transaction will have higher priority in scheduling. When two transactions have the same `ComputeUnitPrice` value, the transaction with less `ComputeUnitLimit` has higher priority to be included in the block (https://github.com/solana-labs/solana/pull/34888). In another word, transaction with less `ComputeUnitLimit` are more likely to be included in currently processing thread in the validator.**
Therefore, setting optimal `ComputeUnitLimit` is not only cost effective but also have higher chance of success.

Some of the program instructions (e.g. SystemProgram and ComputeBudget Program) have fixed amount of `Compute Unit`. As a transaction gets complicated with variable `Compute Unit` amounts, it's difficult to calculate the minimal `ComputeUnitLimit` required to submit the transaction.

However, with the help of transaction [simulation](https://github.com/lwin-kyaw/solana-getting-started/blob/main/simulation.md), we can compute the exact amount of `ComputeUnitLimit` required for a transaction which relatively reduces the transaction costs and increases the higher guarantee of landings on chain. 




