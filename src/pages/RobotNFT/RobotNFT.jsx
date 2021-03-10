import React, { Component } from 'react';
import { Button, Grid, Input, Icon, Table, Pagination, Balloon, Tag } from "@alifd/next";
import IceContainer from '@icedesign/container';

import BigNumber from "bignumber.js";
import { T } from '../../utils/lang';
import './local.scss';
import cn from 'classnames';
import * as utils from '../../utils/utils';
import blockIcon from '../../components/Common/images/block-white.png';
import txIcon from '../../components/Common/images/tx-black.png';
import Nodata from '../../components/Common/Nodata';

const { Row, Col } = Grid;

export default class RobotNFT extends Component {
  static displayName = 'Account';

  constructor(props) {
    super(props);
    this.state = {
        allRobots: [],
        robotsOnAuction: [],
        accountName: props.drizzleState.accounts[0],
        ectToken: props.drizzle.contracts.EnergyCellToken,
        robotNFT: props.drizzle.contracts.Robot,
        robotAuction: props.drizzle.contracts.RobotAuction,
        skillAuction: props.drizzle.contracts.SkillAuction,
        ectDecimals: 18,
        ethDecimals: 18,
        value: "",
        blockInfo: {},
        txNum: '',
        transactions: [],
        assetInfos: {},
        pageSize: 10,
        txFrom: {},
        txRawData: {},
        txReceiptData: {},
        assetList: [],
        totalAccountTxsNum: 0,
        robotOnAuctionCurrent: 0,
        robotCurrent: 0,
        searchInfo: null,
        robotMap: {},
    };
  }

  componentDidMount = async () => {
    if (this.state.number != null) {
      this.state.searchedBlock = this.state.number;
      this.onSearch();
    }
    await this.getAllRobots();
    await this.getAllRobotsOnAuction();
  }

  getAllRobotsOnAuction = async () => {
    let { robotNFT, robotAuction, robotsOnAuction, ethDecimals } = this.state;
    let robotCount = await robotNFT.methods.balanceOf(robotAuction.address).call();
    robotCount = parseInt(robotCount);
    for (let id = 0; id < robotCount; id++) {
      console.log('id', id);
      const tokenId = await robotNFT.methods.tokenOfOwnerByIndex(robotAuction.address, id).call();
      const robot = await this.getRobotInfo(tokenId);
      const curPrice = await robotAuction.methods.getCurrentPrice(tokenId).call();
      robot.price = new BigNumber(curPrice).shiftedBy(ethDecimals * -1).toString();
      const auctionInfo = await robotAuction.methods.getAuction(tokenId).call();
      robot.auctionInfo = auctionInfo;
      robot.seller = auctionInfo.seller;
      robotsOnAuction.push(robot);
    }
    this.setState({robotsOnAuction});
  }

  getAllRobots = async () => {
    let { robotNFT, allRobots } = this.state;
    let robotCount = await robotNFT.methods.tokenCount().call();
    robotCount = parseInt(robotCount);
    for (let tokenId = 1; tokenId <= robotCount; tokenId++) {
      const robot = await this.getRobotInfo(tokenId);
      allRobots.push(robot);
    }
    this.setState({allRobots});
  }

  getRobotInfo = async (tokenId) => {
    if (this.state.robotMap[tokenId] != null) {
      return this.state.robotMap[tokenId];
    }

    let { robotNFT, ectDecimals } = this.state;
    let robotInfo = await robotNFT.methods.getRobot(tokenId).call();
    let skillCount = await robotNFT.methods.getRobotSkillNumber(tokenId).call();
    const robot = {}
    robot.id = tokenId;
    robot.price = 0;
    robot.name = robotInfo._name;
    robot.level = parseInt(robotInfo._level);
    robot.burnedECT = new BigNumber(robotInfo._burnedECT).shiftedBy(ectDecimals * -1).toNumber();
    robot.gender = parseInt(robotInfo._gender);
    robot.birthday = parseInt(robotInfo._birthday);
    robot.randomNum = parseInt(robotInfo._randomNum);
    robot.lastBornTime = parseInt(robotInfo._lastBornTime);
    robot.skillNumber = parseInt(skillCount);
    robot.owner = await robotNFT.methods.ownerOf(tokenId).call();
    this.state.robotMap[tokenId] = robot;
    return robot;
  }

  onSearch = () => {
    const _this = this;
    const salingRobots = [];
    this.state.robots.map(robot => {
      if (!robot.bSaling) return;
      if (_this.state.searchInfo.indexOf('0x') == 0 && robot.owner == _this.state.searchInfo) {
        salingRobots.push(robot);
      } else if (typeof(_this.state.searchInfo) == Number && robot.level == _this.state.searchInfo) {
        salingRobots.push(robot);
      } else if (robot.name == _this.state.searchInfo) {
        salingRobots.push(robot);
      }
    });
    this.setState({salingRobots});
  }

