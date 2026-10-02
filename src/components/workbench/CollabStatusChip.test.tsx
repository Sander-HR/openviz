import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CollabStatusChip } from './CollabStatusChip';

describe('CollabStatusChip (US3 / SC-004)', () => {
    it('shows a live indicator when connected', () => {
        render(<CollabStatusChip status="connected" />);
        expect(screen.getByRole('status')).toHaveTextContent(/live/i);
    });

    it('shows the queued state while offline and never claims a durable save', () => {
        render(<CollabStatusChip status="offline-queued" />);

        const chip = screen.getByRole('status');
        expect(chip).toHaveTextContent(/offline/i);
        // Edits are only safe in the local queue + IndexedDB — no "saved"/"synced" claim.
        expect(chip.textContent).not.toMatch(/saved|synced/i);
    });

    it('shows a connecting state before the first sync', () => {
        render(<CollabStatusChip status="connecting" />);
        expect(screen.getByRole('status')).toHaveTextContent(/connecting/i);
    });

    it('warns when live collaboration has no offline backup', () => {
        render(<CollabStatusChip status="connected" localPersistenceAvailable={false} />);
        expect(screen.getByText(/offline backup unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/changes may be lost if this tab closes/i)).toBeInTheDocument();
    });

    it('shows the reconnecting state after a previously connected session drops', () => {
        render(<CollabStatusChip status="reconnecting" />);
        expect(screen.getByRole('status')).toHaveTextContent(/reconnecting/i);
    });

    it('uses a generic access-unavailable message and safe retry action when denied', () => {
        const onRetry = vi.fn();
        render(<CollabStatusChip status="denied" onRetry={onRetry} />);

        expect(screen.getByText(/check that you.re signed in or request access/i)).toBeInTheDocument();
        expect(screen.queryByText(/permission|scene|project/i)).not.toBeInTheDocument();
        screen.getByRole('button', { name: /retry/i }).click();
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders nothing when there is no session (idle)', () => {
        const { container } = render(<CollabStatusChip status="idle" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('lists live collaborators on hover, counting the local user', () => {
        render(
            <CollabStatusChip
                status="connected"
                peers={{
                    'u-bob': { userId: 'u-bob', userName: 'Bob', color: '#ef4444' },
                    'u-carol': { userId: 'u-carol', userName: 'Carol', color: '#3b82f6' },
                }}
            />,
        );

        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveTextContent(/3 live/);
        expect(tooltip).toHaveTextContent('Bob');
        expect(tooltip).toHaveTextContent('Carol');
        expect(tooltip).toHaveTextContent(/you/i);
    });

    it('shows just the local user when no peers are present', () => {
        render(<CollabStatusChip status="connected" />);
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveTextContent(/1 live/);
        expect(tooltip).toHaveTextContent(/you/i);
    });

    it('does not list peers while offline (stale awareness must not be presented as live)', () => {
        render(
            <CollabStatusChip
                status="offline-queued"
                peers={{ 'u-bob': { userId: 'u-bob', userName: 'Bob' } }}
            />,
        );
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});
