
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Infracoes from './pages/Infracoes';
import Tarefas from './pages/Tarefas';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import { LOGO_IMAGE } from './constants';
import { DbService } from './services/db';
import { User, UserRole } from './types';

const PrivateRoute: React.FC<{ children: React.ReactElement; roles?: UserRole[] }> = ({ children, roles }) => {
  const user = DbService.getCurrentUser();
  
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
          
          <Route path="/infracoes" element={
            <PrivateRoute>
              <Infracoes />
            </PrivateRoute>
          } />
          
          <Route path="/tarefas" element={
            <PrivateRoute>
              <Tarefas />
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
