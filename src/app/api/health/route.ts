import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Проверяем соединение с базой данных
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'CONNECTED'
    }, { status: 200 });
  } catch (error: any) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: 'DISCONNECTED',
      error: error.message
    }, { status: 503 });
  }
}
