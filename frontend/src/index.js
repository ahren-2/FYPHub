// File: frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // You should also have this file
import App from './App';

// Find the 'root' div in index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Tell React to render your App component inside that div
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);