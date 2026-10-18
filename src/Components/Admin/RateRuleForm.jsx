import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

const today = new Date().toISOString().slice(0, 10)

export default function RateRuleForm({ unit, onSave, busy = false }) {
  const [values, setValues] = useState({ date_from: '', date_to: '', nightly_price: '', priority: '0' })
  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }
  return <form className="rate-rule-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...values, unit_id: unit.id, currency: unit.currency }) }}>
    <div className="form-grid"><label className="form-field"><span>First night</span><input type="date" min={today} name="date_from" value={values.date_from} onChange={change} required /></label><label className="form-field"><span>Available again</span><input type="date" min={values.date_from || today} name="date_to" value={values.date_to} onChange={change} required /></label><label className="form-field"><span>Nightly rate ({unit.currency})</span><input type="number" min="0" step="0.01" name="nightly_price" value={values.nightly_price} onChange={change} required /></label><label className="form-field"><span>Priority</span><input type="number" step="1" name="priority" value={values.priority} onChange={change} /></label></div><button className="button button-outline" disabled={busy}>{busy ? 'Saving…' : 'Add seasonal rate'} <ArrowRight size={15} /></button>
  </form>
}
