import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import { configureGoogle } from './src/core/google/googleAuth';

configureGoogle();

export default function App() {
  return <RootNavigator />;
}
