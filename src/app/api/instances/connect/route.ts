import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore self-signed certificate errors

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const instanceName = searchParams.get('instanceName');

        if (!instanceName) {
            return NextResponse.json({ error: 'instanceName query parameter is required' }, { status: 400 });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return NextResponse.json({ error: 'Evolution API credentials not configured' }, { status: 500 });
        }

        // Call Evolution API to connect/get the QR code
        const evolutionRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY,
            },
        });

        const data = await evolutionRes.json();

        if (!evolutionRes.ok) {
            return NextResponse.json({ error: data.message || 'Failed to fetch QR code from Evolution API' }, { status: evolutionRes.status });
        }

        // Usually connection already established, or qr is returned
        const qrcodeBase64 = data.base64 || null;
        let status = 'connecting';

        // if evolution responds with an instance already active:
        if (data.instance?.state === 'open') {
            status = 'open';
        }

        // Update in Supabase
        const adminClient = getSupabaseAdminClient();
        await adminClient
            .from('instances')
            .update({
                status: status,
                qrcode: qrcodeBase64,
                updated_at: new Date().toISOString()
            })
            .eq('instance_name', instanceName);

        return NextResponse.json({ success: true, qrcode: qrcodeBase64, status: status }, { status: 200 });

    } catch (err: any) {
        console.error('Connect instance error:', err);
        return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
    }
}
