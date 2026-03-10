'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowserClient } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, QrCode, RefreshCcw, Smartphone, Trash2, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppInstance {
    id: string;
    instance_name: string;
    status: string;
    qrcode: string | null;
    instance_api_key?: string | null;
    updated_at: string;
}

export function InstanceManager() {
    const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
    const [open, setOpen] = useState(false);
    const [newInstanceName, setNewInstanceName] = useState('');
    const [newInstanceApiKey, setNewInstanceApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeQrCode, setActiveQrCode] = useState<string | null>(null);
    const [activeInstanceName, setActiveInstanceName] = useState<string | null>(null);

    // Fetch instances on load
    const fetchInstances = async () => {
        const { data, error } = await supabaseBrowserClient
            .from('instances')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setInstances(data as WhatsAppInstance[]);
        }
    };

    useEffect(() => {
        if (open) {
            fetchInstances();
        }

        // Subscribe to realtime updates for instances
        const channel = supabaseBrowserClient
            .channel('public:instances')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'instances' },
                () => {
                    fetchInstances();
                }
            )
            .subscribe();

        return () => {
            supabaseBrowserClient.removeChannel(channel);
        };
    }, [open]);

    const handleCreateInstance = async () => {
        if (!newInstanceName.trim()) {
            toast.error('Instance name is required');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/instances/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceName: newInstanceName.replace(/\s+/g, '-'),
                    instanceApiKey: newInstanceApiKey.trim() || undefined
                }), // No spaces allowed usually
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create instance');
            }

            toast.success('Instance created! Generating QR Code...');
            setNewInstanceName('');
            setNewInstanceApiKey('');

            if (data.qrcode) {
                setActiveQrCode(data.qrcode);
                setActiveInstanceName(newInstanceName);
            } else {
                // If creation didn't return QR immediately, try to fetch it
                fetchQrCode(newInstanceName.replace(/\s+/g, '-'));
            }

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchQrCode = async (name: string) => {
        setLoading(true);
        setActiveQrCode(null);
        setActiveInstanceName(name);

        try {
            const response = await fetch(`/api/instances/connect?instanceName=${name}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch QR Code');
            }

            if (data.status === 'open') {
                toast.success('Instance is already connected!');
                setActiveQrCode(null);
                setActiveInstanceName(null);
            } else if (data.qrcode) {
                setActiveQrCode(data.qrcode);
            } else {
                toast.info('Instance is connecting or restarting. Try again in a few seconds.');
            }

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncMessages = async (name: string, apiKey?: string | null) => {
        setLoading(true);
        toast.info(`Syncing historical messages for ${name}...`);
        try {
            const response = await fetch('/api/instances/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceName: name, instanceApiKey: apiKey || undefined }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to sync messages');
            toast.success(`Successfully pulled ${data.count} historical messages!`);
            // Trigger a UI refresh if there is a way or let realtime handle it (Realtime handles insertions so dashboard should update!)
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'open':
                return 'text-green-500 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20';
            case 'connecting':
                return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20';
            case 'close':
            case 'disconnected':
                return 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
            default:
                return 'text-slate-500 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20';
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                <Smartphone className="w-4 h-4" />
                Manage Connections
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>WhatsApp Instances</DialogTitle>
                    <DialogDescription>
                        Connect your phone via QR Code using the Evolution API.
                    </DialogDescription>
                </DialogHeader>

                {activeQrCode ? (
                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        <h3 className="font-medium text-lg">Scan QR Code</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            Open WhatsApp on your phone, go to Linked Devices, and scan this code for instance: <span className="font-bold">{activeInstanceName}</span>
                        </p>
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            <img
                                src={activeQrCode.startsWith('data:') ? activeQrCode : `data:image/png;base64,${activeQrCode}`}
                                alt="WhatsApp QR Code"
                                className="w-64 h-64"
                            />
                        </div>
                        <Button variant="outline" onClick={() => fetchQrCode(activeInstanceName!)} disabled={loading} className="gap-2">
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh QR Code
                        </Button>
                        <Button variant="ghost" onClick={() => setActiveQrCode(null)}>
                            Back to Instances
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Create New Instance */}
                        <div className="flex flex-col gap-4 border p-4 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                            <h4 className="font-medium text-sm">Add New Instance</h4>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Instance Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Support-Team"
                                    value={newInstanceName}
                                    onChange={(e) => setNewInstanceName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="apikey">Instance API Key (optional)</Label>
                                <Input
                                    id="apikey"
                                    type="password"
                                    placeholder="Leave blank to use global API Key"
                                    value={newInstanceApiKey}
                                    onChange={(e) => setNewInstanceApiKey(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateInstance()}
                                    disabled={loading}
                                />
                                <p className="text-[10px] text-muted-foreground">Used for fetching messages or if your Evolution host doesn't use a Global API Key.</p>
                            </div>
                            <Button onClick={handleCreateInstance} disabled={loading || !newInstanceName} className="mt-2 w-full sm:w-auto">
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Create / Connect
                            </Button>
                        </div>

                        {/* List Instances */}
                        <div className="space-y-3">
                            <Label className="text-muted-foreground">Connected Instances</Label>
                            {instances.length === 0 ? (
                                <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
                                    No instances found. Create one above.
                                </div>
                            ) : (
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                    {instances.map((instance) => (
                                        <div key={instance.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{instance.instance_name}</span>
                                                <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full border mt-1 capitalize font-medium ${getStatusColor(instance.status)}`}>
                                                    {instance.status}
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                {instance.status === 'open' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => handleSyncMessages(instance.instance_name, instance.instance_api_key)}
                                                        disabled={loading}
                                                        title="Pull historical messages"
                                                    >
                                                        <DownloadCloud className="w-4 h-4 text-blue-500" />
                                                    </Button>
                                                )}
                                                {instance.status !== 'open' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 group"
                                                        onClick={() => fetchQrCode(instance.instance_name)}
                                                        disabled={loading}
                                                    >
                                                        <QrCode className="w-4 h-4 mr-1 group-hover:text-blue-500" />
                                                        Connect
                                                    </Button>
                                                )}
                                                {/* A real app should also have a safe delete endpoint, for now we just keep the UI simple */}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
