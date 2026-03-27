import { useStore } from './store';
import { AppShell } from './components/layout/AppShell';
import { ProjectScreen } from './components/ProjectScreen';

function App() {
  const projectId = useStore(s => s.projectId);
  return projectId ? <AppShell /> : <ProjectScreen />;
}

export default App;
