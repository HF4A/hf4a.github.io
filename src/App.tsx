import { Routes, Route, Navigate } from 'react-router-dom';
import { CatalogLayout } from './components/CatalogLayout';
import { CardGrid } from './components/CardGrid';
import { CardDetail } from './components/CardDetail';
import { ShowxatingShell } from './features/showxating';
import { useSettingsStore } from './store/settingsStore';

function DefaultRedirect() {
  const { defaultMode } = useSettingsStore();
  return <Navigate to={defaultMode === 'scan' ? '/showxating' : '/catalog'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Root redirects to default mode */}
      <Route path="/" element={<DefaultRedirect />} />

      {/* SHOWXATING mode - scan */}
      <Route path="/showxating/*" element={<ShowxatingShell />} />

      {/* Catalog mode */}
      <Route
        path="/catalog/*"
        element={
          <CatalogLayout>
            <CardGrid />
            <Routes>
              <Route path="/" element={null} />
              <Route path="/card/:cardId" element={<CardDetail />} />
            </Routes>
          </CatalogLayout>
        }
      />

      {/* Legacy card detail route - redirect to catalog */}
      <Route path="/card/:cardId" element={<Navigate to="/catalog/card/:cardId" replace />} />
    </Routes>
  );
}
