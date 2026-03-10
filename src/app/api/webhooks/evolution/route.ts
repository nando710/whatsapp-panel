import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// Secret key for basic webhook security
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

export async function POST(req: Request) {
    try {
        // Basic Authentication check (optional but recommended)
        // You can configure your Evolution API to send an apikey header
        if (EVOLUTION_API_KEY) {
            const authHeader = req.headers.get('apikey');
            if (authHeader !== EVOLUTION_API_KEY) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const payload = await req.json();
        const event = payload.event;
        const instanceId = payload.instance || 'default';

        // Handle connection updates
        if (event === 'connection.update' && payload.data) {
            const state = payload.data.state || payload.data.status;
            if (state) {
                const adminClient = getSupabaseAdminClient();
                await adminClient
                    .from('instances')
                    .update({ status: state.toLowerCase(), updated_at: new Date().toISOString() })
                    .eq('instance_name', instanceId);
            }
            return NextResponse.json({ success: true }, { status: 200 });
        }

        // Evolution API typically sends webhooks for 'messages.upsert'
        if (event === 'messages.upsert') {
            const messageData = payload.data;

            if (!messageData) {
                return NextResponse.json({ error: 'No data field found' }, { status: 400 });
            }

            const key = messageData.key || {};
            const fromMe = key.fromMe || false;
            const senderNumber = key.remoteJid?.split('@')[0] || 'Unknown';
            const senderName = messageData.pushName || senderNumber;

            const messageContent = messageData.message || {};
            const messageType = messageData.messageType || Object.keys(messageContent)[0] || 'unknown';

            // Extract the text content based on the message type
            let messageText = '';
            if (messageType === 'conversation') {
                messageText = messageContent.conversation || '';
            } else if (messageType === 'extendedTextMessage') {
                messageText = messageContent.extendedTextMessage?.text || '';
            } else if (messageType === 'imageMessage') {
                messageText = messageContent.imageMessage?.caption || '[Image]';
            } else if (messageType === 'videoMessage') {
                messageText = messageContent.videoMessage?.caption || '[Video]';
            } else if (messageType === 'audioMessage') {
                messageText = '[Audio]';
            } else if (messageType === 'documentMessage') {
                messageText = `[Document: ${messageContent.documentMessage?.fileName || 'file'}]`;
            } else {
                messageText = `[${messageType}]`;
            }

            // Extract timestamp (convert from UNIX timestamp if needed)
            let timestamp = new Date().toISOString();
            if (messageData.messageTimestamp) {
                // Evolution API usually sends timestamp in seconds
                timestamp = new Date(messageData.messageTimestamp * 1000).toISOString();
            }

            // Insert the message into Supabase
            const adminClient = getSupabaseAdminClient();
            const { error } = await adminClient
                .from('messages')
                .insert([
                    {
                        instance_id: instanceId,
                        sender_name: senderName,
                        sender_number: senderNumber,
                        message_text: messageText,
                        message_type: messageType,
                        from_me: fromMe,
                        timestamp: timestamp,
                    }
                ]);

            if (error) {
                console.error('Error inserting message into Supabase:', error);
                return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
            }

            return NextResponse.json({ success: true }, { status: 200 });
        }

        // Default response for other events
        return NextResponse.json({ success: true, message: 'Event ignored' }, { status: 200 });

    } catch (err: any) {
        console.error('Webhook processing error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
