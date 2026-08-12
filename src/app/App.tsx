import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './auth/AuthContext';
import { router } from './routes';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="coverd-ui-theme">
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                'border border-[#DDE7E8] bg-white text-[#10283D] shadow-md group-[.toaster]:bg-white',
              title: 'text-[#13334F] font-semibold',
              description: 'text-[#607583]',
              actionButton: 'bg-[#53B59F] text-white',
              cancelButton: 'text-[#607583]',
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
