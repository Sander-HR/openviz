"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { Github, Chrome } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
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

    const handleMouseEnter = () => {
        setIsHovering(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        setSplitPosition(50);
    };

    return (
        <div
            ref={containerRef}
            className="min-h-screen w-screen relative overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="absolute inset-0 w-screen h-screen">
                <Image
                    src="/images/login-sample-2.png"
                    alt="Background"
                    fill
                    className="object-cover w-full h-full"
                    priority
                    sizes="100vw"
                />
            </div>

            <div
                className="absolute inset-0 w-screen h-screen"
                style={{
                    clipPath: `inset(0 ${100 - splitPosition}% 0 0)`,
                }}
            >
                <Image
                    src="/images/login-sample-1.png"
                    alt="Foreground"
                    fill
                    className="object-cover w-full h-full"
                    priority
                    sizes="100vw"
                />
            </div>

            <div className="absolute inset-0 bg-black/40" />

            {isHovering && (
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10 pointer-events-none"
                    style={{
                        left: `${splitPosition}%`,
                    }}
                />
            )}

            <div className="relative z-20 min-h-screen flex flex-col items-start justify-center text-white p-4">
                <div className="w-[30vw] space-y-8 bg-black/60 backdrop-blur-sm p-10 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-6">
                            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
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
                                    callbackUrl: "/dashboard"
                                })}
                                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-all"
                            >
                                🚀 Dev Login ({process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL})
                            </button>
                        )}

                        <button
                            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all border border-white/20"
                        >
                            <Github size={20} />
                            Continue with GitHub
                        </button>

                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl transition-all font-medium group"
                        >
                            <Chrome size={20} className="group-hover:scale-110 transition-transform" />
                            Continue with Google
                        </button>
                    </div>

                    <div className="pt-8 text-center">
                        <p className="text-xs text-zinc-400">
                            By signing in, you agree to our Terms of Service <br /> and Privacy Policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
