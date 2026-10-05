import { NextRequest, NextResponse } from 'next/server';
import { DatasetProfile, ConversationContext } from '@/types/dataset';
import { runAnalyticsAgent } from '@/lib/agent-new';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, profile, dataset, context, customApiKey } = body as {
      question: string;
      profile: DatasetProfile;
      dataset?: Record<string, any>[];
      context?: ConversationContext;
      customApiKey?: string;
    };

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    if (!profile || !profile.columns) {
      return NextResponse.json({ error: 'Dataset profile is required.' }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI analysis is temporarily unavailable. Please check the AI configuration. OPENROUTER_API_KEY is missing.' },
        { status: 500 }
      );
    }

    // Always run the new agent
    const analysis = await runAnalyticsAgent(question, profile, dataset || [], context, apiKey);
    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
