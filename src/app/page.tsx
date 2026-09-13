'use client';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { TimeBar } from '@/components/TimeBar';
import { Overview } from '@/components/pages/Overview';
import { BasinGraph } from '@/components/pages/BasinGraph';
import { ZoneDetails } from '@/components/pages/ZoneDetails';
import { Satellite } from '@/components/pages/Satellite';
import { Historical } from '@/components/pages/Historical';
import { Alerts } from '@/components/pages/Alerts';
import { DataSources } from '@/components/pages/DataSources';
import { useSimulation } from '@/hooks/useSimulation';
import { checkMLHealth } from '@/services/mlPredictionService';
import type { PageId } from '@/types';

export default function Home() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [mlStatus, setMlStatus] = useState<{ online: boolean; algorithm: string }>({
    online: false,
    algorithm: 'XGBoost',
  });

  const { state, startEvent, stopEvent, resetEvent, step } = useSimulation();

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      const res = await checkMLHealth();
      if (mounted) {
        setMlStatus(res);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSelectZone = useCallback((id: string) => {
    setSelectedZoneId(id);
  }, []);

  const handlePageChange = useCallback((page: PageId) => {
    setActivePage(page);
  }, []);

  const activeAlerts = state.alerts.length;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Header
        state={state}
        activeAlerts={activeAlerts}
        mlOnline={mlStatus.online}
        mlAlgorithm={mlStatus.algorithm}
      />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <Sidebar
          activePage={activePage}
          onPageChange={handlePageChange}
          isRunning={state.isRunning}
          onStart={startEvent}
          onStop={stopEvent}
          onReset={resetEvent}
          onStep={step}
        />
        <main className="flex-1 min-h-0 h-full overflow-hidden bg-slate-950">
          {activePage === 'overview' && (
            <Overview state={state} selectedZoneId={selectedZoneId} onSelectZone={handleSelectZone} />
          )}
          {activePage === 'basin-graph' && (
            <BasinGraph state={state} selectedZoneId={selectedZoneId} onSelectZone={handleSelectZone} />
          )}
          {activePage === 'zone-details' && (
            <ZoneDetails state={state} selectedZoneId={selectedZoneId} onSelectZone={handleSelectZone} />
          )}
          {activePage === 'satellite' && <Satellite state={state} />}
          {activePage === 'historical' && <Historical />}
          {activePage === 'alerts' && <Alerts state={state} onSelectZone={handleSelectZone} />}
          {activePage === 'data-sources' && <DataSources />}
        </main>
      </div>
      <TimeBar state={state} onSeek={() => {}} />
    </div>
  );
}
