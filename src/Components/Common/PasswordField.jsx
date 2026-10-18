import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordField({ label, value, onChange, autoComplete, minLength = 8, required = true }) {
  const [visible, setVisible] = useState(false)

  return <label className="form-field"><span>{label}</span><div className="password-control"><input aria-label={label} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} required={required} minLength={minLength} /><button className="password-toggle" type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
}