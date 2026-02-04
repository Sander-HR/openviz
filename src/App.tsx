import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { renderService } from './services/renderService';
import Studio from './components/Studio';
import Workbench from './components/Workbench';

const App: React.FC = () => {
    const { viewMode } = useStore();

    useEffect(() => {
        console.log('🚀 OpenVizCom App Mounted');
        // Check ComfyUI connection on startup
        renderService.checkConnection();
    }, []);

    return (
        <div className="w-full h-full">
            {viewMode === 'STUDIO' ? <Studio /> : <Workbench />}
        </div>
    );
};

export default App;
