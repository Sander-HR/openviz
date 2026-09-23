import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { CollabPresencePeer } from '@/types/collab.types';
import { PresenceIndicator } from './PresenceIndicator';

describe('PresenceIndicator', () => {
    it('renders a chip for each active peer', () => {
        const presence: Record<string, CollabPresencePeer> = {
            'u-2': { userId: 'u-2', userName: 'Grace', color: '#f97316' },
            'u-3': { userId: 'u-3', userName: 'Hugo', color: '#0ea5e9' },
        };

        render(<PresenceIndicator presence={presence} />);

        expect(screen.getByText('Grace')).toBeInTheDocument();
        expect(screen.getByText('Hugo')).toBeInTheDocument();
    });

    it('falls back to a generic label when the peer has no name', () => {
        const presence: Record<string, CollabPresencePeer> = {
            'u-2': { userId: 'u-2' },
        };

        render(<PresenceIndicator presence={presence} />);

        expect(screen.getByText(/u-2/)).toBeInTheDocument();
    });

    it('renders nothing when no peers are present', () => {
        const { container } = render(<PresenceIndicator presence={{}} />);
        expect(container).toBeEmptyDOMElement();
    });
});
