import { NextResponse } from 'next/server';
import { fetchBridgeStats } from '@/lib/api';

export async function GET() {
  try {
    const stats = await fetchBridgeStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bridge stats' },
      { status: 500 }
    );
  }
}
