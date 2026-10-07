import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Preferences } from './Preferences';
import './theme.css';
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('view') === 'preferences' ? <Preferences /> : <App />);
