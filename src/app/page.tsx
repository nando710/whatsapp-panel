'use client';

import { useEffect, useState, useRef } from 'react';
import { supabaseBrowserClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MessageCircle, Bot, Zap, CheckCircle2 } from 'lucide-react';
import { InstanceManager } from '@/components/InstanceManager';

interface Message {
  id: string;
  instance_id: string;
  sender_name: string;
  sender_number: string;
  message_text: string;
  message_type: string;
  from_me: boolean;
  timestamp: string;
}

export default function WhatsAppDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabaseBrowserClient
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: true }) // we want oldest first so new messages appear at the bottom
        .limit(100);

      if (!error && data) {
        setMessages(data as Message[]);
      }
      setLoading(false);
    };

    fetchMessages();

    // 2. Subscribe to new messages
    const channel = supabaseBrowserClient
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabaseBrowserClient.removeChannel(channel);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-green-500" />
              WhatsApp Panel
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Monitor incoming messages in real-time via Evolution API
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InstanceManager />
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 flex gap-1.5 items-center py-1.5 px-3">
              <CheckCircle2 className="w-4 h-4" />
              Realtime Active
            </Badge>
            <Badge variant="outline" className="flex gap-1.5 items-center py-1.5 px-3">
              <Zap className="w-4 h-4 text-amber-500" />
              {messages.length} Messages
            </Badge>
          </div>
        </div>

        {/* Dashboard Content */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 pb-4">
            <CardTitle className="text-lg">Live Feed</CardTitle>
            <CardDescription>
              Messages sent to your connected Evolution API instances will appear here instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center h-[600px] text-slate-400">
                <div className="animate-pulse flex flex-col items-center gap-2">
                  <Bot className="w-8 h-8 opacity-50" />
                  <p>Loading messages...</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[600px] p-4 md:p-6 bg-slate-50/50 dark:bg-slate-950/50">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                    <MessageCircle className="w-12 h-12 opacity-20" />
                    <p>No messages yet. Waiting for incoming webhooks...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((msg, index) => {
                      const isMe = msg.from_me;
                      const showDateDivider = false; // Logic for date dividers could be added here

                      return (
                        <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>

                          <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                            {/* Avatar */}
                            {!isMe && (
                              <Avatar className="w-8 h-8 border border-slate-200 shadow-sm shrink-0">
                                <AvatarFallback className="bg-white text-xs text-slate-500 font-medium">
                                  {getInitials(msg.sender_name)}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            {/* Message Bubble */}
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                  {isMe ? 'You' : msg.sender_name}
                                </span>
                                {!isMe && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {msg.sender_number}
                                  </span>
                                )}
                              </div>

                              <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm whitespace-pre-wrap break-words
                                ${isMe
                                  ? 'bg-blue-600 text-white rounded-br-sm'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                                }`}>
                                {msg.message_text}
                              </div>

                              <div className="flex items-center gap-2 mt-1 px-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {format(new Date(msg.timestamp), 'h:mm a')}
                                </span>
                                <span className="text-[10px] text-slate-300 dark:text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">
                                  {msg.message_type}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={scrollRef} />
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
