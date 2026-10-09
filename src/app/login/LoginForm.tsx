"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { Github, Chrome } from "lucide-react";
import Image from "next/image";

export default function LoginForm() {
    const [splitPosition, setSplitPosition] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [hasAnimated, setHasAnimated] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasAnimated) {
            const timer = setTimeout(() => {
                setSplitPosition(50);
                setHasAnimated(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [hasAnimated]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitPosition(Math.max(0, Math.min(100, x)));
    };

    return (
        <div
            ref={containerRef}
            className="relative min-h-[100svh] w-full overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => {
                setIsHovering(false);
                setSplitPosition(50);
            }}
        >
            <div className="absolute inset-0">
                <Image src="/images/login-sample-2.png" alt="" fill className="object-cover object-center" priority sizes="100vw" />
            </div>
            <div
                className="absolute inset-0 hidden lg:block"
                style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
            >
                <Image src="/images/login-sample-1.png" alt="" fill className="object-cover object-center" priority sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-black/40" />
            {isHovering && (
                <div
                    className="pointer-events-none absolute bottom-0 top-0 z-10 hidden w-0.5 bg-white/50 lg:block"
                    style={{ left: `${splitPosition}%` }}
                />
            )}
            <main className="relative z-20 flex min-h-[100svh] flex-col items-center justify-center px-4 py-8 text-white sm:px-6 lg:items-start lg:justify-center lg:pl-16 xl:pl-20">
                <div className="w-full max-w-md space-y-7 rounded-2xl border border-white/10 bg-black/60 p-6 shadow-2xl backdrop-blur-sm sm:p-8 lg:w-[30vw] lg:max-w-[30rem]">
                    <div className="space-y-2 text-center">
                        <div className="mb-6 flex justify-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
                                <span className="text-2xl font-bold italic">O</span>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">OpenViz</h1>
                        <p className="text-zinc-300">Sign in to your creative workspace</p>
                    </div>
                    <div className="space-y-3">
                        {process.env.NODE_ENV === "development" && (
                            <button
                                onClick={() => signIn("credentials", {
                                    email: process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL,
                                    password: process.env.NEXT_PUBLIC_DEMO_PASSWORD,
                                    callbackUrl: "/dashboard",
                                })}
                                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-yellow-600 px-3 py-2.5 text-center text-sm font-medium text-white transition-all hover:bg-yellow-500 sm:text-base"
                            >
                                🚀 Dev Login ({process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL})
                            </button>
                        )}
                        <button onClick={() => signIn("github", { callbackUrl: "/dashboard" })} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 font-medium text-white transition-all hover:bg-white/20">
                            <Github size={20} /> Continue with GitHub
                        </button>
                        <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-medium text-black transition-all hover:bg-zinc-200">
                            <Chrome size={20} className="transition-transform group-hover:scale-110" /> Continue with Google
                        </button>
                    </div>
                    <div className="pt-5 text-center sm:pt-6">
                        <p className="mx-auto max-w-[34ch] text-sm leading-5 text-zinc-400">By signing in, you agree to our Terms of Service and Privacy Policy.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
