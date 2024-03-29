require('log-timestamp');
const ethers = require('ethers');
const { Contract } = require('ethers');
const request = require('request-promise');

///////////User settings//////////////
const mnemonic = 'your mnemonic';
let ethersWallet = new ethers.Wallet.fromMnemonic(mnemonic);
const infuraProvider = new ethers.providers.InfuraProvider('homestead');
ethersWallet = ethersWallet.connect(infuraProvider, 'infura api key');

const fromToken = "DAI"
const toToken = "ETH"
const fromAmount = 10
const dex = "best"  //best, uniswap, bancor, oasis, radar-relay, kyber

const gasPriceSpeed = "average" //fast, fastest, safeLow, average => https://docs.ethgasstation.info/

const gasLimit = 500000;

//Telegram notifications parameters
token = "token"
chat_id = "chat_id"

/////////////////////////////////////

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
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
          "name": "",
          "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
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

function logging(message) {
  //Console notifications
  console.log(message)
  //Telegram notifications
  request("https://api.telegram.org/bot"+token+"/sendMessage?chat_id="+chat_id+"&text="+message)
}

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

async function getDecimals(tokenAddress) {
  let contract = new Contract(tokenAddress, ERC20_abi, infuraProvider);
  decimals = await contract.decimals();
  return decimals.toString();
}

async function getDexAgTrade() {
  try {
    let trade = await request('https://api.dex.ag/trade?from='+ fromToken + '&to=' + toToken + '&fromAmount='+fromAmount+'&dex='+dex);
    return JSON.parse(trade);
  } catch (err) {
    logging('Error reaching DEX.AG');
  }
}

async function getGasPrice() {
  try {
    let gasPrice = await request('https://ethgasstation.info/json/ethgasAPI.json');
    return Number(JSON.parse(gasPrice)[gasPriceSpeed])*10**8;
  } catch (err) {
    logging('Error reaching ethgasstation');
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

  let gasPrice = await getGasPrice();

  let transaction = {
      to: token,
      nonce: nonce,
      gasLimit: gasLimit, // You will want to use estimateGas instead for real apps
      gasPrice: gasPrice,
      data: inputData
  }

  // transaction.gasLimit = await infuraProvider.estimateGas(transaction);

  let tx = await ethersWallet.sendTransaction(transaction);
  logging(" ------ Transaction approve token " + tx);
}

async function sendTrade(trade) {
    let nonce = await infuraProvider.getTransactionCount(ethersWallet.address);
    let gasPrice = await getGasPrice();
    if (trade.metadata.gasPrice) {
        // Use the contract gas price if specified (Bancor)
        gasPrice = trade.metadata.gasPrice
    }

    let transaction = trade.trade;
    transaction.nonce = nonce;
    transaction.gasPrice = gasPrice;
    transaction.gasLimit = gasLimit; // You will want to use estimateGas instead for real apps
    transaction.value = Number(transaction.value);
    // transaction.gasLimit = await infuraProvider.estimateGas(transaction);

    if (trade.metadata.source && trade.metadata.query) {
      logging(" ------ Transaction sent. You should receive "
            + trade.metadata.query.fromAmount*trade.metadata.source.price
            + trade.metadata.query.to + " via " + trade.metadata.source.dex)

      let tx = await ethersWallet.sendTransaction(transaction)
      logging(" ------ Check etherscan: https://etherscan.io/tx/" + tx.hash )
    }
    else {
      logging(" ------ Error in DEX.ag request. Missing data for the transaction")
    }

}

async function start() {
  let trade = await getDexAgTrade();
  if (!trade) {
    logging("Request error from dex.ag")
  }
  else {
    logging("Dex.ag request " + JSON.stringify(trade.metadata))
    // Check if enough tokens for the trade and return from dex.ag correct
    let balance = await getBalance(trade.metadata.input.address)
    let decimals = await getDecimals(trade.metadata.input.address)

    //If balance is enough
    if (parseInt(balance) >= parseInt(trade.metadata.input.amount)) {
      let allowance = await getAllowance(trade.metadata.input.address, trade.metadata.input.spender)
      //If allowance is enough for transfer
      if (parseInt(allowance) >= parseInt(trade.metadata.input.amount)) {
        await sendTrade(trade);
      } else {
        //Allow transfer of token
        await approveToken(trade.metadata.input.address, trade.metadata.input.spender, trade.metadata.input.amount);
        await sendTrade(trade);
      }
    }
    else {
      logging('Token ' + fromToken + ' balance too small:' + parseInt(balance)/10**parseInt(decimals) + ' should be higher than '+ fromAmount)
    }
  }
}
