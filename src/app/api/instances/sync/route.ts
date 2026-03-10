import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_GLOBAL_KEY = process.env.EVOLUTION_API_KEY || '';

export async function POST(req: Request) {
    try {
        const { instanceName, instanceApiKey } = await req.json();

        if (!instanceName) {
            return NextResponse.json({ error: 'instanceName is required' }, { status: 400 });
        }

        const apikeyToUse = instanceApiKey || EVOLUTION_GLOBAL_KEY;

        if (!EVOLUTION_API_URL || !apikeyToUse) {
            return NextResponse.json({ error: 'API Key not provided' }, { status: 500 });
        }

        // POST /chat/findMessages behaves differently on some Evolution vers, typically fetching many
        const res = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apikeyToUse,
            },
            body: JSON.stringify({
                where: {} // Tries to fetch all messages, depending on Evolution version
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return NextResponse.json({ error: errData.message || 'Failed to fetch historical messages' }, { status: res.status });
        }

        const data = await res.json();
        const records = data.records || data.messages || data; // Evolution API payload structure varies

        if (!Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'No historical messages found' }, { status: 200 });
        }

        // Prepare for Supabase
        const adminClient = getSupabaseAdminClient();
        let inserted = 0;

        for (const msg of records) {
            // Adapt to Evolution API returned properties structure for /findMessages
            const key = msg.key || {};
            const fromMe = key.fromMe || false;
            const senderNumber = key.remoteJid?.split('@')[0] || 'Unknown';
            const senderName = msg.pushName || senderNumber;

            const messageContent = msg.message || {};
            const messageType = msg.messageType || Object.keys(messageContent)[0] || 'conversation';

            let messageText = '';
            if (messageType === 'conversation') {
                messageText = messageContent.conversation || '';
            } else if (messageType === 'extendedTextMessage') {
                messageText = messageContent.extendedTextMessage?.text || '';
            } else {
                messageText = `[${messageType}]`;
            }

            let timestamp = new Date().toISOString();
            if (msg.messageTimestamp) {
                timestamp = new Date(msg.messageTimestamp * 1000).toISOString();
            }

            // Insert
            const { error } = await adminClient
                .from('messages')
                .insert([{
                    instance_id: instanceName,
                    sender_name: senderName,
                    sender_number: senderNumber,
                    message_text: messageText,
                    message_type: messageType,
                    from_me: fromMe,
                    timestamp: timestamp,
                }]);

            if (!error) inserted++;
        }

        return NextResponse.json({ success: true, count: inserted }, { status: 200 });

    } catch (err: any) {
        console.error('Sync messages error:', err);
        return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
    }
}
