import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './components/Login.jsx';
import Cadastro from './components/Cadastro.jsx';
import Dashboard from './components/Dashboard.jsx';
import EmConstrucao from './components/EmConstrucao.jsx';
import Categorias from './components/Categorias.jsx';
import Lancamentos from './components/Lancamentos.jsx';

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      {/* Protegidas: ProtectedRoute redireciona para /login se não houver sessão */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/fontes-destinos" element={<EmConstrucao titulo="Fontes e destinos" />} />
          <Route path="/relatorios" element={<EmConstrucao titulo="Relatórios" />} />
          <Route path="/faturas" element={<EmConstrucao titulo="Faturas" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
