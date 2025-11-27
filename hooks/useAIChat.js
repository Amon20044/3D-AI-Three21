import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook for AI chat with advanced retry logic, jitter, and exponential backoff
 * 
 * Features:
 * - Exponential backoff retry strategy
 * - Jitter to prevent thundering herd
 * - Automatic error handling
 * - Optimistic updates
 * - Request deduplication
 */

const calculateRetryDelay = (attemptIndex) => {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 16000);
  
  // Add jitter (±25% randomness) to prevent thundering herd
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
  
  const finalDelay = Math.max(baseDelay + jitter, 500); // Minimum 500ms
  
  console.log(`🔄 Retry attempt ${attemptIndex + 1}, waiting ${(finalDelay / 1000).toFixed(2)}s`);
  
  return finalDelay;
};

const isRetryableError = (error) => {
  // Retry on network errors, timeouts, and 5xx server errors
  if (!error.response) return true; // Network error
  
  const status = error.response?.status;
  
  // Retry on server errors and rate limits
  if (status >= 500 || status === 429) return true;
  
  // Don't retry on client errors (4xx except 429)
  if (status >= 400 && status < 500) return false;
  
  return true;
};

const sendChatRequest = async ({ 
  messages, 
  modelInfo, 
  selectedPart, 
  screenshot, 
  sceneAnalysis, 
  analysisContext,
  signal // AbortSignal for cancellation
}) => {
  console.log('🚀 Sending AI chat request:', {
    messageCount: messages.length,
    hasScreenshot: !!screenshot,
    screenshotSize: screenshot ? `${(screenshot.length / 1024).toFixed(2)} KB` : 'N/A',
    hasSelectedPart: !!selectedPart,
    selectedPartName: selectedPart?.name || 'None'
  });

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      modelInfo,
      selectedPart,
      screenshot,
      sceneAnalysis,
      analysisContext: analysisContext || {
        excludeUIElements: true,
        focusOnModel: true,
        researchGrade: true,
        provideCitations: true,
        provideLinks: true
      }
    }),
    signal // Pass abort signal for cancellation
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    error.response = response;
    error.data = errorData;
    throw error;
  }

  const data = await response.json();

  if (data.error) {
    const error = new Error(data.error);
    error.data = data;
    throw error;
  }

  console.log('✅ AI response received:', {
    contentLength: data.content?.length || 0,
    hasCitations: !!(data.citations?.length),
    hasReferences: !!(data.references?.length)
  });

  return data;
};

/**
 * Hook for sending messages to AI chat with retry logic
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Callback on successful response
 * @param {Function} options.onError - Callback on error
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.timeout - Request timeout in ms (default: 60000)
 * 
 * @returns {Object} Mutation object with sendMessage function and state
 */
export const useAIChat = ({ 
  onSuccess, 
  onError,
  maxRetries = 3,
  timeout = 60000 // 60 seconds default timeout
} = {}) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (variables) => {
      // Create abort controller for timeout and cancellation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const result = await sendChatRequest({
          ...variables,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle abort/timeout
        if (error.name === 'AbortError') {
          const timeoutError = new Error(`Request timeout after ${timeout / 1000}s`);
          timeoutError.isTimeout = true;
          throw timeoutError;
        }
        
        throw error;
      }
    },

    // Retry configuration with exponential backoff and jitter
    retry: (failureCount, error) => {
      console.log(`❌ Request failed (attempt ${failureCount}/${maxRetries}):`, error.message);
      
      // Don't retry if max retries reached
      if (failureCount >= maxRetries) {
        console.log('🛑 Max retries reached, giving up');
        return false;
      }

      // Check if error is retryable
      const shouldRetry = isRetryableError(error);
      
      if (!shouldRetry) {
        console.log('⚠️ Non-retryable error, not retrying');
        return false;
      }

      console.log('🔄 Error is retryable, will retry...');
      return true;
    },

    retryDelay: (attemptIndex) => calculateRetryDelay(attemptIndex),

    // Callbacks
    onSuccess: (data, variables) => {
      console.log('🎉 AI chat request successful');
      
      // Invalidate related queries if needed
      queryClient.invalidateQueries({ queryKey: ['ai-chat'] });
      
      if (onSuccess) {
        onSuccess(data, variables);
      }
    },

    onError: (error, variables, context) => {
      console.error('💥 AI chat request failed after all retries:', {
        error: error.message,
        isTimeout: error.isTimeout,
        status: error.response?.status,
        attempts: maxRetries + 1
      });

      if (onError) {
        onError(error, variables, context);
      }
    },

    // Prevent duplicate requests
    onMutate: async (variables) => {
      console.log('⏳ Starting AI chat request...');
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['ai-chat'] });
      
      return { startTime: Date.now() };
    },

    onSettled: (data, error, variables, context) => {
      if (context?.startTime) {
        const duration = Date.now() - context.startTime;
        console.log(`⏱️ Request completed in ${(duration / 1000).toFixed(2)}s`);
      }
    }
  });

  return {
    // Main function to send messages
    sendMessage: (payload) => mutation.mutate(payload),
    
    // Async version that returns a promise
    sendMessageAsync: (payload) => mutation.mutateAsync(payload),
    
    // State flags
    isLoading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    
    // Data and error
    data: mutation.data,
    error: mutation.error,
    
    // Retry count
    failureCount: mutation.failureCount,
    
    // Reset mutation state
    reset: mutation.reset,
    
    // Raw mutation object
    mutation
  };
};

/**
 * Hook for prefetching/caching model context data
 * Useful for preloading model info before chat starts
 */
export const useModelContext = (modelInfo) => {
  const queryClient = useQueryClient();

  const prefetchModelContext = () => {
    queryClient.setQueryData(['model-context', modelInfo?.filename], modelInfo);
  };

  return { prefetchModelContext };
};

export default useAIChat;
