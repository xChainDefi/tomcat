import React, { Component } from 'react';
import { Dialog, Input, Table, Button, Tag, Balloon, Grid, Card } from '@alifd/next';
import { Select, Feedback, Icon } from '@icedesign/base';
import IceContainer from '@icedesign/container';
import BigNumber from 'bignumber.js';
import { encode } from 'rlp';
import * as utils from '../../utils/utils';
import { T, isChinese } from '../../utils/lang';
import * as Constant from '../../utils/constant';
import './local.scss';
import Nodata from '../../components/Common/Nodata';
import {withTranslation} from 'react-i18next';
import ERC20Token from '../../contracts/ERC20.json';

const VOTER = 1;
const PRODUCER = 2;
const OTHER = 3;
const { Row, Col } = Grid;


const alternativenodesImg = require('./images/miners_icon_Alternativenodes.png');
const isapieceofImg = require('./images/miners_icon_Isapieceof.png');
const myImg = require('./images/miners_icon_my.png');
const pieceImg = require('./images/miners_icon_piece.png');

class StakeMining extends Component {
  static displayName = 'StakeMining';


  constructor(props) {
    super(props);

    this.state = {
      stakingMiningPool: props.drizzle.contracts.StakingMiningPool,
      skillDividentToken: props.drizzle.contracts.SkillDividentToken,
      weth: props.drizzle.contracts.WETH9,
      accountName: props.drizzleState.accounts[0],
      poolInfoList: [],
    };
  }

  componentDidMount = () => {
    this.syncData();
    this.state.intervalId = setInterval(() => { this.syncData(); }, 15000);
  }

  componentWillUnmount = () => {
    if (this.state.intervalId > 0) {
      clearInterval(this.state.intervalId);
    }
  }

  syncData = async () => {
    let {stakingMiningPool, skillDividentToken, accountName, weth, poolInfoList} = this.state;

    const wethDecimals = await weth.methods.decimals().call();


    poolInfoList = [];
    const prefixOfStakedToken = 'ERC20-Staked-';
    const prefixOfMinedToken = 'ERC20-Mined-';
    const poolLength = await stakingMiningPool.methods.poolLength().call();
    for (let i = 0; i < poolLength; i++) {
      const poolInfo = await stakingMiningPool.methods.poolInfoList(i).call();
      console.log(poolInfo);
      if (this.props.drizzle.contracts[prefixOfStakedToken + i] == null) {
        this.props.drizzle.addContract({contractName: prefixOfStakedToken + i, 
                                       web3Contract:new this.props.drizzle.web3.eth.Contract(ERC20Token.abi, poolInfo.stakedToken) }, 
                                       []);
      }
      if (this.props.drizzle.contracts[prefixOfMinedToken + i] == null) {
        this.props.drizzle.addContract({contractName: prefixOfMinedToken + i, 
                                       web3Contract:new this.props.drizzle.web3.eth.Contract(ERC20Token.abi, poolInfo.minedToken) }, 
                                       []);
      }
      poolInfo.stakedERC20 = this.props.drizzle.contracts[prefixOfStakedToken + i];
      const stakeDecimals = await poolInfo.stakedERC20.methods.decimals().call();
      poolInfo.stakedAmount = new BigNumber(poolInfo.stakedAmount).shiftedBy(parseInt(stakeDecimals) * -1).toString();
      poolInfo.stakedTokenSymbol = await poolInfo.stakedERC20.methods.symbol().call();

      poolInfo.minedERC20 = this.props.drizzle.contracts[prefixOfMinedToken + i];
      const mineDecimals = await poolInfo.minedERC20.methods.decimals().call();
      poolInfo.minedAmount = new BigNumber(poolInfo.minedAmount).shiftedBy(parseInt(mineDecimals) * -1).toString();
      poolInfo.minedTokenSymbol = await poolInfo.minedERC20.methods.symbol().call();

      poolInfo.accTokenPerShare = new BigNumber(poolInfo.accEctPerShare).shiftedBy(mineDecimals - 12 - stakeDecimals).toString();
      poolInfo.id = i;
      poolInfoList.push(poolInfo);
    }
  }

  approve = (erc20) => {
    erc20.methods.approve(this.state.ectMasterChef.address, '0x' + new BigNumber(2).shiftedBy(50).minus(1).toString(16)).send({from: this.state.accountName});
  }

  deposit = () => {

  }

  withdraw = () => {
    
  }

