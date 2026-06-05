import { BrowserRouter, Route, Routes } from 'react-router-dom';
import CarDetailPage from './pages/CarDetailPage.jsx';
import CarListPage from './pages/CarListPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CarListPage />} />
        <Route path="/cars/:id" element={<CarDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
