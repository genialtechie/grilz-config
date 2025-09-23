import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import Configurator from './components/Configurator';
import './index.css';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage />}
      />
      <Route
        path="/configurator"
        element={<Configurator />}
      />
    </Routes>
  );
}

export default App;
