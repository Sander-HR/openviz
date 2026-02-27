import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { renderService } from './services/apiRenderService';
import { Studio } from './components/Studio';
import { Workbench } from './components/workbench/workbench';

export const App: React.FC = () => {
    const { viewMode } = useStore();

    useEffect(() => {
        console.log('🚀 OpenViz App Mounted');
        renderService.checkConnection();
    }, []);

    return (
        <div className="w-full h-full">
            {viewMode === 'STUDIO' ? <Studio /> : <Workbench />}
        </div>
    );
};
