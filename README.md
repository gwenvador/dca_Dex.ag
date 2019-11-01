## Node script for Dollar-Cost Averaging on Dex.ag

**Dollar-Cost Averaging (DCA)** is an investment strategy that consists in purchasing an asset periodically on a long term period. Because of the high volatility of cryptocurrency DCA is a great plan to increase your crypto assets.
This script uses [Dex.ag](https://dex.ag) an aggregator of DEX (Decentralized Exchange) to find the best rate and execute the trade.

Based on [DEX.ag API](https://docs.dex.ag/api)

### Instructions
* Install node.js
* Install ethers.js: 
> npm install --save ethers
* Configure the user settings
  * Ethereum Mnemonic Key
  * Tokens to exchange (From, To)
  * Amount
  * Dex to use (best is for best rate). see https://docs.dex.ag/api for list of DEX
  * Infura API key
  * Telegram settings (chat_id and token). see https://www.shellhacks.com/telegram-api-send-message-personal-notification-bot/ to find the settings
* To setup DCA use crontab. Example of launching script everyday at midnight:
> 0 0 * * * /usr/bin/node $DIRECTORY/dex.js >> $DIRECTORY/dex.ag.log 2>&1
