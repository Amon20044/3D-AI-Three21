import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ModelInfoWrapper from "./components/ModelInfoWrapper";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL('https://three21.vercel.app'), // Replace with your actual domain
  title: {
    default: "Three21 | Advanced 3D Analysis & Reverse Engineering",
    template: "%s | Three21"
  },
  description: "Experience next-generation 3D visualization. Upload, analyze, and reverse engineer GLB, GLTF, and FBX models with AI-powered insights and WebGPU rendering.",
  keywords: ["3D analysis", "reverse engineering", "WebGL", "WebGPU", "Three.js", "AI", "3D visualization", "GLB viewer", "FBX viewer", "engineering", "CAD", "model inspection"],
  authors: [{ name: "Three21 Team" }],
  creator: "Three21",
  publisher: "Three21",
  openGraph: {
    title: "Three21 | Where 3D Meets Intelligence",
    description: "AI-powered 3D model disassembly and reverse engineering platform. Upload and analyze your models instantly.",
    url: 'https://three21.vercel.app',
    siteName: 'Three21',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Three21 | Advanced 3D Analysis",
    description: "AI-powered 3D model disassembly and reverse engineering platform.",
    creator: '@three21',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  themeColor: "#0f0f13",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark-theme`}
      >
        <ModelInfoWrapper>
          {children}
        </ModelInfoWrapper>
        <Analytics />
      </body>
    </html>
  );
}
