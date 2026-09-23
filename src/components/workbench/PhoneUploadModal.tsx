'use client';

import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePhoneUpload } from '@/hooks/usePhoneUpload';

interface PhoneUploadModalProps {
    open: boolean;
    onClose: () => void;
    onUploadComplete: (info: { url: string; fileName: string; mimeType: string }) => void;
}

export function PhoneUploadModal({ open, onClose, onUploadComplete }: PhoneUploadModalProps) {
    const { state, startSession, poll, stopPolling } = usePhoneUpload();
    const [url, setUrl] = useState<string | null>(null);

    const handleComplete = useCallback((info: { downloadUrl: string; fileName: string; mimeType: string }) => {
        onUploadComplete({ url: info.downloadUrl, fileName: info.fileName, mimeType: info.mimeType });
    }, [onUploadComplete]);

    useEffect(() => {
        if (open && !state.id) {
            startSession().then((id) => {
                if (id) {
                    const u = `${window.location.origin}/phone-upload?id=${encodeURIComponent(id)}`;
                    setUrl(u);
                    poll(id, handleComplete);
                }
            });
        }
        if (!open) {
            stopPolling();
            setUrl(null);
        }
    }, [open, state.id, startSession, poll, stopPolling, handleComplete]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload from Phone</h2>
                <p className="text-sm text-gray-600 mb-4">Scan this QR code with your phone to upload a photo.</p>

                <div className="flex justify-center mb-4">
                    {url ? (
                        <QRCodeSVG value={url} size={200} />
                    ) : (
                        <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded-lg" />
                    )}
                </div>

                {state.status === 'completed' && (
                    <p className="text-center text-sm text-green-600 font-medium">Upload complete!</p>
                )}
                {state.status === 'uploading' && (
                    <p className="text-center text-sm text-blue-600 font-medium">Phone is uploading...</p>
                )}
                {state.error && (
                    <p className="text-center text-sm text-red-600 font-medium">{state.error}</p>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
