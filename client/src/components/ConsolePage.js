import React from 'react';
import { useApp } from '../context/AppContext';

export default function ConsolePage() {
  const { logs } = useApp();

  return (
    <div className="glass-panel">
      <div className="section-label">{/* SYSTEM CONSOLE */} </div>
      <div className="console">
        {logs.map((log, index) => (
          <div key={index} className={`console-line ${log.type}`}>
            [{log.time}] {log.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
