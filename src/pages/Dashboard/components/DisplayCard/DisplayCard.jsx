/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint react/jsx-no-target-blank: 0 */
import React, { Component } from 'react';
import IceContainer from '@icedesign/container';
import { Dialog, Grid, Feedback } from '@icedesign/base';
import { Input } from "@alifd/next";
import { connect } from 'react-redux';
import { compose } from 'redux';
import './DisplayCard.scss';
import EthCrypto from 'eth-crypto';
import cn from 'classnames';
import * as utils from '../../../../utils/utils'; 
import injectReducer from '../../../../utils/injectReducer';
import { getLatestBlock, getTransactionsNum } from './actions';
import reducer from './reducer';
import { T } from '../../../../utils/lang';
import BigNumber from "bignumber.js";

const { Row, Col } = Grid;
const block = require('../../../../components/Common/images/block-white.png');
const tx = require('../../../../components/Common/images/tx-white.png');
const key = require('./images/key.png');
const car = require('./images/car-1.png');

class BlockTxLayout extends Component {
  static displayName = '';

  static propTypes = {};

  static defaultProps = {};

  constructor(props) {
    super(props);
    this.state = {
      deadAddr: '0x000000000000000000000000000000000000dEaD',
      publicKey: '',
      hdANFT: props.drizzle.contracts.HDANFT,
      hdBNFT: props.drizzle.contracts.HDBNFT,
      xToken: props.drizzle.contracts.XToken,
      trade: props.drizzle.contracts.Trade,
      usdt: props.drizzle.contracts.Usdt,
      drizzleState: props.drizzle.store.getState(),
      accountName: props.drizzleState.accounts[0],
      aNFTInfo: {totalSupply: 0, burnedAmount: 0, myAmount: 0, myTokenInfos: []},
      bNFTInfo: {totalSupply: 0, myAmount: 0, myTokenInfos: []},
      xTokenInfo: {totalSupply: 0, myPendingAmount: 0, liquidityAmount: 0, myAmount: 0, name: 'xToken', symbol: 'HDX', decimals: 18},
      buyANFTVisible: false,
      approvedUSDT: 0,
      approveTip: '授权USDT',
      approvingTip: '授权中...',
      curStakeId: null,
      swapANFT2HDWalletVisible: false,
      approvedANFT: 0,
      approveANFTTip: '授权aNFT',
      curANFTId: 0,
      boughtANFTNumber: 1,
    };
  }
  //发送交易：
  // 1:this.contracts.SimpleStorage.methods.set(this.state.storageAmount).send()
  // 2:stackId = contract.methods["set"].cacheSend(value, {from: drizzleState.accounts[0]});
  //   const txHash = this.props.drizzleState.transactionStack[this.state.stackId];
  //   this.props.drizzleState.transactions[txHash].status
  componentDidMount = () => {
    this.state.publicKey = EthCrypto.publicKeyByPrivateKey('0x7c0ec026d465f83aed3a05874ee0b95c731046303cc9abef32685b3dabe35db3');
    this.updateANFTData();
    this.updateBNFTData();
    this.updateXTokenInfo();

    setInterval(() => {
      this.updateXTokenInfo();
    }, 3000);
  }

  updateANFTData = () => {
    const {hdANFT, trade, deadAddr, accountName} = this.state;
    const {aNFTInfo} = this.state;
    hdANFT.methods.totalSupply().call().then(v => {
      aNFTInfo.totalSupply = v;
      this.setState({aNFTInfo});
    });
    hdANFT.methods.balanceOf(deadAddr).call().then(v => {
      aNFTInfo.burnedAmount = v;
      this.setState({aNFTInfo});
    });
    hdANFT.methods.balanceOf(accountName).call().then(async (v) => {
      aNFTInfo.myAmount = v;
      aNFTInfo.myTokenInfos = [];
      for (var i = 0; i < v; i++) {
        const tokenId = await hdANFT.methods.tokenOfOwnerByIndex(accountName, i).call();
        const tokenInfo = await trade.methods.userXTokenList(tokenId - 1).call();
        aNFTInfo.myTokenInfos.push(tokenInfo);
      }
      this.setState({aNFTInfo});
    });
  }

