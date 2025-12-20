import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CardGrid } from './components/CardGrid';
import { CardDetail } from './components/CardDetail';

export default function App() {
  return (
    <Layout>
      {/* Always render the grid */}
      <CardGrid />

      {/* Modal overlay for card detail */}
      <Routes>
        <Route path="/card/:cardId" element={<CardDetail />} />
      </Routes>
    </Layout>
  );
}
