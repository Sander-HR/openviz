export function installBrowserMeasures(evalPage) {
    return evalPage(`(() => {
        const state = { active: false, cursorOnlyPhase: false, visibilityState: document.visibilityState, fps: [], documentSyncMs: [], interactionLatencyMs: [], cursorLatencyMs: [], cursorOnlyGraphMutations: 0, graphMutations: 0 };
        window.__openvizCollabBench = state;
        let frames = 0;
        let frameStart = performance.now();
        state.begin = () => { state.active = true; frames = 0; frameStart = performance.now(); };
        state.end = () => { state.active = false; };
        const sampleFrame = (now) => {
            if (!state.active) {
                frames = 0;
                frameStart = now;
                requestAnimationFrame(sampleFrame);
                return;
            }
            frames += 1;
            if (now - frameStart >= 1000) {
                state.fps.push(frames * 1000 / (now - frameStart));
                frames = 0;
                frameStart = now;
            }
            requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
        window.addEventListener('openviz:collab-perf', (event) => {
            const { metric, value } = event.detail || {};
            if (!state.active) return;
            if (metric === 'documentSyncMs') state.documentSyncMs.push(value);
            if (metric === 'interactionLatencyMs') state.interactionLatencyMs.push(value);
            if (metric === 'cursorLatencyMs') state.cursorLatencyMs.push(value);
        });
        const observeGraph = () => {
            const graph = document.querySelector('.react-flow__nodes');
            if (!graph) { setTimeout(observeGraph, 100); return; }
            new MutationObserver((records) => {
                const changes = records.reduce((sum, record) => sum + record.addedNodes.length + record.removedNodes.length + (record.type === 'attributes' ? 1 : 0), 0);
                state.graphMutations += changes;
                if (state.cursorOnlyPhase) state.cursorOnlyGraphMutations += changes;
            }).observe(graph, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
        };
        observeGraph();
        return 'installed';
    })()`);
}
