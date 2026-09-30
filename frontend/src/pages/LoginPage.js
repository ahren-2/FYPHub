// --- File: src/pages/LoginPage.js ---
import React, { useState } from 'react';
import api from '../api';
import './LoginPage.css';
import utsLogo from './LOGO.png';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Get the token pair.
      const res = await api.post('/token/', { username, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);

      // 2. Read the real role so the correct workspace opens.
      const userRes = await api.get('/user/me/');
      const realRole = userRes.data.role;

      localStorage.setItem('user_role', realRole);

      // 3. Tell App.js about the successful login.
      onLogin(realRole);

    } catch (err) {
      setErrorMessage('That username or password was not recognised. Check your spelling, then try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-form-wrapper">
        <img src={utsLogo} alt="UTS Logo" className="login-logo" />
        <h1 className="login-title">FYP PORTAL LOGIN</h1>

        <form onSubmit={handleSubmit} className="login-form">
          <input 
            type="text" 
            placeholder="Username" 
            className="login-input" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="login-input" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required 
          />
          
          {errorMessage && (
            <p className="login-error" role="alert">{errorMessage}</p>
          )}

          <button type="submit" className="login-button-primary" disabled={loading}>
            {loading ? 'LOGGING IN...' : 'SIGN ME IN'}
          </button>
        </form>

        <button
          type="button"
          className="login-button-secondary"
          onClick={() => setShowHelp((prev) => !prev)}
        >
          Trouble signing in?
        </button>

        {showHelp && (
          <div className="login-help">
            <p>
              <strong>Students</strong> use the matric number printed on the faculty list.
              <strong> Lecturers and coordinators</strong> use the staff account created by the FYP coordinator.
            </p>
            <p>
              Passwords are not reset from this page. Contact your FYP coordinator or the faculty IT desk and they
              will issue a new one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
