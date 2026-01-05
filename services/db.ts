
import { Infracao, Tarefa, User, Notificacao, SyncLog, AppConfig, UserRole, StatusInfracao, FaseRecursal, PrioridadeTarefa, StatusTarefa, StatusLog } from '../types';

const DB_KEYS = {
  INFRACÕES: 'dr_recursos_infracoes',
  TAREFAS: 'dr_recursos_tarefas',
  USERS: 'dr_recursos_users',
  NOTIFICATIONS: 'dr_recursos_notifications',
  SYNC_LOGS: 'dr_recursos_sync_logs',
  CONFIG: 'dr_recursos_config',
  AUTH: 'dr_recursos_current_user'
};

const DEFAULT_USERS: User[] = [
  {
    id: 'admin-main',
    name: 'Administrador Geral',
    email: 'ifadvogado214437@gmail.com',
    password: 'Lcj133028',
    role: UserRole.ADMIN,
    responsavelAcompanhamento: true
  }
];

const DEFAULT_CONFIG: AppConfig = {
  googleSheetsId: '18TKzTVf0MLqSOqp0VBwincpk4bc0uYqDsQKN6vI4fK0',
  alertaPrazosDias: [7, 3, 1],
  diaAcompanhamentoMensal: 1
};

export class DbService {
  private static get<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  }

  private static set<T>(key: string, data: T): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  static getConfig(): AppConfig {
    return this.get(DB_KEYS.CONFIG, DEFAULT_CONFIG);
  }

  static saveConfig(config: AppConfig): void {
    this.set(DB_KEYS.CONFIG, config);
  }

  static getUsers(): User[] {
    return this.get(DB_KEYS.USERS, DEFAULT_USERS);
  }

  static saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.set(DB_KEYS.USERS, users);
  }

  static deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.set(DB_KEYS.USERS, users);
  }

  static getCurrentUser(): User | null {
    const userData = localStorage.getItem(DB_KEYS.AUTH);
    if (!userData) return null;
    return JSON.parse(userData);
  }

  static login(email: string, password?: string): User | null {
    const user = this.getUsers().find(u => u.email === email && u.password === password);
    if (user) {
      this.set(DB_KEYS.AUTH, user);
      return user;
    }
    return null;
  }

  static logout(): void {
    localStorage.removeItem(DB_KEYS.AUTH);
  }

  static getInfracoes(): Infracao[] {
    return this.get(DB_KEYS.INFRACÕES, []);
  }

  static saveInfracao(infracao: Infracao, userId: string, fromSheets = false): void {
    const infracoes = this.getInfracoes();
    const index = infracoes.findIndex(i => i.id === infracao.id);
    const now = new Date().toISOString();
    const updatedInfracao = { ...infracao, atualizadoEm: now };

    if (index >= 0) {
      infracoes[index] = updatedInfracao;
    } else {
      infracoes.push({ ...updatedInfracao, criadoEm: now });
    }
    this.set(DB_KEYS.INFRACÕES, infracoes);
  }

  static deleteInfracao(id: string, userId: string): void {
    const infracoes = this.getInfracoes().filter(i => i.id !== id);
    this.set(DB_KEYS.INFRACÕES, infracoes);
  }

  static getTarefas(): Tarefa[] {
    return this.get(DB_KEYS.TAREFAS, []);
  }

  static saveTarefa(tarefa: Tarefa, userId: string): void {
    const tarefas = this.getTarefas();
    const index = tarefas.findIndex(t => t.id === tarefa.id);
    if (index >= 0) {
      tarefas[index] = tarefa;
    } else {
      tarefas.push(tarefa);
    }
    this.set(DB_KEYS.TAREFAS, tarefas);
  }

  static addNotification(notification: Omit<Notificacao, 'id' | 'lida' | 'data'>): void {
    const all = this.get(DB_KEYS.NOTIFICATIONS, []);
    const newNotif: Notificacao = {
      ...notification,
      id: crypto.randomUUID(),
      lida: false,
      data: new Date().toISOString()
    };
    all.unshift(newNotif);
    this.set(DB_KEYS.NOTIFICATIONS, all);
  }

  static getNotifications(userId: string): Notificacao[] {
    const all = this.get(DB_KEYS.NOTIFICATIONS, []);
    return all.filter((n: any) => n.userId === userId);
  }

  static clearAllData(): void {
    // Keep the current user logged in if possible, or just wipe everything
    // Let's wipe everything except config for safety, or actually wipe everything to be clean
    // User requested "Clean Start".

    // Check if we want to save the user session?
    // Probably safer to force re-login to ensure clean state
    localStorage.clear();
    location.reload();
  }
}
