/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint react/jsx-no-target-blank: 0 */
import React, { Component } from 'react';
import IceContainer from '@icedesign/container';
import { Dialog, Grid, Feedback, Select } from '@icedesign/base';
import { Input, Checkbox } from "@alifd/next";
import Img from '@icedesign/img';
import { connect } from 'react-redux';
import { compose } from 'redux';
import './DisplayCard.scss';
import EthCrypto from 'eth-crypto';
import * as utils from '../../../../utils/utils'; 
import injectReducer from '../../../../utils/injectReducer';
import { getLatestBlock, getTransactionsNum } from './actions';
import reducer from './reducer';
import { T } from '../../../../utils/lang';
import BigNumber from "bignumber.js";
import herosName from './heroname.json';

const { Row, Col } = Grid;
const producer = require('./images/producers.png');
const block = require('../../../../components/Common/images/block-white.png');
const tx = require('../../../../components/Common/images/tx-white.png');
const key = require('./images/cat.png');
const box = require('./images/box.png');
const boxOpening = require('./images/opening1.jpeg');

class BlockTxLayout extends Component {
  static displayName = '';

  static propTypes = {};

  static defaultProps = {};

  constructor(props) {
    super(props);
    this.state = {      
      approveTip: '授权TOM',
      tomCatNFT: props.drizzle.contracts.TomCatNFT,
      tradeMarket: props.drizzle.contracts.TradeMarket,
      tomERC20: props.drizzle.contracts.TomERC20,

      drizzleState: props.drizzle.store.getState(),
      accountAddr: props.drizzleState.accounts[0] != null ? props.drizzleState.accounts[0] : '0x0000000000000000000000000000000000000000',

      tomCatNFTInfo: {totalSupply: 0, breedingCatNum: 0, sellingCatNum: 0},  // 总量，种猫数量，正在交易中的猫数量
      tradeMarketInfo: {totalAmount: 0, dealCount: 0, breedingOwnerFee: 0, sellingCatInfos: {}},    // 总交易金额，总交易量，种猫拥有者的手续费收入
      myInfo: {totalAmount:0, sellingCatNum: 0, breedingFeeAmount: 0, myCatIds: [], mySellingCatIds: []},         // 账户拥有的猫总数，出售中猫咪数量，以及种猫手续费收入
      catInfo: {},
      approveTomERC20Tip: '授权Tom代币', 
      approveCatNFTTip: '授权猫咪NFT', 
      approvingTip: '授权中',
      curCatNFTId: 0,
      priceDescending: true,
      pageSize: 10,
      curPage: 0,
      approvedTom: 0,
      isBreeding: false,
      motherInfos: []
    };
  }
  //发送交易：
  // 1:this.contracts.SimpleStorage.methods.set(this.state.storageAmount).send()
  // 2:stackId = contract.methods["set"].cacheSend(value, {from: drizzleState.accounts[0]});
  //   const txHash = this.props.drizzleState.transactionStack[this.state.stackId];
  //   this.props.drizzleState.transactions[txHash].status
  componentDidMount = () => {
    this.updateTomCatData();
    this.updateTradeMarketData();
    this.updateMyInfo();

    setInterval(() => {
      this.updateMyInfo();
      this.updateTomCatData();
      this.updateTradeMarketData();
    }, 60000);
  }

