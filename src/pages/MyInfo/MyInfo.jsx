import React, { Component } from 'react';
import { Button, Grid, Input, Field, Table, Pagination, Dialog, Form, Message, NumberPicker, Tag, Balloon } from "@alifd/next";
import IceContainer from '@icedesign/container';
import * as ethUtil from 'ethereumjs-util';

import { Select } from '@icedesign/base';
import BigNumber from "bignumber.js";
import { T } from '../../utils/lang';
import './local.scss';
import cn from 'classnames';
import * as utils from '../../utils/utils';
import blockIcon from '../../components/Common/images/block-white.png';
import txIcon from '../../components/Common/images/tx-black.png';
import Nodata from '../../components/Common/Nodata';

const { Row, Col } = Grid;
const FormItem = Form.Item;

const formItemLayout = {
  labelCol: {
      fixedSpan: 10
  },
  wrapperCol: {
      span: 10
  }
};

const issueAssetImg = require('./images/property_icon_01.png');
const addAssetImg = require('./images/property_icon_02.png');
const setOwnerImg = require('./images/property_icon_03.png');
const setFounderImg = require('./images/property_icon_04.png');
const setProtocolAssetImg = require('./images/property_icon_05.png');
const destroyAssetImg = require('./images/property_icon_06.png');
export default class MyInfo extends Component {
  static displayName = 'MyInfo';

  constructor(props) {
    super(props);
    this.state = {
      accountName: props.drizzleState.accounts[0],
      ectToken: props.drizzle.contracts.EnergyCellToken,
      robotNFT: props.drizzle.contracts.Robot,
      robotAuction: props.drizzle.contracts.RobotAuction,
      skillAuction: props.drizzle.contracts.SkillAuction,
      myBalanceOfECT: 0,
      createRobotVisible: false,
      robotField: new Field(this),
      auctionField: new Field(this),
      robotLevels: [],
      levelTooltip: null,
      opTooltip: null,
      approveAmountVisible: false,
      approveAmount: 0,
      ectDecimals: 18,
      ethDecimals: 18,
      curOpRobot: null,

      transferRobotVisible: false,
      goAuctionVisible: false,
      timeFactor: 86400,
      transferToAccount: '',
      myRobots: [],
      myRobotsOnAuction: [],
      allRobots: [],
      mySkills: [],
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
      robotCurrent: 0,
      salingRobotCurrent: 0,
      skillCurrent: 0,
    };
  }

  autoGenerateSkills = () => {
    var skillId = 0;
    for (var level = 1; level < 3; level++) {
      for (var number = 1; number < (8 - level) * 2; number++) {
        const owner = '0x' + (level * number) % 7 + number % 10 + (level * number) % 8 + '...';
        const bSaling = (level * number) %3 == 0;
        const price = bSaling ? level / 100 + ' ETH' : '0';
        const hasRobot = skillId % 5 == 0;
        const skill = {skillId: skillId++, name: 'skill_' + level + '_' + number, desc: '报价机器人', officialUrl: 'swapbot.xchainunion.com',
                      level, consumedECT: level, owner: hasRobot ? 'robot_' + level + '_' + number : owner, bSaling, price };
        this.state.mySkills.push(skill);
      }
    }
  }

  componentDidMount = async () => {
    //this.initAuctionMarkets();
    await this.getBaseInfo();
    await this.getMyRobots();
    await this.getRobotsOnAuction();

  }

  initAuctionMarkets = () => {
    let { robotAuctionAddr, robotAuction, skillAuctionAddr, skillAuction } = this.state;

    this.props.drizzle.addContract({ contractName: 'RobotAuction', 
                                     web3Contract: new this.props.drizzle.web3.eth.Contract(ClockAuction.abi, robotAuctionAddr) }, 
                                     []);
    robotAuction = this.props.drizzle.contracts.RobotAuction;

    this.props.drizzle.addContract({ contractName: 'SkillAuction', 
                                     web3Contract: new this.props.drizzle.web3.eth.Contract(ClockAuction.abi, skillAuctionAddr) }, 
                                     []);
    skillAuction = this.props.drizzle.contracts.SkillAuction;
    this.setState({robotAuction, skillAuction});
  }

