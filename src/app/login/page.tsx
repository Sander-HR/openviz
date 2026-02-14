"use client";

import { signIn } from "next-auth/react";
import { Github, Chrome } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-white p-4">
            <div className="w-full max-w-md space-y-8 bg-[#1A1A1A] p-10 rounded-2xl border border-[#2A2A2A] shadow-2xl">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-2xl font-bold italic">O</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">OpenViz</h1>
                    <p className="text-zinc-400">Sign in to your creative workspace</p>
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
                        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white rounded-lg font-medium transition-all border border-[#333]"
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
                    <p className="text-xs text-zinc-500">
                        By signing in, you agree to our Terms of Service <br /> and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