  updateTomCatData = () => {
    const { tomCatNFT, tradeMarket, tomCatNFTInfo, tradeMarketInfo, priceDescending, pageSize } = this.state;

    tomCatNFT.methods.totalSupply().call().then(v => {
      tomCatNFTInfo.totalSupply = v;
      this.setState({tomCatNFTInfo});
    });
    tomCatNFT.methods.breedingCatAmount().call().then(v => {
      tomCatNFTInfo.breedingCatNum = v;
      this.setState({tomCatNFTInfo});
    });
    tomCatNFT.methods.balanceOf(tradeMarket.address).call().then(async (v) => {
      tomCatNFTInfo.sellingCatNum = parseInt(v);
      this.setState({tomCatNFTInfo});
      tradeMarketInfo.sellingCatIds = [];
      
      tradeMarket.methods.getOrderIds(0, pageSize < tomCatNFTInfo.sellingCatNum ? pageSize : tomCatNFTInfo.sellingCatNum, priceDescending).call().then(catIds => {
        catIds.map(catId => {
          tomCatNFT.methods.id2CatInfoMap(catId).call().then(catInfo => {
            if (tradeMarketInfo.sellingCatInfos[catId] == null) {
              tradeMarketInfo.sellingCatInfos[catId] = {};
            }
            tradeMarketInfo.sellingCatInfos[catId].name = catInfo.name;
            tradeMarketInfo.sellingCatInfos[catId].desc = catInfo.desc;
            tradeMarketInfo.sellingCatInfos[catId].isBreeding = catInfo.isBreeding;
            tradeMarketInfo.sellingCatInfos[catId].motherId = catInfo.motherId;
            this.setState({tradeMarketInfo});
          });
          tradeMarket.methods.tokenOrderMap(catId).call().then(catInfo => {
            if (tradeMarketInfo.sellingCatInfos[catId] == null) {
              tradeMarketInfo.sellingCatInfos[catId] = {};
            }
            tradeMarketInfo.sellingCatInfos[catId].price = catInfo.price;
            this.setState({tradeMarketInfo});
          });
        });
      });
    });
  }

  updateTradeMarketData = () => {
    const { tradeMarket, tradeMarketInfo } = this.state;
    
    tradeMarket.methods.totalAmount().call().then(v => {
      tradeMarketInfo.totalAmount = v;
      this.setState({tradeMarketInfo});
    });
    tradeMarket.methods.breedingOwnerFee().call().then(v => {
      tradeMarketInfo.breedingOwnerFee = v;
      this.setState({tradeMarketInfo});
    });
    tradeMarket.methods.getDealedOrderNumber().call().then(v => {
      tradeMarketInfo.dealCount = v;
      this.setState({tradeMarketInfo});
    });
  }

  updateMyInfo = () => {
    const { tomCatNFT, tradeMarket, myInfo, accountAddr } = this.state;
    var { motherInfos } = this.state;
    if (accountAddr == '0x0000000000000000000000000000000000000000') return;

    motherInfos = [0];
    tradeMarket.methods.sellingCatsNumber(accountAddr).call().then(v => {
      myInfo.sellingCatNum = v;
      tradeMarket.methods.getSellingCats(accountAddr, 0, parseInt(v)).call().then(ids => {
        myInfo.mySellingCatIds = ids;
        motherInfos.push(...ids);
        this.setState({myInfo, motherInfos});
      });
      tomCatNFT.methods.balanceOf(accountAddr).call().then(amount => {
        myInfo.totalAmount = parseInt(amount) + parseInt(myInfo.sellingCatNum);
        this.setState({myInfo});
        myInfo.myCatIds = [];
        for (var i = 0; i < parseInt(amount); i++) {
          tomCatNFT.methods.tokenOfOwnerByIndex(accountAddr, i).call().then(id => {
            myInfo.myCatIds.push(id);
            motherInfos.push(id);
            this.setState({myInfo, motherInfos});
          });
        }
      });
    });
    tradeMarket.methods.breedingCatOwnerFeeMap(accountAddr).call().then(v => {
      myInfo.breedingFeeAmount = v;
      this.setState({myInfo});
    });
  }

