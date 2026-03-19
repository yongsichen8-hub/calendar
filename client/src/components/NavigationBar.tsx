import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/calendar', label: '日历', icon: '📅' },
  { to: '/okr', label: 'OKR', icon: '🎯' },
  { to: '/inspiration', label: '灵感', icon: '💡' },
  { to: '/ledger', label: '台账', icon: '📒' },
];

function NavigationBar() {
  return (
    <nav className="nav-bar" role="navigation" aria-label="主导航">
      <div className="nav-brand">工时日历</div>
      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `nav-link${isActive ? ' nav-link--active' : ''}`
              }
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="nav-extra">
        <NavLink
          to="/categories"
          className={({ isActive }) =>
            `nav-link nav-link--small${isActive ? ' nav-link--active' : ''}`
          }
        >
          <span className="nav-icon" aria-hidden="true">🏷️</span>
          <span className="nav-label">分类</span>
        </NavLink>
      </div>
    </nav>
  );
}

export default NavigationBar;
