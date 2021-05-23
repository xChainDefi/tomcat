import Web3 from "web3";
import TomCatNFT from "./contracts/TomCatNFT.json";
import TradeMarket from "./contracts/TradeMarket.json";
import TomERC20 from "./contracts/ERC20.json";
import AirdropTom from "./contracts/AirdropTom.json";

TomCatNFT.networks['128'] = {address: '0xb99fD33a13e4402c10eBE32a3B8b399d6f3aBD3b'};
TradeMarket.networks['128'] = {address: '0xF62dF8eC20D59111C5d8a3397558a21bE35ffe61'};
TomERC20.networks['128'] = {address: '0x391942D8a0CA5ceF6C1D3355A27E2814060a8a7a'};
AirdropTom.networks['128'] = {address: '0xdE73546E728334D674b018444150a8C3E0E000c8'};


const options = {
  web3: {
    block: true,
    customProvider: new Web3(window.ethereum),
  },
  contracts: [
    TomCatNFT, TradeMarket, TomERC20, AirdropTom
  ],
  events: {
    TomCatNFT: [],
    TradeMarket: [],
    TomERC20: []
  },
  polls: {
    blocks: 3000,
  },
  //syncAlways: true,
};

export default options;
