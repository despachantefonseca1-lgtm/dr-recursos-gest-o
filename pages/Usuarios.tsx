
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';

const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: '',
    email: '',
    password: '',
    role: UserRole.SECRETARIA,
    responsavelAcompanhamento: false
  });

  const load = async () => {
    const data = await api.getUsers();
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.updateUser(editingId, formData);
    } else {
      await api.createUser(formData);
    }
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({
      name: '', email: '', password: '',
      role: UserRole.SECRETARIA, responsavelAcompanhamento: false
    });
    load();
  };

  const startEdit = (user: User) => {
    setFormData(user);
    setEditingId(user.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (id === 'admin-main') {
      alert('Não é possível excluir o administrador mestre.');
      return;
    }
    if (confirm('Excluir acesso deste usuário permanentemente?')) {
      await api.deleteUser(id);
      load();
    }
  };

  if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-slate-400">Carregando usuários...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Controle de Acessos</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestão de colaboradores e permissões</p>
        </div>
        <Button
          onClick={() => { setIsFormOpen(!isFormOpen); setEditingId(null); }}
          className="px-8 py-4 rounded-3xl shadow-xl"
          icon="👤"
        >
          Novo Usuário
        </Button>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? "Editar Acesso" : "Novo Acesso"}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nome Completo"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Maria Souza"
          />
          <Input
            label="E-mail de Login"
            required
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="maria@drrecursos.com"
          />
          <Input
            label="Senha Provisória"
            required
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            placeholder="Mínimo 6 caracteres"
          />
          <Select
            label="Cargo / Papel"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value as any })}
          >
            <option value={UserRole.SECRETARIA}>Secretaria (Operacional)</option>
            <option value={UserRole.ADMIN}>Administrador (Total)</option>
          </Select>

          <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center space-x-4">
            <input
              type="checkbox"
              id="respCheck"
              className="w-5 h-5 accent-indigo-600"
              checked={formData.responsavelAcompanhamento}
              onChange={e => setFormData({ ...formData, responsavelAcompanhamento: e.target.checked })}
            />
            <label htmlFor="respCheck" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">
              Responsável por acompanhar status de julgamento (Recebe alertas de 15/30 dias)
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" className="px-10 py-4 rounded-3xl uppercase tracking-[0.2em]">
              {editingId ? 'Salvar Usuário' : 'Criar Acesso'}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usuarios.map(u => (
          <div key={u.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-110`} />

            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-200 font-black text-slate-400">
                {u.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-slate-900 leading-none">{u.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{u.role}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                <span>📧</span> <span className="truncate">{u.email}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                <span>🔑</span> <span className="font-mono">{u.password}</span>
              </div>
              {u.responsavelAcompanhamento && (
                <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100">
                  <span>🔔</span> <span>Monitorador de Status</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-50">
              <Button variant="ghost" size="sm" onClick={() => startEdit(u)} className="text-indigo-600 hover:bg-indigo-50">Configurar</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-rose-600 hover:bg-rose-50">Excluir</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Usuarios;
