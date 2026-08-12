import { CovreBrandLogo } from '../../components/CovreBrandLogo';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/worker/welcome');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-[100svh] w-full max-w-full flex-col items-center justify-center overflow-x-hidden bg-[#0B1218] px-6 py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white">
      <CovreBrandLogo surface="dark" layout="stacked" width={280} className="px-2" />
      <p className="mt-8 text-center text-lg font-medium tracking-tight text-[#C9D4DC]">
        Care staffing. Covered.
      </p>
    </div>
  );
}
