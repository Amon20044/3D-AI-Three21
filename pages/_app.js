import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ModelInfoProvider } from '../components/ModelInfoContext';
import '../app/globals.css';
import { Analytics } from "@vercel/analytics/next"

export default function MyApp({ Component, pageProps }) {
    // Create QueryClient instance with optimized defaults
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes
                gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
                retry: 2,
                refetchOnWindowFocus: false,
                refetchOnReconnect: true
            },
            mutations: {
                retry: 3,
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
            }
        }
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <ModelInfoProvider>
                <Component {...pageProps} />
            </ModelInfoProvider>
            <Analytics />
        </QueryClientProvider>
    );
}
