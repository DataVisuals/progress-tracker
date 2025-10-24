import React, { useState } from 'react';
import { api } from '../api/client';
import './Login.css';

const Login = ({ onLogin }) => {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(email, password);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setShowModal(false);
      onLogin(user); // Pass user data directly to callback
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) {
    return (
      <button className="login-btn" onClick={() => setShowModal(true)}>
        Login
      </button>
    );
  }

  return (
    <div className="login-overlay" onClick={() => setShowModal(false)}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-header">
          <h1>Login</h1>
          <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="login-input"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="login-input"
            required
            autoFocus
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
