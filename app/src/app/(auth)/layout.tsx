export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-950 p-6">
      {children}
    </div>
  );
}
