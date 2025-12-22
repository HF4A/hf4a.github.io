import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { CatalogLayout } from './components/CatalogLayout';
import { CardGrid } from './components/CardGrid';
import { CardDetailView } from './components/CardDetailView';
import { ShowxatingShell } from './features/showxating';
import { useSettingsStore } from './store/settingsStore';

function DefaultRedirect() {
  const { defaultMode } = useSettingsStore();
  return <Navigate to={defaultMode === 'scan' ? '/showxating' : '/catalog'} replace />;
}

// Redirect legacy card routes to catalog
function LegacyCardRedirect() {
  const { cardId } = useParams();
  return <Navigate to={`/catalog/card/${cardId}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Root redirects to default mode */}
      <Route path="/" element={<DefaultRedirect />} />

      {/* SHOWXATING mode - scan */}
      <Route path="/showxating/*" element={<ShowxatingShell />} />

      {/* Catalog mode - grid view */}
      <Route
        path="/catalog"
        element={
          <CatalogLayout>
            <CardGrid />
          </CatalogLayout>
        }
      />

      {/* Catalog card detail - full screen overlay */}
      <Route path="/catalog/card/:cardId" element={<CardDetailView />} />

      {/* Legacy card detail route - redirect to catalog */}
      <Route path="/card/:cardId" element={<LegacyCardRedirect />} />
    </Routes>
  );
}
