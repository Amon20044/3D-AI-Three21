'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Language configuration
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
];

// Language names for chat prompt (what AI should respond in)
export const LANGUAGE_NAMES = {
    en: 'English',
    hi: 'Hindi (हिंदी)',
};

const LanguageContext = createContext(undefined);

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState('en');
    const [isHydrated, setIsHydrated] = useState(false);

    // Load language from localStorage on mount
    useEffect(() => {
        const savedLang = localStorage.getItem('three21-language');
        if (savedLang && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLang)) {
            setLanguageState(savedLang);
        }
        setIsHydrated(true);
    }, []);

    // Set language - updates state and localStorage
    const setLanguage = useCallback((newLang) => {
        if (SUPPORTED_LANGUAGES.some(lang => lang.code === newLang)) {
            setLanguageState(newLang);
            localStorage.setItem('three21-language', newLang);
            console.log('🌐 Language changed to:', newLang);
        }
    }, []);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, isHydrated }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

export default LanguageContext;
