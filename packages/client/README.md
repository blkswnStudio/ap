# Start the development stack

You will the needed values in the .env file.

- NEXT_PUBLIC_API_MOCKING: Will use the mock server that imitates the subgraph API
- NEXT_PUBLIC_CONTRACT_MOCKING: Will supply dummy data that is usually resolved over the contracts and will abstract contract mutation calls.

You can choose the combination you need.

# Start the integration stack

1. Follow the setup of an ethereum node and a local graph-node like described in the subgraph package.
2. Connect your Metamask to the local node. Follow [this article](https://medium.com/@kaishinaw/connecting-metamask-with-a-local-hardhat-network-7d8cea604dc6) or [search MM for more info](https://support.metamask.io/hc/en-us/articles/360015290012-Using-a-local-node). Make sure you use the demo address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" from the deployment script as it is receiving all the Collateral Tokens.
3. Have fun testing.

# Preparations for testing

- add all the ERC tokens to your local Metamask wallet. To do this just click "Add new Token" and paste the address, you will see active balances of your ERC20.