  getBaseInfo = async () => {
    let { ectToken, robotNFT, accountName, ectDecimals, robotLevels } = this.state;

    let myBalanceOfECT = await ectToken.methods.balanceOf(accountName).call();
    myBalanceOfECT = new BigNumber(myBalanceOfECT).shiftedBy(ectDecimals * -1).toString();
    let maxLevel = await robotNFT.methods.maxLevel().call();
    maxLevel = parseInt(maxLevel);
    robotLevels = [];
    for (let i = 1; i <= maxLevel; i++) {
      robotLevels.push(i);
    }
    this.setState({myBalanceOfECT, robotLevels});
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

  getMyRobots = async () => {
    let { robotNFT, myRobots, accountName } = this.state;
    let robotCount = await robotNFT.methods.balanceOf(accountName).call();
    robotCount = parseInt(robotCount);
    for(let i = 0; i < robotCount; i++) {
      let tokenId = await robotNFT.methods.tokenOfOwnerByIndex(accountName, i).call();
      tokenId = parseInt(tokenId);
      const robot = await this.getRobotInfo(tokenId);
      myRobots.push(robot);
    }
    this.setState({myRobots});
  }

  getRobotsOnAuction = async () => {
    let { robotAuction, myRobotsOnAuction, accountName, ethDecimals } = this.state;
    let robotCount = await robotAuction.methods.getTokenNumber(accountName).call();
    robotCount = parseInt(robotCount);
    myRobotsOnAuction = [];
    for (let i = 0; i < robotCount; i++) {
      let tokenId = await robotAuction.methods.getTokenId(accountName, i).call();
      const robot = await this.getRobotInfo(tokenId);
      const curPrice = await robotAuction.methods.getCurrentPrice(tokenId).call();
      robot.price = new BigNumber(curPrice).shiftedBy(ethDecimals * -1).toString();
      const auctionInfo = await robotAuction.methods.getAuction(tokenId).call();
      robot.auctionInfo = auctionInfo;
      myRobotsOnAuction.push(robot);
    }
    this.setState({myRobotsOnAuction});
  }

  getRobotInfo = async (tokenId) => {
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
    return robot;
  }

  onChange = (currentPage) => {
    this.setState({current: currentPage, isLoading: true});
    this.showAccountTxTable(this.state.accountName, currentPage);
  }

  onChangeSkill = (currentPage) => {
    this.setState({skillCurrent: currentPage, isLoading: true});
  }

  onChangeRobot = (currentPage) => {
    this.setState({robotCurrent: currentPage, isLoading: true});
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

  timestampRender = (value) => {
    return utils.getBlockTime(value);
  }
  
  operatorRender = (value, index, robot) => {
    return <div>
            <Button text type="normal" style={{marginLeft: '10px'}}>升级</Button> 
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={this.goAuction.bind(this, robot)}>加入竞拍</Button> 
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={this.transferRobot.bind(this, robot)}>转让</Button> 
            <Button text type="normal" style={{marginLeft: '10px'}}>繁殖</Button> 
           </div>
  }

  salingOperatorRender = (value, index, robot) => {
    return <div>
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={this.cancelAuction.bind(this, robot)}>取消拍卖</Button> 
           </div>
  }

  goAuction = async (robot) => {
    let { robotNFT, opTooltip, robotAuction } = this.state;
    this.state.curOpRobot = robot;
    const approvedAddress = await robotNFT.methods.getApproved(robot.id).call();
    opTooltip = approvedAddress != robotAuction.address ? 
                  <div style={{color: 'red'}}>需先授权ECT，之后再提交</div>
                      :
                  <div style={{color: 'red'}}>无需授权ECT，可直接提交</div>;
    this.setState({goAuctionVisible: true, opTooltip});
  }

  transferRobot = (robot) => {
    this.state.curOpRobot = robot;
    this.setState({transferRobotVisible: true});
  }

  skillRender = (value, index, robot) => {
    return <div>
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={() => this.showSkill(robot.id)}>{value}</Button> 
           </div>
  }

  showSkill = (robotId) => {

  }

  createRobot = () => {
    this.setState({createRobotVisible: true});
  }

  approveECT = () => {
    this.setState({approveAmountVisible: true});
  }

  createRobotSubmit = async (robotInfo, error) => {
    if (error != null) {
      return;
    }
    if (!ethUtil.isValidAddress(robotInfo.address)) {
      Message.show({type: 'warning', content: '请输入有效地址', duration: 3000});
      return;
    }
    const { robotNFT, accountName } = this.state;
    robotNFT.methods.mint(robotInfo.address, robotInfo.name, robotInfo.level).send({from: accountName});
    this.setState({createRobotVisible: false});
  }
  
  approveRobot = async () => {
    const { robotAuction, robotNFT, accountName, curOpRobot } = this.state;
    const approvedAddress = await robotNFT.methods.getApproved(curOpRobot.id).call();
    if (robotAuction.address == approvedAddress) {
      Message.show({type: 'notice', content: '已给拍卖合约授权，无需再次授权', duration: 3000});
      return;
    }
    robotNFT.methods.approve(robotAuction.address, curOpRobot.id).send({from: accountName});
  }

  goAuctionSubmit = async (auctionInfo, error) => {
    if (error != null) {
      return;
    }

    const { robotAuction, accountName, curOpRobot, ethDecimals } = this.state;
    const duration = '0x' + new BigNumber(auctionInfo.duration * this.state.timeFactor).toString(16);
    auctionInfo.startingPrice = '0x' + new BigNumber(auctionInfo.startingPrice).shiftedBy(ethDecimals).toString(16);
    auctionInfo.endingPrice = '0x' + new BigNumber(auctionInfo.endingPrice).shiftedBy(ethDecimals).toString(16);
    robotAuction.methods.createAuction(curOpRobot.id, auctionInfo.startingPrice, auctionInfo.endingPrice, duration, accountName).send({from: accountName}).then(v => {
      this.setState({goAuctionVisible: false});
    });
    
  }

  cancelAuction = async (robot) => {
    const { robotAuction, accountName } = this.state;
    robotAuction.methods.cancelAuction(robot.id).send({from: accountName});
  }

  checkLevel = async (rule, level, callback) => {
    let { robotNFT, myBalanceOfECT, levelTooltip, opTooltip, ectToken, accountName, ectDecimals } = this.state;
    let legal;
    let burnedECT = await robotNFT.methods.evaluateECTBurned(level).call();
    burnedECT = new BigNumber(burnedECT).shiftedBy(ectDecimals * -1).toNumber();
    let approvedECT = await ectToken.methods.allowance(accountName, robotNFT.address).call();
    approvedECT = new BigNumber(approvedECT).shiftedBy(ectDecimals * -1).toNumber();
    if (level > 1) {
      let levelInfo = await robotNFT.methods.getValidNumOfLevel(level).call();
      legal = myBalanceOfECT >= burnedECT && parseInt(levelInfo._leftNum) > 0;
      levelTooltip = <div style={{color: '#000'}}>本级别当前需消耗ECT: {burnedECT}
                      <p/>最多容纳机器人数为: {levelInfo._maxNum}
                      <p/>剩余可容纳数为:{levelInfo._leftNum}
                    </div>;
      legal ? callback() : callback('您不符合创建条件');
    } else {  
      legal = myBalanceOfECT >= burnedECT;
      levelTooltip = <div style={{color: '#000'}}>本级别当前需消耗ECT: {burnedECT}</div>;
      legal ? callback() : callback('您不符合创建条件');
    }
    opTooltip = null;
    if (legal) {
      const needApprove = new BigNumber(approvedECT).lte(new BigNumber(burnedECT));
      opTooltip = needApprove ? <div style={{color: 'red'}}>需先授权ECT，之后再提交</div>
                                :
                                <div style={{color: 'red'}}>无需授权ECT，可直接提交</div>;
      this.state.approveAmount = needApprove ? new BigNumber(burnedECT).minus(new BigNumber(approvedECT)).toNumber() : 0;
    }
    this.setState({levelTooltip, opTooltip});
  }

  handleApproveAmountChange = (v) => {
    this.setState({approveAmount: v});
  }

  onApproveAmountOK = () => {
    if (utils.isEmptyObj(this.state.approveAmount)) {
      Message.show({type: 'warning', content: '请输入授权金额', duration: 3000});
      return;
    }
    const { ectToken, robotNFT, accountName, ectDecimals } = this.state;
    const amount = '0x' + new BigNumber(this.state.approveAmount).shiftedBy(ectDecimals).toString(16);
    ectToken.methods.approve(robotNFT.address, amount).send({from: accountName});
  }
  
  handleTransferToAccountChange = (v) => {
    this.setState({transferToAccount: v});
  }

  onTransferRobotOK = () => {
    if (!ethUtil.isValidAddress(this.state.transferToAccount)) {
      Message.show({type: 'warning', content: '请输入有效地址', duration: 3000});
      return;
    }
    let { robotNFT, accountName } = this.state;
    robotNFT.methods.transferFrom(accountName, this.state.transferToAccount, this.state.curOpRobot.id).send({from: accountName});
    this.setState({transferRobotVisible: false});
  }

  changeTimeFactor = (v) => {
    this.state.timeFactor = v;
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
      <p>价格变化结束时间:{endTime}</p>
    </Balloon>;
  }

  render() {

    const {match, t} = this.props;

    const isBlock = Boolean(match.path.includes('Block'))

    const subClass = isBlock ? 'bk' : 'tx';

    const init = this.state.robotField.init;
    const auctionInit = this.state.auctionField.init;

    return (
      <div className={cn('contain', subClass)} style={styles.all}> 
        <div className='mainContainer'> 
          <Row align='center' justify='space-around' style={{marginTop: '30px', marginLeft: '80px'}}>
              <Col>
                <Button text onClick={this.createRobot.bind(this)}><img src={setOwnerImg}/><div style={{marginLeft: '-100px', color: '#000000'}}>{T('创建机器人')}</div></Button>
              </Col>
              <Col>
                <Button text><img src={setFounderImg}/><div style={{marginLeft: '-100px', color: '#000000'}}>{T('创建技能')}</div></Button>
              </Col>
              <Col>
                <Button text><img src={issueAssetImg}/><div style={{marginLeft: '-120px', color: '#000000'}}>{T('抵押分红代币SDT')}</div></Button>
              </Col>
              <Col>
                <Button text><img src={addAssetImg}/><div style={{marginLeft: '-120px', color: '#000000'}}>{T('抵押WETH挖ETC')}</div></Button>
              </Col>
            </Row>

          <IceContainer className={cn('block-container')} style={{marginTop: '180px'}}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("持币信息")}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              原石: {this.state.myBalanceOfECT} ECT
            </Row>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              分红Token: 1200 SDT
            </Row>
          </IceContainer>
          <IceContainer className={cn('block-container')} style={{marginTop: '30px'}}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("我的机器人列表(未出售)")}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              {
                this.state.myRobots.length > 0 ? 
                <Table primaryKey="id" language={T('zh-cn')} style={{width: '100%'}}
                isZebra={false}  hasBorder={false} 
                dataSource={this.state.myRobots.slice(this.state.robotCurrent * this.state.pageSize, this.state.pageSize * (this.state.robotCurrent + 1))}
                emptyContent={<Nodata />}
                >
                  <Table.Column title={T("名称")} dataIndex="name" width={50}/>
                  <Table.Column title={T("级别")} dataIndex="level" width={25}/>
                  <Table.Column title={T("性别")} dataIndex="gender" width={25} cell={(gender) => gender == 1 ? 'π' : 'e'}/>
                  <Table.Column title={T("出生日期")} dataIndex="birthday" width={75} cell={(time) => new Date(time * 1000).toLocaleString()}/>
                  <Table.Column title={T("技能数")} dataIndex="skillNumber" width={25} cell={this.skillRender.bind(this)}/>
                  <Table.Column title={T("消耗的ECT")} dataIndex="burnedECT" width={25}/>
                  <Table.Column title={T("操作")} width={100} cell={this.operatorRender.bind(this)}/>
                </Table>
                : '无'
              }
              
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.robotCurrent} pageSize={this.state.pageSize} 
                          total={this.state.myRobots.length} onChange={this.onChangeRobot} style={{marginTop: '10px'}} />
            </Row>
          </IceContainer>
          <IceContainer className={cn('block-container')} style={{marginTop: '30px'}}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("我的机器人列表(出售中)")}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              {
                this.state.myRobotsOnAuction.length > 0 ? 
                  <Table primaryKey="id" language={T('zh-cn')} style={{width: '100%'}}
                  isZebra={false}  hasBorder={false} 
                  dataSource={this.state.myRobotsOnAuction.slice(this.state.salingRobotCurrent * this.state.pageSize, this.state.pageSize * (this.state.salingRobotCurrent + 1))}
                  emptyContent={<Nodata />}
                  >
                    <Table.Column title={T("名称")} dataIndex="name" width={50}/>
                    <Table.Column title={T("级别")} dataIndex="level" width={25}/>
                    <Table.Column title={T("性别")} dataIndex="gender" width={25} cell={(gender) => gender == 1 ? 'π' : 'e'}/>
                    <Table.Column title={T("出生日期")} dataIndex="birthday" width={75} cell={(time) => new Date(time * 1000).toLocaleString()}/>
                    <Table.Column title={T("技能数")} dataIndex="skillNumber" width={25} cell={this.skillRender.bind(this)}/>
                    <Table.Column title={T("消耗的ECT")} dataIndex="burnedECT" width={40}/>
                    <Table.Column title={T("售价")} dataIndex="price" width={25} cell={this.auctionRender.bind(this)}/>
                    <Table.Column title={T("操作")} width={100} cell={this.salingOperatorRender.bind(this)}/>
                  </Table>
                  : '无'
              }
              
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.salingRobotCurrent} pageSize={this.state.pageSize} 
                          total={this.state.myRobotsOnAuction.length} onChange={this.onChangeRobot} style={{marginTop: '10px'}} />
            </Row>
          </IceContainer>

          <IceContainer className={cn('block-container')}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("我的技能列表")}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              <Table primaryKey="name" language={T('zh-cn')} style={{width: '100%'}}
                isZebra={false}  hasBorder={false} 
                dataSource={this.state.mySkills.slice(this.state.skillCurrent * this.state.pageSize, this.state.pageSize * (this.state.skillCurrent + 1))}
                emptyContent={<Nodata />}
              >
                <Table.Column title={T("名称")} dataIndex="name" width={50}/>
                <Table.Column title={T("级别")} dataIndex="level" width={30}/>
                <Table.Column title={T("描述")} dataIndex="desc" width={100} />
                <Table.Column title={T("官方链接")} dataIndex="officialUrl" width={100}/>
                <Table.Column title={T("消耗的原石数")} dataIndex="consumedECT" width={100}/>
                <Table.Column title={T("所有者")} dataIndex="owner" width={100}/>
                <Table.Column title={T("当前售价")} dataIndex="price" width={100} cell={this.operatorRender.bind(this)}/>
              </Table>
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.skillCurrent} pageSize={this.state.pageSize} total={this.state.mySkills.length} onChange={this.onChangeSkill} style={{marginTop: '10px'}} />
            </Row>
          </IceContainer>
        </div>
        <Dialog
          title="创建机器人"
          style={{ width: 640 }}
          visible={this.state.createRobotVisible}
          closable="esc,mask,close"
          onCancel={() => this.setState({createRobotVisible: false})}
          onClose={() => this.setState({createRobotVisible: false})}
          footer={<div/>}
        >
          <Form direction="ver" field={this.state.robotField}>
            <FormItem label="所有者地址：" {...formItemLayout} asterisk={true}>
              <Input 
                {...init('address', {
                  rules: [{ required: true, message: '地址0x开头,总长度需为42', trigger: 'onBlur', length:42 }],
                  initValue: this.state.accountName
                })}
              />
            </FormItem>

            <FormItem label="名称：" {...formItemLayout} asterisk={true}>
              <Input placeholder="3<=长度<=32"
                {...init('name', {
                  rules: [{ required: true, trigger: 'onBlur', message: '必填' },
                          { pattern:/\w{3,32}/, message:'名称由3~32个字母、数字、下划线组成'}],
                })}
              />
            </FormItem>

            <FormItem label="级别：" {...formItemLayout} asterisk={true}>
              <Select dataSource={this.state.robotLevels}
                {...init('level', {
                  rules: [{ required: true, message: '必选', trigger: 'onChange' },
                          { validator: this.checkLevel }],
                })}
              />
            </FormItem>
            <Row justify='space-around'>
              <FormItem label=''>
                <Form.Submit style={{marginRight: '20px'}} type="primary" onClick={() => this.approveECT()}>授权ECT</Form.Submit>
                <Form.Submit validate type="primary" onClick={(v, e) => this.createRobotSubmit(v, e)}>提交</Form.Submit>
              </FormItem>
            </Row>
          </Form>
          <Row justify='center'>
            {this.state.opTooltip}
          </Row>
          <Row justify='center'>
            {this.state.levelTooltip}
          </Row>
        </Dialog>
        
        <Dialog
          title="将机器人加入竞拍"
          style={{ width: 640 }}
          visible={this.state.goAuctionVisible}
          closable="esc,mask,close"
          onCancel={() => this.setState({goAuctionVisible: false})}
          onClose={() => this.setState({goAuctionVisible: false})}
          footer={<div/>}
        >
          <Form direction="ver" field={this.state.auctionField}>
            <FormItem label="起始价(ETH)" format="number" {...formItemLayout} asterisk={true}>
              <Input 
                {...auctionInit('startingPrice', {
                  rules: [{ required: true, message: '请输入竞拍起始价（最高价）', trigger: 'onBlur'}],
                })}
              />
            </FormItem>

            <FormItem label="结束价(ETH)" format="number" {...formItemLayout} asterisk={true}>
              <Input
                {...auctionInit('endingPrice', {
                  rules: [{ required: true, trigger: 'onBlur', message: '请输入竞拍结束价（最低价）' }],
                })}
              />
            </FormItem>

            <FormItem label="价格调整时长" {...formItemLayout} asterisk={true}>
              <NumberPicker {...auctionInit('duration', {
                  rules: [{ required: true, message: '请输入时长', trigger: 'onBlur' }],
                })}/>
              <Select dataSource={[{label:'分钟', value: 60}, {label:'小时', value: 3600}, {label:'天', value: 86400}, {label:'周', value: 604800}]}
                      defaultValue={86400} onChange={this.changeTimeFactor.bind(this)}/>
            </FormItem>
            <Row justify='space-around'>
              <FormItem label=''>
                <Form.Submit style={{marginRight: '20px'}} type="primary" onClick={() => this.approveRobot()}>授权</Form.Submit>
                <Form.Submit validate type="primary" onClick={(v, e) => this.goAuctionSubmit(v, e)}>提交</Form.Submit>
              </FormItem>
            </Row>
          </Form>
          <Row justify='center'>
            {this.state.opTooltip}
          </Row>
          <p>
            竞拍规则: 价格按照时间流逝线性变化(从起始价到结束价为止)
          </p>
          <p>
            举例1:如设定的最高价是2ETH, 最低价1ETH, 时长为2天, 则在1天后, 用户出1.5ETH便可拍得机器人, 在2天及之后的时间里, 用户出1ETH便可拍得机器人
          </p>
          <p>
            举例2:如设定的最高价是2ETH, 最低价4ETH, 时长为1天, 则在半天后, 用户出3ETH可拍得机器人, 在1天及之后的时间里, 用户都需要出4ETH便可拍得机器人
          </p>
        </Dialog>
        <Dialog style={{ width: '400px'}}
          visible={this.state.approveAmountVisible}
          title="输入授权金额"
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={this.onApproveAmountOK.bind(this)}
          onCancel={() => this.setState({approveAmountVisible: false})}
          onClose={() => this.setState({approveAmountVisible: false})}
        >
          <Input hasClear autoFocus
            onChange={this.handleApproveAmountChange.bind(this)}
            style={{ width: '100%'}}
            innerBefore="授权金额"
            value={this.state.approveAmount}
          />
          <p>
          友情提示:  
          </p>
          <p>
          1: 若您只创建一个机器人，授权的金额按照本次需要的额度进行设置即可
          </p>
          <p>
          2: 若您之后需要创建多个机器人，那么本次授权金额多一些，后续便不需要频繁授权，由此节省交易手续费 
          </p>
        </Dialog>

        <Dialog style={{ width: '400px'}}
          visible={this.state.transferRobotVisible}
          title="输入接受者账号"
          footerAlign="center"
          closeable="esc,mask,close"
          onOk={this.onTransferRobotOK.bind(this)}
          onCancel={() => this.setState({transferRobotVisible: false})}
          onClose={() => this.setState({transferRobotVisible: false})}
        >
          <Input hasClear autoFocus
            onChange={this.handleTransferToAccountChange.bind(this)}
            style={{ width: '100%'}}
            innerBefore="接受账号"
            value={this.state.transferToAccount}
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