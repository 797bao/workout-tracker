import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// The Android widget's WebView can't resolve env(safe-area-inset-top) (always
// 0), so the app passes the real status-bar height as ?insetTop=<css px> and
// we feed it to the --safe-top variable the layout is built on.
const insetTop = new URLSearchParams(window.location.search).get('insetTop');
if (insetTop && !isNaN(parseFloat(insetTop))) {
  document.documentElement.style.setProperty('--safe-top', `${parseFloat(insetTop)}px`);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);