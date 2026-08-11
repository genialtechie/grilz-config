import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import './App.css';

const Configurator = lazy(() => import('./components/Configurator'));

function ConfiguratorLoader() {
  return (
    <div className="route-loader" role="status">
      <span />
      Loading custom commerce experience
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/configurator"
        element={
          <Suspense fallback={<ConfiguratorLoader />}>
            <Configurator />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default App;
