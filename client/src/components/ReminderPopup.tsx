import { useNavigate } from 'react-router-dom';

export interface ReminderPopupProps {
  timeSlot: string;
  onFillNow: () => void;
  onSnooze: () => void;
  onSkip: () => void;
}

export default function ReminderPopup({ timeSlot, onFillNow, onSnooze, onSkip }: ReminderPopupProps) {
  const navigate = useNavigate();

  function handleFillNow() {
    onFillNow();
    navigate('/calendar');
  }

  return (
    <div className="reminder-popup" role="alert">
      <h4>⏰ 工时填写提醒</h4>
      <p>请填写过去一小时的工作内容：<strong>{timeSlot}</strong></p>
      <div className="reminder-actions">
        <button className="btn btn-primary" onClick={handleFillNow}>
          立即填写
        </button>
        <button className="btn btn-secondary" onClick={onSnooze}>
          稍后提醒
        </button>
        <button className="btn btn-ghost" onClick={onSkip}>
          跳过
        </button>
      </div>
    </div>
  );
}
