export interface RoomCapacity {
    reserve(documentName: string, socketId: string): boolean;
    release(documentName: string, socketId: string): void;
    count(documentName: string): number;
}

export function createRoomCapacity(maxConnectionsPerDocument = 50): RoomCapacity {
    if (!Number.isInteger(maxConnectionsPerDocument) || maxConnectionsPerDocument < 1) {
        throw new RangeError('maxConnectionsPerDocument must be a positive integer');
    }

    const reservations = new Map<string, Set<string>>();

    return {
        reserve(documentName, socketId) {
            const room = reservations.get(documentName) ?? new Set<string>();
            if (room.has(socketId)) return true;
            if (room.size >= maxConnectionsPerDocument) return false;

            room.add(socketId);
            reservations.set(documentName, room);
            return true;
        },
        release(documentName, socketId) {
            const room = reservations.get(documentName);
            if (!room) return;
            room.delete(socketId);
            if (room.size === 0) reservations.delete(documentName);
        },
        count(documentName) {
            return reservations.get(documentName)?.size ?? 0;
        },
    };
}