  submitSwapReq = () => {
    const {trade, accountName, curCatNFTId} = this.state;
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
        this.state.curStakeId = trade.methods["burnANFT4HD"].cacheSend(JSON.stringify(encryptedInfo), curCatNFTId, {from: accountName});
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

  createCatNFT = () => {
    const {accountAddr, tomCatNFT} = this.state;
    if (utils.isEmptyObj(this.state.createdCatName)) {
      Feedback.toast.error(T('请输入猫咪名称'));
      return;
    }
    if (utils.isEmptyObj(this.state.catPic)) {
      Feedback.toast.error(T('请输入猫咪头像url'));
      return;
    }
    const motherId = this.state.selectedMotherId == null ? 0 : parseInt(this.state.selectedMotherId);
    this.state.curStakeId = tomCatNFT.methods["mint"].cacheSend(this.state.createdCatName, this.state.catPic, this.state.selectedMotherId, this.state.isBreeding, {from: accountAddr});
    this.syncTxStatus(() => {
      this.updateTomCatData();
      this.updateMyInfo();
    }, () => {})
  }

  sellCat = (catId) => {
    const {tomCatNFT, accountAddr, tradeMarket} = this.state;
    this.state.curCatNFTId = catId;
    tomCatNFT.methods.isApprovedForAll(accountAddr, tradeMarket.address).call().then(v => {
      this.setState({approvedTomCatNFT: v});
    });
    this.setState({sellCatNFTVisible: true});
  }

  getMoreCatNFT = () => {
    const {accountAddr, tradeMarket} = this.state;

  }

  buyCat = (catId, price) => {
    const {tradeMarket, accountAddr, tomERC20} = this.state;
    this.state.curCatNFTId = catId;
    tomERC20.methods.allowance(accountAddr, tradeMarket.address).call().then(amount => {
      if (new BigNumber(amount).gt(new BigNumber(price))) {
        this.state.curStakeId = tradeMarket.methods["buyCat"].cacheSend(catId, {from: accountAddr});
        this.syncTxStatus(() => {
          this.updateTomCatData();
          this.updateTradeMarketData();
          this.updateMyInfo();
        }, () => {});
      } else {
        this.setState({buyCatNFTVisible: true});
      }
    })
    
  }

  openCreateCatNFTDialog = () => {
    const {trade, tomERC20, accountAddr} = this.state;
    this.setState({createCatNFTVisible: true});
  }

  swap2HDWallet = (aNFTId) => {
    const {trade, hdANFT} = this.state;
    this.state.curCatNFTId = aNFTId;
    hdANFT.methods.getApproved(aNFTId).call().then(v => {
      this.setState({approvedTomCatNFT: trade.address == v, swapANFT2HDWalletVisible: true});
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

  handleCatNameChange = (v) => {
    this.state.createdCatName = v;
  }

  handleCatPicChange = (v) => {
    this.state.catPic = v;
  }

  handleMotherIdChanged = (v) => {
    this.state.selectedMotherId = v;
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

  onCreateCatNFTOK = () => {
    this.setState({createCatNFTVisible: false});
  }

  onSwapANFTOK = () => {
    this.setState({swapANFT2HDWalletVisible: false});
  }

  onSellCatNFTOK = () => {
    this.setState({swapANFT2HDWalletVisible: false});
  }

  approveTomERC20 = () => {
    const {tradeMarket, tomERC20, accountAddr, approveTomERC20Tip, approvingTip} = this.state;
    if (approveTomERC20Tip == approvingTip) return;

    const curStakeId = tomERC20.methods["approve"].cacheSend(tradeMarket.address, 
                                                        '0x' + new BigNumber(1).shiftedBy(26).toString(16), 
                                                        {from: accountAddr});
    this.setState({approveTomERC20Tip: approvingTip, curStakeId});
    this.syncTxStatus(() => {
      this.setState({approvedTomERC20: false, approveTomERC20Tip});
    }, () => { 
      this.setState({approveTomERC20Tip}); 
    });
  }

  buyCatConfirm = () => {
    this.state.curStakeId = tradeMarket.methods["buyCat"].cacheSend(this.state.curCatNFTId, {from: accountAddr});
    this.syncTxStatus(() => {
      this.updateTomCatData();
      this.updateMyInfo();
    }, () => {});
  }

  approveCatNFT = () => {
    const {tradeMarket, tomCatNFT, accountAddr, approveCatNFTTip, approvingTip, curCatNFTId} = this.state;
    if (approveCatNFTTip == approvingTip) return;

    const curStakeId = tomCatNFT.methods["approve"].cacheSend(tradeMarket.address, 
                                                           curCatNFTId, 
                                                           {from: accountAddr});
    this.setState({approveCatNFTTip: approvingTip, curStakeId});
    this.syncTxStatus(() => {
      this.setState({approvedTomCatNFT: true, approveCatNFTTip});
    }, () => { 
      this.setState({approveCatNFTTip}); 
    })
  }

  addOrder = () => {
    const {tradeMarket, accountAddr, curCatNFTId, sellPrice} = this.state;
    const curStakeId = tradeMarket.methods["addOrder"].cacheSend(curCatNFTId, sellPrice, {from: accountAddr});
    this.setState({curStakeId});
    this.syncTxStatus(() => {
      this.updateTomCatData();
      this.updateTradeMarketData();
      this.updateMyInfo();
      this.setState({sellCatNFTVisible: false});
    }, () => { 
    })
  }


  cancelOrder = (catNFTId) => {
    const {tradeMarket, accountAddr} = this.state;
    const curStakeId = tradeMarket.methods["cancelOrder"].cacheSend(catNFTId, {from: accountAddr});
    this.setState({curStakeId});
    this.syncTxStatus(() => {
      this.updateTomCatData();
      this.updateTradeMarketData();
      this.updateMyInfo();
    }, () => { 
    })
  }

  openBox = (bNFTId) => {
    const { accountName, hdBNFT, mysteryBox } = this.state;
    hdBNFT.methods.nft2HeroIdMap(bNFTId).call().then(heroId => {
      if (heroId > 0) {
        Feedback.toast.error('宝盒已开启');
      } else {
        const curStakeId = mysteryBox.methods["openBox"].cacheSend(bNFTId, 
                                                                  {from: accountName});
        
        this.setState({curStakeId, boxOpeningVisible: true});
        this.syncTxStatus(() => {
          hdBNFT.methods.nft2HeroIdMap(bNFTId).call().then(v => {
            this.updateBNFTData();
            this.setState({boxOpeningVisible: false});
          });
        }, () => { 
          Feedback.toast.error('宝盒开启失败');
          this.setState({boxOpeningVisible: false});
        })
      }
    });
  }

  swapANFT2HDWallet = () => {
    this.submitSwapReq();
  }

  handleSellPriceChange = (v) => {
    this.state.sellPrice = new BigNumber(v).shiftedBy(18).toString();
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
    const { sellingCatInfos } = this.state.tradeMarketInfo;
    const catInfos = [];
    for(var id in sellingCatInfos) {
      const catInfo = sellingCatInfos[id];
      catInfo.id = id;
      catInfos.push(catInfo);
    }
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
                      {T('TOM猫')}
                    </div>
                  </Row>
                </Col>
                <Col span='4' style={styles.item}>
                  <Row align='center' style={styles.titleRow}>
                    <img src={tx} width='24'/>
                    <div style={styles.title}>
                      {T('猫咪市场')}
                    </div>
                  </Row>
                </Col>
                <Col span='4' style={{...styles.item, }}>
                  <Row align='center' style={{...styles.titleRow, justifyContent: 'flex-end'}}>
                    <img src={producer} width='24'/>
                    <div style={styles.title}>
                      {T('我的猫咪')}
                    </div>
                  </Row>
                </Col>
              </Row>
              <Row style={{width: '100%',  display:'flex', justifyContent:'space-between'}}>
                <Col span="4" style={{...styles.item, textAlign:'left'}}>
                  <div style={styles.countTitle}>
                  {T('总数量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {this.state.tomCatNFTInfo.totalSupply}
                    
                  </div>
                  
                  <div style={styles.smallCountTitle}>
                  {T('种猫数量')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                    {this.state.tomCatNFTInfo.breedingCatNum}
                  </div>


                  <div style={styles.smallCountTitle}>
                  {T('种猫手续费收入')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                   {this.state.tradeMarketInfo.breedingOwnerFee}
                  </div>
                  
                </Col>
                <Col span="4" style={styles.item}>
                  
                  <div style={styles.countTitle}>
                  {T('总交易量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {utils.getReadableNumber(this.state.tradeMarketInfo.totalAmount, 18, 2)} TOM
                  </div>

                  <div style={styles.countTitle}>
                  {T('总成交笔数')}
                  </div>
                  <div className="count" style={styles.count}>
                  {this.state.tradeMarketInfo.dealCount}
                  </div>
                  
                  <div style={styles.countTitle}>
                  {T('正在交易中的猫咪数量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {/* {parseInt(this.state.robotNFT.methods["tokenCount"].cacheCall(), 16)} */}
                    {this.state.tomCatNFTInfo.sellingCatNum}
                  </div>
                </Col>
                <Col span="4" style={styles.item}>
                  <div style={styles.countTitle}>
                  {T('数量')}
                  </div>
                  <div className="count" style={styles.count}>
                    {this.state.myInfo.totalAmount}
                  </div>
                  
                  <div style={styles.smallCountTitle}>
                  {T('出售中')}
                  </div>

                  <div className="count" style={styles.smallCount}>
                    {this.state.myInfo.sellingCatNum}
                  </div>

                  <div style={styles.countTitle}>
                  {T('种猫手续费')}
                  </div>
                  <div className="count" style={styles.count}>
                   {this.state.myInfo.breedingFeeAmount}
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        </div>       
        <div className='block-container'>
            <div className='nft-title'> 
              <img src={block} width='24'/>
              <b style={{fontSize: 20}}>{T('您的猫咪')}</b>
              <div class="common-btn" onClick={() => this.openCreateCatNFTDialog()} title="10U/aNFT">
                创建猫咪NFT
              </div>
            </div>
            <div className='nft-list'>
              <ul>
              {
                this.state.myInfo.mySellingCatIds.map(catId => {
                  return (
                      <li>
                        <img src={key} width='80'/>
                        <h2>ID: {catId}</h2>
                        <div class="info-div">
                          <p>名称: AAA-{catId}</p>
                        </div>
                        <div class="process-div" onClick={() => this.cancelOrder(catId)}>
                        取消出售
                        </div>
                      </li>)
                })
              }
              {
                this.state.myInfo.myCatIds.map(catId => {
                  return (
                      <li>
                        <img src={key} width='80'/>
                        <h2>ID: {catId}</h2>
                        <div class="info-div">
                          <p>名称: CCC-{catId}</p>
                        </div>
                        <div class="process-div" onClick={() => this.sellCat(catId)}>
                        出售
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
              <b style={{fontSize: 20}}>{T('猫咪交易市场')}</b>    
              <div class="common-btn" onClick={() => this.getMoreCatNFT()}>
                查看更多
              </div>          
            </div>
            <div className='nft-list'>
              <ul>
              {
                catInfos.map(catInfo => {
                  return (
                      <li>
                        <img src={key} width='80'/>
                        <h2>ID: {catInfo.id}({catInfo.name})</h2>                        
                        <div class="info-div">
                          <p>是否种猫: {catInfo.breedingCat ? '是' : '否'}</p>
                        </div>
                        <div class="info-div">
                          <p>售价: {utils.getReadableNumber(catInfo.price, 18, 2)} TOM</p>
                        </div>
                        <div class="process-div" onClick={() => this.buyCat(catInfo.id, catInfo.price)}>
                        购买
                        </div>
                      </li>)
                })
              }
              </ul>
            </div>            
        </div>
        <Dialog
            visible={this.state.createCatNFTVisible}
            title={<div className='dialogTitle'><img src={key} width={80}/> <span className='title-text'>创建猫咪NFT</span></div>}
            //footerActions="ok"
            footerAlign="center"
            closeable="true"
            onOk={this.onCreateCatNFTOK.bind(this)}
            onCancel={() => this.setState({ createCatNFTVisible: false })}
            onClose={() => this.setState({ createCatNFTVisible: false })}
            className='dialogs'
            footer={<div className='dialog-footer'>
                       <div class="dialog-btn" onClick={() => this.createCatNFT()}>
                       提交
                      </div>
                    </div>}
          >
            <Input hasClear
              onChange={this.handleCatNameChange.bind(this)}
              className='node-input'
              addonBefore="名称"
              size="medium"
              maxLength={150}
              showLimitHint
            />
            <Input hasClear
              onChange={this.handleCatPicChange.bind(this)}
              className='node-input'
              addonBefore="头像URL"
              size="medium"
              maxLength={150}
              showLimitHint
            />
            <div className='node-input' >
              选择母猫:
              <Select 
                dataSource={this.state.motherInfos}
                onChange={this.handleMotherIdChanged.bind(this)}/>
            </div>
            <Checkbox
                className='node-input'
                checked={this.state.isBreeding}
                onChange={
                    (checked) => {
                        this.setState({isBreeding: checked});
                    }
                }
            >是否种猫</Checkbox>
          </Dialog>
        <Dialog
          visible={this.state.sellCatNFTVisible}
          title={<div className='dialogTitle'><img src={key} width={80}/> <span className='title-text'>放入交易市场进行出售</span></div>}
          //footerActions="ok"
          footerAlign="center"
          closeable="true"
          onOk={this.onSellCatNFTOK.bind(this)}
          onCancel={() => this.setState({ sellCatNFTVisible: false })}
          onClose={() => this.setState({ sellCatNFTVisible: false })}
          className='dialogs'
          footer={<div className='dialog-footer'>
                    {
                      !this.state.approvedTomCatNFT ? <div class="dialog-btn" onClick={() => this.approveCatNFT()}>
                                                      {this.state.approveCatNFTTip}
                                                    </div> 
                                                      : 
                                                    <div class="dialog-btn" onClick={() => this.addOrder()}>
                                                      提交
                                                    </div>
                    }
                  </div>}
        >
          <Input hasClear
            onChange={this.handleSellPriceChange.bind(this)}
            className='node-input'
            addonBefore="出售价格:"
            addonAfter="TOM"
            size="medium"
            maxLength={50}
            showLimitHint
          />
        </Dialog>
        <Dialog
          visible={this.state.buyCatNFTVisible}
          title={<div className='dialogTitle'><img src={key} width={80}/> <span className='title-text'>购买猫咪</span></div>}
          //footerActions="ok"
          footerAlign="center"
          closeable="true"          
          onCancel={() => this.setState({ buyCatNFTVisible: false })}
          onClose={() => this.setState({ buyCatNFTVisible: false })}
          className='dialogs'
          footer={<div className='dialog-footer'>
                    {
                      !this.state.approvedTomERC20 ? <div class="dialog-btn" onClick={() => this.approveTomERC20()}>
                                                      {this.state.approveTomERC20Tip}
                                                    </div> 
                                                      : 
                                                    <div class="dialog-btn" onClick={() => this.buyCatConfirm()}>
                                                      购买
                                                    </div>
                    }
                  </div>}
        >
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
                      !this.state.approvedTomCatNFT ? <div class="dialog-btn" onClick={() => this.approveCatNFT()}>
                                                      {this.state.approveCatNFTTip}
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
        <div className={this.state.boxOpeningVisible ? 'imgDisplayDiv' : 'imgNoneDiv'}>
          <Img
            enableAliCDNSuffix={true}
            src={boxOpening}
            type='contain'
          />
        </div>
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
