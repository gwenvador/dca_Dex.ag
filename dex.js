require('log-timestamp');
const ethers = require('ethers');
const { Contract } = require('ethers');
const request = require('request-promise');

/////////User settings//////////
const mnemonic = 'your mnemonic';
ethersWallet = ethersWallet.connect(infuraProvider, 'infura api key');

const fromToken = "DAI"
const toToken = "ETH"
const fromAmount = 10
const dex = "best"
/////////////////////////////////////

const infuraProvider = new ethers.providers.InfuraProvider('homestead');
let ethersWallet = new ethers.Wallet.fromMnemonic(mnemonic);

const gasLimit = 500000;

const ERC20_abi = [
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
        {
            "name": "_owner",
            "type": "address"
        },
        {
            "name": "_spender",
            "type": "address"
        }
    ],
    "name": "allowance",
    "outputs": [
        {
            "name": "",
            "type": "uint256"
        }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

start()

async function getBalance(tokenAddress) {
  let contract = new Contract(tokenAddress, ERC20_abi, infuraProvider);
  balance = await contract.balanceOf(ethersWallet.address);
  return balance.toString();
}

async function getAllowance(tokenAddress,spenderAddress) {
  let contract = new Contract(tokenAddress, ERC20_abi, infuraProvider);
  balance = await contract.allowance(ethersWallet.address, spenderAddress);
  return balance.toString();
}

async function getDexAgTrade() {
    try {
      let trade = await request('https://api.dex.ag/trade?from='+ fromToken + '&to=' + toToken + '&fromAmount='+fromAmount+'&dex='+dex);
      return JSON.parse(trade);
    } catch (err) {
      console.log('Error request trade DEX.AG');
    }
}

async function approveToken(token, spender, amount) {
    // First 4 bytes of the hash of "fee()" for the sighash selector
    let funcHash = ethers.utils.hexDataSlice(ethers.utils.id('approve(address,uint256)'), 0, 4);

    let abi = new ethers.utils.AbiCoder();
    let inputs = [{
        name: 'spender',
        type: 'address'
      }, {
        name: 'amount',
        type: 'uint256'
      }];

    let params = [spender, amount];
    let bytes = abi.encode(inputs, params).substr(2);

    // construct approval data from function hash and parameters
    let inputData = `${funcHash}${bytes}`;
    let nonce = await infuraProvider.getTransactionCount(ethersWallet.address);
    let gasPrice = await infuraProvider.getGasPrice();

    let transaction = {
        to: token,
        nonce: nonce,
        gasLimit: gasLimit, // You will want to use estimateGas instead for real apps
        gasPrice: gasPrice,
        data: inputData
    }

    let tx = await ethersWallet.sendTransaction(transaction);
}

async function sendTrade(trade) {
    let nonce = await infuraProvider.getTransactionCount(ethersWallet.address);
    let gasPrice = await infuraProvider.getGasPrice();
    if (trade.metadata.gasPrice) {
        // Use the contract gas price if specified (Bancor)
        gasPrice = trade.metadata.gasPrice
    }

    let transaction = trade.trade;
    transaction.nonce = nonce;
    transaction.gasPrice = Number(gasPrice);
    transaction.gasLimit = gasLimit; // You will want to use estimateGas instead for real apps
    transaction.value = Number(transaction.value);

    let tx = await ethersWallet.sendTransaction(transaction);
}

async function start() {
  let trade = await getDexAgTrade();
  if (!trade) {
    console.log("Request error from dex.ag")
  }
  else {
    console.log(" ------ Dex.ag request " , trade)
    // Check if enough tokens for the trade
    let balance = await getBalance(trade.metadata.input.address)

    if (parseInt(balance) >= parseInt(trade.metadata.input.amount)) {
      let allowance = await getAllowance(trade.metadata.input.address, trade.metadata.input.spender)
      if (parseInt(allowance) >= parseInt(trade.metadata.input.amount)) {
        await sendTrade(trade);
        console.log("Trade executed")
      } else {
        //Allow transfer of token
        console.log("Approval of Token transfer")
        await approveToken(trade.metadata.input.address, trade.metadata.input.spender, trade.metadata.input.amount);
        await sendTrade(trade);
        console.log("Trade executed")
      }
    }
    else {
      console.log('Token balance to small:', parseInt(balance))
    }
  }
}
