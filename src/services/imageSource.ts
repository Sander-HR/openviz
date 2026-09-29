/** Convert a browser file/blob into a durable data URL for project persistence. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    const contentType = blob.type || 'application/octet-stream';
    return `data:${contentType};base64,${btoa(binary)}`;
}

export async function fileToDataUrl(file: File): Promise<string> {
    return blobToDataUrl(file);
}
