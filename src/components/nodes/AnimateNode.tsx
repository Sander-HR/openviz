import React from 'react';
import { Image as ImageIcon, Plus, X, Settings2 } from 'lucide-react';
import { AnimateNode as AnimateNodeType } from '../../types';

interface AnimateNodeProps {
    node: AnimateNodeType;
    selected: boolean;
    updateNode: (id: string, updates: any) => void;
}

const AnimateNode: React.FC<AnimateNodeProps> = ({ node, selected, updateNode }) => {
    return (
        <div
            className={`w-[320px] bg-[#1a1a1a] rounded-2xl p-4 shadow-2xl border transition-colors pointer-events-none ${selected ? 'border-primary' : 'border-[#333]'}`} // add thicker border
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium text-lg">Animate</h3>
            </div>

            {/* Frames Section */}
            <div className="mb-4 pointer-events-auto">
                <div className="text-gray-400 text-sm mb-2">Frames</div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-[#2a2a2a] pl-1 pr-3 py-1 rounded-lg border border-[#333] cursor-pointer hover:border-gray-600 transition-colors">
                        {node.data.frames.start ? (
                            <img src={node.data.frames.start} className="w-8 h-8 rounded object-cover bg-white" alt="Start" />
                        ) : (
                            <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center">
                                <ImageIcon size={14} className="text-gray-500" />
                            </div>
                        )}
                        <span className="text-white text-sm">Start</span>
                        <X size={14} className="text-gray-500 hover:text-white ml-1" />
                    </div>

                    <div className="text-gray-500">⇄</div>

                    <button className="flex items-center gap-2 bg-[#2a2a2a] px-3 py-2 rounded-lg border border-[#333] hover:bg-[#333] transition-colors">
                        <Plus size={16} className="text-gray-400" />
                        <span className="text-gray-300 text-sm">End</span>
                    </button>
                </div>
            </div>

            {/* Settings Section */}
            <div className="mb-4 pointer-events-auto">
                <div className="text-gray-400 text-sm mb-2">Settings</div>
                <div className="flex gap-2">
                    <button className="flex-1 bg-[#2a2a2a] text-white text-sm py-2 px-3 rounded-lg border border-[#333] flex items-center justify-between hover:border-gray-600 transition-colors">
                        Standard v2
                        <Settings2 size={14} className="text-gray-500" />
                    </button>
                    <button className="w-24 bg-[#2a2a2a] text-white text-sm py-2 px-3 rounded-lg border border-[#333] flex items-center justify-between hover:border-gray-600 transition-colors">
                        5 sec
                        <Settings2 size={14} className="text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Prompt Section */}
            <div className="mb-4 pointer-events-auto">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm relative">
                        Prompt <span className="text-xs text-gray-600">(optional)</span>
                    </span>
                    <button className="text-xs text-blue-400 hover:text-blue-300">Describe</button>
                </div>
                <div className="relative">
                    <textarea
                        className="w-full bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-white text-sm min-h-[100px] resize-none focus:outline-none focus:border-gray-600 placeholder-gray-600"
                        placeholder="Tell us how things should move or add a preset"
                        value={node.data.prompt}
                        onChange={(e) => updateNode(node.id, { data: { ...node.data, prompt: e.target.value } })}
                    />
                    <button className="absolute bottom-3 left-3 p-1.5 hover:bg-[#333] rounded-md transition-colors">
                        <div className="w-4 h-4 border-2 border-gray-500 rounded-sm border-t-transparent" />
                    </button>
                </div>
            </div>

            {/* Animate Button */}
            <button className="w-full bg-[#6366f1] hover:bg-[#5558e6] text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 pointer-events-auto">
                Animate
            </button>
        </div>
    );
};

export default AnimateNode;
