import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import './App.css';

const Configurator = lazy(() => import('./components/Configurator'));
const ShopPage = lazy(() => import('./components/ShopPage'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

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
      <Route
        path="/b/:slug/*"
        element={
          <Suspense fallback={<ConfiguratorLoader />}>
            <ShopPage />
          </Suspense>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<ConfiguratorLoader />}>
            <AdminApp />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default App;
