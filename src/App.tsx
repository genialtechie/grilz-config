import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import './App.css';

const Configurator = lazy(() => import('./components/Configurator'));
const ShopPage = lazy(() => import('./components/ShopPage'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const DashboardApp = lazy(() => import('./dashboard/DashboardApp'));

// On a shop's own domain (build.theirshop.com) the server marks the page with
// <meta name="vvs-shop">, and "/" is that shop's builder instead of our landing page.
const customDomainShop = typeof document === 'undefined' ? null : document.querySelector<HTMLMetaElement>('meta[name="vvs-shop"]')?.content || null;

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
      <Route
        path="/"
        element={
          customDomainShop ? (
            <Suspense fallback={<ConfiguratorLoader />}>
              <ShopPage slug={customDomainShop} />
            </Suspense>
          ) : (
            <LandingPage />
          )
        }
      />
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
        path="/dashboard/*"
        element={
          <Suspense fallback={<ConfiguratorLoader />}>
            <DashboardApp />
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
