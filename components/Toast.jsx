'use client'
import { useState, useEffect } from 'react';
import './toast.css'
export function Toast({ message, isVisible, onHide, duration = 3000 }) {
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onHide();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onHide]);

    if (!isVisible) return null;

    return (
        <div className="toast-container">
            <div className="toast-content">
                <div className="toast-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <span className="toast-message">{message}</span>
                <button
                    className="toast-close"
                    onClick={onHide}
                    aria-label="Close toast"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

        </div>
    );
}
