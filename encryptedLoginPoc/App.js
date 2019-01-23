/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from 'react';
import { Button, SafeAreaView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { doLoginAsync } from './encrypt';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
  },
  line: {
    flex: 1,
    backgroundColor: 'white',
    color: 'black',
    fontSize: 20,
    padding: 10,
  },
  warn: {
    backgroundColor: '#F2DC71',
  },
  error: {
    backgroundColor: '#F2704F',
  },
  success: {
    backgroundColor: '#51D16D',
  },
});

type LogProps = {
  type: 'warn' | 'log' | 'error' | 'success',
  message: string,
  sensibleData: string,
  omitEnabled: boolean,
}

class Log extends React.PureComponent<LogProps> {
  omitIfNeeded = () => this.props
    .message
    .replace(
      /\{sensible\}/g,
      !this.props.omitEnabled ? this.props.sensibleData : '{DATA OMITTED}',
    );
  render() {
    let newStyle;
    switch (this.props.type) {
      case 'success':
        newStyle = styles.success;
        break;
      case 'error':
        newStyle = styles.error;
        break;
      case 'warn':
        newStyle = styles.warn;
        break;
    }
    const message = this.omitIfNeeded();
    return (
      <Text style={[styles.line, newStyle]}>{message}</Text>
    );
  }
}


type Props = {};
type State = {
  logs: LogProps[],
  isLoading: boolean,
  omitEnabled: boolean,
};

export default class App extends Component<Props, State> {
  state: State = { logs: [], isLoading: false, omitEnabled: true };

  handleAllLogs = (type, message, sensibleData) =>
    this.setState(state => {
      const logs = state.logs.slice();
      logs.push({ type, message, sensibleData });
      return { logs };
    });
  handleLog = (message, sensibleData) =>
    this.handleAllLogs('log', message, sensibleData);
  handleWarn = (message, sensibleData) =>
    this.handleAllLogs('warn', message, sensibleData);
  handleError = (message, sensibleData) =>
    this.handleAllLogs('error', message, sensibleData);
  handleSuccess = (message, sensibleData) =>
    this.handleAllLogs('success', message, sensibleData);

  handleButtonPress = () => {
    this.setState({ isLoading: true, logs: [] }, async () => {
      try {
        const apiContract = await doLoginAsync(
          'My super secret user name',
          'powerful secure password',
          this.handleLog,
          this.handleWarn,
          this.state.omitEnabled,
        );
        this.handleSuccess("{sensible}", apiContract);
      } catch (err) {
        this.handleError(err.message);
      }
      this.setState({ isLoading: false });
    });
    // tslint:disable-next-line:semicolon
  };

  toggleOmit = () =>
    this.setState(state => ({ omitEnabled: !state.omitEnabled }));

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <Button
          onPress={this.handleButtonPress}
          disabled={this.state.isLoading}
          title={'Do login'}
        />

        <Button
          onPress={this.toggleOmit}
          title={`${!this.state.omitEnabled ? 'Omit ' : 'Show'} sensible data`}
        />
        <ScrollView>
          {this.state.logs.map(({ type, message, sensibleData }) => (
            <Log
              key={message + sensibleData}
              omitEnabled={this.state.omitEnabled}
              message={message}
              sensibleData={sensibleData}
              type={type}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
}
