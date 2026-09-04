import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LANDING_LOGO_SRC } from '../../lib/brand';

export default function Splash() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPreview = new URLSearchParams(location.search).get('adminPreview') === '1';

  useEffect(() => {
    if (isAdminPreview) return;
    const timer = setTimeout(() => {
      navigate('/worker/welcome');
    }, 2000);
    return () => clearTimeout(timer);
  }, [isAdminPreview, navigate]);

  return (
    <div className="flex min-h-[100svh] w-full max-w-full flex-col items-center justify-center overflow-x-hidden bg-[#0B243A] px-6 py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white">
      <img
        src={LANDING_LOGO_SRC}
        alt="Covre — Care staffing. Covered."
        className="block h-auto w-[260px] max-w-[82%] object-contain"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
