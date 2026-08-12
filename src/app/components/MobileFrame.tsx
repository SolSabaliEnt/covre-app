interface MobileFrameProps {
  children: React.ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="min-h-screen bg-[#EEF4F5] flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] h-[844px] bg-white rounded-[3rem] shadow-2xl overflow-hidden border-8 border-[#13334F] relative">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-[#13334F] rounded-b-3xl z-50" />

        {/* Content */}
        <div className="h-full overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