  refund = () => {
    
  }
    /*
        struct PoolInfo {
            IERC20 stakedERC20;       // 需要抵押的代币
            IERC20 minedERC20;        // 被挖出的代币

            uint256 stakedAmount; stakedTokenSymbol       // 本池子已经抵押的代币数量，需要单独统计，因为代币只能打给整个合约，而不能给本池子
            uint256 minedAmount;  minedTokenSymbol       // 本池子可挖的代币数量，需要单独统计，因为代币只能打给整个合约，而不能给本池子
            uint256 totalMinedAmount;         // 本池子总的挖出的代币数量，需要单独统计，因为代币只能打给整个合约，而不能给本池子
            address fromAccountOfStakedToken;  // 指定抵押的代币只能来自此地址（合约地址 or 用户地址），为0表示无限制
            uint256 lastRewardBlock;  // 最近计算过激励的区块高度
            uint256 accTokenPerShare;   // 累计每股可分到的token数量，为了防止小数出现，会乘以1e12
        }
    
    */
  render() {
    const {t} = this.props;
    return (
      <div className='contain' sytle={styles.all}>
        <div className='mainContainer'> 
          <div className='cicles'>
            <div className='titleSign'></div>
            <div className='titles'>
              <div className='mainText'>每个Pool会根据抵押币的比重进行分红，Pool之间独立挖矿</div>
            </div>
          </div>
          <Row wrap justify="space-around">
            {
              this.state.poolInfoList.map(poolInfo => {
                return <Col span='7'>
                        <Card key='stakingMining' free style={{width: 450, background: '#fffff0', border: '10px solid #ffffff'}}>
                          <Card.Header title={'抵押' + poolInfo.stakedTokenSymbol + ' 挖' + poolInfo.minedTokenSymbol} />
                          <Card.Content>
                            <p>
                              总抵押量：{poolInfo.stakedAmount} {poolInfo.stakedTokenSymbol}
                            </p>
                            <p>
                              我的抵押量: {poolInfo.myDepositedLpAmount} {poolInfo.stakedTokenSymbol} 
                            </p>
                            <p>
                              总提取矿石: {poolInfo.totalMinedAmount} {poolInfo.minedTokenSymbol} 
                            </p>
                            <p>
                              未提取矿石: {poolInfo.minedAmount} {poolInfo.minedTokenSymbol} 
                            </p>
                            <p>
                              累计收益率: {poolInfo.accTokenPerShare} {poolInfo.minedTokenSymbol} / {poolInfo.stakedTokenSymbol}
                            </p>
                          </Card.Content>
                          <Card.Actions>
                            <Button type="primary" key="action0" onClick={() => this.approve(poolInfo.stakedERC20)}>授权{poolInfo.stakedTokenSymbol}</Button>
                            <Button type="primary" key="action1" onClick={() => this.deposit(poolInfo.id, poolInfo.stakedERC20)}>抵押{poolInfo.stakedTokenSymbol}</Button>
                            <Button type="primary" key="action2" onClick={() => this.withdraw(poolInfo.id, poolInfo.minedERC20)}>提取{poolInfo.minedTokenSymbol}</Button>
                            <Button type="primary" key="action3" onClick={() => this.refund(poolInfo.id, poolInfo.stakedERC20)}>取回{poolInfo.stakedTokenSymbol}</Button>
                          </Card.Actions>
                        </Card>
                       </Col>
              })
            }
          </Row>
        </div>
      </div>
    );
  }
}

const styles = {
  all: {
    height: 'auto',
    background: '#f5f6fa',
    display: 'flex',
    justifyContent: 'start',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop:'334px',
  },
  banner: {
    width: '100%', 
    height: '310px', 
    paddingBottom: '-30px',
    backgroundColor: '#080a20',
    display: 'flex',
    justifyContent: 'start',
    flexDirection: 'column',
    alignItems: 'center'
  },
  table: {
    display: 'flex',
    justifyContent: 'start',
    flexDirection: 'column',
    //alignItems: 'start'
  },
  item: {
    height: '40px',
    lineHeight: '40px',
  },
  label: {
    display: 'inline-block',
    fontWeight: '500',
    minWidth: '74px',
    width: '150px',
  },
  btn: {
    marginRight: '20px',
    borderRadius: '20px'
  },
  inputBoder: {
    borderBottom: '1px solid #dbdbdb',
    borderTop: '0px',
    borderLeft: '0px',
    borderRight: '0px',
  },
  selectBoder: {
    borderBottom: '1px solid #dbdbdb',
    borderTop: '0px',
    borderLeft: '0px',
    borderRight: '0px',
  },
  dialogBtn: {
    width: '100%',
    height: '60px',
    borderRadius: '2px',
    backgroundColor: '#5c67f2'
  }
};

export default withTranslation()(StakeMining);