import { useEffect, useState } from 'react';

/**
 * One-way visibility latch for dual-mounted views (Sprint 3): false until
 * `active` is true at least once, then stays true for the component's
 * lifetime. Studio layer images arm on first visibility and are never
 * unloaded again — back-and-forth view switches cause no re-fetch flicker.
 */
export function useVisibilityLatch(active: boolean): boolean {
    const [armed, setArmed] = useState(active);

    useEffect(() => {
        if (active && !armed) setArmed(true);
    }, [active, armed]);

    return armed;
}
