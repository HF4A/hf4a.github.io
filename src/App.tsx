import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CardGrid } from './components/CardGrid';
import { CardDetail } from './components/CardDetail';
import { ShowxatingShell } from './features/showxating';

export default function App() {
  return (
    <Routes>
      {/* SHOWXATING mode - full screen, no layout */}
      <Route path="/showxating/*" element={<ShowxatingShell />} />

      {/* Main app with layout */}
      <Route
        path="*"
        element={
          <Layout>
            {/* Always render the grid */}
            <CardGrid />

            {/* Modal overlay for card detail */}
            <Routes>
              <Route path="/" element={null} />
              <Route path="/card/:cardId" element={<CardDetail />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
