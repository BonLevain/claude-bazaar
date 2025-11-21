import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PluginProvider } from './contexts/PluginContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PluginProvider>
        <App />
      </PluginProvider>
    </BrowserRouter>
  </React.StrictMode>
);
