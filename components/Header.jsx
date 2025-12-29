'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLingoLocale, setLingoLocale } from "lingo.dev/react/client";
import BrandIcon from "./icons/BrandIcon";
import { useLanguage, SUPPORTED_LANGUAGES } from "./LanguageContext";
import "./header.css";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Lingo.dev for UI translations
  const lingoLocale = useLingoLocale();
  
  // LanguageContext for chat API
  const { language, setLanguage, isHydrated } = useLanguage();

  // Sync LanguageContext when lingo locale changes
  useEffect(() => {
    if (lingoLocale && lingoLocale !== language) {
      setLanguage(lingoLocale);
    }
  }, [lingoLocale]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Update BOTH lingo.dev (UI) AND LanguageContext (chat API)
  const handleLocaleChange = (e) => {
    const newLocale = e.target.value;
    setLingoLocale(newLocale);      // Update lingo.dev for UI
    setLanguage(newLocale);    // Update context for chat API
  };

  return (
    <header className="site-header">
      <div className="header-content">
        <Link href="/" className="logo">
          <div className="logo-icon">
            <BrandIcon />
          </div>
          <span className="logo-text">Three21</span>
        </Link>

        <nav className="header-nav">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/find-models" className="nav-link">Find Models</Link>
        </nav>

        <div className="header-right">
          {isHydrated && (
            <select
              className="locale-switcher"
              value={lingoLocale || language}
              onChange={handleLocaleChange}
              aria-label="Select language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.nativeName}
                </option>
              ))}
            </select>
          )}

          <button
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? "open" : ""}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
        <nav className="mobile-nav">
          <Link href="/" className="mobile-nav-link" onClick={closeMobileMenu}>
            Home
          </Link>
          <Link href="/find-models" className="mobile-nav-link" onClick={closeMobileMenu}>
            Find Models
          </Link>
          
          {/* Mobile Language Selector */}
          {isHydrated && (
            <div className="mobile-language-section">
              <span className="mobile-language-label">Language</span>
              <select
                className="locale-switcher mobile-locale-switcher"
                value={lingoLocale || language}
                onChange={handleLocaleChange}
                aria-label="Select language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>
      </div>

      {/* Backdrop */}
      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={closeMobileMenu}></div>
      )}
    </header>
  );
}
