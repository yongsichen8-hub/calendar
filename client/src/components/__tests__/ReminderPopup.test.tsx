import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReminderPopup from '../ReminderPopup';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPopup(props?: Partial<React.ComponentProps<typeof ReminderPopup>>) {
  const defaultProps = {
    timeSlot: '09:00-10:00',
    onFillNow: vi.fn(),
    onSnooze: vi.fn(),
    onSkip: vi.fn(),
  };
  const merged = { ...defaultProps, ...props };
  return {
    ...render(
      <MemoryRouter>
        <ReminderPopup {...merged} />
      </MemoryRouter>,
    ),
    props: merged,
  };
}

describe('ReminderPopup', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the reminder heading and time slot', () => {
    renderPopup({ timeSlot: '14:00-15:00' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/工时填写提醒/)).toBeInTheDocument();
    expect(screen.getByText('14:00-15:00')).toBeInTheDocument();
  });

  it('renders three action buttons', () => {
    renderPopup();
    expect(screen.getByText('立即填写')).toBeInTheDocument();
    expect(screen.getByText('稍后提醒')).toBeInTheDocument();
    expect(screen.getByText('跳过')).toBeInTheDocument();
  });

  it('"立即填写" calls onFillNow and navigates to /calendar', () => {
    const { props } = renderPopup();
    fireEvent.click(screen.getByText('立即填写'));
    expect(props.onFillNow).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('"稍后提醒" calls onSnooze', () => {
    const { props } = renderPopup();
    fireEvent.click(screen.getByText('稍后提醒'));
    expect(props.onSnooze).toHaveBeenCalledTimes(1);
  });

  it('"跳过" calls onSkip', () => {
    const { props } = renderPopup();
    fireEvent.click(screen.getByText('跳过'));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('displays the prompt text about filling work content', () => {
    renderPopup({ timeSlot: '18:00-18:30' });
    expect(screen.getByText(/请填写过去一小时的工作内容/)).toBeInTheDocument();
    expect(screen.getByText('18:00-18:30')).toBeInTheDocument();
  });
});
