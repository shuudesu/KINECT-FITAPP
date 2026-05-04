import React from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, LayoutDashboard, NotebookPen, Users, LogOut, Menu, X, ShieldAlert, Timer } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ChangePasswordModal from '../components/ChangePasswordModal';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['atleta', 'treinador', 'admin', 'athlete', 'coach'] },
    { name: 'Workout Builder', path: '/builder', icon: NotebookPen, roles: ['treinador', 'coach'] },
    { name: 'Treino Hoje', path: '/session', icon: Activity, roles: ['atleta', 'athlete'] },
    { name: 'HIIT (Treinador)', path: '/coach-hiit', icon: Timer, roles: ['treinador', 'coach'] },
    { name: 'Meus Alunos', path: '/users', icon: Users, roles: ['treinador', 'coach'] },
    { name: 'Administração', path: '/admin', icon: ShieldAlert, roles: ['admin'] },
  ].filter(link => link.roles.includes(user.role || 'athlete'));

  const NavItem = ({ link }) => (
    <NavLink
      to={link.path}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-300",
          isActive 
            ? "bg-kinetic-neon text-kinetic-black" 
            : "text-kinetic-white hover:bg-kinetic-gray hover:text-kinetic-neon"
        )
      }
    >
      <link.icon className="w-5 h-5" />
      <span>{link.name}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-kinetic-dark flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-kinetic-black border-b border-kinetic-gray">
        <h1 className="text-2xl font-display font-bold tracking-wider text-kinetic-white">
          KINE<span className="text-kinetic-neon">TIC</span>
        </h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-kinetic-neon p-2 -mr-1 rounded-lg hover:bg-kinetic-gray/30 transition-colors"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Backdrop — fecha o menu ao tocar fora */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile overlay */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-kinetic-black border-r border-kinetic-gray transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:block">
          <h1 className="text-3xl font-display font-bold tracking-wider text-kinetic-white">
            KINE<span className="text-kinetic-neon">TIC</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navLinks.map((link) => (
            <NavItem key={link.name} link={link} />
          ))}
        </nav>

        <div className="p-4 border-t border-kinetic-gray">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-kinetic-dark">
             <div className="w-8 h-8 rounded-full bg-kinetic-neon flex items-center justify-center text-kinetic-black font-bold uppercase">
               {(user?.name || user?.email || 'U').charAt(0)}
             </div>
             <div className="overflow-hidden">
               <p className="truncate font-medium text-sm text-kinetic-white">{user?.name || user?.email?.split('@')[0]}</p>
               <p className="text-xs text-kinetic-neon capitalize">{user?.role || 'Aguardando'}</p>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-kinetic-white hover:bg-kinetic-gray hover:text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content Info */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-kinetic-dark p-4 md:p-8">
        <Outlet />
      </main>

      {user?.must_change_password && <ChangePasswordModal />}
    </div>
  );
};

export default MainLayout;
