import { describe, expect, it } from "vitest";

import { isMissingOrPlaceholder, mergeEnvContent } from "./setupUtils";

describe("setupUtils", () => {
    it("detects placeholder values", () => {
        expect(isMissingOrPlaceholder("replace_with_secret")).toBe(true);
        expect(isMissingOrPlaceholder("${DB_USER}")).toBe(true);
        expect(isMissingOrPlaceholder("")).toBe(true);
        expect(isMissingOrPlaceholder("postgres://postgres:postgres@localhost:5432/openviz")).toBe(false);
    });

    it("merges updates while preserving unrelated lines", () => {
        const input = [
            "# Comment",
            "DATABASE_URL=postgres://old",
            "NEXTAUTH_URL=http://localhost:3000",
            "",
        ].join("\n");

        const result = mergeEnvContent(input, {
            DATABASE_URL: "postgres://new",
            NEXTAUTH_SECRET: "abc123",
        });

        expect(result).toContain("# Comment");
        expect(result).toContain("DATABASE_URL=postgres://new");
        expect(result).toContain("NEXTAUTH_URL=http://localhost:3000");
        expect(result).toContain("NEXTAUTH_SECRET=abc123");
    });

    it("quotes values that contain spaces", () => {
        const input = "DEV_ADMIN_NAME=Admin\n";
        const result = mergeEnvContent(input, {
            DEV_ADMIN_NAME: "Demo Admin",
        });

        expect(result).toContain("DEV_ADMIN_NAME=\"Demo Admin\"");
    });
});
