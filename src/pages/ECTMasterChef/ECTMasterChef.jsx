import React, { Component } from 'react';
import { Button, Grid, Input, Dialog, Table, Pagination, Card } from "@alifd/next";

import { Feedback } from '@icedesign/base';
import BigNumber from "bignumber.js";
import { T } from '../../utils/lang';
import './local.scss';
import ERC20Token from '../../contracts/ERC20.json';

const { Row, Col } = Grid;

export default class ECTMasterChef extends Component {
  static displayName = 'ECTMasterChef';

  constructor(props) {
    super(props);
    this.state = {
        ectMasterChef: props.drizzle.contracts.ECTMasterChef,
        ectToken: props.drizzle.contracts.EnergyCellToken,
        weth: props.drizzle.contracts.WETH9,
        accountName: props.drizzleState.accounts[0],
        ectPerBlock: 0,
        startMiningBlock: 0,
        bonusEndBlock: 0,
        bonusMultiplier: 1,
        isStartMining: false,
        totalSupplyECT: 0,
        poolList: [],
        poolId: 0,
        curErc20: null,
        maxDepositAmount: 0,
        depositAmount: 0,
        depositAmountVisible: false,
        refundAmount: 0,
        refundAmountVisible: false,
        withdrawVisible: false,
        intervalId: 0,
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
    let {ectMasterChef, accountName, ectToken, weth} = this.state;

    const wethDecimals = await weth.methods.decimals().call();
    
    let totalSupplyECT = await ectToken.methods.totalSupply().call();
    const ectDecimals = await ectToken.methods.decimals().call();
    totalSupplyECT = new BigNumber(totalSupplyECT).shiftedBy(ectDecimals * -1).toString();
    
    let ectPerBlock = await ectMasterChef.methods.ectPerBlock().call();
    ectPerBlock = new BigNumber(ectPerBlock).shiftedBy(ectDecimals * -1).toString();
    const bonusEndBlock = await ectMasterChef.methods.bonusEndBlock().call();
    const startMiningBlock = await ectMasterChef.methods.startBlock().call();
    const bonusMultiplier = await ectMasterChef.methods.getCurMultiplierPerBlock().call();
    const isStartMining = await ectMasterChef.methods.isStartMining().call();

    const poolLength = await ectMasterChef.methods.poolLength().call();
    console.log('poolLength', poolLength);
    const poolList = [];
    for (let i = 0; i < poolLength; i++) {
      const poolInfo = await ectMasterChef.methods.poolList(i).call();
      console.log('poolInfo', poolInfo);
      if (this.props.drizzle.contracts['ERC20-' + i] == null) {
        this.props.drizzle.addContract({contractName: 'ERC20-' + i, 
                                       web3Contract:new this.props.drizzle.web3.eth.Contract(ERC20Token.abi, poolInfo.lpToken) }, 
                                       []);
      }
      const erc20 = this.props.drizzle.contracts['ERC20-' + i];
      const decimals = await erc20.methods.decimals().call();
      let totalLPAmount = await erc20.methods.balanceOf(ectMasterChef.address).call();
      totalLPAmount = new BigNumber(totalLPAmount).shiftedBy(decimals * -1).toString();
      const lpName = await erc20.methods.symbol().call();

      let myPendingReward = await ectMasterChef.methods.pendingEct(i, accountName).call();
      myPendingReward = new BigNumber(myPendingReward).shiftedBy(ectDecimals * -1).toString();
      console.log('myPendingReward', myPendingReward);

      //const multiplier = await ectMasterChef.methods.getMultiplier(poolInfo.lastRewardBlock, 471).call();
      //console.log('multiplier', multiplier);

      const userInfo = await ectMasterChef.methods.userInfoMap(i, accountName).call();
      let myDepositedLpAmount = userInfo.amount;
      myDepositedLpAmount = new BigNumber(myDepositedLpAmount).shiftedBy(decimals * -1).toString();
      console.log('userInfo', userInfo, 'myDepositedLpAmount', myDepositedLpAmount);

      poolList.push({lpInfo: {totalLPAmount, lpName}, myDepositedLpAmount, myPendingReward, 
                     allocPoint: poolInfo.allocPoint, accEctPerShare: new BigNumber(poolInfo.accEctPerShare).shiftedBy(wethDecimals - 12 - ectDecimals).toString(), 
                     lastRewardBlock: poolInfo.lastRewardBlock,
                     erc20, id: i});
    }
    this.setState({totalSupplyECT, poolList, ectPerBlock, startMiningBlock, bonusEndBlock, bonusMultiplier, isStartMining});
    console.log('state', this.state);
  }

  //发送交易：
  // 1:this.contracts.SimpleStorage.methods.set(this.state.storageAmount).send()
  // 2:stackId = contract.methods["set"].cacheSend(value, {from: drizzleState.accounts[0]});
  //   const txHash = this.props.drizzleState.transactionStack[this.state.stackId];
  //   this.props.drizzleState.transactions[txHash].status
  approve = (erc20) => {
    erc20.methods.approve(this.state.ectMasterChef.address, '0x' + new BigNumber(2).shiftedBy(50).minus(1).toString(16)).send({from: this.state.accountName});
  }
  
  deposit = async (pid, erc20) => {
    this.state.poolId = pid;
    this.state.curErc20 = erc20;
    const balance = await erc20.methods.balanceOf(this.state.accountName).call();
    const decimals = await erc20.methods.decimals().call();
    this.setState({depositAmountVisible: true, maxDepositAmount: new BigNumber(balance).shiftedBy(decimals * -1).toString()})
  }

  withdraw = (pid) => {
    const { ectMasterChef, accountName } = this.state;
    ectMasterChef.methods.withdraw(pid, 0).send({from: accountName});
  }

  refund = (pid, erc20) => {
    this.state.poolId = pid;
    this.state.curErc20 = erc20;
    this.setState({refundAmountVisible: true});
  }

  handleDepoistAmountChange = (value) => {
    this.setState({depositAmount: value});
  }

  onDepositAmountOK = async () => {
    if (this.state.depositAmount == 0 || this.state.depositAmount > this.state.maxDepositAmount) {
      Feedback.toast.error('请输入有效的抵押值');
      return;
    }
    const {curErc20, ectMasterChef, accountName, poolId} = this.state;
    const decimals = await curErc20.methods.decimals().call();
    const amount = '0x' + new BigNumber(this.state.depositAmount).shiftedBy(parseInt(decimals)).toString(16);
    ectMasterChef.methods.deposit(poolId, amount).send({from: accountName});
    this.setState({depositAmount: 0, depositAmountVisible: false});
  }

  handleRefundAmountChange = (value) => {
    this.setState({refundAmount: value});
  }

  onRefundAmountOK = async () => {
    if (this.state.refundAmount == 0) {
      Feedback.toast.error('请输入有效值');
      return;
    }
    const {curErc20, ectMasterChef, accountName, poolId} = this.state;
    const decimals = await curErc20.methods.decimals().call();
    const amount = '0x' + new BigNumber(this.state.refundAmount).shiftedBy(parseInt(decimals)).toString(16);
    ectMasterChef.methods.withdraw(poolId, amount).send({from: accountName});
    this.setState({refundAmount: 0, refundAmountVisible: false});
  }

  render() {

    return (
      <div className='contain' sytle={styles.all}>
        <div className='mainContainer'> 
          <div className='cicles'>
            <div class='titleSign'></div>
              <div className='titles'>
                    <div className='mainText'>当前ECT总量{this.state.totalSupplyECT}，每区块产出ECT为{this.state.ectPerBlock * this.state.bonusMultiplier}
                   {this.state.bonusMultiplier > 1 ? '，在区块号大于' + this.state.bonusEndBlock + '时，ECT产出将恢复为' + this.state.ectPerBlock + '/区块': ''}
                    {this.state.isStartMining ? <p>起始挖矿区块号为{this.state.startMiningBlock}</p> : <p>尚未开始挖矿，起始挖矿区块号为{this.state.startMiningBlock}</p>}
                </div>
              </div>
          </div>
          <Row wrap justify="space-around">
            {
              this.state.poolList.map(poolInfo => {
                return <Col span='7'>
                        <Card key='ectMasterChef' free style={{width: 450, background: '#fffff0', border: '10px solid #ffffff'}}>
                          <Card.Header title={'抵押' + poolInfo.lpInfo.lpName + ' 挖ECT'} extra={'产出权重 ' + poolInfo.allocPoint}/>
                          <Card.Content>
                            <p>
                              总抵押量：{poolInfo.lpInfo.totalLPAmount} {poolInfo.lpInfo.lpName}
                            </p>
                            <p>
                              我的抵押量: {poolInfo.myDepositedLpAmount} {poolInfo.lpInfo.lpName} 
                            </p>
                            <p>
                              我可提取矿石数: {poolInfo.myPendingReward} ECT 
                            </p>
                            <p>
                              累计收益率: {poolInfo.accEctPerShare} ECT / {poolInfo.lpInfo.lpName}
                            </p>
                          </Card.Content>
                          <Card.Actions>
                            <Button type="primary" key="action0" onClick={() => this.approve(poolInfo.erc20)}>授权{poolInfo.lpInfo.lpName}</Button>
                            <Button type="primary" key="action1" onClick={() => this.deposit(poolInfo.id, poolInfo.erc20)}>抵押{poolInfo.lpInfo.lpName}</Button>
                            <Button type="primary" key="action2" onClick={() => this.withdraw(poolInfo.id)}>提取ECT</Button>
                            <Button type="primary" key="action3" onClick={() => this.refund(poolInfo.id, poolInfo.erc20)}>取回{poolInfo.lpInfo.lpName}</Button>
                          </Card.Actions>
                        </Card>
                       </Col>
              })
            }
          </Row>
        </div>
        <Dialog style={{ width: '400px'}}
          visible={this.state.depositAmountVisible}
          title="输入抵押金额"
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={this.onDepositAmountOK.bind(this)}
          onCancel={() => this.setState({depositAmountVisible: false})}
          onClose={() => this.setState({depositAmountVisible: false})}
        >
          <Input hasClear autoFocus
            onChange={this.handleDepoistAmountChange.bind(this)}
            style={{ width: '100%'}}
            innerBefore="抵押金额"
            value={this.state.depositAmount}
            placeholder={'最大可抵押值:' + this.state.maxDepositAmount}
          />
        </Dialog>
        <Dialog style={{ width: '400px'}}
          visible={this.state.refundAmountVisible}
          title="输入取回金额"
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={this.onRefundAmountOK.bind(this)}
          onCancel={() => this.setState({refundAmountVisible: false})}
          onClose={() => this.setState({refundAmountVisible: false})}
        >
          <Input hasClear autoFocus
            onChange={this.handleRefundAmountChange.bind(this)}
            style={{ width: '100%'}}
            innerBefore="取回金额"
            value={this.state.refundAmount}
          />
        </Dialog>
      </div>
    );
  }
}

const styles = {
    all: {
      height: 'auto',
      display: 'flex',
      justifyContent: 'start',
      flexDirection: 'column',
      alignItems: 'center'
    },
    title: {
      margin: '0',
      padding: '15px 0',
      fonSize: '16px',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      color: 'rgba(255,255,255,.85)',
      fontWeight: '500',
      borderBottom: '1px solid rgba(255,255,255,.21)',
      margin:'0 30px'
    },
    summary: {
      padding: '20px',
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
  };