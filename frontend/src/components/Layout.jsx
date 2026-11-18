import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const itens = [
  ['/dashboard', 'Resumo'],
  ['/lancamentos', 'Lançamentos'],
  ['/categorias', 'Categorias'],
  ['/fontes-destinos', 'Fontes e destinos'],
  ['/relatorios', 'Relatórios'],
  ['/faturas', 'Faturas'],
  ['/saude-financeira', 'Saúde financeira'],
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const sair = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <aside className="menu">
        <strong className="menu__marca">Finanças</strong>
        <nav aria-label="Principal">
          {itens.map(([para, rotulo]) => (
            <NavLink key={para} to={para} className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
              {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="menu__usuario">
          <span>{usuario?.nome}</span>
          <button className="btn btn--discreto" onClick={sair}>Sair</button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
