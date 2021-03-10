import React, { Component } from 'react';
import { Button, Grid, Input, Icon, Table, Pagination } from "@alifd/next";
import IceContainer from '@icedesign/container';
import BigNumber from "bignumber.js";
import { T } from '../../utils/lang';
import './local.scss';
import cn from 'classnames';
import blockIcon from '../../components/Common/images/block-white.png';
import txIcon from '../../components/Common/images/tx-black.png';
import Nodata from '../../components/Common/Nodata';

const { Row, Col } = Grid;

export default class SkillNFT extends Component {
  static displayName = 'SkillNFT';

  constructor(props) {
    super(props);
    this.state = {
        skills: [],
        accountName: "",
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
        current: 1,
        totalAccountTxsNum: 0,
        salingCurrent: 0,
        salingSkills: [],
        searchInfo: null,
    };
    this.autoGenerateSkills();
  }

  autoGenerateSkills = () => {
    var skillId = 0;
    for (var level = 1; level < 6; level++) {
      for (var number = 1; number < (8 - level) * 8; number++) {
        const owner = '0x' + (level * number) % 7 + number % 10 + (level * number) % 8 + '...';
        const bSaling = (level * number) %3 == 0;
        const price = bSaling ? level / 100 + ' ETH' : '0';
        const hasRobot = skillId % 5 == 0;
        const skill = {skillId: skillId++, name: 'skill_' + level + '_' + number, desc: '报价机器人', officialUrl: 'swapbot.xchainunion.com',
                      level, consumedECT: level, owner: hasRobot ? 'robot_' + level + '_' + number : owner, bSaling, price };
        this.state.skills.push(skill);
        if (bSaling)
          this.state.salingSkills.push(skill);
      }
    }
  }

  componentDidMount = async () => {
  }

  onSearch = () => {
    const _this = this;
    const salingSkills = [];
    this.state.skills.map(skill => {
      if (!skill.bSaling) return;
      if (skill.level == _this.state.searchInfo || skill.owner == _this.state.searchInfo 
          || skill.name == _this.state.searchInfo || skill.officialUrl == _this.state.searchInfo) {
        salingSkills.push(skill);
      }
    });
    this.setState({salingSkills});
  }

  onChange = (currentPage) => {
    this.setState({current: currentPage, isLoading: true});
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

  onLevelChange = (v) => {
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
            <Button text type="normal" style={{marginLeft: '10px'}} onClick={() => this.buySkill(record)}>购买</Button> 
           </div>
  }
  
  buySkill = (skillInfo) => {
    if (this.props.drizzle.contracts['SkillAuction'] != null) {
      this.props.drizzle.contracts['SkillAuction'].methods["bid"].cacheSend(skillInfo.skillId, 
                                                                            {
                                                                            value: '0x' + new BigNumber(skillInfo.price).shiftedBy(18).toString(16)});
    } else {
      this.props.drizzle.contracts.ClockAuctionFactory.methods["createClockAuction"].cacheSend(skillInfo.skillId, 
        {
        value: '0x' + new BigNumber(skillInfo.price).shiftedBy(18).toString(16)});
    }
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
                  placeholder={T("根据名称/级别/所有者搜索出售中的技能")} onChange={this.onLevelChange.bind(this)} onPressEnter={this.onSearch.bind(this)}/>
          </Row>  
          <IceContainer className={cn('block-container')}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("出售中的技能列表")}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              <Table primaryKey="name" language={T('zh-cn')} style={{width: '100%'}}
                isZebra={false}  hasBorder={false} 
                dataSource={this.state.salingSkills.slice(this.state.salingCurrent * this.state.pageSize, this.state.pageSize * (this.state.salingCurrent + 1))}
                emptyContent={<Nodata />}
              >
                <Table.Column title={T("名称")} dataIndex="name" width={100}/>
                <Table.Column title={T("级别")} dataIndex="level" width={100}/>
                <Table.Column title={T("描述")} dataIndex="desc" width={100} />
                <Table.Column title={T("官方链接")} dataIndex="officialUrl" width={100}/>
                <Table.Column title={T("消耗的原石数")} dataIndex="consumedECT" width={100}/>
                <Table.Column title={T("所有者")} dataIndex="owner" width={100}/>
                <Table.Column title={T("当前售价")} dataIndex="price" width={100} cell={this.salingRender.bind(this)}/>
              </Table>
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.salingCurrent} pageSize={this.state.pageSize} total={this.state.salingSkills.length} onChange={this.onChangeSaling} style={{marginTop: '10px'}} />
            </Row>
          </IceContainer>

          <IceContainer className={cn('block-container')}>
            <h4 className={cn('title')}> <img src={txIcon} width='24'/>{T("所有技能列表")}</h4>
            <Row style={{marginBottom: '10px', width: '100%'}}>
              <Table primaryKey="name" language={T('zh-cn')} style={{width: '100%'}}
                isZebra={false}  hasBorder={false} 
                dataSource={this.state.skills.slice(this.state.current * this.state.pageSize, this.state.pageSize * (this.state.current + 1))}
                emptyContent={<Nodata />}
              >
                <Table.Column title={T("名称")} dataIndex="name" width={100}/>
                <Table.Column title={T("级别")} dataIndex="level" width={100}/>
                <Table.Column title={T("描述")} dataIndex="desc" width={100} />
                <Table.Column title={T("官方链接")} dataIndex="officialUrl" width={100}/>
                <Table.Column title={T("消耗的原石数")} dataIndex="consumedECT" width={100}/>
                <Table.Column title={T("所有者")} dataIndex="owner" width={100}/>
                {/* <Table.Column title={T("交易详情")} dataIndex="actiondata" width={100} cell={this.txDetailRender.bind(this)}/> */}
              </Table>
            </Row>
            <Row justify='end'>
              <Pagination hideOnlyOnePage showJump={false} shape="arrow-only" current={this.state.current} pageSize={this.state.pageSize} total={this.state.skills.length} onChange={this.onChange} style={{marginTop: '10px'}} />
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