export type EnvMap = Record<string, string>;

const PLACEHOLDER_PATTERNS = [
    "replace_with",
    "your_secret",
    "your-demo-password",
    "your_demo_password",
    "your_db",
    "${",
];

function formatEnvValue(value: string): string {
    if (value.includes(" ") || value.includes("#") || value.includes("\"")) {
        return `"${value.replaceAll("\"", "\\\"")}"`;
    }
    return value;
}

export function isMissingOrPlaceholder(value: string | undefined): boolean {
    if (!value || value.trim().length === 0) return true;
    return PLACEHOLDER_PATTERNS.some((pattern) => value.toLowerCase().includes(pattern));
}

export function mergeEnvContent(currentContent: string, updates: EnvMap): string {
    const lines = currentContent.split("\n");
    const writtenKeys = new Set<string>();

    const mergedLines = lines.map((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match) return line;

        const key = match[1];
        if (!(key in updates)) return line;

        writtenKeys.add(key);
        return `${key}=${formatEnvValue(updates[key])}`;
    });

    for (const [key, value] of Object.entries(updates)) {
        if (writtenKeys.has(key)) continue;
        mergedLines.push(`${key}=${formatEnvValue(value)}`);
    }

    return `${mergedLines.join("\n").trimEnd()}\n`;
}

export function parseEnvContent(content: string): EnvMap {
    const parsed: EnvMap = {};

    for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) continue;

        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex).trim();
        if (key.length === 0) continue;

        let value = line.slice(separatorIndex + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        parsed[key] = value;
    }

    return parsed;
}
