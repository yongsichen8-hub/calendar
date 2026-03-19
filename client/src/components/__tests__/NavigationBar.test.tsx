import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import NavigationBar from '../NavigationBar';

function renderNav(route = '/calendar') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <NavigationBar />
    </MemoryRouter>,
  );
}

describe('NavigationBar', () => {
  it('renders brand name', () => {
    renderNav();
    expect(screen.getByText('工时日历')).toBeInTheDocument();
  });

  it('renders three main nav items', () => {
    renderNav();
    expect(screen.getByText('日历')).toBeInTheDocument();
    expect(screen.getByText('OKR')).toBeInTheDocument();
    expect(screen.getByText('灵感')).toBeInTheDocument();
  });

  it('renders category management link', () => {
    renderNav();
    expect(screen.getByText('分类')).toBeInTheDocument();
  });

  it('highlights the active nav item for /calendar', () => {
    renderNav('/calendar');
    const calendarLink = screen.getByText('日历').closest('a');
    expect(calendarLink?.className).toContain('nav-link--active');
  });

  it('highlights the active nav item for /okr', () => {
    renderNav('/okr');
    const okrLink = screen.getByText('OKR').closest('a');
    expect(okrLink?.className).toContain('nav-link--active');
  });

  it('highlights the active nav item for /inspiration', () => {
    renderNav('/inspiration');
    const link = screen.getByText('灵感').closest('a');
    expect(link?.className).toContain('nav-link--active');
  });

  it('does not highlight inactive nav items', () => {
    renderNav('/calendar');
    const okrLink = screen.getByText('OKR').closest('a');
    expect(okrLink?.className).not.toContain('nav-link--active');
  });

  it('has navigation role with accessible label', () => {
    renderNav();
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
  });
});
