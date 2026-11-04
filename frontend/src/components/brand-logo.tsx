import centivaLogo from '@/assets/centiva-logo.svg'

interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className = '' }: BrandLogoProps) {
  return <img className={className} src={centivaLogo} alt="Centiva" />
}
