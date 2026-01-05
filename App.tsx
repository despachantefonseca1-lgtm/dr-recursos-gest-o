import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Recursos from './pages/Recursos';
import Despachante from './pages/Despachante';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Clientes from './pages/Despachante/Clientes'; // Legacy Despachante Clients
import Tarefas from './pages/Tarefas';
import ClienteDetalhes from './pages/Despachante/ClienteDetalhes';
import NovoServico from './pages/Despachante/NovoServico';

import Relatorios from './pages/Despachante/Relatorios';
import Caixa from './pages/Despachante/Caixa';
import CaixaRelatorio from './pages/Despachante/CaixaRelatorio';
import { LOGO_IMAGE } from './constants';
import { api } from './lib/api';
import { NotificationService } from './services/notificationService';
import { User, UserRole } from './types';

const PrivateRoute: React.FC<{ children: React.ReactElement; roles?: UserRole[] }> = ({ children, roles }) => {
  const user = api.getCurrentUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  useEffect(() => {
    NotificationService.runCheckups();
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${isLoginPage ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {!isLoginPage && <Header />}
      <main className={`flex-1 ${!isLoginPage ? 'container mx-auto px-4 py-8' : ''}`}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />

          <Route path="/recursos" element={
            <PrivateRoute>
              <Recursos />
            </PrivateRoute>
          } />

          <Route path="/tarefas" element={
            <PrivateRoute>
              <Tarefas />
            </PrivateRoute>
          } />

          {/* Despachante Module */}
          <Route path="/despachante" element={
            <PrivateRoute>
              <Despachante />
            </PrivateRoute>
          } />
          <Route path="/despachante/clientes" element={
            <PrivateRoute>
              <Clientes />
            </PrivateRoute>
          } />
          <Route path="/despachante/clientes/:id" element={
            <PrivateRoute>
              <ClienteDetalhes />
            </PrivateRoute>
          } />
          <Route path="/despachante/clientes/:id/novo-servico" element={
            <PrivateRoute>
              <NovoServico />
            </PrivateRoute>
          } />
          <Route path="/despachante/clientes/:id/servicos/:servicoId" element={
            <PrivateRoute>
              <NovoServico />
            </PrivateRoute>
          } />
          <Route path="/despachante/relatorios" element={
            <PrivateRoute>
              <Relatorios />
            </PrivateRoute>
          } />

          {/* Caixa Module */}
          <Route path="/despachante/caixa" element={
            <PrivateRoute>
              <Caixa />
            </PrivateRoute>
          } />
          <Route path="/despachante/caixa/relatorio" element={
            <PrivateRoute roles={[UserRole.ADMIN]}>
              <CaixaRelatorio />
            </PrivateRoute>
          } />

          <Route path="/usuarios" element={
            <PrivateRoute roles={[UserRole.ADMIN]}>
              <Usuarios />
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isLoginPage && (
        <footer className="bg-white border-t border-slate-200 py-8 text-center mt-12">
          <div className="flex flex-col items-center space-y-3">
            <img
              src={LOGO_IMAGE}
              alt="Logo Doutor Recursos"
              className="w-10 h-10 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default"
            />
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Doutor Recursos</p>
              <p className="text-[10px] text-slate-300">Internal Management System v1.1.0 © 2024</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
