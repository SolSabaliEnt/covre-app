export type BadgeVariant = 'covered' | 'verified' | 'pending' | 'urgent' | 'preferred' | 'new' | 'missing' | 'expiring';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  covered: 'bg-[#E6F6F2] text-[#257665]',
  verified: 'bg-[#E6F6F2] text-[#257665]',
  pending: 'bg-[#FFF4E0] text-[#9B6419]',
  urgent: 'bg-[#FDEAEA] text-[#A93636]',
  preferred: 'bg-[#E8EEF2] text-[#13334F]',
  new: 'bg-[#EEF4F5] text-[#607583]',
  missing: 'bg-[#FDEAEA] text-[#A93636]',
  expiring: 'bg-[#FFF4E0] text-[#9B6419]',
};

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}
