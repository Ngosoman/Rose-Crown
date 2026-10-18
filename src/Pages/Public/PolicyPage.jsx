import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const content = {
  privacy: { title: 'Privacy, with care.', eyebrow: 'Privacy', intro: 'Rose-Crown uses the information you provide to manage stay requests, support your booking, and keep you informed about your reservation.', sections: [['What we collect', 'Booking contact details, stay dates, account information, and essential service records are stored in the Rose-Crown database. Payment card details are not collected by this application.'], ['How it is used', 'Property staff assigned to your stay may see the information needed to host you. Guest booking details are restricted from other guests and public visitors.'], ['Questions', 'Contact the property using the contact details provided with your booking. This notice must be reviewed for your jurisdiction before public launch.']] },
  terms: { title: 'A few useful details.', eyebrow: 'Terms', intro: 'Rose-Crown helps guests request stays and property teams manage reservations. A submitted request is not a confirmed booking.', sections: [['Booking requests', 'Dates are held temporarily while the property reviews a request. Your booking is confirmed only after the property approves it.'], ['Payment', 'No payment is taken through this website unless a configured payment provider is connected and its verified status is shown in your booking.'], ['Before launch', 'Property-specific terms, liability limits, governing law, and guest obligations must be supplied and reviewed by the operator.']] },
  contact: { title: 'We’re here to help.', eyebrow: 'Contact', intro: 'For questions about a stay, contact the property directly using the details in your booking confirmation.', sections: [['Booking support', 'Sign in to Rose-Crown to review your reservation reference and contact the property team.'], ['Property enquiries', 'Browse published stays to find a place that fits your trip. Contact details for each property will be shown when configured by its operator.']] },
}

export default function PolicyPage() {
  const { pathname } = useLocation()
  const key = pathname.slice(1)
  const page = content[key] || content.privacy
  return <section className="policy-page section-wrap"><Link className="back-link" to="/"><ArrowLeft size={15} /> Rose-Crown home</Link><div className="policy-heading"><span className="eyebrow">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.intro}</p></div><div className="policy-sections">{page.sections.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{body}</p></div></article>)}</div><Link className="text-link" to="/stays">Explore stays <ArrowRight size={15} /></Link></section>
}
