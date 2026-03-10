import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore self-signed certificate errors

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

export async function POST(req: Request) {
    try {
        const { instanceName, instanceApiKey } = await req.json();

        if (!instanceName) {
            return NextResponse.json({ error: 'instanceName is required' }, { status: 400 });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return NextResponse.json({ error: 'Evolution API credentials not configured' }, { status: 500 });
        }

        const apiKeyToUse = instanceApiKey || EVOLUTION_API_KEY;

        // 1. Call Evolution API to create the instance
        const evolutionRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKeyToUse,
            },
            body: JSON.stringify({
                instanceName: instanceName,
                token: instanceApiKey || undefined, // Sometimes helpful depending on Api Version
                qrcode: true, // Auto-generate QR on creation
                integration: 'WHATSAPP-BAILEYS',
                webhook_wa_business: false, // Make sure it's regular WA if needed
                webhook: process.env.NEXT_PUBLIC_APP_URL ? {
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`,
                    byEvents: false,
                    base64: false,
                    events: [
                        "MESSAGES_UPSERT",
                        "CONNECTION_UPDATE"
                    ]
                } : undefined,
            }),
        });

        const data = await evolutionRes.json();

        if (!evolutionRes.ok) {
            return NextResponse.json({ error: data.message || 'Failed to create instance on Evolution API' }, { status: evolutionRes.status });
        }

        const { qrcode } = data.qrcode || {};

        // 2. Save the instance in Supabase
        const adminClient = getSupabaseAdminClient();
        const { error: dbError } = await adminClient
            .from('instances')
            .insert([{
                instance_name: instanceName,
                status: 'connecting',
                qrcode: qrcode?.base64 || null,
                instance_api_key: instanceApiKey || null
            }]);

        if (dbError) {
            // Handle constraint violation gracefully if it already exists in DB
            if (dbError.code === '23505') {
                await adminClient
                    .from('instances')
                    .update({ status: 'connecting', qrcode: qrcode?.base64 || null, instance_api_key: instanceApiKey || null, updated_at: new Date().toISOString() })
                    .eq('instance_name', instanceName);
            } else {
                console.error('Supabase error inserting instance:', dbError);
                return NextResponse.json({ error: 'Saved on Evolution, but failed to save in Database' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, instance: data.instance, qrcode: qrcode?.base64 || null }, { status: 201 });

    } catch (err: any) {
        console.error('Create instance error:', err);
        return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
    }
}