  onChange = (currentPage) => {
    this.setState({current: currentPage, isLoading: true});
    this.showAccountTxTable(this.state.accountName, currentPage);
  }

  onChangeSaling = (currentPage) => {
    this.setState({salingCurrent: currentPage, isLoading: true});
  }

  showAccountTxTable = (accountName, pageIndex) => {
    fetch("https://api.oexchain.com/api/otransactioninfo/gettransactionforme?pageIndex=" + pageIndex + "&pageSize=" + this.state.pageSize + "&account=" + accountName).then(response => {
      return response.json();
    }).then(txInfo => {
      if (txInfo != null && txInfo.data != null) {
        console.log(txInfo.data.total);
        const txList = txInfo.data.list;
        this.setState({txList, totalAccountTxsNum: txInfo.data.total});
      }
    })
  }

  onLevelChange(v) {
    this.setState({searchInfo: v});
  }

  getReadableNumber = (value, decimals) => {
    var renderValue = new BigNumber(value);
    renderValue = renderValue.shiftedBy(decimals * -1);
    
    BigNumber.config({ DECIMAL_PLACES: 6 });
    renderValue = renderValue.toString(10);
    return renderValue;
  }

  searchOfficialAccount = (accountName) => {
    this.state.accountName = accountName;
    this.setState({accountName});
    this.onSearch();
  }

  symbolRender = (symbol) => {
    return symbol.toUpperCase();
  }

  balanceRender = (balance, index, assetInfo) => {
    const readableValue = this.getReadableNumber(balance, assetInfo.decimals);
    return readableValue + ' ' + assetInfo.symbol.toUpperCase() + ' [' + balance + ']';
  }

  txHashRender = (value) => {
    const displayValue = value.substr(0, 8) + '...' + value.substr(value.length - 6);
    return <a className='txHash' href={'/#/Transaction?' + value} target='_blank'>{displayValue}</a>;
  }

  blockHashRender = (value) => {
    const displayValue = value.substr(0, 8) + '...' + value.substr(value.length - 6);
    return <a className='blockHash' href={'/#/Block?' + value} target='_blank'>{displayValue}</a>;
  }
  
  salingRender = (value, index, record) => {
    return <div>
            {value}
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={() => this.buyRobot(record)}>购买</Button> 
           </div>
  }
  
  buyRobot = (robotInfo) => {
    if (this.props.drizzle.contracts['RobotAuction'] != null) {
      this.props.drizzle.contracts['RobotAuction'].methods["bid"].cacheSend(robotInfo.robotId, 
                                                                            {
                                                                            value: '0x' + new BigNumber(robotInfo.price).shiftedBy(18).toString(16)});
    } else {
      this.props.drizzle.contracts.ClockAuctionFactory.methods["createClockAuction"].cacheSend(robotInfo.robotId, 
        {
        value: '0x' + new BigNumber(robotInfo.price).shiftedBy(18).toString(16)});
    }
  }

  salingOperatorRender = (value, index, robot) => {
    return <div>
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={this.bid.bind(this, robot)}>拍卖</Button> 
           </div>
  }

  bid = (robot) => {
    const { robotAuction, accountName, ethDecimals } = this.state;
    robotAuction.methods.bid(robot.id).send({from: accountName, value: '0x' + new BigNumber(robot.price).shiftedBy(ethDecimals).toString(16)});
  }

  onChangeAuctionRobot = (currentPage) => {
    this.setState({robotOnAuctionCurrent: currentPage, isLoading: true});
  }

  onChangeRobot = (currentPage) => {
    this.setState({robotCurrent: currentPage, isLoading: true});
  }

  skillRender = (value, index, robot) => {
    return <div>
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={() => this.showSkill(robot.id)}>{value}</Button> 
           </div>
  }

  auctionRender = (value, index, robot) => {
    let { ethDecimals } = this.state;
    value = utils.getReadableNumber(value, 0, 6);
    const defaultTrigger = <Tag type="normal" size="small">{value} ETH</Tag>;
    const startingPrice = new BigNumber(robot.auctionInfo.startingPrice).shiftedBy(ethDecimals * -1).toNumber();
    const endingPrice = new BigNumber(robot.auctionInfo.endingPrice).shiftedBy(ethDecimals * -1).toNumber();
    const startTime = new Date(parseInt(robot.auctionInfo.startedAt) * 1000).toLocaleString();
    const endTime = new Date((parseInt(robot.auctionInfo.startedAt) + parseInt(robot.auctionInfo.duration)) * 1000).toLocaleString();
    return <Balloon trigger={defaultTrigger} closable={false}>
      <p>起始价:{startingPrice} ETH</p>
      <p>结束价:{endingPrice} ETH</p>
      <p>竞拍开始时间:{startTime}</p>
      <p>价格递减结束时间:{endTime}</p>
    </Balloon>;
  }

