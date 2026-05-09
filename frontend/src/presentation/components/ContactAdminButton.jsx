import { Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../infrastructure/utils'

const ADMIN_EMAIL = 'ssantiago.xz1130@gmail.com'

export function ContactAdminButton({ label, subject = 'Sentinel - Solicitud de plan', className = '' }) {
  const { t } = useTranslation()
  const href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}`

  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest',
        'text-text-secondary hover:text-[#2ecc71] transition-colors duration-200',
        className
      )}
    >
      <Mail size={11} />
      {label || t('common.contactAdmin')}
    </a>
  )
}
