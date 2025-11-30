'use client'
import './EmbeddedDemoErrorBoundary.css'
import React from 'react';

class EmbeddedDemoErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error details
        console.error('EmbeddedDemoViewer Error:', error);
        console.error('Error Info:', errorInfo);

        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-fallback">
                    <div className="error-content">
                        <div className="error-icon">⚠️</div>
                        <h3>3D Model Loading Error</h3>
                        <p>The embedded model viewer encountered an error.</p>
                        <button
                            className="retry-button"
                            onClick={() => {
                                this.setState({ hasError: false, error: null, errorInfo: null });
                                window.location.reload();
                            }}
                        >
                            Reload Page
                        </button>
                        {process.env.NODE_ENV === 'development' && (
                            <details className="error-details">
                                <summary>Technical Details</summary>
                                <pre>{this.state.error && this.state.error.toString()}</pre>
                                <pre>{this.state.errorInfo.componentStack}</pre>
                            </details>
                        )}
                    </div>

                </div>
            );
        }

        return this.props.children;
    }
}

export default EmbeddedDemoErrorBoundary;
