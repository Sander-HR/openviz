import type { Metadata } from 'next';
import { GenerationNodeMockup } from '@/components/generation-lab/GenerationNodeMockup';

export const metadata: Metadata = {
    title: 'Generation Node Lab | OpenViz',
    description: 'Interactive mockup of a shared multi-mode generation node.',
};

export default function GenerationLabPage() {
    return <GenerationNodeMockup />;
}