  updateBNFTData = () => {
    const {hdBNFT, accountName} = this.state;
    const {bNFTInfo} = this.state;

    hdBNFT.methods.totalSupply().call().then(v => {
      bNFTInfo.totalSupply = v;
      this.setState({bNFTInfo});
    });
    hdBNFT.methods.balanceOf(accountName).call().then(async (v) => {
      bNFTInfo.myAmount = v;
      bNFTInfo.myTokenInfos = [];
      for (var i = 0; i < v; i++) {
        const tokenId = await hdBNFT.methods.tokenOfOwnerByIndex(accountName, i).call();
        bNFTInfo.myTokenInfos.push(tokenId);
      };
      this.setState({bNFTInfo});
    });
  }

  updateXTokenInfo = () => {
    const {xToken, accountName} = this.state;
    const {trade, xTokenInfo} = this.state;

    xToken.methods.totalSupply().call().then(v => {
      xTokenInfo.totalSupply = v;
      this.setState({xTokenInfo});
    });
    xToken.methods.name().call().then(v => {
      xTokenInfo.name = v;
      this.setState({xTokenInfo});
    });
    xToken.methods.symbol().call().then(v => {
      xTokenInfo.symbol = v;
      this.setState({xTokenInfo});
    });
    xToken.methods.balanceOf(trade.address).call().then(v => {
      xTokenInfo.liquidityAmount = v;
      this.setState({xTokenInfo});
    });
    trade.methods.pendingXToken().call().then(v => {
      xTokenInfo.myPendingAmount = v;
      this.setState({xTokenInfo});
    });
    return xToken.methods.balanceOf(accountName).call().then(v => {
      xTokenInfo.myAmount = v;
      this.setState({xTokenInfo});
      return v;
    });
  }

  getMyXTokenNumber = () => {
    const {xToken, accountName} = this.state;

    return xToken.methods.balanceOf(accountName).call();
  }

  submitSwapReq = () => {
    const {trade, accountName, curANFTId} = this.state;
    try {
      if (utils.isEmptyObj(this.state.userName)) {
        Feedback.toast.error(T('请输入收货人'));
        return;
      }
      if (utils.isEmptyObj(this.state.deliverAddress)) {
        Feedback.toast.error(T('请输入收货地址'));
        return;
      }
      if (utils.isEmptyObj(this.state.contactInfo)) {
        Feedback.toast.error(T('请输入手机号'));
        return;
      }
      const deliverInfo = this.state.userName + '; ' + this.state.deliverAddress + '; ' + this.state.contactInfo;
      EthCrypto.encryptWithPublicKey(this.state.publicKey, deliverInfo).then(encryptedInfo => {
        console.log('encryptedInfo', encryptedInfo);  
        this.state.curStakeId = trade.methods["burnANFT4HD"].cacheSend(JSON.stringify(encryptedInfo), curANFTId, {from: accountName});
        this.syncTxStatus(() => {
          this.updateANFTData();
          this.updateBNFTData();
        }, () => {})
      }).catch(error => {
        Feedback.toast.error(error.message || error);
      });
      this.setState({swapANFT2HDWalletVisible: false});
    } catch (error) {
      Feedback.toast.error(error.message || error);
    }
  };

  buyANFT = () => {
    const {trade, accountName, xTokenInfo} = this.state;
    if (utils.isEmptyObj(this.state.boughtANFTNumber)) {
      Feedback.toast.error(T('请输入购买数量'));
      return;
    }
    const aNFTNumber = parseInt(this.state.boughtANFTNumber);
    if (aNFTNumber < 1) {
      Feedback.toast.error(T('购买数量不可小于1'));
      return;
    }
    this.state.curStakeId = trade.methods["buyANFT"].cacheSend(aNFTNumber, {from: accountName});
    this.syncTxStatus(() => {
      this.updateXTokenInfo();
      this.updateANFTData();
    }, () => {})
  }

  openBuyANFTDialog = () => {
    const {trade, usdt, accountName} = this.state;
    usdt.methods.allowance(accountName, trade.address).call().then(v => {
      this.setState({approvedUSDT: v, buyANFTVisible: true});
    });
  }

  swap2HDWallet = (aNFTId) => {
    const {trade, hdANFT} = this.state;
    this.state.curANFTId = aNFTId;
    hdANFT.methods.getApproved(aNFTId).call().then(v => {
      this.setState({approvedANFT: trade.address == v, swapANFT2HDWalletVisible: true});
    });
  }

