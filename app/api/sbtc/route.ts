import { NextResponse } from 'next/server';
import { fetchSBTCStats } from '@/lib/api';

export async function GET() {
  try {
    const stats = await fetchSBTCStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sBTC stats' },
      { status: 500 }
    );
  }
}
