import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Stacks Bridge Monitor | sBTC & Cross-Chain Analytics',
  description: 'Real-time monitoring for cross-chain bridges on Stacks blockchain. Track sBTC peg-ins, peg-outs, and bridge volumes.',
  keywords: ['Stacks', 'sBTC', 'Bitcoin', 'Bridge', 'Cross-chain', 'DeFi', 'Analytics'],
  authors: [{ name: 'serayd61' }],
  openGraph: {
    title: 'Stacks Bridge Monitor',
    description: 'Real-time sBTC and cross-chain bridge analytics',
    type: 'website',
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
