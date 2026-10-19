import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import './App.css';

const Configurator = lazy(() => import('./components/Configurator'));
const ShopPage = lazy(() => import('./components/ShopPage'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const DashboardApp = lazy(() => import('./dashboard/DashboardApp'));
const SignupPage = lazy(() => import('./components/signup/SignupPage'));
const LabPage = import.meta.env.DEV ? lazy(() => import('./lab/LabPage')) : null;
const PrivacyPage = lazy(() => import('./components/legal/LegalPage').then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => import('./components/legal/LegalPage').then((module) => ({ default: module.TermsPage })));

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
      {LabPage && <Route path="/lab" element={<Suspense fallback={null}><LabPage /></Suspense>} />}
      <Route path="/signup" element={<Suspense fallback={null}><SignupPage /></Suspense>} />
      <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPage /></Suspense>} />
      <Route path="/terms" element={<Suspense fallback={null}><TermsPage /></Suspense>} />
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
