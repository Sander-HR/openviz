import { useCallback, useRef, useState } from 'react';

export type PhoneUploadStatus = 'pending' | 'uploading' | 'completed' | 'expired';

export interface PhoneUploadState {
    id: string | null;
    status: PhoneUploadStatus | null;
    error: string | null;
}

interface CompletedPayload {
    s3Key: string;
    fileName: string;
    mimeType: string;
    downloadUrl: string;
}

export function usePhoneUpload() {
    const [state, setState] = useState<PhoneUploadState>({ id: null, status: null, error: null });
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startSession = useCallback(async () => {
        setState({ id: null, status: null, error: null });
        try {
            const res = await fetch('/api/phone-upload/session', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to create session');
            const data = await res.json();
            setState({ id: data.id, status: 'pending', error: null });
            return data.id as string;
        } catch (err) {
            setState({ id: null, status: null, error: err instanceof Error ? err.message : 'Unknown error' });
            return null;
        }
    }, []);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const poll = useCallback((sessionId: string, onComplete: (info: CompletedPayload) => void) => {
        stopPolling();
        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/phone-upload/session?id=${encodeURIComponent(sessionId)}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        stopPolling();
                        setState(prev => ({ ...prev, status: 'expired', error: 'Session not found' }));
                    }
                    return;
                }
                const data = await res.json();
                setState(prev => ({ ...prev, status: data.status, error: null }));

                if (data.status === 'completed') {
                    stopPolling();
                    onComplete({
                        s3Key: data.s3Key,
                        fileName: data.fileName,
                        mimeType: data.mimeType,
                        downloadUrl: data.downloadUrl,
                    });
                } else if (data.status === 'expired') {
                    stopPolling();
                }
            } catch {
                // ignore polling errors
            }
        }, 2000);
    }, [stopPolling]);

    return { state, startSession, poll, stopPolling };
}
