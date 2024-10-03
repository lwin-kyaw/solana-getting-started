## A little research and playing around with Solana
### Pre-requisites
- Solana CLI
### Run
- create `.env` in root directory with the following variables
```bash
# RPC endpoint
RPC_URL=https://api.devnet.solana.com
# absolute path for a local keypair file
# replace with your own file path
LOCAL_PAYER_JSON_ABSPATH="/Users/lwin/.config/solana/id.json"
```
- `npm i`
- `npx ts-node src/<file_name>.ts`
	You can run the example scripts in order to follow along with README.
