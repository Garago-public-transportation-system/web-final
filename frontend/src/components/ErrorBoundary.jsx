import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--ink)',
                    padding: '32px',
                    textAlign: 'center',
                    fontFamily: 'Inter, system-ui, sans-serif',
                }}
            >
                <div className="mono text-xs muted" style={{ letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Application fault
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
                    Something went wrong.
                </h1>
                <p className="muted text-sm" style={{ maxWidth: 560, marginBottom: 24 }}>
                    An unexpected error occurred in this section of the application. Reload to continue.
                </p>
                <button className="btn primary" onClick={() => window.location.reload()}>Reload page</button>
                {import.meta.env.MODE === 'development' && this.state.error ? (
                    <div style={{ marginTop: 32, maxWidth: 800, textAlign: 'left', width: '100%' }}>
                        <div className="mono text-xs muted mb-2" style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}>Error</div>
                        <pre
                            className="mono"
                            style={{
                                padding: 12,
                                background: 'var(--panel)',
                                border: '1px solid var(--line-soft)',
                                fontSize: 11,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {String(this.state.error)}
                        </pre>
                    </div>
                ) : null}
            </div>
        );
    }
}

export default ErrorBoundary;
