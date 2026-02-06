import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

// ============================================
// TYPES
// ============================================

export interface FileAttachment {
  file: File;
  preview?: string; // data URL for image previews
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: AIAction[];
  data?: Record<string, any>;
  suggestions?: string[];
  attachments?: { fileName: string; mimeType: string }[];
}

export interface AIAction {
  type: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIAgentState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  currentConversation: AIConversation | null;
  conversations: AIConversation[];
  error: string | null;
}

export interface AIAgentContextType extends AIAgentState {
  // UI Controls
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  minimizeAssistant: () => void;
  maximizeAssistant: () => void;

  // Chat Operations
  sendMessage: (message: string, attachments?: FileAttachment[]) => Promise<void>;
  clearConversation: () => void;
  startNewConversation: () => void;

  // Quick Actions
  analyzeData: (dataType: string) => Promise<void>;
  askQuestion: (question: string) => Promise<void>;

  // Utility
  clearError: () => void;
}

// ============================================
// CONTEXT
// ============================================

const AIAgentContext = createContext<AIAgentContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

interface AIAgentProviderProps {
  children: ReactNode;
}

export function AIAgentProvider({ children }: AIAgentProviderProps) {
  const [state, setState] = useState<AIAgentState>({
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    currentConversation: null,
    conversations: [],
    error: null,
  });

  // tRPC mutation for agent chat
  const agentChatMutation = trpc.ai.agentChat.useMutation();

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create new conversation
  const createNewConversation = useCallback((): AIConversation => {
    const now = new Date();
    return {
      id: generateId(),
      title: 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  // UI Controls
  const openAssistant = useCallback(() => {
    setState(prev => {
      // Create a new conversation if none exists
      const currentConversation = prev.currentConversation || createNewConversation();
      return {
        ...prev,
        isOpen: true,
        isMinimized: false,
        currentConversation,
      };
    });
  }, [createNewConversation]);

  const closeAssistant = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const toggleAssistant = useCallback(() => {
    setState(prev => {
      if (prev.isOpen) {
        return { ...prev, isOpen: false };
      }
      const currentConversation = prev.currentConversation || createNewConversation();
      return {
        ...prev,
        isOpen: true,
        isMinimized: false,
        currentConversation,
      };
    });
  }, [createNewConversation]);

  const minimizeAssistant = useCallback(() => {
    setState(prev => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeAssistant = useCallback(() => {
    setState(prev => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  // Helper to convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Send message to AI agent
  const sendMessage = useCallback(async (message: string, attachments?: FileAttachment[]) => {
    if (!message.trim() && (!attachments || attachments.length === 0)) return;

    const attachmentMeta = attachments?.map(a => ({
      fileName: a.file.name,
      mimeType: a.file.type,
    }));

    setState(prev => {
      const currentConversation = prev.currentConversation || createNewConversation();

      // Add user message
      const userMessage: AIMessage = {
        id: generateId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        attachments: attachmentMeta,
      };

      const updatedConversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage],
        updatedAt: new Date(),
        // Update title based on first message
        title: currentConversation.messages.length === 0
          ? message.slice(0, 50) + (message.length > 50 ? '...' : '')
          : currentConversation.title,
      };

      return {
        ...prev,
        isLoading: true,
        error: null,
        currentConversation: updatedConversation,
      };
    });

    try {
      // Build conversation history for context
      const conversationHistory = state.currentConversation?.messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })) || [];

      // Convert file attachments to base64 for upload
      let encodedAttachments: { fileData: string; fileName: string; mimeType: string }[] | undefined;
      if (attachments && attachments.length > 0) {
        encodedAttachments = await Promise.all(
          attachments.map(async (a) => ({
            fileData: await fileToBase64(a.file),
            fileName: a.file.name,
            mimeType: a.file.type || 'application/octet-stream',
          }))
        );
      }

      // Call the AI agent
      const response = await agentChatMutation.mutateAsync({
        message: message || 'Please analyze the attached file(s).',
        conversationHistory,
        attachments: encodedAttachments,
      });

      // Add assistant response
      setState(prev => {
        if (!prev.currentConversation) return prev;

        const assistantMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          actions: response.actions,
          data: response.data,
          suggestions: response.suggestions,
        };

        const updatedConversation = {
          ...prev.currentConversation,
          messages: [...prev.currentConversation.messages, assistantMessage],
          updatedAt: new Date(),
        };

        return {
          ...prev,
          isLoading: false,
          currentConversation: updatedConversation,
        };
      });
    } catch (error: any) {
      // Handle error
      setState(prev => {
        if (!prev.currentConversation) return prev;

        const errorMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        };

        const updatedConversation = {
          ...prev.currentConversation,
          messages: [...prev.currentConversation.messages, errorMessage],
          updatedAt: new Date(),
        };

        return {
          ...prev,
          isLoading: false,
          error: error.message || 'An error occurred',
          currentConversation: updatedConversation,
        };
      });
    }
  }, [state.currentConversation, agentChatMutation, createNewConversation]);

  // Clear current conversation
  const clearConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentConversation: createNewConversation(),
    }));
  }, [createNewConversation]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setState(prev => {
      // Save current conversation to list if it has messages
      const conversations = prev.currentConversation && prev.currentConversation.messages.length > 0
        ? [prev.currentConversation, ...prev.conversations]
        : prev.conversations;

      return {
        ...prev,
        currentConversation: createNewConversation(),
        conversations,
      };
    });
  }, [createNewConversation]);

  // Quick Actions
  const analyzeData = useCallback(async (dataType: string) => {
    const message = `Analyze ${dataType} data and provide insights`;
    await sendMessage(message);
  }, [sendMessage]);

  const askQuestion = useCallback(async (question: string) => {
    await sendMessage(question);
  }, [sendMessage]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Keyboard shortcut to toggle assistant (Cmd/Ctrl + J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Cmd/Ctrl + J to toggle AI Assistant
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        toggleAssistant();
      }

      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        closeAssistant();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleAssistant, closeAssistant, state.isOpen]);

  const contextValue: AIAgentContextType = {
    ...state,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    minimizeAssistant,
    maximizeAssistant,
    sendMessage,
    clearConversation,
    startNewConversation,
    analyzeData,
    askQuestion,
    clearError,
  };

  return (
    <AIAgentContext.Provider value={contextValue}>
      {children}
    </AIAgentContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useAIAgent(): AIAgentContextType {
  const context = useContext(AIAgentContext);
  if (context === undefined) {
    throw new Error('useAIAgent must be used within an AIAgentProvider');
  }
  return context;
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook for quick AI analysis from any component
 */
export function useQuickAnalysis() {
  const { analyzeData, openAssistant, isOpen } = useAIAgent();

  return useCallback(async (dataType: string) => {
    if (!isOpen) {
      openAssistant();
    }
    // Small delay to ensure assistant is open
    setTimeout(() => {
      analyzeData(dataType);
    }, 100);
  }, [analyzeData, openAssistant, isOpen]);
}

/**
 * Hook for sending quick questions to AI
 */
export function useQuickQuestion() {
  const { askQuestion, openAssistant, isOpen } = useAIAgent();

  return useCallback(async (question: string) => {
    if (!isOpen) {
      openAssistant();
    }
    // Small delay to ensure assistant is open
    setTimeout(() => {
      askQuestion(question);
    }, 100);
  }, [askQuestion, openAssistant, isOpen]);
}
