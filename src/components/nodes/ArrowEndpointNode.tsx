import React from 'react';

/** Invisible ghost node used as a freely draggable endpoint for a temporary arrow. */
export const ArrowEndpointNode: React.FC = () => <div className="h-2 w-2 opacity-0" aria-hidden="true" />;