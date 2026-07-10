import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Catches any render error so the preview shows a recoverable message instead of
 * a blank white page. The fallback uses plain DOM (not react-native-web) so it
 * renders even if the RN tree is what failed. "Reset app data" clears the local
 * store — the escape hatch if persisted data is ever incompatible.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
  }

  private reset = () => {
    try {
      localStorage.removeItem('document-tracker-preview-v1');
    } catch {
      /* ignore */
    }
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 420,
            margin: '80px auto',
            padding: 24,
            fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif',
            color: '#111827',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40 }}>😕</div>
          <h2 style={{ margin: '12px 0 8px' }}>Something went wrong</h2>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
            The preview hit an error. Resetting the local demo data usually fixes it (this only
            clears data stored in your browser).
          </p>
          <pre
            style={{
              background: '#f6f8fa',
              color: '#b42318',
              padding: 10,
              borderRadius: 8,
              fontSize: 12,
              overflowX: 'auto',
              textAlign: 'left',
            }}
          >
            {String(this.state.error.message || this.state.error)}
          </pre>
          <button
            onClick={this.reset}
            style={{
              marginTop: 12,
              background: '#1f6feb',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset app data
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