  showSkill = (robotId) => {

  }

  render() {

    const {match, t} = this.props;

    const isBlock = Boolean(match.path.includes('Block'))

    const subClass = isBlock ? 'bk' : 'tx';

    return (
      <div className={cn('contain', subClass)} style={styles.all}> 
        <div className='mainContainer'>
          <Row className='searchContain'>
            <Button text iconSize='small' onClick={this.onSearch.bind(this)} className='searchIcon'><div><Icon type="search"/></div></Button>              
            <Input className={cn('search', subClass)} value={this.state.searchInfo}
                  placeholder={T("根据名称/级别/所有者搜索出售中的机器人")} onChange={this.onLevelChange.bind(this)} onPressEnter={this.onSearch.bind(this)}/>
          </Row>  
          <IceContainer className={cn('block-container')} style={{marginTop: '30px'}}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("竞拍中的机器人, 总数:") + this.state.robotsOnAuction.length}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              {
                this.state.robotsOnAuction.length > 0 ? 
                <Table primaryKey="id" language={T('zh-cn')} style={{width: '100%'}}
                isZebra={false}  hasBorder={false} 
                dataSource={this.state.robotsOnAuction.slice(this.state.robotOnAuctionCurrent * this.state.pageSize, this.state.pageSize * (this.state.robotOnAuctionCurrent + 1))}
                emptyContent={<Nodata />}
                >
                  <Table.Column title={T("名称")} dataIndex="name" width={50}/>
                  <Table.Column title={T("级别")} dataIndex="level" width={25}/>
                  <Table.Column title={T("性别")} dataIndex="gender" width={25} cell={(gender) => gender == 1 ? 'π' : 'e'}/>
                  <Table.Column title={T("出生日期")} dataIndex="birthday" width={100} cell={(time) => new Date(time * 1000).toLocaleString()}/>
                  <Table.Column title={T("技能数")} dataIndex="skillNumber" width={25} cell={this.skillRender.bind(this)}/>
                  <Table.Column title={T("消耗的ECT")} dataIndex="burnedECT" width={50}/>
                  <Table.Column title={T("售价")} dataIndex="price" width={50} cell={this.auctionRender.bind(this)}/>
                  <Table.Column title={T("卖家")} dataIndex="seller" width={150} cell={v => utils.renderAddress(v)}/>
                  <Table.Column title={T("操作")} width={100} cell={this.salingOperatorRender.bind(this)}/>
                </Table>
                : '无'
              }
              
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.robotOnAuctionCurrent} pageSize={this.state.pageSize} 
                          total={this.state.robotsOnAuction.length} onChange={this.onChangeAuctionRobot} style={{marginTop: '10px'}} />
            </Row>
          </IceContainer>
          <IceContainer className={cn('block-container')} style={{marginTop: '30px'}}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("所有机器人, 总数:") + this.state.allRobots.length}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              {
                this.state.allRobots.length > 0 ? 
                  <Table primaryKey="id" language={T('zh-cn')} style={{width: '100%'}}
                  isZebra={false}  hasBorder={false} 
                  dataSource={this.state.allRobots.slice(this.state.robotCurrent * this.state.pageSize, this.state.pageSize * (this.state.robotCurrent + 1))}
                  emptyContent={<Nodata />}
                  >
                    <Table.Column title={T("名称")} dataIndex="name" width={50}/>
                    <Table.Column title={T("级别")} dataIndex="level" width={25}/>
                    <Table.Column title={T("性别")} dataIndex="gender" width={25} cell={(gender) => gender == 1 ? 'π' : 'e'}/>
                    <Table.Column title={T("出生日期")} dataIndex="birthday" width={75} cell={(time) => new Date(time * 1000).toLocaleString()}/>
                    <Table.Column title={T("技能数")} dataIndex="skillNumber" width={25} cell={this.skillRender.bind(this)}/>
                    <Table.Column title={T("所有者")} dataIndex="owner" width={50} cell={v => utils.renderAddress(v)}/>
                    <Table.Column title={T("消耗的ECT")} dataIndex="burnedECT" width={25}/>
                  </Table>
                  : '无'
              }
              
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.robotCurrent} pageSize={this.state.pageSize} 
                          total={this.state.allRobots.length} onChange={this.onChangeRobot} style={{marginTop: '10px'}} />
            </Row>
          </IceContainer>
        </div>
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