  withdrawXToken = () => {
    const {trade, xToken, accountName, xTokenInfo} = this.state;
    this.state.curStakeId = trade.methods["withdrawXToken"].cacheSend({from: accountName});
    this.syncTxStatus(() => {
      xToken.methods.balanceOf(accountName).call().then(v => {
        xTokenInfo.myAmount = v;
        this.setState({xTokenInfo});
      });
      trade.methods.pendingXToken().call().then(v => {
        xTokenInfo.myPendingAmount = v;
        this.setState({xTokenInfo});
      });
    }, () => {})
  }

  handleANFTNumberChange = (v) => {
    this.state.boughtANFTNumber = v;
  }

  handleUserNameChange = (v) => {
    this.state.userName = v;
  }

  handleAddressChange = (v) => {
    this.state.deliverAddress = v;
  }

  handleContactChange = (v) => {
    this.state.contactInfo = v;
  }

  onBuyANFTOK = () => {
    this.setState({buyANFTVisible: false});
  }

  onSwapANFTOK = () => {
    this.setState({swapANFT2HDWalletVisible: false});
  }

  approveUSDT = () => {
    const {trade, usdt, accountName, approveTip, approvingTip} = this.state;
    if (approveTip == approvingTip) return;

    const curStakeId = usdt.methods["approve"].cacheSend(trade.address, 
                                                        '0x' + new BigNumber(1).shiftedBy(26).toString(16), 
                                                        {from: accountName});
    this.setState({approveTip: approvingTip, curStakeId});
    this.syncTxStatus(() => {
      usdt.methods.allowance(accountName, trade.address).call().then(v => {
        this.setState({approvedUSDT: v, approveTip});
      });
    }, () => { 
      this.setState({approveTip}); 
    });
  }

  approveANFT = () => {
    const {trade, hdANFT, accountName, approveANFTTip, approvingTip, curANFTId} = this.state;
    if (approveANFTTip == approvingTip) return;

    const curStakeId = hdANFT.methods["approve"].cacheSend(trade.address, 
                                                           curANFTId, 
                                                           {from: accountName});
    this.setState({approveANFTTip: approvingTip, curStakeId});
    this.syncTxStatus(() => {
      this.setState({approvedANFT: true, approveANFTTip});
    }, () => { 
      this.setState({approveANFTTip}); 
    })
  }

  swapANFT2HDWallet = () => {
    this.submitSwapReq();
  }

  syncTxStatus = (successCallback, failCallback) => {

    const intervalId = setInterval(() => { 
      // get the transaction states from the drizzle state
      const { transactions, transactionStack } = this.props.drizzleState;
      // get the transaction hash using our saved `stackId`
      const txHash = transactionStack[this.state.curStakeId];
      console.log('txHash', txHash, this.state.curStakeId, transactionStack);
      // if transaction hash does not exist, don't display anything
      if (!txHash) return;
      console.log('transaction', transactions[txHash]);
      if (transactions[txHash]) {
        const status = transactions[txHash].status;
        if (status == 'pending') return;

        if (status == 'success') {
          successCallback();
        } else {
          failCallback();
        }
        clearInterval(intervalId);
      }
      return;
    }, 3000);
  };

  displayReadableAmount = (value) => {
    let renderValue = new BigNumber(value).shiftedBy(-18);
    const fmt = {
        decimalSeparator: '.',
        groupSeparator: ',',
        groupSize: 3,
        secondaryGroupSize: 0,
        fractionGroupSeparator: ' ',
        fractionGroupSize: 0
      }
      
    BigNumber.config({ FORMAT: fmt });
  
    return renderValue.toFormat(6);
  }

  minusAmount = (amount1, amount2) => {
    return new BigNumber(amount1).minus(new BigNumber(amount2)).shiftedBy(-18).toNumber();
  }

