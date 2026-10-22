// RegistrationStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SignUpScreen from './SignUpScreen';
import LoginScreen from './LoginScreen';

const Stack = createStackNavigator();

const RegistrationStack = () => {
  return (
    <Stack.Navigator initialRouteName="SignUp">
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Sign Up' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log In' }} />
    </Stack.Navigator>
  );
};

export default RegistrationStack;
