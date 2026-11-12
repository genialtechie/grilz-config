import { lazy, Suspense } from 'react';
import { loadable } from './lib/loadable';
import { Route, Routes } from 'react-router-dom';
import { BuilderShell } from './components/builder/BuilderShell';
import LandingPage from './components/landing/LandingPage';
import './App.css';

// The builder routes swap in the moment their code arrives (see loadable); the rest are plain lazy routes.
const Configurator = loadable(() => import('./components/Configurator'));
const ShopPage = loadable<{ slug?: string }>(() => import('./components/ShopPage'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const DashboardApp = lazy(() => import('./dashboard/DashboardApp'));
const SignupPage = lazy(() => import('./components/signup/SignupPage'));
const ClaimPage = lazy(() => import('./components/claim/ClaimPage'));
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
            <ShopPage slug={customDomainShop} fallback={<BuilderShell />} />
          ) : (
            <LandingPage />
          )
        }
      />
      <Route
        path="/configurator"
        element={<Configurator fallback={<BuilderShell />} />}
      />
      <Route
        path="/b/:slug/*"
        element={<ShopPage fallback={<BuilderShell />} />}
      />
      {LabPage && <Route path="/lab" element={<Suspense fallback={null}><LabPage /></Suspense>} />}
      <Route path="/signup" element={<Suspense fallback={null}><SignupPage /></Suspense>} />
      <Route path="/claim/*" element={<Suspense fallback={null}><ClaimPage /></Suspense>} />
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
