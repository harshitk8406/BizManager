import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/select-firm');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/select-firm');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <style>{`
        .login-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-primary);
          padding: 40px 20px;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          background-color: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 40px;
          box-shadow: var(--shadow-lg);
          box-sizing: border-box;
          animation: loginFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes loginFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-title {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 6px 0;
        }

        .login-subtitle {
          color: var(--text-muted);
          font-size: 14px;
          margin: 0;
        }

        .input-group {
          position: relative;
          margin-bottom: 24px;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
        }

        .input-field {
          width: 100%;
          padding: 13px 16px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .input-field:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-primary-glow);
        }

        .input-field::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .err-banner {
          background: var(--danger-dim);
          border: 1px solid rgba(220, 38, 38, 0.2);
          color: var(--danger);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 14px;
          margin-bottom: 24px;
          text-align: center;
        }

        .submit-btn {
          width: 100%;
          background-color: var(--accent-primary);
          color: #ffffff;
          border: none;
          padding: 14px;
          border-radius: var(--radius-md);
          font-size: 16px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 12px;
        }

        .submit-btn:hover:not(:disabled) {
          background-color: var(--accent-secondary);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: var(--text-muted);
        }

        .login-footer a {
          color: var(--accent-primary);
          text-decoration: none;
          font-weight: 600;
        }

        .login-footer a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">BizLedger</h1>
          <p className="login-subtitle">Sign in to manage your business portfolio</p>
        </div>

        {error && <div className="err-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <div className="input-wrapper">
              <input
                className="input-field"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <input
                className="input-field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            Sign In
          </button>
        </form>

        <div className="login-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
