import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateUserSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validated = UpdateUserSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const updatedUser = await db
        .update(users)
        .set({
            name: validated.data.name,
            updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id))
        .returning();

    return NextResponse.json(updatedUser[0]);
}

export async function DELETE() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Assuming we just delete the user record, or mark as deleted.
    // For now, let's just implement deletion.
    try {
        await db.delete(users).where(eq(users.id, session.user.id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete user:", error);
        return NextResponse.json({ error: "Failed to delete account. Please contact support." }, { status: 500 });
    }
}
