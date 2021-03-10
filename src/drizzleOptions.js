import Web3 from "web3";
import HDANFT from "./contracts/HDANFT.json";
import HDBNFT from "./contracts/HDBNFT.json";
import XToken from "./contracts/XToken.json";
import Trade from "./contracts/Trade.json";
import Usdt from "./contracts/ERC20.json";

HDANFT.networks = {}
HDBNFT.networks = {}
XToken.networks = {}
Trade.networks = {}
Usdt.networks = {}

HDANFT.networks['128'] = {address: '0xC9Bf4a208C5b718cf2835CCee39555795b4Ea4A6'};
HDANFT.contractName = 'HDANFT';

HDBNFT.networks['128'] = {address: '0xB39Fc20e892E128F2B50811fD609D1597253b57B'};
HDBNFT.contractName = 'HDBNFT';

XToken.networks['128'] = {address: '0xA48ce42AA6ac60cBD34ec3e906a03a6E85278BEA'};
XToken.contractName = 'XToken';

Trade.networks['128'] = {address: '0x1fFc60F43828C5D581E131E0FB2468d0cb662C14'};
Trade.contractName = 'Trade';

Usdt.networks['128'] = {address: '0xa71EdC38d189767582C38A3145b5873052c3e47a'};
Usdt.contractName = 'Usdt';


const options = {
  web3: {
    block: true,
    customProvider: new Web3(window.ethereum),
  },
  contracts: [
    HDANFT, HDBNFT, XToken, Trade, Usdt
  ],
  events: {
    
  },
  polls: {
    blocks: 3000,
  },
  //syncAlways: true,
};

export default options;
