'use client';

import React, { useCallback, useRef, useState, Suspense } from 'react';

function PhoneUploadInner() {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [message, setMessage] = useState('Tap below to choose a photo');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('id');
        if (!sessionId) {
            setStatus('error');
            setMessage('Invalid link - missing session ID.');
            return;
        }

        setStatus('uploading');
        setMessage('Requesting upload URL...');

        try {
            const metaRes = await fetch('/api/phone-upload/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, fileName: file.name, mimeType: file.type }),
            });
            if (!metaRes.ok) throw new Error('Failed to get upload URL');
            const { uploadUrl, key } = await metaRes.json();

            setMessage('Uploading to cloud...');
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });
            if (!uploadRes.ok) throw new Error('Upload failed');

            setMessage('Finishing up...');
            const completeRes = await fetch('/api/phone-upload/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, s3Key: key, fileName: file.name, mimeType: file.type }),
            });
            if (!completeRes.ok) throw new Error('Failed to finalize');

            setStatus('done');
            setMessage('Uploaded successfully! You can close this page.');
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Something went wrong.');
        }
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">OpenViz Upload</h1>
            <p className="text-gray-600 mb-8 text-center">{message}</p>

            {status !== 'done' && status !== 'error' && (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={status === 'uploading'}
                    className="w-full max-w-xs py-3 px-4 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 active:bg-blue-700"
                >
                    {status === 'uploading' ? 'Uploading...' : 'Choose Photo'}
                </button>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
}

export default function PhoneUploadPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-600">Loading...</div>}>
            <PhoneUploadInner />
        </Suspense>
    );
}
