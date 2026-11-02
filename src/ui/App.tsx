import { strings } from '../domain/strings';
import { Cofre } from './screens/Cofre';

// Cloudflare Access signs the owner in before the app loads (ADR-007), so there is no login screen.
export function App() {
  return (
    <div className="app">
      <header className="app-header row space-between align-center">
        <strong>{strings.appName}</strong>
      </header>
      <main>
        <Cofre />
      </main>
    </div>
  );
}
