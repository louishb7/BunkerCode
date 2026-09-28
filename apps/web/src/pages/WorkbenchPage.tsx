import { useEffect } from 'react';
import { OrderDesk } from '../components/workbench/OrderDesk';
import { LastRunSummary } from '../components/workbench/LastRunSummary';
import { useWorkspace } from '../workspace/WorkspaceProvider';

export function WorkbenchPage() {
  const { refreshSystem } = useWorkspace();
  useEffect(() => { void refreshSystem(); }, [refreshSystem]);
  return <div className="mx-auto max-w-5xl"><OrderDesk /><LastRunSummary /></div>;
}
