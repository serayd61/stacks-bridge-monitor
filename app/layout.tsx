import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Stacks Dashboard | Ecosystem Analytics, sBTC & DeFi',
  description: 'The complete Stacks ecosystem dashboard. Real-time analytics for sBTC, DeFi protocols, NFTs, tokens, and network health. Track everything on Stacks in one place.',
  keywords: ['Stacks', 'STX', 'sBTC', 'Bitcoin', 'DeFi', 'NFT', 'Analytics', 'Dashboard', 'Crypto', 'Web3'],
  authors: [{ name: 'serayd61' }],
  openGraph: {
    title: 'Stacks Dashboard - Complete Ecosystem Analytics',
    description: 'Real-time analytics for the Stacks ecosystem. Track sBTC, DeFi, NFTs, and more.',
    type: 'website',
    siteName: 'Stacks Dashboard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stacks Dashboard',
    description: 'The complete Stacks ecosystem dashboard',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
