'use client';

import { useState } from "react";
import Link from "next/link";
import BrandIcon from "./icons/BrandIcon";
import "./header.css";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
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
        </nav>
      </div>

      {/* Backdrop */}
      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={closeMobileMenu}></div>
      )}
    </header>
  );
}
