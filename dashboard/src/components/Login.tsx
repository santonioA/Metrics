import { useState, type FormEvent } from 'react';
import { AuthError, login, type Credentials } from '../api';

export function Login({ onLogin }: { onLogin: (c: Credentials, name: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = { username: username.trim(), password };
      const res = await login(c);
      onLogin(c, res.name);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login">
        <h1>Zeeker impact</h1>
        <p className="sub">Sign in to see how the team uses Zeeker.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Username</span>
            <input
              className="control"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="control"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
