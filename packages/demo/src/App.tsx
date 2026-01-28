import React, { useState, useRef } from 'react';
import { AspectPlayer } from '@aspect/player-react';
import { streams } from './streams';

function App() {
    const [currentStream, setCurrentStream] = useState(streams[0]);
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', gap: '20px' }}>
            <header>
                <h1>Stream Player SDK Demo</h1>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    {streams.map(stream => (
                        <button
                            key={stream.name}
                            onClick={() => {
                                log(`Switching to: ${stream.name}`);
                                setCurrentStream(stream);
                            }}
                            style={{
                                padding: '8px 16px',
                                background: currentStream.url === stream.url ? '#646cff' : '#333',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {stream.name}
                        </button>
                    ))}
                </div>
            </header>

            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                {/* Player Container */}
                <div style={{ flex: 2, background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                    <AspectPlayer
                        source={{ url: currentStream.url }}
                        title={currentStream.name}
                        autoplay={false}
                        controls={true}
                        debug={true}
                        onReady={() => log('Player ready')}
                        onPlay={() => log('Playing')}
                        onPause={() => log('Paused')}
                        onEnded={() => log('Ended')}
                        onError={(e) => log(`Error: ${e.message}`)}
                        onQualityChange={(level, auto) => log(`Quality changed: ${level?.height}p (Auto: ${auto})`)}
                        style={{ aspectRatio: '16/9' }}
                    />
                </div>

                {/* Logs */}
                <div style={{ flex: 1, background: '#222', padding: '10px', borderRadius: '8px', overflowY: 'auto' }}>
                    <h3>Event Logs</h3>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {logs.map((entry, i) => (
                            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #333' }}>{entry}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
