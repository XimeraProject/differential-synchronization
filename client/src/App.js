import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import synchronization from './database.js';

class App extends Component {
  state = {users: [], value: ""}

  componentDidMount() {
    fetch('/users')
      .then(res => res.json())
      .then(users => this.setState({ users }));
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <h1>Users</h1>
        {this.state.users.map(user =>
          <div key={user.id}>{user.username}</div>
	)}
	<div><span>{this.state.value}</span></div>
	<div>
	    <input type="text" onChange={(event) => this.setState({value: event.target.value})} value={this.state.value}/>
	</div>
      </div>
    );
  }
}

export default App;
