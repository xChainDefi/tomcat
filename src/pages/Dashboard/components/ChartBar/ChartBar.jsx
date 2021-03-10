import React, { Component } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Bar, Area, Scatter, XAxis,
  YAxis, ReferenceLine, ReferenceDot, Tooltip, Legend, CartesianGrid, Brush,
  LineChart } from 'recharts';
import { T } from '../../../../utils/lang';

// eslint-disable-next-line react/prefer-stateless-function
export default class Demo extends Component {

  static displayName = 'ComposedChartDemo';
  
  constructor(props) {
    super(props);
    this.state = {
      robotData: []
    };
  }

  componentDidMount() {
    this.updateSampleData(this.props.sampleData);
  }

  componentWillReceiveProps(nextProps) {
    this.updateSampleData(nextProps.sampleData);
  }

  updateSampleData = (sampleData) => {
    const robotDataList = [];
    sampleData.map(robotInfo => {
      var newRobotData = {};
      newRobotData[T('级别')] = robotInfo.level;
      newRobotData[T('上限数量')] = robotInfo.limitation;
      newRobotData[T('当前数量')] = robotInfo.curNumber;
      robotDataList.push(newRobotData);
    });
    this.setState({robotData: robotDataList});
  }

  render () {
    return (
          <ComposedChart width={document.body.scrollWidth * 0.75} height={400} data={this.state.robotData} margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
            <XAxis dataKey={T("级别")}/>
            <YAxis />
            <Legend />
            <CartesianGrid stroke="#f5f5f5" />
            <Tooltip />
            <Bar dataKey={T("当前数量")} stackId="a" barSize={20} fill="rgba(35, 201, 167, 1)" />
            <Bar dataKey={T("上限数量")} stackId="a" barSize={20} fill="#8884d8" />
            {/* <Line dataKey={T("上限数量")} type="monotone" strokeWidth={2} stroke="#c02230" /> */}
          </ComposedChart>
    );
  }
}