  render() {
    return (
      <div style={styles.container}>
        <div className='containMain'>
          <div className='borderContent'>
            <div className='realContent'>
              <Row className='content'>
                <Col span='4' style={{...styles.item, textAlign:'left'}}>
                  <Row align='center' style={styles.titleRow}>
                    <img src={block} width='24'/>
                    <div style={styles.title}>
                      {T('aNFT')}
                    </div>
                  </Row>
                </Col>
                <Col span='4' style={styles.item}>
                  <Row align='center' style={styles.titleRow}>
                    <img src={block} width='24'/>
                    <div style={styles.title}>
                      {T('bNFT')}
                    </div>
                  </Row>
                </Col>
                <Col span='4' style={styles.item}>
                  <Row align='center' style={styles.titleRow}>
                    <img src={tx} width='24'/>
                    <div style={styles.title}>
                      {T('xToken')}
                    </div>
                  </Row>
                </Col>
              </Row>
              <Row style={{width: '100%',  display:'flex', justifyContent:'space-between'}}>
                <Col span="4" style={{...styles.item, textAlign:'left'}}>
                  <div style={styles.countTitle}>
                  {T('总产出量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {this.state.aNFTInfo.totalSupply}
                    
                  </div>
                  
                  <div style={styles.smallCountTitle}>
                  {T('总兑换量')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                    {this.state.aNFTInfo.burnedAmount}
                  </div>

                  <div style={styles.countTitle}>
                  {T('我拥有的量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {/* {parseInt(this.state.robotNFT.methods["tokenCount"].cacheCall(), 16)} */}
                    {this.state.aNFTInfo.myAmount}
                  </div>
                </Col>
                <Col span="4" style={styles.item}>
                  
                  <div style={styles.countTitle}>
                  {T('总产出量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {this.state.bNFTInfo.totalSupply}
                  </div>
                  
                  <div style={styles.smallCountTitle}>
                  {T('我拥有的量')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                   {this.state.bNFTInfo.myAmount}
                  </div>
                </Col>
                <Col span="4" style={styles.item}>
                  <div style={styles.countTitle}>
                  {T('已挖出总量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {this.displayReadableAmount(this.state.xTokenInfo.totalSupply)} {this.state.xTokenInfo.symbol}
                  </div>
                  
                  {/* <div style={styles.smallCountTitle}>
                  {T('当前流通量')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                    {this.displayReadableAmount(this.minusAmount(this.state.xTokenInfo.totalSupply, this.state.xTokenInfo.liquidityAmount))} {this.state.xTokenInfo.symbol}
                  </div> */}

                  <div style={styles.countTitle}>
                  {T('我的余额')}
                  </div>
                  <div className="count" style={styles.count}>
                   {this.displayReadableAmount(this.state.xTokenInfo.myAmount)} {this.state.xTokenInfo.symbol}
                  </div>
                  
                  <div style={styles.smallCountTitle}>
                  {T('我的可提取量')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                    {this.displayReadableAmount(this.state.xTokenInfo.myPendingAmount, 2)} {this.state.xTokenInfo.symbol}

                    <div class="common-btn" onClick={() => this.withdrawXToken()}>
                      提取
                    </div>
                  </div>

                </Col>
              </Row>
            </div>
          </div>
        </div>
        <div className='block-container'>
            <div className='nft-title'> 
              <img src={block} width='24'/>
              <b style={{fontSize: 20}}>{T('您的aNFT')}</b>
              <div class="common-btn" onClick={() => this.openBuyANFTDialog()}>
                购买
              </div>
            </div>
            <div className='nft-list'>
              <ul>
              {
                this.state.aNFTInfo.myTokenInfos.map(tokenInfo => {
                  return (
                      <li>
                        <img src={key} width='80'/>
                        <h2>ID: {tokenInfo.aNFTId}</h2>
                        <div class="info-div">
                          <p>购买时区块高度:{tokenInfo.startBlockNum}</p>
                        </div>
                        <div class="process-div" onClick={() => this.swap2HDWallet(tokenInfo.aNFTId)}>
                        兑换
                        </div>
                      </li>)
                })
              }
              </ul>
            </div>
        </div>

        <div className='block-container'>
            <div className='nft-title'> 
              <img src={block} width='24'/>
              <b style={{fontSize: 20}}>{T('您的bNFT')}</b>
              <div width='60'/>
            </div>
            <div className='nft-list'>
              <ul>
              {
                this.state.bNFTInfo.myTokenInfos.map(tokenInfo => {
                  return (
                      <li>
                        <img src={car} width='200'/>
                        <h2 style={{marginTop: -20}}>ID: {tokenInfo}</h2>                      
                      </li>)
                })
              }
              </ul>
            </div>
        </div>
        <Dialog
            visible={this.state.buyANFTVisible}
            title={<div className='dialogTitle'><img src={key} width={80}/> <span className='title-text'>购买aNFT</span></div>}
            //footerActions="ok"
            footerAlign="center"
            closeable="true"
            onOk={this.onBuyANFTOK.bind(this)}
            onCancel={() => this.setState({ buyANFTVisible: false })}
            onClose={() => this.setState({ buyANFTVisible: false })}
            className='dialogs'
            footer={<div className='dialog-footer'>
                      {
                        (this.state.approvedUSDT == 0) ? <div class="dialog-btn" onClick={() => this.approveUSDT()}>
                                                        {this.state.approveTip}
                                                      </div> 
                                                        : 
                                                      <div class="dialog-btn" onClick={() => this.buyANFT()}>
                                                        提交
                                                      </div>
                      }
                    </div>}
          >
            <Input hasClear
              onChange={this.handleANFTNumberChange.bind(this)}
              className='node-input'
              addonBefore="购买数量"
              size="medium"
              defaultValue={1}
              maxLength={150}
              showLimitHint
            />
          </Dialog>
        <Dialog
          visible={this.state.swapANFT2HDWalletVisible}
          title={<div className='dialogTitle'><img src={key} width={80}/> <span className='title-text'>将aNFT兑换为硬件钱包</span></div>}
          //footerActions="ok"
          footerAlign="center"
          closeable="true"
          onOk={this.onSwapANFTOK.bind(this)}
          onCancel={() => this.setState({ swapANFT2HDWalletVisible: false })}
          onClose={() => this.setState({ swapANFT2HDWalletVisible: false })}
          className='dialogs'
          footer={<div className='dialog-footer'>
                    {
                      !this.state.approvedANFT ? <div class="dialog-btn" onClick={() => this.approveANFT()}>
                                                      {this.state.approveANFTTip}
                                                    </div> 
                                                      : 
                                                    <div class="dialog-btn" onClick={() => this.swapANFT2HDWallet()}>
                                                      提交
                                                    </div>
                    }
                  </div>}
        >
          <Input hasClear
            onChange={this.handleUserNameChange.bind(this)}
            className='node-input'
            addonBefore="收件人:"
            size="medium"
            maxLength={10}
            showLimitHint
          />
          <Input hasClear
            onChange={this.handleAddressChange.bind(this)}
            className='node-input'
            addonBefore="地  址:"
            size="medium"
            maxLength={10}
            showLimitHint
          />
          <Input hasClear
            onChange={this.handleContactChange.bind(this)}
            className='node-input'
            addonBefore="手机号:"
            size="medium"
            maxLength={10}
            showLimitHint
          />
        </Dialog>
      </div>
    );
  }
}

const styles = {
  container: {
    width: '100%',
    padding: '30px 10%',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: '5px',
  },
  containMain:{
    backgroundColor: '#080a20', 
    width: '100%', 
    borderRadius: '5px',
    padding: '0 70px', 
    border: '2px solid rgba(35, 201, 167, 0.10196078431372549)', 
  },
  item: {
    height: '100%', 
    width: '100%', 
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  titleRow: {
    margin: '28px 0 24px 0',
  },
  title: {
    color: '#fff',
    fontSize: '16px',
    marginLeft: '8px',
  },
  nftTitle: {
    backgroundColor: '#fff',
    fontSize: '16px',
    marginLeft: '8px',
  },
  countTitle: {
    fontSize: '14px', 
    marginTop:'8px',
    color: '#fff'
  },
  count: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '38px',
  },
  smallCountTitle: {
    fontSize: '14px', 
    color: '#fff'
  },
  smallCount: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '28px',
  },
  desc: {
    fontSize: '12px',
  },
  down: {
    width: '6px',
    height: '9px',
  },
  up: {
    width: '6px',
    height: '9px',
  },
  extraIcon: {
    marginLeft: '5px',
    position: 'relative',
    top: '1px',
  },
  btn: {
    marginLeft: '10px',
    borderRadius: '5px',
    background: '#91FFE9',
    color: '5E768B'
  }
};


const mapDispatchToProps = {
  getLatestBlock,
  getTransactionsNum,
};

// 参数state就是redux提供的全局store，而loginResult会成为本组件的this.props的其中一个成员
const mapStateToProps = (state) => {
  return { lastBlockInfo: state.lastBlockInfo };
};

const withConnect = connect(
  mapStateToProps,
  mapDispatchToProps
);

const withReducer = injectReducer({ key: 'blockTxLayout', reducer });

export default compose(
  withReducer,
  withConnect
)(BlockTxLayout);
