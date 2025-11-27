"use client"
import { ModelInfoProvider } from './ModelInfoContext';

export default function ModelInfoWrapper({ children }) {
    return (
        <ModelInfoProvider>
            {children}
        </ModelInfoProvider>
    );
}