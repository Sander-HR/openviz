/** Returns the first image available in the system clipboard, if any. */
export async function readClipboardImage(): Promise<File | null> {
    if (!navigator.clipboard?.read) return null;
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            const imageType = item.types.find((type) => type.startsWith('image/'));
            if (!imageType) continue;
            const blob = await item.getType(imageType);
            return new File([blob], `clipboard-image.${imageType.split('/')[1] ?? 'png'}`, { type: imageType });
        }
    } catch (error) {
        console.warn('Unable to read an image from the clipboard', error);
    }
    return null;
}