import { Bell, Check, CircleAlert } from 'lucide-react'
import { formatStayDate, humanizeStatus } from '../../Utils/format'

export default function NotificationList({ notifications, onRead, showDelivery = false }) {
  if (notifications.length === 0) return <div className="notification-empty"><Bell size={18} /><span>No notifications yet.</span></div>
  return <div className="notification-list">{notifications.map((notification) => <article className={`notification-item ${notification.read_at ? 'is-read' : ''}`} key={notification.id}>
    <span className={`notification-icon ${notification.delivery_status === 'failed' ? 'notification-failed' : ''}`}>{notification.delivery_status === 'failed' ? <CircleAlert size={17} /> : <Bell size={16} />}</span>
    <div className="notification-copy"><div className="notification-title"><h3>{notification.title}</h3>{showDelivery && <span className={`delivery-pill delivery-${notification.delivery_status}`}>{humanizeStatus(notification.delivery_status)}</span>}</div><p>{notification.body}</p><div className="notification-meta"><span>{formatStayDate(notification.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><span>{humanizeStatus(notification.channel)}</span>{notification.last_error && <span className="notification-error-text">{notification.last_error}</span>}</div></div>
    {!notification.read_at && <button className="notification-read" aria-label={`Mark ${notification.title} as read`} onClick={() => onRead(notification.id)}><Check size={15} /></button>}
  </article>)}</div>
}
