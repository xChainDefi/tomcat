import React, { Component } from 'react';
import { Grid } from '@icedesign/base';
import { Slider } from '@alifd/next';
import './Dashboard.scss';

import DisplayCard from './components/DisplayCard';

import ChartBar from './components/ChartBar';



const { Row, Col } = Grid;

const slides = [
  { url: 'https://img.alicdn.com/tps/TB1bewbNVXXXXc5XXXXXXXXXXXX-1000-300.png', text: 'Tape Player Skin Design Competition' },
  { url: 'https://img.alicdn.com/tps/TB1xuUcNVXXXXcRXXXXXXXXXXXX-1000-300.jpg', text: 'Mobile Phone Taobao Skin Call' },
  { url: 'https://img.alicdn.com/tps/TB1ikP.NVXXXXaYXpXXXXXXXXXX-1000-300.jpg', text: 'Design Enabling Public Welfare' },
  { url: 'https://img.alicdn.com/tps/TB1s1_JNVXXXXbhaXXXXXXXXXXX-1000-300.jpg', text: 'Amoy Doll Design Competition' }
];

const itemNodes = slides.map((item, index) => <div key={index}><img style={{width: '100%', height: '80px'}} draggable={false} src={item.url} alt={item.text} /></div>);


export default class Dashboard extends Component {
  static displayName = 'Dashboard';

  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount = async () => {
  }

  render() {
    return (
      <div className="dashboard-page" style={{background: '#f5f6fa'}}>
        <DisplayCard drizzle={this.props.drizzle} drizzleState={this.props.drizzleState}/>
      </div>
    );
  }
}
