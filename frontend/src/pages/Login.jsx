import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../garago/Icon';

const roleToPath = (role) => {
    if (role === 'ADMIN') return '/admin/dashboard';
    if (role === 'MANAGER') return '/manager/dashboard';
    return null;
};

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) {
            const path = roleToPath(user.role);
            if (path) navigate(path, { replace: true });
            else setError('This portal is for admins and managers only.');
        }
    }, [user, loading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }
        setSubmitting(true);
        try {
            const logged = await login(email, password);
            const path = roleToPath(logged.role);
            if (path) {
                navigate(path, { replace: true });
            } else {
                setError('This portal is for admins and managers only.');
            }
        } catch (err) {
            if (err?.response) {
                const status = err.response.status;
                const detail = err.response.data?.detail;
                if (status === 401) setError('Incorrect email or password.');
                else if (status === 400) setError(detail || 'Invalid request.');
                else if (status === 422) setError('Validation error. Check your email format.');
                else if (status >= 500) setError('Server error. Try again later.');
                else setError(detail || 'Unexpected error.');
            } else if (err?.request) {
                setError('Unable to reach the server.');
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)' }}>
                <div className="mono text-xs muted" style={{ letterSpacing: '.1em', textTransform: 'uppercase' }}>Loading…</div>
            </div>
        );
    }

    return (
        <div className="login-wrap">
            <div className="login-art">
                <div className="flex items-center gap-3">
                    <div
                        className="brand-mark"
                        style={{ background: '#fafaf7', color: '#0a0a0a', width: 32, height: 32, fontSize: 14 }}
                    >
                        G
                    </div>
                    <span className="mono text-sm" style={{ letterSpacing: '.1em' }}>GARAGO / v2.1.0</span>
                </div>
                <div>
                    <div
                        className="mono text-xs"
                        style={{ opacity: 0.5, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 16 }}
                    >
                        Smart bus garage
                    </div>
                    <h1>Every bus, every driver, every ticket — in one control plane.</h1>
                    <div className="mono text-xs mt-4" style={{ opacity: 0.5 }}>
                        Live operations · Real-time fleet · Unified revenue
                    </div>
                </div>
                <div className="mono text-xs" style={{ opacity: 0.4, letterSpacing: '.08em' }}>
                    <div>SERVER · PRIMARY</div>
                    <div>STATUS · ALL SYSTEMS NOMINAL</div>
                    <div>BUILD · 2026.04.17</div>
                </div>
            </div>

            <form className="login-panel" onSubmit={handleSubmit} noValidate>
                <div
                    className="mono text-xs muted mb-2"
                    style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}
                >
                    Sign in
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 32px' }}>
                    Welcome back.
                </h2>

                {error ? (
                    <div
                        className="panel mb-4"
                        style={{
                            padding: '10px 12px',
                            borderColor: 'var(--crit)',
                            color: 'var(--crit)',
                            background: 'color-mix(in oklab, var(--crit) 6%, transparent)',
                        }}
                    >
                        <div className="mono text-xs" style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            Error
                        </div>
                        <div className="text-sm" style={{ marginTop: 2 }}>{error}</div>
                    </div>
                ) : null}

                <label>Email</label>
                <div className="field mb-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        autoFocus
                        required
                    />
                </div>

                <label>Password</label>
                <div className="field mb-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="btn primary w-full"
                    disabled={submitting}
                    style={{ justifyContent: 'center', height: 40, fontSize: 14, opacity: submitting ? 0.6 : 1 }}
                >
                    {submitting ? 'Signing in…' : (<>Sign in <Icon name="arrow" /></>)}
                </button>

                <div
                    className="mono text-xs muted mt-3"
                    style={{ letterSpacing: '.04em' }}
                >
                    Your role is determined by your account.
                </div>

                <div className="flex justify-between mt-4 text-xs muted" style={{ marginTop: 16 }}>
                    <span>© 2026 Garago</span>
                    <span className="mono" style={{ letterSpacing: '.06em' }}>SECURE</span>
                </div>
            </form>
        </div>
    );
};

export default Login;
