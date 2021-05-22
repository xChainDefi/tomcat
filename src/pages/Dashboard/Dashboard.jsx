import React, { Component } from 'react';
import './Dashboard.scss';

import DisplayCard from './components/DisplayCard';


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
